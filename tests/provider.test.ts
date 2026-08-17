import { describe, expect, it } from 'vitest'
import { detectDeepSeekProvider, isDeepSeekProvider } from '../src/provider.js'

describe('provider detection', () => {
  it.each([
    [{ provider: 'DeepSeek' }],
    [{ provider: 'deepseek' }],
    [{ provider: 'deepseek-official' }],
    [{ provider: 'deepseek-v4-flash' }],
    [{ providerName: 'DeepSeek' }],
    [{ baseURL: 'https://api.deepseek.com/v1' }],
    [{ baseURL: 'api.deepseek.com' }],
    [{ metadata: { base_url: 'https://api.deepseek.com' } }],
    [{ model: 'deepseek-v4-flash' }],
    [{ model: 'deepseek-v4-pro' }],
    [{ model: 'deepseek-v5-pro' }],
  ])('identifies DeepSeek route %#', (input) => {
    expect(isDeepSeekProvider(input)).toBe(true)
  })

  it.each([
    [{ provider: 'openai', model: 'gpt-5' }],
    [{ provider: 'anthropic', model: 'claude-sonnet-4' }],
    [{ provider: 'not-deepseek' }],
    [{ model: 'my-deepseek-proxy-model' }],
    [{ baseURL: 'https://api.notdeepseek.com' }],
  ])('does not use broad substring matching %#', (input) => {
    expect(isDeepSeekProvider(input)).toBe(false)
  })

  it('reports the strongest reason for a match', () => {
    expect(detectDeepSeekProvider({ provider: 'deepseek', model: 'gpt-5' })).toEqual({
      deepseek: true,
      reason: 'provider-id',
    })
    expect(detectDeepSeekProvider({ model: 'deepseek-chat' })).toEqual({
      deepseek: true,
      reason: 'model-id',
    })
  })

  it('honors custom provider matching config', () => {
    expect(isDeepSeekProvider(
      { provider: 'company-deepseek-gateway' },
      { providerIds: ['company-deepseek-gateway'] },
    )).toBe(true)
    expect(isDeepSeekProvider(
      { baseURL: 'https://deepseek.internal.example.com' },
      { baseURLHosts: ['deepseek.internal.example.com'] },
    )).toBe(true)
  })
})
