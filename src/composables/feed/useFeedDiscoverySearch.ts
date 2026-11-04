import { ref } from 'vue'
import { apiRequestResult } from '@/api/client'
import { useApi } from '@/composables/useApi'
import type { FeedExploreRecentItem, FeedExploreSource, TimelineItem } from '@/types'

export type ExploreSourcePayload = Partial<FeedExploreSource> & {
  rss_url?: string
  cover_url?: string
  subscription_count?: number
  recent_item_count?: number
  last_published_at?: string
  recent_items?: Array<{ id: string; title: string; published_at?: string }>
}

export type DiscoverySearchArticle = {
  id: string
  title: string
  summary: string
  sourceTitle: string
  targetPath: string
}

export function normalizeExploreSource(payload: ExploreSourcePayload): FeedExploreSource {
  return {
    id: payload.id || '',
    title: payload.title || '',
    rssUrl: payload.rssUrl ?? payload.rss_url,
    coverUrl: payload.coverUrl ?? payload.cover_url,
    category: payload.category || 'blog',
    subscriptionCount: payload.subscriptionCount ?? payload.subscription_count ?? 0,
    recentItemCount: payload.recentItemCount ?? payload.recent_item_count ?? 0,
    lastPublishedAt: payload.lastPublishedAt ?? payload.last_published_at,
    language_code: payload.language_code,
    subscribed: Boolean(payload.subscribed),
    platform: payload.platform,
    content_type: payload.content_type,
    recentItems: (payload.recentItems ?? payload.recent_items ?? []).map((item) => {
      const recent = item as FeedExploreRecentItem & { published_at?: string }
      return {
        id: recent.id,
        title: recent.title,
        publishedAt: recent.publishedAt ?? recent.published_at,
      }
    }),
  }
}

export function useFeedDiscoverySearch() {
  const api = useApi()
  const discoverySearchQuery = ref('')
  const discoverySearchOpen = ref(false)
  const discoverySearchLoading = ref(false)
  const discoverySearchError = ref('')
  const discoverySearchSources = ref<FeedExploreSource[]>([])
  const discoverySearchArticles = ref<DiscoverySearchArticle[]>([])

  let discoverySearchTimer: ReturnType<typeof setTimeout> | null = null
  let discoverySearchCloseTimer: ReturnType<typeof setTimeout> | null = null
  let discoverySearchController: AbortController | null = null
  let discoverySearchRequestId = 0

  function handleDiscoverySearchInput(value: string) {
    discoverySearchQuery.value = value
    discoverySearchOpen.value = true
    if (discoverySearchCloseTimer) clearTimeout(discoverySearchCloseTimer)
    if (discoverySearchTimer) clearTimeout(discoverySearchTimer)
    if (value.trim().length < 2) {
      discoverySearchSources.value = []
      discoverySearchArticles.value = []
      discoverySearchError.value = ''
      discoverySearchLoading.value = false
      return
    }
    discoverySearchTimer = setTimeout(() => {
      void searchDiscovery(value)
    }, 250)
  }

  function handleDiscoverySearchFocus() {
    if (discoverySearchCloseTimer) clearTimeout(discoverySearchCloseTimer)
    discoverySearchOpen.value = true
  }

  function handleDiscoverySearchBlur() {
    if (discoverySearchCloseTimer) clearTimeout(discoverySearchCloseTimer)
    discoverySearchCloseTimer = setTimeout(() => {
      discoverySearchOpen.value = false
    }, 150)
  }

  async function searchDiscovery(queryValue = discoverySearchQuery.value) {
    discoverySearchController?.abort()
    discoverySearchController = null
    const query = queryValue.trim()
    const requestId = ++discoverySearchRequestId
    if (query.length < 2) return

    discoverySearchLoading.value = true
    discoverySearchError.value = ''
    const controller = new AbortController()
    discoverySearchController = controller

    try {
      const [sourceRes, articleRes] = await Promise.all([
        apiRequestResult(`${api.url}/feed/explore/sources?page=1&limit=6&q=${encodeURIComponent(query)}`, { signal: controller.signal }),
        apiRequestResult(`${api.url}/feed/explore?page=1&page_size=6&q=${encodeURIComponent(query)}&sort=recent`, { signal: controller.signal }),
      ])
      if (requestId !== discoverySearchRequestId) return

      discoverySearchSources.value = sourceRes.ok && Array.isArray(sourceRes.data?.data)
        ? sourceRes.data.data.map((item: ExploreSourcePayload) => normalizeExploreSource(item))
        : []
      discoverySearchArticles.value = articleRes.ok && Array.isArray(articleRes.data?.data)
        ? (articleRes.data.data as TimelineItem[]).map((item: TimelineItem) => {
          if (item.type === 'post' && item.post) {
            return { id: item.post.id, title: item.post.title, summary: item.post.summary || '', sourceTitle: item.post.channel?.name || '', targetPath: `/posts/post/${item.post.id}` }
          }
          if ((item.type === 'feed_item' || item.type === 'project_update') && item.feed_item) {
            return { id: item.feed_item.id, title: item.feed_item.title, summary: item.feed_item.summary || '', sourceTitle: item.feed_item.feed_source?.title || '', targetPath: `/feed/item/${item.feed_item.id}` }
          }
          return null
        }).filter((item): item is DiscoverySearchArticle => Boolean(item))
        : []
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (requestId !== discoverySearchRequestId) return
      discoverySearchError.value = '搜索失败，请稍后重试'
    } finally {
      if (discoverySearchController === controller) discoverySearchController = null
      if (requestId === discoverySearchRequestId) discoverySearchLoading.value = false
    }
  }

  return {
    discoverySearchQuery,
    discoverySearchOpen,
    discoverySearchLoading,
    discoverySearchError,
    discoverySearchSources,
    discoverySearchArticles,
    handleDiscoverySearchInput,
    handleDiscoverySearchFocus,
    handleDiscoverySearchBlur,
    searchDiscovery,
  }
}
