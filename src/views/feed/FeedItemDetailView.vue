<template>
  <FeedSourceArticlesSheet
    v-if="!isMobileApp && articleSource && sourceSheetVisible"
    :show="sourceSheetVisible"
    :source="articleSource"
    :items="sourceArticles"
    :loading="sourceArticlesLoading"
    :subscribe-busy="sourceSubscribeBusy"
    :show-subscribe="authStore.isAuthenticated"
    :layer-index="0"
    :stack-size="articleSheetVisible ? 2 : 1"
    :is-shifted="articleSheetVisible"
    :is-top-layer="!articleSheetVisible"
    @close="close"
    @activate="articleSheetVisible = true"
    @subscribe="subscribeSource"
    @open-article="openSourceArticle"
  />

  <FeedArticleSheet
    v-if="article"
    :presentation="isMobileApp ? 'page' : 'sheet'"
    :index="sourceSheetVisible ? 1 : 0"
    :show="articleSheetVisible"
    :article="article"
    :reader="reader"
    :related-articles="routeState?.articles || sourceArticles"
    :source="articleSource"
    :show-source-subscribe="Boolean(articleSource)"
    :source-subscribe-busy="sourceSubscribeBusy"
    :is-podcast-playing="isPodcastPlaying"
    :has-previous="articleIndex > 0"
    :has-next="articleIndex >= 0 && articleIndex < (routeState?.articles.length ?? 0) - 1"
    @close="close"
    @open-source="openArticleSource"
    @subscribe-source="subscribeSource"
    @previous="openRelativeArticle(-1)"
    @next="openRelativeArticle(1)"
    @play-podcast="playPodcast"
  />

  <div v-else class="a-page-md feed-item-route">
    <div v-if="loading" class="feed-item-route__loading" aria-busy="true">
      <div class="a-skeleton" style="height: 2rem; width: 72%" />
      <div class="a-skeleton" style="height: 1rem; width: 40%" />
      <div v-for="index in 8" :key="index" class="a-skeleton" style="height: 1rem" />
    </div>
    <PEmpty v-else text="内容不存在或已被删除" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { apiRequestResult } from '@/api/client'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useApi } from '@/composables/useApi'
import { feedArticleRouteState, readFeedArticleRouteState, type FeedArticleRouteState } from '@/composables/feed/feedArticleRouteState'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { useFeedStore } from '@/stores/feed'
import type { FeedArticleSource, FeedItem, FeedItemDetail, FeedItemReader, TimelineItem } from '@/types'
import { reportError } from '@/utils/logger'
import { isStandaloneMobileApp } from '@/utils/appRuntime'

const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const playerStore = usePlayerStore()
const feedStore = useFeedStore()
const isMobileApp = isStandaloneMobileApp()

const loading = ref(false)
const articleSheetVisible = ref(true)
const sourceSheetVisible = ref(Boolean(readFeedArticleRouteState()?.source))
const sourceArticlesLoading = ref(false)
const sourceSubscribeBusy = ref(false)
const routeState = ref<FeedArticleRouteState | null>(readFeedArticleRouteState())
const sourceArticles = ref<TimelineItem[]>(routeState.value?.sourceArticles || [])
const item = ref<FeedItem | null>(null)
const reader = ref<FeedItemReader | null>(null)
const article = computed<TimelineItem | null>(() => item.value ? ({
  type: 'feed_item',
  feed_item: item.value,
  published_at: item.value.published_at,
  is_read: true,
}) : null)
const isPodcastPlaying = computed(() => (
  Boolean(item.value?.enclosure_url)
  && playerStore.currentSong?.audio_url === item.value?.enclosure_url
  && playerStore.isPlaying
))

const articleSource = computed<FeedArticleSource | null>(() => {
  if (routeState.value?.source) return routeState.value.source
  const feedItem = item.value
  if (!feedItem?.feed_source_id) return null
  const subscription = feedStore.subscriptions.find((entry) => (
    entry.feed_source_id === feedItem.feed_source_id
    || entry.feed_source?.id === feedItem.feed_source_id
  ))
  return {
    type: 'external_rss',
    id: feedItem.feed_source?.id || feedItem.feed_source_id,
    title: feedItem.feed_source?.title || 'RSS',
    rssUrl: feedItem.feed_source?.rss_url,
    subscriptionId: subscription?.id,
    subscribed: Boolean(subscription),
  }
})
const articleIndex = computed(() => routeState.value?.articles.findIndex(
  (entry) => entry.type === 'feed_item' && entry.feed_item?.id === item.value?.id,
) ?? -1)

function openRelativeArticle(offset: -1 | 1) {
  const next = routeState.value?.articles[articleIndex.value + offset]
  if (next?.type !== 'feed_item' || !next.feed_item) return
  const state = { ...routeState.value!, article: next }
  void router.replace({ path: `/feed/item/${next.feed_item.id}`, state: feedArticleRouteState(state) })
}

function close() {
  void router.push('/feed')
}

