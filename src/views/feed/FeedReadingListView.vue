<template>
  <div ref="pageRootRef" class="a-page-xl feed-subpage">
    <PPageHeader v-if="!embedded" title="稍后阅读" mb="1.25rem">
      <template #action>
        <RouterLink to="/feed" style="text-decoration:none">
          <PButton variant="secondary" label="← 返回订阅" />
        </RouterLink>
      </template>
    </PPageHeader>

    <div v-if="!authStore.isAuthenticated" class="feed-unauth">
      <PEmpty
        title="请登录后查看稍后阅读"
        description="登录账号以同步你的稍后阅读文章清单。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <div v-if="loading" class="feed-loading">
        <div v-for="i in 5" :key="i" class="a-skeleton feed-skeleton" />
      </div>

      <PEmpty v-else-if="errorMessage" title="加载失败" :description="errorMessage" />

      <PEmpty v-else-if="!items.length" title="稍后阅读列表为空" description="在文章或订阅列表中点击「稍后阅读」保存内容。" />

    <div v-else class="feed-timeline">
      <template v-for="(entry, index) in items" :key="`${entry.target_type}:${entry.target_id}`">
        <BlogItemCard
          :item="entry.feed_item || entry.post"
          :type="entry.feed_item ? 'feed_item' : 'post'"
          in-reading-list
          @click="entry.feed_item ? openArticleSheet(entry, index) : (entry.post && router.push(`/posts/post/${entry.post.id}`))"
          @toggle-reading-list="remove(entry.target_type, entry.target_id)"
        />
      </template>

      <FeedTimelineFooter
        :page="page"
        :page-size="pageLimit"
        :total="totalItems"
        :loading="loading"
        @change-page="changePage"
      />
    </div>
    </template>

    <FeedArticleSheet
      :show="showArticleSheet"
      :article="selectedArticle"
      :is-podcast-playing="selectedArticle?.type === 'feed_item' && selectedArticle.feed_item ? isPodcastPlaying(selectedArticle.feed_item) : false"
      :has-previous="selectedArticleIndex > 0"
      :has-next="selectedArticleIndex >= 0 && selectedArticleIndex < rssEntries.length - 1"
      @close="showArticleSheet = false"
      @play-podcast="playFeedItemFromSheet"
      @previous="openPreviousArticle"
      @next="openNextArticle"
    />
  </div>
</template>

<script setup lang="ts">
import { apiRequestResult } from '@/api/client'
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
import PButton from '@/components/ui/PButton.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { usePlayerStore } from '@/stores/player'
import { useUIStore } from '@/stores/ui'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { feedArticleRouteState } from '@/composables/feed/feedArticleRouteState'
import type { FeedItem, Post, TimelineItem } from '@/types'
import { useApi } from '@/composables/useApi'

interface ReadingListEntry {
  target_type: 'feed_item' | 'post'
  target_id: string
  feed_item?: FeedItem
  post?: Post
  created_at: string
  is_read?: boolean
}

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})
const embedded = computed(() => props.embedded)

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

const loading = ref(true)
const errorMessage = ref('')
const items = ref<ReadingListEntry[]>([])
const totalItems = ref(0)
const page = ref(1)
const pageLimit = 20
let readingListRequestId = 0

const showArticleSheet = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)
const rssEntries = computed(() => items.value.filter(entry => entry.target_type === 'feed_item' && entry.feed_item))
const selectedArticleIndex = computed(() => {
  if (!selectedArticle.value?.feed_item?.id) return -1
  return rssEntries.value.findIndex((entry) => entry.target_id === selectedArticle.value?.feed_item?.id)
})

const pageRootRef = ref<HTMLElement | null>(null)

