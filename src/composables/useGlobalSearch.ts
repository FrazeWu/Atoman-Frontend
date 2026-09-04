import { computed, ref, watch } from 'vue'
import { type ReferenceTarget, type ReferenceTargetType } from '@/api/references'
import { moduleRooms, type ModuleRoomKey } from '@/config/moduleRooms'
import { modulePathUrl } from '@/router/siteUrls'
import { useReferenceSearch } from '@/composables/useReferenceSearch'

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

const globalTargetTypes: readonly ReferenceTargetType[] = [
  'user',
  'post',
  'short_note',
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
  'channel',
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
  short_note: '短笺',
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
  const activeIndex = ref(-1)
  const sectionLimit = ref(2)
  const referenceSearch = useReferenceSearch({
    targetTypes: globalTargetTypes,
    limit: 2,
  })
  const error = computed(() => referenceSearch.failed.value ? '搜索暂不可用' : '')
  const sections = computed<GlobalSearchSection[]>(() => {
    const grouped = new Map<GlobalSearchSectionType, GlobalSearchItem[]>()
    for (const target of referenceSearch.results.value) {
      if (!target.available) continue
      const item = itemFromTarget(target)
      if (!item) continue
      if (item.type !== 'user' && options.isModuleVisible && !options.isModuleVisible(item.type)) continue
      const items = grouped.get(item.type) ?? []
      items.push(item)
      grouped.set(item.type, items)
    }

    return sectionOrder.flatMap((type) => {
      const items = grouped.get(type) ?? []
      if (items.length === 0) return []
      return [{
        type,
        label: type === 'user' ? '用户' : moduleRooms[type].name,
        items: interleaveItems(items, sectionLimit.value),
      }]
    })
  })

  const flatItems = computed(() => sections.value.flatMap((section) => section.items))
  const activeItem = computed(() => flatItems.value[activeIndex.value] ?? null)

  watch(referenceSearch.results, () => {
    activeIndex.value = flatItems.value.length > 0 ? 0 : -1
  })

  const clearResults = () => {
    activeIndex.value = -1
  }

  const search = async (nextQuery: string, mode: GlobalSearchMode = 'preview') => {
    query.value = nextQuery.trim()
    sectionLimit.value = mode === 'expanded' ? 6 : 2
    clearResults()
    await referenceSearch.search(query.value, sectionLimit.value)
  }

  const scheduleSearch = (nextQuery: string) => {
    query.value = nextQuery.trim()
    sectionLimit.value = 2
    clearResults()
    referenceSearch.schedule(query.value, 2)
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
    query.value = ''
    clearResults()
    referenceSearch.reset()
  }

  return {
    query,
    loading: referenceSearch.loading,
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
