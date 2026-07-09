import { useEffect, useRef, useState } from 'react'
import type { AppSettings, CandidateGroup, GeneralApiProfile, ModelHealthEntry } from '../../types'
import { useStore } from '../../store'
import { groupModelsByLcp } from '../../lib/modelGrouping'
import { buildModelHealthKey, checkModelHealth } from '../../lib/modelHealth'
import { isApiProxyAvailable, isApiProxyLocked } from '../../lib/devProxy'
import { fetchModelList } from '../../lib/modelList'
import ModelPickerModal from './ModelPickerModal'

interface GeneralApiProfilePanelProps {
  settings: AppSettings
  onCommit: (next: AppSettings) => void
}

// 生成短随机 ID
function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
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

  // 缓存 key:按 baseUrl + apiKey + apiMode 区分,存 sessionStorage(会话级)
  const modelCacheKey = `${activeProfile.baseUrl.trim()}|${activeProfile.apiKey.trim()}|${activeProfile.apiMode}`

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

    // 先尝试读缓存:有缓存就直接显示(瞬间),后台刷新
    let usedCache = false
    try {
      const cached = window.sessionStorage.getItem(`models:${modelCacheKey}`)
      if (cached) {
        const cachedIds = JSON.parse(cached) as string[]
        if (cachedIds.length > 0) {
          const groups = groupModelsByLcp(cachedIds)
          setCandidateGroups(groups)
          setShowPicker(true)
          setFetchingModels(true) // 仍显示 loading(后台刷新中)
          usedCache = true
        }
      }
    } catch { /* 缓存损坏则忽略 */ }

    if (!usedCache) {
      // 无缓存:开弹窗 + 骨架屏
      setFetchingModels(true)
      setCandidateGroups([])
      setShowPicker(true)
    }

    try {
      const ids = await fetchModelList(activeProfile, controller.signal)
      if (!mountedRef.current || controller.signal.aborted) return
      // 写缓存
      try { window.sessionStorage.setItem(`models:${modelCacheKey}`, JSON.stringify(ids)) } catch { /* 配额满则忽略 */ }
      const groups = groupModelsByLcp(ids)
      setCandidateGroups(groups)
      if (!usedCache) showToast(`获取到 ${ids.length} 个模型,分成 ${groups.length} 组`, 'success')
    } catch (err) {
      if (!mountedRef.current || controller.signal.aborted) return
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`获取模型失败:${msg}`, 'error')
      if (!usedCache) setShowPicker(false)
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
