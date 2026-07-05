import { useState } from 'react'
import type { GeneralApiProfile, ModelHealthEntry } from '../../types'
import { useStore } from '../../store'
import { buildModelHealthKey, checkModelHealth } from '../../lib/modelHealth'
import { TrashIcon } from '../icons'

interface ModelRowProps {
  profile: GeneralApiProfile
  modelId: string
  onDelete: () => void
}

// 状态徽章:根据健康状态展示对应图标与文案
function StatusBadge({ entry }: { entry: ModelHealthEntry | undefined }) {
  if (!entry) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">● 未测</span>
  }
  const { status, latencyMs, error } = entry
  if (status === 'checking') {
    return (
      <span className="text-xs text-blue-500 dark:text-blue-400 inline-flex items-center gap-1">
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        检测中
      </span>
    )
  }
  if (status === 'ok') {
    return <span className="text-xs text-green-600 dark:text-green-400">✓ {latencyMs ?? 0}ms</span>
  }
  if (status === 'fail') {
    return (
      <span className="text-xs text-red-500 dark:text-red-400" title={error ?? ''}>
        ✗ 失败
      </span>
    )
  }
  return <span className="text-xs text-gray-400 dark:text-gray-500">● 未测</span>
}

export default function ModelRow({ profile, modelId, onDelete }: ModelRowProps) {
  // 从 store 读取该模型的健康状态及更新方法
  const health = useStore((s) => s.modelHealthMap[buildModelHealthKey(profile.id, modelId)])
  const setModelHealth = useStore((s) => s.setModelHealth)
  const showToast = useStore((s) => s.showToast)
  const [spinning, setSpinning] = useState(false)

  // 执行单模型测活
  const runCheck = async () => {
    const key = buildModelHealthKey(profile.id, modelId)
    setSpinning(true)
    setModelHealth(key, { status: 'checking', lastCheckedAt: Date.now(), latencyMs: null, error: null })
    try {
      const entry = await checkModelHealth(profile, modelId)
      setModelHealth(key, entry)
      if (entry.status === 'ok') {
        showToast(`${modelId} 测活成功(${entry.latencyMs}ms)`, 'success')
      } else {
        showToast(`${modelId} 测活失败:${entry.error}`, 'error')
      }
    } finally {
      setSpinning(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.02] rounded-lg">
      <div className="min-w-0 flex items-center gap-2">
        <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{modelId}</code>
        <StatusBadge entry={health} />
      </div>
      <div className="shrink-0 flex items-center gap-1">
        <button
          onClick={runCheck}
          disabled={spinning}
          className="rounded-md px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          测活
        </button>
        <button
          onClick={onDelete}
          className="rounded-md p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 active:scale-[0.98]"
          aria-label={`删除 ${modelId}`}
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
