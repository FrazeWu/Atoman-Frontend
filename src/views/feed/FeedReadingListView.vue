<template>
  <div ref="pageRootRef" class="a-page-xl feed-subpage">
    <PPageHeader title="稍后阅读" sub="你保存的 RSS 阅读队列">
      <template #action>
        <RouterLink to="/feed" style="text-decoration:none">
          <PPress variant="secondary" label="← 返回订阅" />
        </RouterLink>
      </template>
    </PPageHeader>

    <div v-if="loading" class="feed-loading">
      <div v-for="i in 5" :key="i" class="a-skeleton feed-skeleton" />
    </div>

    <PEmpty v-else-if="!items.length" text="阅读列表为空" sub="在订阅时间线中点击「稍后阅读」保存" />

    <div v-else class="feed-timeline">
      <template v-for="(entry, index) in items" :key="entry.feed_item_id">
        <PEntry
          v-if="entry.feed_item"
          :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
          :is-open="showArticleSheet && selectedArticle?.feed_item?.id === entry.feed_item_id"
          :force-show-actions="true"
          @click="openArticleSheet(entry, index)"
          :title="entry.feed_item.title"
          :summary="stripHtml(entry.feed_item.summary || '')"
        >
          <template #visual>
            <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
              <PBadge type="external" fill>外部</PBadge>
              <PBadge type="external">{{ getExternalBadge(entry.feed_item) }}</PBadge>
              <img
                v-if="entry.feed_item.image_url"
                :src="entry.feed_item.image_url"
                style="width:4.5rem;height:4.5rem;object-fit:cover;border:1px solid var(--a-color-line-soft);filter:grayscale(100%);flex-shrink:0;border-radius:4px;margin-top:0.25rem;"
              />
            </div>
          </template>

          <template #meta>
            <a 
              v-if="getFeedSourceHomeUrl(entry.feed_item)"
              :href="getFeedSourceHomeUrl(entry.feed_item)"
              target="_blank"
              rel="noopener noreferrer"
              class="a-label a-muted feed-source-link"
              @click.stop
            >
              {{ entry.feed_item.feed_source?.title || 'RSS' }} ↗
            </a>
            <span v-else class="a-label a-muted">{{ entry.feed_item.feed_source?.title || 'RSS' }}</span>
            <span v-if="entry.feed_item.author" class="a-label a-muted">· {{ entry.feed_item.author }}</span>
            <span style="color:var(--a-color-muted-soft)">{{ formatDate(entry.feed_item.published_at) }}</span>
            <span style="color:var(--a-color-success);font-size:0.7rem;font-weight:900">
              添加于 {{ formatDate(entry.created_at) }}
            </span>
          </template>

          <template #actions>
            <PClip
              active
              label="移除"
              @click="remove(entry.feed_item_id)"
            />
            <div style="flex:1"></div>
            <a v-if="entry.feed_item.link" :href="entry.feed_item.link" target="_blank" rel="noopener noreferrer" class="feed-item-external-link">
              ↗ 原文
            </a>
          </template>
        </PEntry>
      </template>

      <FeedTimelineFooter
        :page="page"
        :page-size="pageLimit"
        :total="totalItems"
        :loading="loading"
        @change-page="changePage"
      />
    </div>

    <PShortcutHints :hints="shortcutHints" />
    <FeedArticleSheet
      :show="showArticleSheet"
      :article="selectedArticle"
      :is-podcast-playing="selectedArticle?.type === 'feed_item' && selectedArticle.feed_item ? isPodcastPlaying(selectedArticle.feed_item) : false"
      @close="showArticleSheet = false"
      @play-podcast="playFeedItemFromSheet"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
import PPress from '@/components/ui/PPress.vue'
import PShortcutHints from '@/components/ui/PShortcutHints.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { usePlayerStore } from '@/stores/player'
import { useUIStore } from '@/stores/ui'
import { useKeyboardList } from '@/composables/useKeyboardList'
import type { FeedItem, TimelineItem } from '@/types'
import { useApi } from '@/composables/useApi'

interface ReadingListEntry {
  feed_item_id: string
  feed_item?: FeedItem
  created_at: string
}

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
const items = ref<ReadingListEntry[]>([])
const totalItems = ref(0)
const page = ref(1)
const pageLimit = 20

const showArticleSheet = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)

const pageRootRef = ref<HTMLElement | null>(null)

const shortcutHints = [
  { key: 'H', label: '聚焦侧边栏' },
  { key: 'L', label: '聚焦内容区' },
  { key: 'J / K', label: '上下切换项目' },
  { key: 'Enter', label: '打开当前项' },
  { key: 'Esc', label: '关闭面板' },
  { key: 'V', label: '查看原文' }
]

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
  selectedArticle.value = {
    type: 'feed_item',
    feed_item: entry.feed_item,
    published_at: entry.feed_item.published_at,
    is_read: true
  }
  showArticleSheet.value = true
}

const formatDate = (d?: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()

const getExternalBadge = (item?: FeedItem) => {
  if (!item) return '博客'
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  return '博客'
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
  playerStore.playSong(tempSong)
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
  loading.value = true
  const res = await fetch(`${api.url}/feed/reading-list?page=${page.value}&limit=${pageLimit}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    loading.value = false
    return
  }

  const data = await res.json()
  const nextItems: ReadingListEntry[] = Array.isArray(data.data)
    ? data.data
    : data.data?.items || data.items || []
  const total = data.meta?.total ?? data.data?.total ?? data.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageLimit))

  if (total > 0 && page.value > totalPages) {
    await setRoutePage(totalPages, true)
    return
  }

  const previousIds = items.value.map((item) => item.feed_item_id)
  const nextIds = nextItems.map((item) => item.feed_item_id)
  items.value = nextItems
  feedStore.syncReadingListPageIds(previousIds, nextIds)
  totalItems.value = total
  loading.value = false
}

const remove = async (feedItemId: string) => {
  const res = await fetch(`${api.url}/feed/reading-list/${feedItemId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) return

  const nextIds = new Set(feedStore.readingListItemIds)
  nextIds.delete(feedItemId)
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
  font-family: var(--a-font-meta);
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--a-color-fg);
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-line-soft);
  text-decoration: none;
  transition: all 0.15s;
}

.feed-item-external-link:hover {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
  box-shadow: var(--a-shadow-paper-sm);
}
</style>
