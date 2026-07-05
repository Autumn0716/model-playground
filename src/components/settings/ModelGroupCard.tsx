import type { ModelGroup, GeneralApiProfile } from '../../types'
import { useStore } from '../../store'
import ModelRow from './ModelRow'
import { TrashIcon } from '../icons'

interface ModelGroupCardProps {
  group: ModelGroup
  profile: GeneralApiProfile
}

export default function ModelGroupCard({ group, profile }: ModelGroupCardProps) {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const clearModelHealthForModel = useStore((s) => s.clearModelHealthForModel)

  // 删除分组内单个模型:splice 出 modelIds,并清理测活缓存
  const deleteModel = (modelId: string) => {
    const nextModelIds = group.modelIds.filter((id) => id !== modelId)
    setSettings({
      ...settings,
      modelGroups: settings.modelGroups.map((g) =>
        g.id === group.id ? { ...g, modelIds: nextModelIds, updatedAt: Date.now() } : g,
      ),
    })
    clearModelHealthForModel(`${profile.id}:${modelId}`)
  }

  // 删除整个分组:弹确认框,确认后从 modelGroups 中移除
  const confirmDeleteGroup = () => {
    setConfirmDialog({
      title: '删除分组',
      message: `确定要删除分组「${group.name}」吗?该分组下 ${group.modelIds.length} 个模型将一并移除。`,
      action: () => {
        setSettings({
          ...settings,
          modelGroups: settings.modelGroups.filter((g) => g.id !== group.id),
        })
        // 清理该分组下所有模型的测活缓存,避免内存中残留孤儿条目
        group.modelIds.forEach((modelId) => clearModelHealthForModel(`${profile.id}:${modelId}`))
      },
    })
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-white/[0.02]">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{group.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">profile: {profile.name}</div>
        </div>
        <button
          onClick={confirmDeleteGroup}
          className="shrink-0 ml-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 active:scale-[0.98]"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          删除分组
        </button>
      </div>
      <div className="p-2">
        {group.modelIds.length === 0 ? (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">暂无模型</p>
        ) : (
          <div className="space-y-0.5">
            {group.modelIds.map((modelId) => (
              <ModelRow
                key={modelId}
                profile={profile}
                modelId={modelId}
                onDelete={() => deleteModel(modelId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
