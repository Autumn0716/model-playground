import type { GeneralApiProfile, ModelHealthEntry } from '../types'
import { buildApiUrl, shouldUseApiProxy } from './devProxy'
import { getApiErrorMessage } from './imageApiShared'

/** 测活请求超时时间,30 秒(轻量请求,不需要图片 API 那种 600s 长超时) */
export const MODEL_HEALTH_TIMEOUT_MS = 30000

/** 测活使用的 token 上限,容错用 */
const MAX_TOKENS = 64

const PROBE_PROMPT = 'Hi!'

export function buildModelHealthKey(profileId: string, modelId: string): string {
  return `${profileId}:${modelId}`
}

function buildRequestBody(profile: GeneralApiProfile, modelId: string): Record<string, unknown> {
  if (profile.apiMode === 'responses') {
    return {
      model: modelId,
      input: PROBE_PROMPT,
      max_output_tokens: MAX_TOKENS,
    }
  }
  return {
    model: modelId,
    messages: [{ role: 'user', content: PROBE_PROMPT }],
    max_tokens: MAX_TOKENS,
  }
}

/**
 * 发送 Hi! 探测请求,验证模型可用性。
 * 成功(2xx)返回 ok,失败(4xx/5xx/网络异常)返回 fail,均带 latencyMs。
 */
export async function checkModelHealth(
  profile: GeneralApiProfile,
  modelId: string,
  signal?: AbortSignal,
): Promise<ModelHealthEntry> {
  const path = profile.apiMode === 'chat' ? 'chat/completions' : 'responses'
  const useApiProxy = shouldUseApiProxy(profile.apiProxy)
  const url = buildApiUrl(profile.baseUrl, path, undefined, useApiProxy)
  const body = buildRequestBody(profile, modelId)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MODEL_HEALTH_TIMEOUT_MS)

  // 合并外部 signal(用于取消批量测活)
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const start = performance.now()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const latencyMs = Math.round(performance.now() - start)
    const lastCheckedAt = Date.now()

    if (response.ok) {
      return { status: 'ok', lastCheckedAt, latencyMs, error: null }
    }

    // 保留状态码便于 UI 展示,后接 getApiErrorMessage 解析出的具体原因
    const detail = await getApiErrorMessage(response)
    const errorMsg = `HTTP ${response.status}: ${detail}`
    return { status: 'fail', lastCheckedAt, latencyMs, error: errorMsg }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const lastCheckedAt = Date.now()
    const aborted = err instanceof DOMException && err.name === 'AbortError'
    const errorMsg = aborted ? '请求超时' : (err instanceof Error ? err.message : String(err))
    return { status: 'fail', lastCheckedAt, latencyMs, error: errorMsg }
  } finally {
    clearTimeout(timeoutId)
  }
}
