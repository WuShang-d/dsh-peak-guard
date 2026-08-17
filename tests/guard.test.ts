import { describe, expect, it, vi } from 'vitest'
import { PeakGuardController } from '../src/guard.js'
import { DEFAULT_PEAK_GUARD_SETTINGS, type PeakGuardSettings } from '../src/settings.js'
import type { AgentLike, PreStepDecision, PreStepPayload, UserMessage } from '../src/dsh-types.js'
import type { PeakGuardConfirmation } from '../src/ui.js'

function userMessage(text = 'hello'): UserMessage {
  return {
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

function pluginMessage(text = 'ctx'): UserMessage {
  return {
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'test' },
  }
}

function agent(provider: string, model: string, sessionId = 's1'): AgentLike {
  return {
    id: sessionId,
    options: { provider, model },
    session: { id: sessionId },
  }
}

function payload(input: {
  agent?: AgentLike
  messages?: UserMessage[]
  turn?: number
  step?: number
}): PreStepPayload {
  return {
    agent: input.agent ?? agent('deepseek-official', 'deepseek-v4-pro'),
    messages: input.messages ?? [userMessage()],
    turn: input.turn ?? 1,
    step: input.step ?? 1,
    signal: new AbortController().signal,
  }
}

function enter(messages: UserMessage[]): PreStepDecision {
  return { kind: 'enter', messages }
}

function makeController(input?: {
  settings?: Partial<PeakGuardSettings>
  now?: Date
  confirmations?: PeakGuardConfirmation[]
}) {
  const settings: PeakGuardSettings = {
    ...DEFAULT_PEAK_GUARD_SETTINGS,
    ...input?.settings,
    peak: {
      ...DEFAULT_PEAK_GUARD_SETTINGS.peak,
      ...input?.settings?.peak,
      periods: input?.settings?.peak?.periods ?? DEFAULT_PEAK_GUARD_SETTINGS.peak.periods,
    },
    providerMatching: {
      ...DEFAULT_PEAK_GUARD_SETTINGS.providerMatching,
      ...input?.settings?.providerMatching,
    },
  }
  const confirmations = [...input?.confirmations ?? [{ action: 'run', sessionBypass: false } satisfies PeakGuardConfirmation]]
  const confirm = vi.fn(async () => {
    const next = confirmations.shift()
    if (next === undefined) throw new Error('no scripted confirmation')
    return next
  })
  const notify = vi.fn()
  const logger = { warn: vi.fn(), debug: vi.fn() }
  const controller = new PeakGuardController({
    settings: () => settings,
    runtime: {
      now: () => input?.now ?? new Date('2026-01-02T02:00:00.000Z'),
      confirm,
      notify,
      logger,
      llm: {
        listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }],
      },
    },
  })
  return { controller, confirm, notify, logger }
}

async function run(
  controller: PeakGuardController,
  input: PreStepPayload,
  decision: PreStepDecision = enter(input.messages),
) {
  const next = vi.fn(async () => decision)
  const result = await controller.handlePreStep(input, next)
  return { result, next }
}

describe('PeakGuardController', () => {
  it('Scenario 1: OpenAI at 10:00 is not intercepted', async () => {
    const { controller, confirm } = makeController()
    const p = payload({ agent: agent('openai', 'gpt-5') })
    const { result, next } = await run(controller, p)
    expect(result).toEqual(enter(p.messages))
    expect(next).toHaveBeenCalledTimes(1)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('Scenario 2: DeepSeek at 08:00 is not intercepted', async () => {
    const { controller, confirm } = makeController({ now: new Date('2026-01-02T00:00:00.000Z') })
    const p = payload({})
    const { result } = await run(controller, p)
    expect(result).toEqual(enter(p.messages))
    expect(confirm).not.toHaveBeenCalled()
  })

  it('Scenario 3: DeepSeek at 10:00 in require-confirmation asks before entering', async () => {
    const { controller, confirm } = makeController()
    const p = payload({})
    const { result } = await run(controller, p)
    expect(result).toEqual(enter(p.messages))
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('Scenario 4: Run anyway preserves the original entered request exactly once', async () => {
    const { controller, confirm } = makeController({ confirmations: [{ action: 'run', sessionBypass: false }] })
    const p = payload({})
    const downstream = enter([p.messages[0]!, pluginMessage('downstream context')])
    const { result, next } = await run(controller, p, downstream)
    expect(result).toBe(downstream)
    expect(next).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('Scenario 5: Cancel rejects and produces no model-entering step', async () => {
    const { controller, confirm } = makeController({ confirmations: [{ action: 'cancel', sessionBypass: false }] })
    const p = payload({})
    const { result } = await run(controller, p)
    expect(result).toEqual({ kind: 'reject' })
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('Scenario 6: internal agent continuations do not prompt again', async () => {
    const { controller, confirm } = makeController()
    await run(controller, payload({ turn: 1, step: 1, messages: [userMessage()] }))
    await run(controller, payload({ turn: 1, step: 2, messages: [] }))
    await run(controller, payload({ turn: 1, step: 3, messages: [] }))
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('Scenario 7: repeated same-turn handling, as in retry recovery, does not prompt twice', async () => {
    const { controller, confirm } = makeController()
    const p = payload({ turn: 1, step: 1 })
    await run(controller, p)
    await run(controller, p)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('Scenario 8: session bypass applies only to the current session', async () => {
    const { controller, confirm } = makeController({
      confirmations: [
        { action: 'run', sessionBypass: true },
        { action: 'run', sessionBypass: false },
      ],
    })
    await run(controller, payload({ agent: agent('deepseek-official', 'deepseek-v4-pro', 's1'), turn: 1 }))
    await run(controller, payload({ agent: agent('deepseek-official', 'deepseek-v4-pro', 's1'), turn: 2 }))
    await run(controller, payload({ agent: agent('deepseek-official', 'deepseek-v4-pro', 's2'), turn: 1 }))
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('warn-only mode notifies but does not block', async () => {
    const { controller, confirm, notify } = makeController({ settings: { mode: 'warn-only' } })
    const p = payload({})
    const { result } = await run(controller, p)
    expect(result).toEqual(enter(p.messages))
    expect(confirm).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('fails closed when confirmation UI is unavailable', async () => {
    const { controller, confirm } = makeController()
    confirm.mockRejectedValueOnce(new Error('no provider'))
    const { result } = await run(controller, payload({}))
    expect(result).toEqual({ kind: 'reject' })
  })

  it('ignores plugin-only first-step context', async () => {
    const { controller, confirm } = makeController()
    const p = payload({ messages: [pluginMessage()] })
    const { result } = await run(controller, p)
    expect(result).toEqual(enter(p.messages))
    expect(confirm).not.toHaveBeenCalled()
  })
})
