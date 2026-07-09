import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GeneralApiProfile } from '../types'
import { fetchModelList } from './modelList'

const profile: GeneralApiProfile = {
  id: 'test-profile',
  name: '测试',
  baseUrl: 'https://ctmoai.com/v1',
  apiKey: 'sk-test',
  apiMode: 'chat',
  apiProxy: false,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchModelList', () => {
  it('uses GET /v1/models with Bearer authentication', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      object: 'list',
      data: [{ id: 'gpt-image-1', object: 'model', created: 1, owned_by: 'test' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await expect(fetchModelList(profile)).resolves.toEqual(['gpt-image-1'])
    expect(fetchMock).toHaveBeenCalledWith('https://ctmoai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: 'Bearer sk-test' },
      cache: 'no-store',
      signal: undefined,
    })
  })

  it('reports the API error message for a failed HTTP response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'Invalid API key', type: 'authentication_error' },
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }))

    await expect(fetchModelList(profile)).rejects.toThrow('HTTP 401: Invalid API key')
  })

  it('reports a network request failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchModelList(profile)).rejects.toThrow('网络请求失败: Failed to fetch')
  })

  it('reports a non-JSON success response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>upstream error</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }))

    await expect(fetchModelList(profile)).rejects.toThrow('响应格式异常: 不是有效 JSON')
  })

  it('reports an empty model list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      object: 'list',
      data: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await expect(fetchModelList(profile)).rejects.toThrow('响应中没有可用模型')
  })
})