async function fetchSourceArticles(source: FeedArticleSource) {
  sourceArticlesLoading.value = true
  try {
    const params = new URLSearchParams({ limit: '100' })
    if (source.subscriptionId) params.set('source_id', source.subscriptionId)
    else params.set('feed_source_id', source.id)
    const response = await apiRequestResult(`${api.url}/feed/timeline?${params}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (response.ok) sourceArticles.value = response.data.data || []
  } catch (error) {
    reportError(error, 'Failed to fetch feed source articles')
    sourceArticles.value = []
  } finally {
    sourceArticlesLoading.value = false
  }
}

async function openArticleSource() {
  const source = articleSource.value
  if (!source) return
  if (isMobileApp) {
    await router.push({ path: '/feed', query: { source_id: source.subscriptionId || source.id } })
    return
  }
  sourceSheetVisible.value = true
  articleSheetVisible.value = false
  if (!sourceArticles.value.length) await fetchSourceArticles(source)
}

async function subscribeSource() {
  const source = articleSource.value
  if (!source || source.subscribed || sourceSubscribeBusy.value) return
  if (!authStore.isAuthenticated) {
    const redirect = router.resolve({
      path: route.path,
      query: route.query,
      hash: route.hash,
    }).fullPath
    await router.push({ path: '/login', query: { redirect } })
    return
  }
  if (source.type !== 'external_rss' || !source.rssUrl) return

  sourceSubscribeBusy.value = true
  try {
    const success = await feedStore.subscribeToRSS(source.rssUrl, source.title)
    if (!success) return
    await Promise.all([
      feedStore.fetchSubscriptions(),
      feedStore.fetchGroups(),
      feedStore.fetchSubscriptionHubTree(),
    ])
    routeState.value = routeState.value
      ? { ...routeState.value, source: { ...source, subscribed: true } }
      : routeState.value
  } finally {
    sourceSubscribeBusy.value = false
  }
}

function openSourceArticle(next: TimelineItem) {
  if (next.type !== 'feed_item' || !next.feed_item) return
  const source = articleSource.value
  const state: FeedArticleRouteState = {
    article: next,
    articles: routeState.value?.articles || sourceArticles.value,
    source,
    sourceArticles: sourceArticles.value,
  }
  item.value = next.feed_item
  routeState.value = state
  articleSheetVisible.value = true
  sourceSheetVisible.value = true
  void router.push({ path: `/feed/item/${next.feed_item.id}`, state: feedArticleRouteState(state) })
}

function playPodcast(feedItem: FeedItem) {
  const timelineItem = article.value
  if (timelineItem) playerStore.setQueueFromCurrentItems([timelineItem])
  const podcast = playerStore.createPodcastSong(feedItem)
  if (podcast) playerStore.playQueuedSong(podcast)
}

async function reportReadEvent(feedItem: FeedItem) {
  if (!feedItem.feed_source_id) return
  try {
    await apiRequestResult(`${api.url}/feed/events/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {}),
      },
      body: JSON.stringify({
        source_type: 'external_rss',
        source_id: feedItem.feed_source_id,
        event_type: 'detail_open',
      }),
    })
  } catch {
    // Read-event telemetry must not block the article itself.
  }
}

async function fetchItem(id: string) {
  const restored = readFeedArticleRouteState()
  const restoredItem = restored?.article.type === 'feed_item' && restored.article.feed_item?.id === id
    ? restored.article.feed_item
    : null
  reader.value = null

  if (restoredItem && restored) {
    routeState.value = restored
    sourceArticles.value = restored?.sourceArticles ?? []
    sourceSheetVisible.value = Boolean(restored?.source)
    articleSheetVisible.value = true
    item.value = restoredItem
    loading.value = false
  } else {
    routeState.value = null
    loading.value = true
    item.value = null
  }

  try {
    const response = await apiRequestResult(`${api.url}/feed/items/${id}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!response.ok) return

    const result = await Promise.resolve(response.data)
    const detail = result.data as FeedItemDetail | undefined
    const nextItem = detail?.item
    if (!nextItem || !detail?.reader || String(route.params.id || '') !== id) return
    item.value = nextItem
    reader.value = detail.reader
    if (restoredItem && routeState.value) {
      routeState.value = {
        ...routeState.value,
        article: {
          type: 'feed_item',
          feed_item: nextItem,
          published_at: nextItem.published_at,
          is_read: true,
        },
      }
    } else {
      const source = articleSource.value
      routeState.value = {
        article: {
          type: 'feed_item',
          feed_item: nextItem,
          published_at: nextItem.published_at,
          is_read: true,
        },
        articles: [],
        source,
        sourceArticles: [],
      }
      sourceSheetVisible.value = false
      articleSheetVisible.value = true
    }
    if (authStore.isAuthenticated) {
      void feedStore.markItemsRead([nextItem.id])
    }
    void reportReadEvent(nextItem)
  } catch (error) {
    reportError(error, 'Failed to fetch feed item')
  } finally {
    if (String(route.params.id || '') === id) loading.value = false
  }
}

watch(() => String(route.params.id || ''), (id) => {
  if (id) void fetchItem(id)
}, { immediate: true })
</script>

<style scoped>
.feed-item-route { padding-top: 4rem; padding-bottom: 12rem; }
.feed-item-route__loading { display: grid; gap: 1rem; }
</style>
