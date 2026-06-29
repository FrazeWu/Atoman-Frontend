<template>
  <div ref="pageRootRef" class="a-page-xl feed-page">
    <PPageHeader title="探索" accent sub="发现更多有趣的订阅内容">
      <template #action>
        <div class="explore-header-actions">
          <div class="explore-sort-tabs">
            <PTab
              v-for="option in sortOptions"
              :key="option.value"
              :label="option.label"
              :active="sort === option.value"
              @click="changeSort(option.value)"
            />
          </div>
          <PPress to="/feed" variant="secondary" label="返回订阅" />
        </div>
      </template>
    </PPageHeader>

    <FeedSourceArticlesSheet
      :show="showSourceSheet"
      :source="selectedSource"
      :items="sourceArticles"
      :loading="sourceArticlesLoading"
      :subscribe-busy="sourceSubscribeBusy"
      @close="showSourceSheet = false"
      @subscribe="subscribeSelectedSource"
      @open-article="openSourceArticle"
    />

    <section class="feed-content">
      <div class="feed-actions">
        <div class="explore-mode-switch">
          <PPress
            data-test="explore-mode-articles"
            label="文章浏览"
            :variant="mode === 'articles' ? 'primary' : 'secondary'"
            @click="changeMode('articles')"
          />
          <PPress
            data-test="explore-mode-channels"
            label="频道浏览"
            :variant="mode === 'channels' ? 'primary' : 'secondary'"
            @click="changeMode('channels')"
          />
        </div>
      </div>

      <ArticleExplorePanel
        v-if="mode === 'articles'"
        :items="items"
        :loading="loading"
        :total-items="totalItems"
        :page="page"
        :page-size="pageLimit"
        :selected-article="selectedArticle"
        :show-article-sheet="showArticleSheet"
        :focused-index="focusedIndex"
        :starred-ids="starredIds"
        :reading-list-ids="readingListIds"
        :feed-item-source="feedItemSource"
        :source-trigger-label="sourceTriggerLabel"
        @open-article="openArticleSheet"
        @open-source="openFeedItemSourceSheet"
        @toggle-star="toggleStar"
        @toggle-reading-list="toggleReadingList"
        @change-page="changePage"
        @play-podcast="playPodcast"
      />

      <ChannelExplorePanel
        v-else
        :items="channelItems"
        :loading="channelLoading"
        :error="channelError"
        :total-items="channelTotalItems"
        :page="page"
        :page-size="pageLimit"
        :subscribing-source-id="subscribingChannelSourceId"
        @open-source="openExploreSource"
        @subscribe-source="subscribeExploreSource"
        @retry="retryChannels"
        @change-page="changePage"
      />
    </section>

    <PShortcutHints :hints="shortcutHints" />
    <FeedArticleSheet
      :show="showArticleSheet"
      :article="selectedArticle"
      :is-podcast-playing="selectedArticle?.type === 'feed_item' && selectedArticle.feed_item ? isPodcastPlaying(selectedArticle.feed_item) : false"
      @close="showArticleSheet = false"
      @play-podcast="playPodcast"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PTab from '@/components/ui/PTab.vue'
import PShortcutHints from '@/components/ui/PShortcutHints.vue'
import ArticleExplorePanel from '@/components/feed/ArticleExplorePanel.vue'
import ChannelExplorePanel from '@/components/feed/ChannelExplorePanel.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { usePlayerStore } from '@/stores/player'
import { useUIStore } from '@/stores/ui'
import { useKeyboardList } from '@/composables/useKeyboardList'
import type { FeedArticleSource, FeedExploreSource, FeedItem, TimelineItem } from '@/types'
import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const feedStore = useFeedStore()
const playerStore = usePlayerStore()
const uiStore = useUIStore()
const api = useApi()
const authHeaders = () => ({ Authorization: `Bearer ${authStore.token}` })

