import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GeneralApiProfile } from '../types'
import { checkModelHealth, buildModelHealthKey, MODEL_HEALTH_TIMEOUT_MS } from './modelHealth'

const chatProfile: GeneralApiProfile = {
  id: 'p1',
  name: 'test',
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  apiMode: 'chat',
  apiProxy: false,
}

const responsesProfile: GeneralApiProfile = {
  ...chatProfile,
  id: 'p2',
  apiMode: 'responses',
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('buildModelHealthKey', () => {
  it('builds key as profileId:modelId', () => {
    expect(buildModelHealthKey('p1', 'gpt-4o')).toBe('p1:gpt-4o')
  })
})

describe('checkModelHealth', () => {
  it('returns ok status with latency on 2xx for chat mode', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const result = await checkModelHealth(chatProfile, 'gpt-4o')

    expect(result.status).toBe('ok')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body).toMatchObject({ model: 'gpt-4o', max_tokens: 64 })
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi!' }])
  })

  it('returns ok status with latency on 2xx for responses mode', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const result = await checkModelHealth(responsesProfile, 'gpt-4o')

    expect(result.status).toBe('ok')
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body).toMatchObject({ model: 'gpt-4o', input: 'Hi!', max_output_tokens: 64 })
  })

  it('returns fail status on 4xx with error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'invalid api key' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }))

    const result = await checkModelHealth(chatProfile, 'gpt-4o')

    expect(result.status).toBe('fail')
    expect(result.error).toContain('401')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('returns fail status on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await checkModelHealth(chatProfile, 'gpt-4o')

    expect(result.status).toBe('fail')
    expect(result.error).toBe('Failed to fetch')
  })

  it('includes Authorization header with bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    await checkModelHealth(chatProfile, 'gpt-4o')

    const [, init] = fetchMock.mock.calls[0]
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-test')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('uses 30s timeout constant', () => {
    expect(MODEL_HEALTH_TIMEOUT_MS).toBe(30000)
  })
})
