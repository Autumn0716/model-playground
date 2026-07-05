import { useMemo } from 'react'
import type { AppSettings, GeneralApiProfile } from '../../types'
import { useStore } from '../../store'
import ModelGroupCard from './ModelGroupCard'

interface ModelGroupListProps {
  profile: GeneralApiProfile
  /** 提交设置变更(走 SettingsModal.commitSettings,保持 draft 同步) */
  onCommit: (next: AppSettings) => void
}

export default function ModelGroupList({ profile, onCommit }: ModelGroupListProps) {
  const modelGroups = useStore((s) => s.settings.modelGroups)
  const groupsForProfile = useMemo(
    () => modelGroups.filter((g) => g.profileId === profile.id),
    [modelGroups, profile.id],
  )

  // 空状态:虚线占位提示用户去获取模型
  if (groupsForProfile.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] p-8 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">还没有保存的模型分组</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">点击上方「获取模型」按钮开始</p>
      </div>
    )
  }

  // 有分组:逐个渲染卡片
  return (
    <div className="space-y-3">
      {groupsForProfile.map((group) => (
        <ModelGroupCard key={group.id} group={group} profile={profile} onCommit={onCommit} />
      ))}
    </div>
  )
}