const normalizePage = (value: unknown) => {
  const parsed = Number.parseInt(String(value || '1'), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const items = ref<TimelineItem[]>([])
const loading = ref(true)
const mode = ref<'articles' | 'channels'>('articles')
const sort = ref<'random' | 'popular'>('popular')
const sortOptions: Array<{ label: string; value: 'random' | 'popular' }> = [
  { label: '热门', value: 'popular' },
  { label: '随机', value: 'random' },
]
const page = ref(1)
const totalItems = ref(0)
const channelItems = ref<FeedExploreSource[]>([])
const channelLoading = ref(false)
const channelError = ref('')
const channelTotalItems = ref(0)
const pageLimit = 20
const subscriptions = computed(() => feedStore.subscriptions)
const pageRootRef = ref<HTMLElement | null>(null)
const starredIds = computed(() => feedStore.starredItemIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const showArticleSheet = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)
const showSourceSheet = ref(false)
const selectedSource = ref<FeedArticleSource | null>(null)
const sourceArticles = ref<TimelineItem[]>([])
const sourceArticlesLoading = ref(false)
const sourceSubscribeBusy = ref(false)
const subscribingChannelSourceId = ref('')

const shortcutHints = [
  { key: 'H', label: '聚焦侧边栏' },
  { key: 'L', label: '聚焦内容区' },
  { key: 'J / K', label: '上下切换项目' },
  { key: 'Enter', label: '打开当前项' },
  { key: 'Esc', label: '关闭面板' },
  { key: 'S', label: '收藏/退藏' },
  { key: 'L', label: '稍后阅读' },
  { key: 'V', label: '查看原文' }
]

const { focusedIndex, scrollToFocused } = useKeyboardList({
  items,
  section: 'content',
  onEnter: (item, index) => openArticleSheet(item, index),
  onAction: (key, item) => {
    const id = item.feed_item?.id
    if (!id) return
    switch (key) {
      case 's': toggleStar(id); break
      case 'l': toggleReadingList(id); break
      case 'v': window.open(item.feed_item?.link || '#', '_blank'); break
    }
  }
})

// Auto-focus first item when switching to content area
watch(() => uiStore.focusedSection, (section) => {
  if (section === 'content' && focusedIndex.value === -1 && items.value.length > 0) {
    focusedIndex.value = 0
    scrollToFocused()
  }
})

// Reset focus when items change
watch(items, () => {
  if (focusedIndex.value >= items.value.length) {
    focusedIndex.value = items.value.length > 0 ? 0 : -1
  }
})

const openArticleSheet = (item: TimelineItem, index?: number) => {
  if (index !== undefined) focusedIndex.value = index
  selectedArticle.value = item
  showArticleSheet.value = true
}

const findSubscriptionForSource = (source: FeedArticleSource) => {
  if (source.type === 'internal_channel') {
    return subscriptions.value.find((sub) => (
      sub.feed_source?.source_type === 'internal_channel'
      && sub.feed_source.source_id === source.id
    ))
  }

  if (source.type === 'external_rss') {
    return subscriptions.value.find((sub) => (
      sub.feed_source_id === source.id
      || sub.feed_source?.id === source.id
      || (!!source.rssUrl && sub.feed_source?.rss_url === source.rssUrl)
    ))
  }

  return undefined
}

const withSubscriptionState = (source: FeedArticleSource): FeedArticleSource => {
  const subscription = findSubscriptionForSource(source)
  return {
    ...source,
    subscriptionId: subscription?.id || source.subscriptionId,
    subscribed: Boolean(subscription || source.subscribed),
  }
}

const feedItemSource = (item: FeedItem): FeedArticleSource | null => {
  const sourceId = item.feed_source?.id || item.feed_source_id
  if (!sourceId) return null
  return withSubscriptionState({
    type: 'external_rss',
    id: sourceId,
    title: item.feed_source?.title || 'RSS',
    rssUrl: item.feed_source?.rss_url,
    subscribed: false,
  })
}

const sourceTriggerLabel = (source: FeedArticleSource) => `查看 ${source.title} 的所有文章`

const mapExploreSource = (source: Record<string, any>): FeedExploreSource => ({
  id: source.id,
  title: source.title || '未命名来源',
  rssUrl: source.rss_url || source.rssUrl,
  subscriptionCount: Number(source.subscription_count ?? source.subscriptionCount ?? 0),
  recentItemCount: Number(source.recent_item_count ?? source.recentItemCount ?? 0),
  lastPublishedAt: source.last_published_at || source.lastPublishedAt || source.last_fetched_at || source.lastFetchedAt,
  subscribed: Boolean(source.subscribed),
  recentItems: Array.isArray(source.recent_items || source.recentItems)
    ? (source.recent_items || source.recentItems).map((item: Record<string, any>) => ({
      id: item.id,
      title: item.title || '未命名文章',
      publishedAt: item.published_at || item.publishedAt,
    }))
    : [],
})

const withExploreSourceSubscriptionState = (source: FeedExploreSource): FeedExploreSource => {
  const articleSource = mapExploreSourceToArticleSource(source)
  const subscription = findSubscriptionForSource(articleSource)
  return {
    ...source,
    subscribed: Boolean(source.subscribed || subscription),
  }
}

const mapExploreSourceToArticleSource = (source: FeedExploreSource): FeedArticleSource => withSubscriptionState({
  type: 'external_rss',
  id: source.id,
  title: source.title,
  rssUrl: source.rssUrl,
  subscribed: source.subscribed,
})

const openSourceArticle = (item: TimelineItem) => {
  selectedArticle.value = item
  showArticleSheet.value = true
}

const fetchSourceArticles = async (source: FeedArticleSource) => {
  if (!source.id && !source.subscriptionId) {
    sourceArticles.value = []
    return
  }

  sourceArticlesLoading.value = true
  try {
    const params = source.id
      ? new URLSearchParams({
        limit: '100',
        feed_source_id: source.id,
      })
      : buildFeedTimelineQuery({
        limit: 100,
        sourceId: source.subscriptionId,
      })
    const headers = authStore.isAuthenticated ? authHeaders() : {}
    const response = await fetch(`${api.url}/feed/timeline?${params.toString()}`, { headers })
    if (response.ok) {
      const data = await response.json()
      sourceArticles.value = data.data || []
    }
  } catch (error) {
    console.error(error)
    sourceArticles.value = []
  } finally {
    sourceArticlesLoading.value = false
  }
}

const openSourceSheet = async (source: FeedArticleSource) => {
  selectedSource.value = withSubscriptionState(source)
  sourceArticles.value = []
  showSourceSheet.value = true
  showArticleSheet.value = false
  await fetchSourceArticles(selectedSource.value)
}

const openExploreSource = async (source: FeedExploreSource) => {
  await openChannelSourceSheet(source)
}

const openChannelSourceSheet = async (source: FeedExploreSource) => {
  await openSourceSheet(mapExploreSourceToArticleSource(source))
}

const openFeedItemSourceSheet = async (item: FeedItem) => {
  const source = feedItemSource(item)
  if (!source) return
  await openSourceSheet(source)
}

const subscribeSelectedSource = async () => {
  if (!selectedSource.value || selectedSource.value.subscribed || !authStore.isAuthenticated) return

  sourceSubscribeBusy.value = true
  try {
    let success = false
    if (selectedSource.value.type === 'external_rss' && selectedSource.value.rssUrl) {
      success = await feedStore.subscribeToRSS(selectedSource.value.rssUrl, selectedSource.value.title)
    }
    if (!success) return

    await feedStore.fetchSubscriptions()
    selectedSource.value = withSubscriptionState(selectedSource.value)
    await fetchSourceArticles(selectedSource.value)
  } finally {
    sourceSubscribeBusy.value = false
  }
}

const subscribeExploreSource = async (source: FeedExploreSource) => {
  if (source.subscribed || !source.rssUrl || !authStore.isAuthenticated || subscribingChannelSourceId.value) return

  subscribingChannelSourceId.value = source.id
  try {
    const success = await feedStore.subscribeToRSS(source.rssUrl, source.title)
    if (!success) return

    await feedStore.fetchSubscriptions()
    await fetchExploreSources()
  } finally {
    subscribingChannelSourceId.value = ''
  }
}

const toggleStar = async (id: string) => {
  if (!authStore.isAuthenticated) return
  await feedStore.toggleStar(id)
}

const toggleReadingList = async (id: string) => {
  if (!authStore.isAuthenticated) return
  await feedStore.toggleReadingListItem(id)
}

const playPodcast = (feedItem: FeedItem) => {
  playerStore.setQueueFromCurrentItems(items.value)

  const tempSong = playerStore.createPodcastSong(feedItem)
  if (!tempSong) return

  playerStore.playSong(tempSong)
}

const isPodcastPlaying = (feedItem: FeedItem) =>
  playerStore.currentSong?.audio_url === feedItem.enclosure_url && playerStore.isPlaying

const fetchExplore = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ sort: sort.value, page: String(page.value), limit: String(pageLimit) })
    const headers = authStore.isAuthenticated ? authHeaders() : {}
    const res = await fetch(`${api.feed.explore}?${params.toString()}`, {
      headers
    })
    if (res.ok) {
      const d = await res.json()
      items.value = d.data || []
      totalItems.value = d.total ?? d.meta?.total ?? 0
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const fetchExploreSources = async () => {
  channelLoading.value = true
  channelError.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: String(pageLimit) })
    const headers = authStore.isAuthenticated ? authHeaders() : {}
    const res = await fetch(`${api.feed.exploreSources}?${params.toString()}`, { headers })
    if (!res.ok) {
      throw new Error(`频道探索加载失败: ${res.status}`)
    }
    const d = await res.json()
    channelItems.value = Array.isArray(d.data)
      ? d.data.map((source: Record<string, any>) => withExploreSourceSubscriptionState(mapExploreSource(source)))
      : []
    channelTotalItems.value = d.total ?? d.meta?.total ?? 0
  } catch (error) {
    console.error(error)
    channelItems.value = []
    channelTotalItems.value = 0
    channelError.value = '频道探索加载失败，请稍后重试。'
  } finally {
    channelLoading.value = false
  }
}

