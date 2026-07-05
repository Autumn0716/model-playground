import { useMemo, useState, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AppSettings, CandidateGroup, CandidateModel, GeneralApiProfile, ModelGroup } from '../../types'
import { useStore } from '../../store'
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape'
import { PlusIcon, CloseIcon } from '../icons'

interface ModelPickerModalProps {
  profile: GeneralApiProfile
  candidateGroups: CandidateGroup[]
  onClose: () => void
  /** 提交设置变更(走 SettingsModal.commitSettings,保持 draft 同步) */
  onCommit: (next: AppSettings) => void
  /** 加载态:为 true 时显示骨架屏 */
  loading?: boolean
}

// 把匹配 query 的片段用黄底 <mark> 包裹,其余为纯文本
function renderHighlighted(text: string, query: string): ReactNode {
  if (!query.trim()) return text
  const q = query.trim().toLowerCase()
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/30 text-inherit rounded px-0.5">
        {text.slice(idx, idx + query.trim().length)}
      </mark>
      {text.slice(idx + query.trim().length)}
    </>
  )
}

// 生成新分组的唯一 ID
function createModelGroupId() {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export default function ModelPickerModal({ profile, candidateGroups, onClose, onCommit, loading = false }: ModelPickerModalProps) {
  const [query, setQuery] = useState('')
  // 折叠状态:记录哪些分组名被折叠(默认全部展开)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const settings = useStore((s) => s.settings)
  const showToast = useStore((s) => s.showToast)
  // 注:不调 usePreventBackgroundScroll —— 本弹窗通过 createPortal 渲染到 document.body,
  // 在 SettingsModal 的 scrollBoundaryRef 之外。SettingsModal 已锁定 body 滚动,
  // 这里只需依赖弹窗内部的 overflow-y-auto 自然滚动即可。
  useCloseOnEscape(true, onClose)

  const savedGroups = settings.modelGroups
  // 已保存分组的去重键集合(同 name + 同 profileId 视为重复)
  const savedGroupKeys = useMemo(() => {
    const set = new Set<string>()
    for (const group of savedGroups) {
      if (group.profileId === profile.id) set.add(`${group.name}@${group.profileId}`)
    }
    return set
  }, [savedGroups, profile.id])

  // 每个候选组对应的已保存分组(用于单模型累积)
  const savedGroupByCandidateName = useMemo(() => {
    const map = new Map<string, ModelGroup>()
    for (const group of savedGroups) {
      if (group.profileId === profile.id) map.set(group.name, group)
    }
    return map
  }, [savedGroups, profile.id])

  // 搜索过滤:分组名命中则整组保留,否则按模型 ID 过滤
  const filteredGroups = useMemo(() => {
    if (!query.trim()) return candidateGroups
    const q = query.trim().toLowerCase()
    return candidateGroups
      .map((group) => {
        const groupMatch = group.name.toLowerCase().includes(q)
        if (groupMatch) return group
        const matchedModels = group.models.filter((m) => m.id.toLowerCase().includes(q))
        return matchedModels.length ? { ...group, models: matchedModels } : null
      })
      .filter((g): g is CandidateGroup => g !== null)
  }, [candidateGroups, query])

  const addGroup = (group: CandidateGroup) => {
    const key = `${group.name}@${profile.id}`
    if (savedGroupKeys.has(key)) {
      showToast(`分组「${group.name}」已选中`, 'info')
      return
    }
    const now = Date.now()
    const newModelGroup: ModelGroup = {
      id: createModelGroupId(),
      name: group.name,
      profileId: profile.id,
      modelIds: group.models.map((m) => m.id),
      createdAt: now,
      updatedAt: now,
    }
    onCommit({ ...settings, modelGroups: [...savedGroups, newModelGroup] })
    showToast(`已添加分组「${group.name}」`, 'success')
  }

  // 单模型累积添加:加入候选组对应的保存分组(存在则 push,不存在则新建)
  const addSingleModel = (group: CandidateGroup, model: CandidateModel) => {
    const existing = savedGroupByCandidateName.get(group.name)
    if (existing) {
      if (existing.modelIds.includes(model.id)) {
        showToast(`模型「${model.id}」已在分组内`, 'info')
        return
      }
      onCommit({
        ...settings,
        modelGroups: savedGroups.map((g) => g.id === existing.id
          ? { ...g, modelIds: [...g.modelIds, model.id], updatedAt: Date.now() }
          : g),
      })
      showToast(`已添加「${model.id}」到分组「${group.name}」`, 'success')
    } else {
      const now = Date.now()
      onCommit({
        ...settings,
        modelGroups: [...savedGroups, {
          id: createModelGroupId(), name: group.name, profileId: profile.id,
          modelIds: [model.id], createdAt: now, updatedAt: now,
        }],
      })
      showToast(`已新建分组「${group.name}」并添加「${model.id}」`, 'success')
    }
  }

  const addAllFiltered = () => {
    if (filteredGroups.length === 0) return
    const now = Date.now()
    const toAdd: ModelGroup[] = filteredGroups
      .filter((g) => !savedGroupKeys.has(`${g.name}@${profile.id}`))
      .map((group) => ({
        id: createModelGroupId(),
        name: group.name,
        profileId: profile.id,
        modelIds: group.models.map((m) => m.id),
        createdAt: now,
        updatedAt: now,
      }))
    if (toAdd.length === 0) {
      showToast('当前搜索结果已全部选中', 'info')
      return
    }
    onCommit({ ...settings, modelGroups: [...savedGroups, ...toAdd] })
    showToast(`已添加 ${toAdd.length} 个分组`, 'success')
  }

  const toggleCollapse = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/50 bg-white/95 shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10 flex h-[80vh] flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between shrink-0 p-5 border-b border-gray-100 dark:border-white/[0.08]">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">选择模型</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-all duration-200 active:scale-[0.98] hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 p-4 border-b border-gray-100 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索模型 ID 或分组名..."
                className="w-full rounded-xl border border-gray-200/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03] px-3 py-2 text-sm text-gray-700 dark:text-gray-200 outline-none focus:border-blue-400"
              />
            </div>
            <button
              onClick={addAllFiltered}
              disabled={loading}
              className="shrink-0 rounded-xl bg-gray-900 dark:bg-white/10 px-3 py-2 text-sm font-medium text-white dark:text-white transition-all duration-200 active:scale-[0.98] hover:bg-gray-700 dark:hover:bg-white/20 disabled:opacity-50"
            >
              添加全部
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-4">
          {loading ? (
            // 骨架屏:获取中显示脉冲占位
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-gray-200 dark:border-white/[0.08] overflow-hidden animate-pulse">
                  <div className="px-4 py-3 bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-white/[0.08] rounded"></div>
                    <div className="h-3 w-16 bg-gray-100 dark:bg-white/[0.04] rounded mt-2"></div>
                  </div>
                  <div className="px-4 py-2 space-y-2">
                    <div className="h-3 w-48 bg-gray-100 dark:bg-white/[0.04] rounded"></div>
                    <div className="h-3 w-40 bg-gray-100 dark:bg-white/[0.04] rounded"></div>
                  </div>
                </div>
              ))}
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 pt-2">正在获取模型列表...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">未匹配到任何模型</p>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group) => {
                const isAdded = savedGroupKeys.has(`${group.name}@${profile.id}`)
                const isCollapsed = collapsed.has(group.name)
                const savedGroup = savedGroupByCandidateName.get(group.name)
                return (
                  <div key={group.name} className="rounded-2xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-white/[0.02]">
                      <button
                        onClick={() => toggleCollapse(group.name)}
                        className="min-w-0 flex items-center gap-1.5 text-left transition-all duration-200 active:scale-[0.98]"
                      >
                        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                            {renderHighlighted(group.name, query)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {group.models.length} 个模型{savedGroup ? `(已选 ${savedGroup.modelIds.length})` : ''}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => addGroup(group)}
                        disabled={isAdded}
                        className={`shrink-0 ml-3 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-[0.98] ${
                          isAdded
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 cursor-default'
                            : 'bg-gray-900 dark:bg-white/10 text-white dark:text-white hover:bg-gray-700 dark:hover:bg-white/20'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                            已选中
                          </>
                        ) : (
                          <>
                            <PlusIcon className="w-3.5 h-3.5" />
                            添加整组
                          </>
                        )}
                      </button>
                    </div>
                    {!isCollapsed && (
                      <ul className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                        {group.models.map((model) => {
                          const inSaved = savedGroup?.modelIds.includes(model.id) ?? false
                          return (
                            <li key={model.id} className="flex items-center justify-between gap-2 px-4 py-2">
                              <span className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">
                                {renderHighlighted(model.id, query)}
                              </span>
                              <button
                                onClick={() => addSingleModel(group, model)}
                                disabled={inSaved}
                                className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-xs transition-all duration-200 active:scale-[0.98] ${
                                  inSaved
                                    ? 'text-green-500 cursor-default'
                                    : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                                }`}
                                aria-label={inSaved ? `${model.id} 已添加` : `添加 ${model.id}`}
                                title={inSaved ? '已添加' : '添加此模型'}
                              >
                                {inSaved ? (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <PlusIcon className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
