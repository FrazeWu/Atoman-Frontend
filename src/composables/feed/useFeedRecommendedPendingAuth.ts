import { ref, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { apiRequestResult } from '@/api/client'
import type { FeedArticleSource, FeedItem, Post, TimelineItem } from '@/types'
import { subscriptionSourceId, type RecommendationItem } from './useFeedRecommendedHelpers'

interface UseFeedRecommendedPendingAuthOptions {
  route: RouteLocationNormalizedLoaded
  router: Router
  isAuthenticated: Ref<boolean>
  api: { url: string; blog: { posts: string } }
  channels: Ref<RecommendationItem[]>
  channelArticles: Ref<TimelineItem[]>
  selectedChannelSource: Ref<FeedArticleSource | null>
  openArticleSource: (item: RecommendationItem) => void
  openSource: (source: FeedArticleSource) => void
  onRestoreArticle: (article: TimelineItem) => void
}

export function useFeedRecommendedPendingAuth(options: UseFeedRecommendedPendingAuthOptions) {
  const {
    route,
    router,
    isAuthenticated,
    api,
    channels,
    channelArticles,
    selectedChannelSource,
    openArticleSource,
    openSource,
    onRestoreArticle,
  } = options

  const pendingSubscriptionRestored = ref(false)
  const pendingArticleRestored = ref(false)

  function restorePendingSubscriptionSource() {
    const sourceId = typeof route.query.subscribe_source_id === 'string'
      ? route.query.subscribe_source_id
      : ''
    if (pendingSubscriptionRestored.value || !isAuthenticated.value || !sourceId) return

    const item = channels.value.find((candidate) => subscriptionSourceId(candidate) === sourceId)
    if (item) {
      pendingSubscriptionRestored.value = true
      openArticleSource(item)
    } else {
      const type = route.query.subscribe_source_type
      const title = route.query.subscribe_source_title
      if ((type !== 'internal_channel' && type !== 'external_rss') || typeof title !== 'string' || !title.trim()) return
      pendingSubscriptionRestored.value = true
      openSource({
        id: sourceId,
        title,
        type,
        rssUrl: typeof route.query.subscribe_source_url === 'string' ? route.query.subscribe_source_url : undefined,
        subscribed: false,
      })
    }

    const query = { ...route.query }
    for (const key of ['subscribe_source_id', 'subscribe_source_type', 'subscribe_source_title', 'subscribe_source_url']) {
      delete query[key]
    }
    void router.replace({ query })
  }

  function handleArticleRequireAuth(payload: { articleId: string; action: 'star' | 'read_later' }) {
    if (isAuthenticated.value) return

    const query = {
      ...route.query,
      read_article_id: payload.articleId,
      article_action: payload.action,
    } as Record<string, string | string[] | null | undefined>

    if (selectedChannelSource.value) {
      query.subscribe_source_id = selectedChannelSource.value.id
      query.subscribe_source_type = selectedChannelSource.value.type
      query.subscribe_source_title = selectedChannelSource.value.title
      if (selectedChannelSource.value.rssUrl) {
        query.subscribe_source_url = selectedChannelSource.value.rssUrl
      }
    }

    const resolved = router.resolve?.({
      path: route.path || '/feed',
      query,
      hash: route.hash,
    })
    const search = new URLSearchParams(query as Record<string, string>).toString()
    const returnPath = resolved?.fullPath || `${route.path || '/feed'}${search ? `?${search}` : ''}`
    void router.push({ path: '/login', query: { redirect: returnPath } })
  }

  async function restorePendingArticle() {
    const articleId = typeof route.query.read_article_id === 'string'
      ? route.query.read_article_id
      : ''
    if (pendingArticleRestored.value || !isAuthenticated.value || !articleId) return

    pendingArticleRestored.value = true

    const query = { ...route.query }
    delete query.read_article_id
    delete query.article_action
    void router.replace({ query })

    let article: TimelineItem | null = null
    const fromChannel = channelArticles.value.find((candidate) => {
      if (candidate.type === 'feed_item' && candidate.feed_item?.id === articleId) return true
      if (candidate.type === 'post' && candidate.post?.id === articleId) return true
      return false
    })
    if (fromChannel) {
      article = fromChannel
    } else {
      try {
        const res = await apiRequestResult(`${api.blog.posts}/${encodeURIComponent(articleId)}`)
        const payload = res.data
        const postData = payload?.data || payload
        if (res.ok && postData && typeof postData === 'object' && 'id' in postData) {
          const post = postData as Post
          article = {
            type: 'post',
            post,
            is_read: false,
            published_at: post.published_at || post.created_at,
          } as TimelineItem
        }
      } catch {
        // fallback
      }
      if (!article) {
        try {
          const res = await apiRequestResult(`${api.url}/feed/items/${encodeURIComponent(articleId)}`)
          const payload = res.data
          const itemData = payload?.data || payload
          if (res.ok && itemData && typeof itemData === 'object' && 'id' in itemData) {
            const item = itemData as FeedItem
            article = {
              type: 'feed_item',
              feed_item: item,
              is_read: false,
              published_at: item.published_at || (item as { created_at?: string }).created_at || '',
            } as TimelineItem
          }
        } catch {
          // ignore
        }
      }
    }

    if (article) {
      onRestoreArticle(article)
    }
  }

  return {
    pendingSubscriptionRestored,
    pendingArticleRestored,
    restorePendingSubscriptionSource,
    handleArticleRequireAuth,
    restorePendingArticle,
  }
}
