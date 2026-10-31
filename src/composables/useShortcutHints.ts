import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getActivePinia } from 'pinia'
import { usePlayerStore } from '@/stores/player'

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

  let player: ReturnType<typeof usePlayerStore> | null = null
  try {
    const pinia = getActivePinia()
    player = pinia ? usePlayerStore(pinia) : null
  } catch {
    player = null
  }

  const currentPath = computed(() => route?.path || '')

  const isMediaModule = computed(() => {
    return /^\/(music|podcasts|videos)(\/|$)/.test(currentPath.value) || Boolean(player?.showLyrics)
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
        { key: '← / →', label: '快退 / 快进 5 秒', category: 'module' },
        { key: '↑ / ↓', label: '音量调节', category: 'module' },
        { key: 'M', label: '静音 / 取消静音', category: 'module' },
        { key: 'Shift + F', label: '展开 / 收起歌词', category: 'module' },
      )
    }
    return hints
  })

  const mediaGlobalShortcutHints = computed<ShortcutHint[]>(() => {
    if (!player?.currentSong) return []
    return [
      { key: 'Alt + Shift + Space', label: '全局 播放 / 暂停', category: 'global' },
      { key: 'Alt + Shift + ← / →', label: '全局 上一首 / 下一首', category: 'global' },
      { key: 'Alt + Shift + ↑ / ↓', label: '全局 音量调节', category: 'global' },
      { key: 'Alt + Shift + M', label: '全局 静音', category: 'global' },
      { key: 'Shift + F', label: '全局 歌词面板', category: 'global' },
    ]
  })

  const shortcutHints = computed<ShortcutHint[]>(() => {
    return [...commonShortcutHints, ...mediaGlobalShortcutHints.value, ...moduleShortcutHints.value]
  })

  return {
    commonShortcutHints,
    mediaGlobalShortcutHints,
    moduleShortcutHints,
    moduleSectionTitle,
    shortcutHints,
  }
}
