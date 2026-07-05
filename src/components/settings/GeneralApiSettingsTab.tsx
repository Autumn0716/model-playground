import { useEffect, useRef } from 'react'
import type { AppSettings, ModelHealthEntry } from '../../types'
import { useStore } from '../../store'
import { buildModelHealthKey, checkModelHealth } from '../../lib/modelHealth'
import GeneralApiProfilePanel from './GeneralApiProfilePanel'
import ModelGroupList from './ModelGroupList'

interface GeneralApiSettingsTabProps {
  draft: AppSettings
  commitSettings: (next: AppSettings) => void
}

export default function GeneralApiSettingsTab({ draft, commitSettings }: GeneralApiSettingsTabProps) {
  const activeProfile = draft.generalApiProfiles.find((p) => p.id === draft.generalActiveProfileId) ?? draft.generalApiProfiles[0]
  const showToast = useStore((s) => s.showToast)
  const batchSetModelHealth = useStore((s) => s.batchSetModelHealth)
  const setModelHealth = useStore((s) => s.setModelHealth)

  // 卸载或重入时中止未完成的全局测活,避免写入已卸载组件的状态
  const mountedRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  // 全局测活:遍历所有分组,按各自 profile 逐个探测
  const checkAllGlobally = async () => {
    const allKeys: Array<{ profile: NonNullable<typeof activeProfile>; modelId: string; key: string }> = []
    for (const group of draft.modelGroups) {
      const profile = draft.generalApiProfiles.find((p) => p.id === group.profileId)
      if (!profile) continue
      for (const modelId of group.modelIds) {
        allKeys.push({ profile, modelId, key: buildModelHealthKey(profile.id, modelId) })
      }
    }
    if (allKeys.length === 0) {
      showToast('没有可测活的模型', 'info')
      return
    }
    // 中止上一轮,启动新的
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    // 批量置为 checking,统一刷新 UI
    const checkingEntries: Record<string, ModelHealthEntry> = {}
    for (const item of allKeys) {
      checkingEntries[item.key] = { status: 'checking', lastCheckedAt: Date.now(), latencyMs: null, error: null }
    }
    batchSetModelHealth(checkingEntries)

    // 并发探测,逐个回写结果;绑定外部 signal,卸载时统一中止
    const results = await Promise.allSettled(
      allKeys.map(async (item) => {
        const entry = await checkModelHealth(item.profile, item.modelId, controller.signal)
        if (mountedRef.current && !controller.signal.aborted) setModelHealth(item.key, entry)
        return entry
      }),
    )
    if (!mountedRef.current || controller.signal.aborted) return
    const okCount = results.filter((r) => r.status === 'fulfilled' && r.value.status === 'ok').length
    const failCount = results.length - okCount
    showToast(`全局测活完成:${okCount} 正常,${failCount} 失败`, failCount > 0 ? 'info' : 'success')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">通用 API 配置</h4>
        <button
          onClick={checkAllGlobally}
          className="rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03] px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.06] transition-all duration-200 active:scale-[0.98]"
        >
          测活全部
        </button>
      </div>

      <GeneralApiProfilePanel settings={draft} onCommit={commitSettings} />

      <div className="flex items-center justify-between pt-2">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">模型分组管理</h4>
      </div>

      <ModelGroupList profile={activeProfile} />
    </div>
  )
}
