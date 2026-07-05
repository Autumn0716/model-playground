import { useState, useRef, useEffect } from 'react'
import { PlusIcon, CopyIcon, TrashIcon } from '../icons'

export interface ProfileSidebarItem {
  id: string
  name: string
  /** 可选的副标题(如 provider 名、baseUrl 摘要) */
  subtitle?: string
}

interface ProfileSidebarProps {
  title: string
  items: ProfileSidebarItem[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: () => void
  onDuplicate: () => void
  onDelete: () => void
  /** 重命名 profile */
  onRename: (id: string, name: string) => void
  /** 新建/复制/删除按钮的文案定制 */
  createLabel?: string
}

/**
 * 第二栏:profile 列表(通用 API 和 图片 API 共用)。
 * 列出所有 profile,点击切换 activeId;双击名称可内联编辑;底部有新建/复制/删除操作。
 */
export default function ProfileSidebar({
  title,
  items,
  activeId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onRename,
  createLabel = '新建配置',
}: ProfileSidebarProps) {
  // 正在编辑名称的 profile id(null = 不在编辑)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 编辑框出现时自动聚焦并全选
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id)
    setEditValue(currentName)
  }

  const commitRename = () => {
    if (editingId) {
      const trimmed = editValue.trim()
      if (trimmed) onRename(editingId, trimmed)
      setEditingId(null)
    }
  }

  const cancelRename = () => {
    setEditingId(null)
  }

  return (
    <div className="w-full sm:w-[200px] shrink-0 flex flex-col border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
      <div className="shrink-0 px-3 pt-3 pb-1">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h4>
      </div>
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
        {items.map((item) => {
          const isActive = item.id === activeId
          const isEditing = item.id === editingId
          return (
            <div
              key={item.id}
              className={`rounded-lg transition-all duration-200 ${
                isActive ? 'bg-white dark:bg-white/[0.08] shadow-sm' : 'hover:bg-gray-100/80 dark:hover:bg-white/[0.04]'
              }`}
            >
              {isEditing ? (
                // 编辑模式:input 替代按钮
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') cancelRename()
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 bg-transparent border border-blue-400 outline-none"
                />
              ) : (
                // 正常模式:按钮,双击名称进入编辑
                <button
                  onClick={() => onSelect(item.id)}
                  onDoubleClick={() => startEditing(item.id, item.name)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 active:scale-[0.98] ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  title="单击切换,双击重命名"
                >
                  <div className="truncate">{item.name}</div>
                  {item.subtitle && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{item.subtitle}</div>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </nav>
      <div className="shrink-0 border-t border-gray-100 dark:border-white/[0.06] p-2 space-y-0.5">
        <button
          onClick={onCreate}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] transition-all duration-200 active:scale-[0.98] inline-flex items-center gap-1.5"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          {createLabel}
        </button>
        <button
          onClick={onDuplicate}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-white/[0.04] transition-all duration-200 active:scale-[0.98] inline-flex items-center gap-1.5"
        >
          <CopyIcon className="w-3.5 h-3.5" />
          复制当前
        </button>
        <button
          onClick={onDelete}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 active:scale-[0.98] inline-flex items-center gap-1.5"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          删除当前
        </button>
      </div>
    </div>
  )
}