const scrollToTop = async () => {
  await nextTick()
  pageRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const changePage = async (nextPage: number) => {
  const normalizedPage = normalizePage(nextPage)
  if (normalizedPage === page.value) return
  const query = {
    ...route.query,
    page: normalizedPage > 1 ? String(normalizedPage) : undefined,
  }
  await router.push({ query })
  await scrollToTop()
}

const changeMode = async (nextMode: 'articles' | 'channels') => {
  if (nextMode === mode.value) return
  const query = {
    ...route.query,
    mode: nextMode === 'channels' ? 'channels' : undefined,
    page: undefined,
    sort: nextMode === 'articles' && sort.value !== 'popular' ? sort.value : undefined,
  }
  await router.push({ query })
}

const changeSort = (newSort: 'random' | 'popular') => {
  sort.value = newSort
  const query = { ...route.query, page: undefined, sort: newSort !== 'popular' ? newSort : undefined }
  router.push({ query })
}

const retryChannels = async () => {
  await fetchExploreSources()
}

const handleKeyDownGlobal = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    showArticleSheet.value = false
  }
}

watch(
  () => route.query,
  async (query) => {
    page.value = normalizePage(query.page)
    mode.value = query.mode === 'channels' ? 'channels' : 'articles'
    const queriedSort = query.sort === 'random' ? 'random' : 'popular'
    sort.value = queriedSort
    if (mode.value === 'channels') {
      await fetchExploreSources()
      return
    }
    await fetchExplore()
  },
  { immediate: true },
)

onMounted(() => {
  if (authStore.isAuthenticated) {
    feedStore.fetchStarredIds()
    feedStore.fetchReadingListIds()
    void feedStore.fetchSubscriptions()
  }
  window.addEventListener('keydown', handleKeyDownGlobal)
})

watch(
  [() => authStore.isAuthenticated, () => authStore.token],
  ([isAuthenticated, token], [previousAuthenticated, previousToken]) => {
    if (!isAuthenticated) return
    if (previousAuthenticated !== isAuthenticated || previousToken !== token) {
      void feedStore.fetchSubscriptions()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDownGlobal)
})
</script>

<style scoped>
.feed-page {
  padding-bottom: 12rem;
}

.feed-content {
  display: grid;
  gap: 1rem;
}

.explore-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.explore-sort-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
}

.feed-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 2.5rem;
}

.explore-mode-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
