import { computed, ref } from 'vue'
import { referenceApi, type ReferenceTarget, type ReferenceTargetType } from '@/api/references'
import { moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { modulePathUrl } from '@/router/siteUrls'

export type GlobalSearchSectionType = 'user' | ModuleRoomKey

export type GlobalSearchItem = {
  id: string
  type: GlobalSearchSectionType
  targetType: ReferenceTargetType
  title: string
  subtitle?: string
  meta: string
  href: string
}

export type GlobalSearchSection = {
  type: GlobalSearchSectionType
  label: string
  items: GlobalSearchItem[]
}

export type GlobalSearchMode = 'preview' | 'expanded'

type GlobalSearchOptions = {
  isModuleVisible?: (module: ModuleRoomKey) => boolean
}

const previewDelay = 250

const globalTargetTypes: readonly ReferenceTargetType[] = [
  'user',
  'post',
  'collection',
  'thread',
  'debate',
  'feed',
  'article',
  'artist',
  'album',
  'song',
  'playlist',
  'podcast',
  'episode',
  'video',
  'person',
  'event',
]

const sectionOrder: readonly GlobalSearchSectionType[] = [
  'user',
  'blog',
  'forum',
  'debate',
  'feed',
  'music',
  'podcast',
  'video',
  'timeline',
]

const targetLabels: Record<ReferenceTargetType, string> = {
  user: '用户',
  post: '文章',
  thread: '主题',
  debate: '辩题',
  feed: '订阅源',
  article: '文章',
  artist: '艺术家',
  album: '专辑',
  song: '歌曲',
  playlist: '歌单',
  podcast: '播客',
  episode: '单集',
  video: '视频',
  person: '人物',
  event: '事件',
  channel: '频道',
  collection: '合集',
  comment: '评论',
}

function isModuleRoomKey(value: string): value is ModuleRoomKey {
  return value in moduleRooms
}

function itemFromTarget(target: ReferenceTarget): GlobalSearchItem | null {
  if (target.type === 'user') {
    return {
      id: `${target.type}-${target.id}`,
      type: 'user',
      targetType: target.type,
      title: target.label,
      subtitle: target.subtitle,
      meta: targetLabels.user,
      href: target.path,
    }
  }
  if (!isModuleRoomKey(target.module)) return null
  return {
    id: `${target.type}-${target.id}`,
    type: target.module,
    targetType: target.type,
    title: target.label,
    subtitle: target.subtitle,
    meta: targetLabels[target.type],
    href: modulePathUrl(target.module, target.path),
  }
}

function interleaveItems(items: GlobalSearchItem[], limit: number) {
  const buckets = new Map<ReferenceTargetType, GlobalSearchItem[]>()
  for (const item of items) {
    const bucket = buckets.get(item.targetType) ?? []
    bucket.push(item)
    buckets.set(item.targetType, bucket)
  }

  const result: GlobalSearchItem[] = []
  for (let offset = 0; result.length < limit; offset += 1) {
    let added = false
    for (const bucket of buckets.values()) {
      const item = bucket[offset]
      if (!item) continue
      result.push(item)
      added = true
      if (result.length === limit) break
    }
    if (!added) break
  }
  return result
}

export function useGlobalSearch(options: GlobalSearchOptions = {}) {
  const query = ref('')
  const loading = ref(false)
  const error = ref('')
  const sections = ref<GlobalSearchSection[]>([])
  const activeIndex = ref(-1)
  let currentRequestId = 0
  let currentController: AbortController | null = null
  let previewTimer: ReturnType<typeof setTimeout> | null = null

  const flatItems = computed(() => sections.value.flatMap((section) => section.items))
  const activeItem = computed(() => flatItems.value[activeIndex.value] ?? null)

  const cancelPending = () => {
    if (previewTimer) {
      clearTimeout(previewTimer)
      previewTimer = null
    }
    currentController?.abort()
    currentController = null
  }

  const clearResults = () => {
    sections.value = []
    activeIndex.value = -1
    error.value = ''
    loading.value = false
  }

  const search = async (nextQuery: string, mode: GlobalSearchMode = 'preview') => {
    cancelPending()
    query.value = nextQuery.trim()
    const requestId = ++currentRequestId
    if (query.value.length < 2) {
      clearResults()
      return
    }

    const sectionLimit = mode === 'expanded' ? 6 : 2
    const controller = new AbortController()
    currentController = controller
    loading.value = true
    error.value = ''

    try {
      const targets = await referenceApi.search(globalTargetTypes, query.value, sectionLimit, controller.signal)
      if (requestId !== currentRequestId) return

      const grouped = new Map<GlobalSearchSectionType, GlobalSearchItem[]>()
      for (const target of targets) {
        if (!target.available) continue
        const item = itemFromTarget(target)
        if (!item) continue
        if (item.type !== 'user' && options.isModuleVisible && !options.isModuleVisible(item.type)) continue
        const items = grouped.get(item.type) ?? []
        items.push(item)
        grouped.set(item.type, items)
      }

      sections.value = sectionOrder.flatMap((type) => {
        const items = grouped.get(type) ?? []
        if (items.length === 0) return []
        return [{
          type,
          label: type === 'user' ? '用户' : moduleRooms[type].name,
          items: interleaveItems(items, sectionLimit),
        }]
      })
      activeIndex.value = flatItems.value.length > 0 ? 0 : -1
    } catch (cause) {
      if (requestId !== currentRequestId || controller.signal.aborted) return
      sections.value = []
      activeIndex.value = -1
      error.value = '搜索暂不可用'
    } finally {
      if (requestId === currentRequestId) {
        loading.value = false
        if (currentController === controller) currentController = null
      }
    }
  }

  const scheduleSearch = (nextQuery: string) => {
    cancelPending()
    currentRequestId += 1
    query.value = nextQuery.trim()
    clearResults()
    if (query.value.length < 2) return
    loading.value = true
    previewTimer = setTimeout(() => {
      previewTimer = null
      void search(query.value, 'preview')
    }, previewDelay)
  }

  const moveActive = (direction: 1 | -1) => {
    const total = flatItems.value.length
    if (total === 0) {
      activeIndex.value = -1
      return
    }
    if (activeIndex.value < 0) {
      activeIndex.value = 0
      return
    }
    activeIndex.value = (activeIndex.value + direction + total) % total
  }

  const reset = () => {
    cancelPending()
    currentRequestId += 1
    query.value = ''
    clearResults()
  }

  return {
    query,
    loading,
    error,
    sections,
    activeIndex,
    activeItem,
    flatItems,
    search,
    scheduleSearch,
    moveActive,
    reset,
  }
}