const { focusedIndex, scrollToFocused } = useKeyboardList({
  items,
  section: 'content',
  onEnter: (item, index) => openArticleSheet(item, index),
  onAction: (key, item) => {
    if (key === 'v') {
      window.open(item.feed_item?.link || '#', '_blank')
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

const openArticleSheet = (entry: ReadingListEntry, index?: number) => {
  if (index !== undefined) focusedIndex.value = index
  if (!entry.feed_item) return
  const wasRead = entry.is_read === true
  entry.is_read = true
  const article: TimelineItem = {
    type: 'feed_item',
    feed_item: entry.feed_item,
    published_at: entry.feed_item.published_at,
    is_read: true,
  }
  selectedArticle.value = article
  void router.push({
    path: `/feed/item/${entry.feed_item.id}`,
    state: feedArticleRouteState({
      article,
      articles: rssEntries.value.map((item) => ({
        type: 'feed_item', feed_item: item.feed_item!, published_at: item.feed_item!.published_at, is_read: item.is_read === true,
      })),
      source: null,
      sourceArticles: [],
    }),
  })
  if (!wasRead) {
    void markItemsReadAndRefresh([entry.feed_item.id])
  }
}

const markItemsReadAndRefresh = async (ids: string[]) => {
  const success = await feedStore.markItemsRead(ids)
  if (success) await feedStore.fetchSubscriptions()
}

const openPreviousArticle = () => {
  if (selectedArticleIndex.value <= 0) return
  const entry = rssEntries.value[selectedArticleIndex.value - 1]
  if (!entry) return
  openArticleSheet(entry, selectedArticleIndex.value - 1)
}

const openNextArticle = () => {
  if (selectedArticleIndex.value < 0 || selectedArticleIndex.value >= rssEntries.value.length - 1) return
  const entry = rssEntries.value[selectedArticleIndex.value + 1]
  if (!entry) return
  openArticleSheet(entry, selectedArticleIndex.value + 1)
}

const formatDate = (d?: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()

const getExternalBadge = (item?: FeedItem) => {
  if (!item) return '文章'
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  return '文章'
}

const getFeedSourceHomeUrl = (item?: FeedItem) => {
  const rssUrl = item?.feed_source?.rss_url
  if (rssUrl) {
    try {
      return new URL(rssUrl).origin
    } catch {
      // Fall through to article link when rss_url is malformed.
    }
  }
  if (!item?.link) return ''
  try {
    return new URL(item.link).origin
  } catch {
    return item.link
  }
}

const isPodcastPlaying = (feedItem: FeedItem) =>
  playerStore.currentSong?.audio_url === feedItem.enclosure_url && playerStore.isPlaying

const playFeedItemFromSheet = (feedItem: FeedItem) => {
  const queueItems: TimelineItem[] = items.value
    .filter((entry) => entry.feed_item)
    .map((entry) => ({
      type: 'feed_item',
      feed_item: entry.feed_item!,
      published_at: entry.feed_item!.published_at,
      is_read: true,
    }))
  playerStore.setQueueFromCurrentItems(queueItems)
  const tempSong = playerStore.createPodcastSong(feedItem)
  if (!tempSong) return
  playerStore.playQueuedSong(tempSong)
}

const scrollToTop = async () => {
  await nextTick()
  pageRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const setRoutePage = async (nextPage: number, replace = false) => {
  const normalizedPage = normalizePage(nextPage)
  const query = {
    ...route.query,
    page: normalizedPage > 1 ? String(normalizedPage) : undefined,
  }

  if (replace) {
    await router.replace({ query })
    return
  }

  await router.push({ query })
}

const changePage = async (nextPage: number) => {
  const normalizedPage = normalizePage(nextPage)
  if (normalizedPage === page.value) return
  await setRoutePage(normalizedPage)
  await scrollToTop()
}

const fetchItems = async () => {
  if (!authStore.isAuthenticated) return
  const requestId = ++readingListRequestId
  const targetPage = page.value
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await apiRequestResult(`${api.url}/feed/reading-list?page=${targetPage}&limit=${pageLimit}`, {
      headers: authHeaders(),
    })
    if (requestId !== readingListRequestId) return
    if (!res.ok) throw new Error(`Failed to load reading list (${res.status})`)

    const data = await Promise.resolve(res.data)
    if (requestId !== readingListRequestId) return
    const rawItems: Array<ReadingListEntry & { feed_item_id?: string }> = Array.isArray(data.data)
      ? data.data
      : data.data?.items || data.items || []
    const nextItems: ReadingListEntry[] = rawItems.map((item) => ({
      ...item,
      target_type: item.target_type || 'feed_item',
      target_id: item.target_id || item.feed_item_id || item.feed_item?.id || '',
    }))
    const total = data.meta?.total ?? data.data?.total ?? data.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageLimit))

    if (total > 0 && targetPage > totalPages) {
      await setRoutePage(totalPages, true)
      return
    }

    const nextIds = nextItems.map((item) => item.target_id)
    items.value = nextItems
    feedStore.mergeReadingListPageIds(nextIds)
    totalItems.value = total
  } catch {
    if (requestId !== readingListRequestId) return
    errorMessage.value = '稍后阅读加载失败'
  } finally {
    if (requestId === readingListRequestId) loading.value = false
  }
}

const remove = async (targetType: ReadingListEntry['target_type'], targetId: string) => {
  const res = await apiRequestResult(`${api.url}/feed/reading-list/${targetType}/${targetId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) return

  const nextIds = new Set(feedStore.readingListItemIds)
  nextIds.delete(targetId)
  feedStore.readingListItemIds = nextIds
  if (items.value.length === 1 && page.value > 1) {
    await setRoutePage(page.value - 1)
    return
  }
  await fetchItems()
}

watch(
  () => route.query.page,
  async (queryPage) => {
    page.value = normalizePage(queryPage)
    await fetchItems()
  },
  { immediate: true },
)

const handleKeyDownGlobal = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    showArticleSheet.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDownGlobal)
})

onUnmounted(() => {
  readingListRequestId += 1
  window.removeEventListener('keydown', handleKeyDownGlobal)
})
</script>

<style scoped>
.feed-subpage {
  padding-bottom: 12rem;
}

.feed-loading,
.feed-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feed-skeleton {
  height: 7rem;
}


.feed-item-external-link {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-family: var(--a-font-sans);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  text-decoration: none;
  transition: all 0.15s;
}

.feed-item-external-link:hover {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
  box-shadow: var(--a-shadow-sm);
}
</style>
