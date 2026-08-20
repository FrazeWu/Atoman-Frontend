<template>
  <FeedSourceArticlesSheet
    v-if="routeState?.source"
    :show="true"
    :source="routeState.source"
    :items="routeState.sourceArticles"
    :stack-size="2"
    :is-shifted="true"
    :is-top-layer="false"
    @close="close"
  />

  <FeedArticleSheet
    v-if="article"
    :show="true"
    :article="article"
    :is-podcast-playing="isPodcastPlaying"
    :has-previous="articleIndex > 0"
    :has-next="articleIndex >= 0 && articleIndex < (routeState?.articles.length ?? 0) - 1"
    @close="close"
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
import type { FeedItem, TimelineItem } from '@/types'
import { reportError } from '@/utils/logger'

const route = useRoute()
const router = useRouter()
const api = useApi()
const authStore = useAuthStore()
const playerStore = usePlayerStore()

const loading = ref(false)
const routeState = ref<FeedArticleRouteState | null>(readFeedArticleRouteState())
const item = ref<FeedItem | null>(null)
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
const articleIndex = computed(() => routeState.value?.articles.findIndex(
  (entry) => entry.type === 'feed_item' && entry.feed_item?.id === item.value?.id,
) ?? -1)

function openRelativeArticle(offset: -1 | 1) {
  const next = routeState.value?.articles[articleIndex.value + offset]
  if (next?.type !== 'feed_item' || !next.feed_item) return
  const state = { ...routeState.value!, article: next }
  void router.push({ path: `/feed/item/${next.feed_item.id}`, state: feedArticleRouteState(state) })
}

function close() {
  void router.push('/feed')
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
  if (restored?.article.type === 'feed_item' && restored.article.feed_item?.id === id) {
    routeState.value = restored
    item.value = restored.article.feed_item
    loading.value = false
    return
  }
  routeState.value = null
  loading.value = true
  item.value = null
  try {
    const response = await apiRequestResult(`${api.url}/feed/items/${id}`, {
      headers: authStore.isAuthenticated ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!response.ok) return

    const result = await Promise.resolve(response.data)
    const nextItem = result.data as FeedItem | undefined
    if (!nextItem || String(route.params.id || '') !== id) return
    item.value = nextItem
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
