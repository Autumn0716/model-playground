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
  /** 新建/复制/删除按钮的文案定制 */
  createLabel?: string
}

/**
 * 第二栏:profile 列表(通用 API 和 图片 API 共用)。
 * 列出所有 profile,点击切换 activeId;底部有新建/复制/删除操作。
 */
export default function ProfileSidebar({
  title,
  items,
  activeId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  createLabel = '新建配置',
}: ProfileSidebarProps) {
  return (
    <div className="w-full sm:w-[200px] shrink-0 flex flex-col border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]">
      <div className="shrink-0 px-3 pt-3 pb-1">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h4>
      </div>
      <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
        {items.map((item) => {
          const isActive = item.id === activeId
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? 'bg-white dark:bg-white/[0.08] shadow-sm text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-white/[0.04]'
              }`}
            >
              <div className="truncate">{item.name}</div>
              {item.subtitle && (
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{item.subtitle}</div>
              )}
            </button>
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
