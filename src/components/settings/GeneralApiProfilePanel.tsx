import { useEffect, useRef, useState } from 'react'
import type { AppSettings, CandidateGroup, GeneralApiProfile, ModelHealthEntry } from '../../types'
import { useStore } from '../../store'
import { groupModelsByLcp } from '../../lib/modelGrouping'
import { buildModelHealthKey, checkModelHealth } from '../../lib/modelHealth'
import { isApiProxyAvailable, isApiProxyLocked, shouldUseApiProxy, buildApiUrl } from '../../lib/devProxy'
import ModelPickerModal from './ModelPickerModal'

interface GeneralApiProfilePanelProps {
  settings: AppSettings
  onCommit: (next: AppSettings) => void
}

// 生成短随机 ID
function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// 拉取远端 /models 列表,返回模型 ID 数组
async function fetchModelList(profile: GeneralApiProfile, signal?: AbortSignal): Promise<string[]> {
  const useApiProxy = shouldUseApiProxy(profile.apiProxy)
  const url = buildApiUrl(profile.baseUrl, 'models', undefined, useApiProxy)
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${profile.apiKey}` },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  const data = await response.json()
  if (!data || !Array.isArray(data.data)) {
    throw new Error('响应格式异常:缺少 data 数组')
  }
  return data.data
    .map((item: unknown) => (typeof item === 'object' && item !== null ? (item as Record<string, unknown>).id : null))
    .filter((id: unknown): id is string => typeof id === 'string' && id.trim() !== '')
}

export default function GeneralApiProfilePanel({ settings, onCommit }: GeneralApiProfilePanelProps) {
  const profiles = settings.generalApiProfiles
  const activeProfileId = settings.generalActiveProfileId
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]
  const showToast = useStore((s) => s.showToast)
  const setModelHealth = useStore((s) => s.setModelHealth)
  const batchSetModelHealth = useStore((s) => s.batchSetModelHealth)

  const [showApiKey, setShowApiKey] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [candidateGroups, setCandidateGroups] = useState<CandidateGroup[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [batchChecking, setBatchChecking] = useState(false)

  // 卸载或重入时中止未完成的 fetch/测活,避免写入已卸载组件的状态
  const mountedRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const apiProxyAvailable = isApiProxyAvailable()
  const apiProxyLocked = isApiProxyLocked()

  // 局部更新当前激活的 profile
  const updateActiveProfile = (patch: Partial<GeneralApiProfile>) => {
    onCommit({
      ...settings,
      generalApiProfiles: profiles.map((p) => (p.id === activeProfile.id ? { ...p, ...patch } : p)),
    })
  }

  // 拉取模型列表并用 LCP 分组,打开选择弹窗
  const handleFetchModels = async () => {
    if (!activeProfile.baseUrl.trim()) {
      showToast('请先填写 Base URL', 'error')
      return
    }
    // 中止上一轮未完成的请求,启动新的
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setFetchingModels(true)
    // 渐进式:先开弹窗(空候选 + loading 骨架屏),让用户立即看到反馈
    setCandidateGroups([])
    setShowPicker(true)
    try {
      const ids = await fetchModelList(activeProfile, controller.signal)
      if (!mountedRef.current || controller.signal.aborted) return
      if (ids.length === 0) {
        showToast('未获取到模型', 'info')
        return
      }
      const groups = groupModelsByLcp(ids)
      setCandidateGroups(groups)
      showToast(`获取到 ${ids.length} 个模型,分成 ${groups.length} 组`, 'success')
    } catch (err) {
      if (!mountedRef.current || controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`获取模型失败:${msg}`, 'error')
      // 失败时关闭弹窗,避免空骨架屏长期停留
      setShowPicker(false)
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setFetchingModels(false)
    }
  }

  // 批量测活当前配置下所有模型
  const checkAllForCurrentProfile = async () => {
    const groupsForProfile = settings.modelGroups.filter((g) => g.profileId === activeProfile.id)
    const allKeys: string[] = []
    for (const group of groupsForProfile) {
      for (const modelId of group.modelIds) {
        allKeys.push(buildModelHealthKey(activeProfile.id, modelId))
      }
    }
    if (allKeys.length === 0) {
      showToast('当前配置下没有可测活的模型', 'info')
      return
    }
    // 中止上一轮,启动新的(批量测活共享一个 controller)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBatchChecking(true)
    // 先整体置为 checking
    const checkingEntries: Record<string, ModelHealthEntry> = {}
    for (const key of allKeys) {
      checkingEntries[key] = { status: 'checking', lastCheckedAt: Date.now(), latencyMs: null, error: null }
    }
    batchSetModelHealth(checkingEntries)

    // 并发测活,逐个回写结果;每个请求绑定外部 signal,卸载时统一中止
    const results = await Promise.allSettled(
      allKeys.map(async (key) => {
        const modelId = key.split(':').slice(1).join(':')
        const entry = await checkModelHealth(activeProfile, modelId, controller.signal)
        if (mountedRef.current && !controller.signal.aborted) setModelHealth(key, entry)
        return entry
      }),
    )
    if (!mountedRef.current || controller.signal.aborted) return
    setBatchChecking(false)
    const okCount = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'ok').length
    const failCount = results.length - okCount
    showToast(`测活完成:${okCount} 正常,${failCount} 失败`, failCount > 0 ? 'info' : 'success')
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] p-4 space-y-3">
      {/* 当前配置名(只读展示,切换在第二栏 ProfileSidebar) */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{activeProfile.name}</div>
      </div>

      {/* Base URL */}
      <div>
        <label className="block mb-1.5 text-sm text-gray-600 dark:text-gray-300">Base URL</label>
        <input
          type="text"
          value={activeProfile.baseUrl}
          onChange={(e) => updateActiveProfile({ baseUrl: e.target.value })}
          placeholder="https://api.example.com/v1"
          className="w-full rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400"
        />
      </div>

      {/* API Key */}
      <div>
        <label className="block mb-1.5 text-sm text-gray-600 dark:text-gray-300">API Key</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={activeProfile.apiKey}
            onChange={(e) => updateActiveProfile({ apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03] px-3 py-2 pr-10 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400 font-mono"
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all duration-200 active:scale-[0.98]"
            aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
          >
            {showApiKey ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {/* 接口模式 */}
      <div>
        <label className="block mb-1.5 text-sm text-gray-600 dark:text-gray-300">接口模式</label>
        <div className="flex gap-2">
          {(['chat', 'responses'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => updateActiveProfile({ apiMode: mode })}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-all duration-200 active:scale-[0.98] ${
                activeProfile.apiMode === mode
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                  : 'border-gray-200/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03] text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.06]'
              }`}
            >
              {mode === 'chat' ? 'Chat Completions' : 'Responses'}
            </button>
          ))}
        </div>
      </div>

      {/* API 代理 */}
      {apiProxyAvailable && (
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={apiProxyLocked || activeProfile.apiProxy}
            disabled={apiProxyLocked}
            onChange={(e) => updateActiveProfile({ apiProxy: e.target.checked })}
            className="rounded"
          />
          API 代理{apiProxyLocked && '(已锁定)'}
        </label>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleFetchModels}
          disabled={fetchingModels}
          className="flex-1 rounded-xl bg-gray-900 dark:bg-white/10 px-3 py-2 text-sm font-medium text-white dark:text-white hover:bg-gray-700 dark:hover:bg-white/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {fetchingModels ? '获取中...' : '获取模型'}
        </button>
        <button
          onClick={checkAllForCurrentProfile}
          disabled={batchChecking}
          className="rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.06] transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          {batchChecking ? '测活中...' : '测活当前配置'}
        </button>
      </div>

      {showPicker && (
        <ModelPickerModal
          profile={activeProfile}
          candidateGroups={candidateGroups}
          loading={fetchingModels}
          onCommit={onCommit}
          onClose={() => {
            setShowPicker(false)
            setCandidateGroups([])
          }}
        />
      )}
    </div>
  )
}
