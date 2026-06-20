<template>
  <div ref="pageRootRef" class="a-page-xl feed-page">
    <PPageHeader title="探索" accent sub="发现更多有趣的订阅内容">
      <template #action>
        <div style="display:flex;gap:0.75rem;align-items:center">
          <PPress
            label="随机"
            :variant="sort === 'random' ? 'primary' : 'secondary'"
            @click="changeSort('random')"
          />
          <PPress
            label="热门"
            :variant="sort === 'popular' ? 'primary' : 'secondary'"
            @click="changeSort('popular')"
          />
          <PPress to="/" variant="secondary" label="返回订阅" />
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
        <div style="width:100%"></div>
      </div>

      <ArticleExplorePanel
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
    </section>

    <PShortcutHints :hints="shortcutHints" />
    <FeedArticleSheet :show="showArticleSheet" :article="selectedArticle" @close="showArticleSheet = false" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PShortcutHints from '@/components/ui/PShortcutHints.vue'
import ArticleExplorePanel from '@/components/feed/ArticleExplorePanel.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { usePlayerStore } from '@/stores/player'
import { useUIStore } from '@/stores/ui'
import { useKeyboardList } from '@/composables/useKeyboardList'
import type { FeedArticleSource, FeedItem, TimelineItem } from '@/types'
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
const sort = ref<'random' | 'popular'>('random')
const page = ref(1)
const totalItems = ref(0)
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

const openSourceArticle = (item: TimelineItem) => {
  selectedArticle.value = item
  showArticleSheet.value = true
}

const fetchSourceArticles = async (source: FeedArticleSource) => {
  if (!source.subscriptionId) {
    sourceArticles.value = []
    return
  }

  sourceArticlesLoading.value = true
  try {
    const params = buildFeedTimelineQuery({
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

const changeSort = (newSort: 'random' | 'popular') => {
  sort.value = newSort
  const query = { ...route.query, page: undefined, sort: newSort !== 'random' ? newSort : undefined }
  router.push({ query })
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
    const queriedSort = query.sort === 'popular' ? 'popular' : 'random'
    sort.value = queriedSort
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

.feed-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 2.5rem;
}

</style>
