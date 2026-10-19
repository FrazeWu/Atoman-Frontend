import { computed } from 'vue'
import { useRoute } from 'vue-router'

export interface ShortcutHint {
  key: string
  label: string
  category?: 'global' | 'module'
}

export const commonShortcutHints: ShortcutHint[] = [
  { key: 'H', label: '聚焦侧边栏', category: 'global' },
  { key: 'L', label: '聚焦内容区', category: 'global' },
  { key: 'J / K', label: '上下选择项目', category: 'global' },
  { key: 'Enter', label: '打开当前项目', category: 'global' },
  { key: '/', label: '打开全局搜索', category: 'global' },
  { key: '?', label: '打开快捷键说明', category: 'global' },
]

export function useShortcutHints() {
  let route: ReturnType<typeof useRoute> | null = null
  try {
    route = useRoute()
  } catch {
    route = null
  }

  const currentPath = computed(() => route?.path || '')

  const isMediaModule = computed(() => {
    return /^\/(music|podcasts|videos)(\/|$)/.test(currentPath.value)
  })

  const moduleSectionTitle = computed(() => {
    const path = currentPath.value
    if (path.startsWith('/feed') || path.startsWith('/posts')) {
      return '文章与短笺操作'
    }
    if (path.startsWith('/forum')) {
      return '论坛操作'
    }
    if (isMediaModule.value) {
      return '视听播放控制'
    }
    return null
  })

  const moduleShortcutHints = computed<ShortcutHint[]>(() => {
    const path = currentPath.value
    const hints: ShortcutHint[] = []
    if (path.startsWith('/feed') || path.startsWith('/posts')) {
      hints.push(
        { key: 'S', label: '收藏 / 取消收藏', category: 'module' },
        { key: 'M', label: '标记已读 / 未读', category: 'module' },
        { key: 'V', label: '查看原文', category: 'module' },
      )
    } else if (path.startsWith('/forum')) {
      hints.push(
        { key: 'N', label: '发起新话题', category: 'module' },
      )
    } else if (isMediaModule.value) {
      hints.push(
        { key: 'Space', label: '播放 / 暂停', category: 'module' },
        { key: 'Alt + ← / →', label: '上一首 / 下一首', category: 'module' },
        { key: '← / →', label: '快退 / 快进 5 秒', category: 'module' },
        { key: 'M', label: '静音', category: 'module' },
        { key: 'Shift + F', label: '打开歌词', category: 'module' },
      )
    }
    return hints
  })

  const shortcutHints = computed<ShortcutHint[]>(() => {
    return [...commonShortcutHints, ...moduleShortcutHints.value]
  })

  return {
    commonShortcutHints,
    moduleShortcutHints,
    moduleSectionTitle,
    shortcutHints,
  }
}
