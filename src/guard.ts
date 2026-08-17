import type {
  AgentLike,
  LoggerLike,
  LlmServiceLike,
  PreStepDecision,
  PreStepNext,
  PreStepPayload,
} from './dsh-types.js'
import { detectDeepSeekProvider } from './provider.js'
import type { ProviderDetectionInput } from './provider.js'
import { getPeakStatus } from './peak-hours.js'
import {
  normalizeSettings,
  type PeakGuardSettings,
} from './settings.js'
import type { PeakGuardConfirmation, PeakGuardPrompt } from './ui.js'
import { warningMessage } from './ui.js'

export interface PeakGuardRuntime {
  now(): Date
  confirm(prompt: PeakGuardPrompt & { agent: AgentLike; signal?: AbortSignal }): Promise<PeakGuardConfirmation>
  notify?(message: string, prompt: PeakGuardPrompt & { agent: AgentLike }): Promise<void> | void
  logger?: LoggerLike
  llm?: LlmServiceLike
}

export interface PeakGuardControllerOptions {
  settings(): PeakGuardSettings
  runtime: PeakGuardRuntime
}

type TurnKey = string

function sessionIdOf(agent: AgentLike): string {
  return String(agent.session.id)
}

function turnKey(agent: AgentLike, turn: number): TurnKey {
  return `${sessionIdOf(agent)}:${String(turn)}`
}

function hasUserInitiatedMessage(messages: readonly { source: { kind: string } }[]): boolean {
  return messages.some(message => message.source.kind === 'user')
}

function providerNameFromRegistry(llm: LlmServiceLike | undefined, provider: string | undefined): string | undefined {
  if (provider === undefined || llm?.listProviders === undefined) return undefined
  return llm.listProviders().find(info => info.id === provider)?.name
    ?? llm.listConfigurableProviders?.().find(info => info.provider === provider)?.displayName
}

function optionString(agent: AgentLike, key: string): string | undefined {
  const value = agent.options[key]
  return typeof value === 'string' ? value : undefined
}

export class PeakGuardController {
  private readonly sessionBypass = new Set<string>()
  private readonly authorizedTurns = new Set<TurnKey>()
  private readonly pendingTurns = new Map<TurnKey, Promise<PeakGuardConfirmation>>()

  constructor(private readonly options: PeakGuardControllerOptions) {}

  clearSessionBypass(sessionId: string): void {
    this.sessionBypass.delete(sessionId)
  }

  hasSessionBypass(sessionId: string): boolean {
    return this.sessionBypass.has(sessionId)
  }

  isTurnAuthorized(agent: AgentLike, turn: number): boolean {
    return this.authorizedTurns.has(turnKey(agent, turn))
  }

  async handlePreStep(payload: PreStepPayload, next: PreStepNext): Promise<PreStepDecision> {
    const downstream = await next()
    if (downstream.kind === 'reject') return downstream
    const settings = normalizeSettings(this.options.settings())
    const guardPrompt = this.buildPromptIfNeeded(payload, downstream, settings)
    if (guardPrompt === null) return downstream

    if (settings.mode === 'warn-only') {
      await this.warn(guardPrompt, payload.agent)
      this.authorizedTurns.add(turnKey(payload.agent, payload.turn))
      return downstream
    }

    const key = turnKey(payload.agent, payload.turn)
    try {
      const decision = await this.confirmOnce(key, {
        ...guardPrompt,
        agent: payload.agent,
        signal: payload.signal,
      })
      this.log(settings, `userDecision=${decision.action}`)
      if (decision.action !== 'run') return { kind: 'reject' }
      this.authorizedTurns.add(key)
      if (decision.sessionBypass) {
        this.sessionBypass.add(sessionIdOf(payload.agent))
      }
      return downstream
    } catch (error) {
      this.options.runtime.logger?.warn?.(`[PeakGuard] confirmation failed closed: ${String(error)}`)
      return { kind: 'reject' }
    }
  }

  private buildPromptIfNeeded(
    payload: PreStepPayload,
    downstream: Extract<PreStepDecision, { kind: 'enter' }>,
    settings: PeakGuardSettings,
  ): PeakGuardPrompt | null {
    if (!settings.enabled || settings.mode === 'off') return null
    if (payload.step !== 1) return null
    if (downstream.messages.length === 0) return null
    if (!hasUserInitiatedMessage(downstream.messages)) return null

    const sessionId = sessionIdOf(payload.agent)
    const key = turnKey(payload.agent, payload.turn)
    if (this.sessionBypass.has(sessionId) || this.authorizedTurns.has(key)) return null

    const provider = payload.agent.options.provider
    const model = payload.agent.options.model
    const providerName = providerNameFromRegistry(this.options.runtime.llm, provider)
    const baseURL = optionString(payload.agent, 'baseURL')
      ?? optionString(payload.agent, 'baseUrl')
      ?? optionString(payload.agent, 'base_url')
    const detectionInput: ProviderDetectionInput = {
      ...(provider === undefined ? {} : { provider }),
      ...(providerName === undefined ? {} : { providerName }),
      ...(model === undefined ? {} : { model }),
      ...(baseURL === undefined ? {} : { baseURL }),
    }
    const detection = detectDeepSeekProvider(detectionInput, settings.providerMatching)
    this.log(settings, `provider=${provider ?? ''} model=${model ?? ''} deepseek=${String(detection.deepseek)} reason=${detection.reason ?? 'none'}`)
    if (!detection.deepseek) return null

    const status = getPeakStatus(this.options.runtime.now(), settings.peak)
    this.log(settings, `localTime=${status.localTime} ${status.timezone} peak=${String(status.peak)}`)
    if (!status.peak) return null

    return {
      status,
      locale: settings.locale,
      showRemainingPeakTime: settings.showRemainingPeakTime,
      allowSessionBypass: settings.allowSessionBypass,
      deferRequested: settings.mode === 'defer-to-off-peak',
    }
  }

  private async confirmOnce(
    key: TurnKey,
    prompt: PeakGuardPrompt & { agent: AgentLike; signal?: AbortSignal },
  ): Promise<PeakGuardConfirmation> {
    const existing = this.pendingTurns.get(key)
    if (existing !== undefined) return existing
    const pending = this.options.runtime.confirm(prompt)
    this.pendingTurns.set(key, pending)
    try {
      return await pending
    } finally {
      this.pendingTurns.delete(key)
    }
  }

  private async warn(prompt: PeakGuardPrompt, agent: AgentLike): Promise<void> {
    const message = warningMessage(prompt)
    this.options.runtime.logger?.warn?.(`[PeakGuard] ${message}`)
    await this.options.runtime.notify?.(message, { ...prompt, agent })
  }

  private log(settings: PeakGuardSettings, message: string): void {
    if (settings.debug) this.options.runtime.logger?.debug?.(`[PeakGuard] ${message}`)
  }
}
