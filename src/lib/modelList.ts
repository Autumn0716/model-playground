import type { GeneralApiProfile } from '../types'
import { buildApiUrl, shouldUseApiProxy } from './devProxy'

// 拉取远端 /models 列表,返回模型 ID 数组
export async function fetchModelList(profile: GeneralApiProfile, signal?: AbortSignal): Promise<string[]> {
  const useApiProxy = shouldUseApiProxy(profile.apiProxy)
  const url = buildApiUrl(profile.baseUrl, 'models', undefined, useApiProxy)
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${profile.apiKey}` },
    cache: 'no-store',
    signal,
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`网络请求失败${msg ? `: ${msg}` : ''}`)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let detail = text.trim()
    try {
      const data = JSON.parse(text) as unknown
      if (typeof data === 'object' && data !== null) {
        const record = data as Record<string, unknown>
        const error = record.error
        const message = typeof error === 'object' && error !== null
          ? (error as Record<string, unknown>).message
          : typeof error === 'string'
            ? error
            : record.message
        if (typeof message === 'string') detail = message
      }
    } catch { /* 非 JSON 错误响应直接使用原文 */ }
    detail = detail.replace(/\s+/g, ' ').slice(0, 200)
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  const data: unknown = await response.json().catch(() => {
    throw new Error('响应格式异常: 不是有效 JSON')
  })
  if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).data)) {
    throw new Error('响应格式异常: 缺少 data 数组')
  }
  const ids = ((data as Record<string, unknown>).data as unknown[])
    .map((item: unknown) => (typeof item === 'object' && item !== null ? (item as Record<string, unknown>).id : null))
    .filter((id: unknown): id is string => typeof id === 'string' && id.trim() !== '')
  if (ids.length === 0) throw new Error('响应中没有可用模型')
  return ids
}
