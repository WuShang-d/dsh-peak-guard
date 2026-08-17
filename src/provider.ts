import {
  DEFAULT_DEEPSEEK_BASE_URL_HOSTS,
  DEFAULT_DEEPSEEK_MODEL_IDS,
  DEFAULT_DEEPSEEK_PROVIDER_IDS,
} from './constants.js'
import type { ProviderMatchingConfig } from './settings.js'

export interface ProviderDetectionInput {
  provider?: string
  providerName?: string
  model?: string
  baseURL?: string
  metadata?: Record<string, unknown>
}

export interface ProviderDetectionResult {
  deepseek: boolean
  reason: 'provider-id' | 'provider-name' | 'base-url' | 'model-id' | null
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

function configuredSet(values: readonly string[] | undefined, fallback: readonly string[]): Set<string> {
  return new Set((values ?? fallback).map(normalizeToken).filter(Boolean))
}

function hostOf(value: string): string | null {
  const raw = value.trim()
  if (raw.length === 0) return null
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

function hostnameMatches(hostname: string, configured: ReadonlySet<string>): boolean {
  for (const candidate of configured) {
    if (hostname === candidate || hostname.endsWith(`.${candidate}`)) return true
  }
  return false
}

function modelMatches(model: string, configured: ReadonlySet<string>): boolean {
  const normalized = normalizeToken(model)
  if (configured.has(normalized)) return true
  return /^deepseek-v\d+(?:\.\d+)?-(?:flash|pro)$/.test(normalized)
}

function metadataBaseURL(metadata: Record<string, unknown> | undefined): string | undefined {
  const candidates = [
    metadata?.baseURL,
    metadata?.baseUrl,
    metadata?.base_url,
    metadata?.endpoint,
    metadata?.url,
  ]
  const hit = candidates.find((value): value is string => typeof value === 'string')
  return hit
}

export function detectDeepSeekProvider(
  input: ProviderDetectionInput,
  config?: Partial<ProviderMatchingConfig>,
): ProviderDetectionResult {
  const providerIds = configuredSet(config?.providerIds, DEFAULT_DEEPSEEK_PROVIDER_IDS)
  const baseURLHosts = configuredSet(config?.baseURLHosts, DEFAULT_DEEPSEEK_BASE_URL_HOSTS)
  const modelIds = configuredSet(config?.modelIds, DEFAULT_DEEPSEEK_MODEL_IDS)

  const provider = input.provider === undefined ? '' : normalizeToken(input.provider)
  if (provider !== '' && providerIds.has(provider)) {
    return { deepseek: true, reason: 'provider-id' }
  }

  const providerName = input.providerName === undefined ? '' : normalizeToken(input.providerName)
  if (providerName === 'deepseek' || providerName === 'deepseek official') {
    return { deepseek: true, reason: 'provider-name' }
  }

  const baseURL = input.baseURL ?? metadataBaseURL(input.metadata)
  if (baseURL !== undefined) {
    const host = hostOf(baseURL)
    if (host !== null && hostnameMatches(host, baseURLHosts)) {
      return { deepseek: true, reason: 'base-url' }
    }
  }

  if (input.model !== undefined && modelMatches(input.model, modelIds)) {
    return { deepseek: true, reason: 'model-id' }
  }

  return { deepseek: false, reason: null }
}

export function isDeepSeekProvider(input: ProviderDetectionInput, config?: Partial<ProviderMatchingConfig>): boolean {
  return detectDeepSeekProvider(input, config).deepseek
}
