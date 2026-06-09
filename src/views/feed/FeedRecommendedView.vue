<template>
  <div ref="pageRootRef" class="a-page-xl feed-subpage">
    <APageHeader title="探索" accent sub="发现更多有趣的订阅内容">
      <template #action>
        <div style="display:flex;gap:0.75rem;align-items:center">
          <PaperTab label="随机" :active="sort === 'random'" @click="changeSort('random')" />
          <PaperTab label="热门" :active="sort === 'popular'" @click="changeSort('popular')" />
          <div style="width:1.5rem"></div>
          <ABtn to="/" outline size="sm">返回订阅</ABtn>
        </div>
      </template>
    </APageHeader>

    <div v-if="loading" class="feed-loading">
      <div v-for="i in 5" :key="i" class="a-skeleton feed-skeleton" />
    </div>

    <AEmpty v-else-if="!items.length" text="暂无发现内容" />

    <div v-else class="feed-timeline">
      <template v-for="(item, index) in items" :key="itemKey(item)">
        <PaperEntry
          v-if="item.type === 'feed_item' && item.feed_item"
          :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
          :is-open="showArticleSheet && selectedArticle && itemKey(selectedArticle) === itemKey(item)"
          @click="openArticleSheet(item, index)"
          :title="item.feed_item.title"
          :summary="stripHtml(item.feed_item.summary || '')"
        >
          <template #visual>
            <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
              <PaperBadge type="external" fill>外部</PaperBadge>
              <PaperBadge type="external">{{ getExternalBadge(item.feed_item) }}</PaperBadge>
            </div>
          </template>

          <template #meta>
            <span class="a-label a-muted">{{ item.feed_item.feed_source?.title || item.feed_item.author || 'RSS' }}</span>
            <span style="color:var(--a-color-muted-soft)">{{ formatDate(item.feed_item.published_at) }}</span>
          </template>

          <template #actions>
            <PaperClip
              :active="starredIds.has(item.feed_item.id)"
              :label="starredIds.has(item.feed_item.id) ? '退藏' : '收藏'"
              @click="toggleStar(item.feed_item.id)"
            />
            <PaperClip
              :active="readingListIds.has(item.feed_item.id)"
              :label="readingListIds.has(item.feed_item.id) ? '移除' : '稍后阅读'"
              @click="toggleReadingList(item.feed_item.id)"
            />
            <PaperClip
              v-if="item.feed_item.enclosure_url"
              :label="isPodcastPlaying(item.feed_item) ? '■ 播放中' : '▶ 播放播客'"
              @click.stop="playPodcast(item.feed_item)"
            />
            <div style="flex:1"></div>
            <a :href="item.feed_item.link" target="_blank" rel="noopener noreferrer" class="feed-item-external-link">
              ↗ 原文
            </a>
          </template>
        </PaperEntry>
      </template>

      <FeedTimelineFooter
        :page="page"
        :page-size="pageLimit"
        :total="totalItems"
        :loading="loading"
        @change-page="changePage"
      />
    </div>

    <ShortcutHints :hints="shortcutHints" />
    <FeedArticleSheet :show="showArticleSheet" :article="selectedArticle" @close="showArticleSheet = false" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ABtn from '@/components/ui/ABtn.vue'
import AEmpty from '@/components/ui/AEmpty.vue'
import APageHeader from '@/components/ui/APageHeader.vue'
import PaperTab from '@/components/ui/PaperTab.vue'
import PaperEntry from '@/components/ui/PaperEntry.vue'
import PaperBadge from '@/components/ui/PaperBadge.vue'
import PaperClip from '@/components/ui/PaperClip.vue'
import ShortcutHints from '@/components/ui/ShortcutHints.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { usePlayerStore } from '@/stores/player'
import { useUIStore } from '@/stores/ui'
import { useKeyboardList } from '@/composables/useKeyboardList'
import type { TimelineItem, FeedItem } from '@/types'

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
const pageRootRef = ref<HTMLElement | null>(null)
const starredIds = computed(() => feedStore.starredItemIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const showArticleSheet = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)

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

const getExternalBadge = (item: FeedItem) => {
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  return '博客'
}

const toggleStar = async (id: string) => {
  await feedStore.toggleStar(id)
}

const toggleReadingList = async (id: string) => {
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

const itemKey = (item: TimelineItem) => {
  return `explore-${item.feed_item?.id}`
}

const formatDate = (date?: string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()

const fetchExplore = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ sort: sort.value, page: String(page.value), limit: String(pageLimit) })
    const res = await fetch(`${api.feed.explore}?${params.toString()}`, {
      headers: authHeaders()
    })
    if (res.ok) {
      const d = await res.json()
      items.value = d.data || []
      totalItems.value = d.total || 0
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
  feedStore.fetchStarredIds()
  feedStore.fetchReadingListIds()
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
  transform: translateY(-2px);
  box-shadow: var(--a-shadow-paper-sm);
}
</style>
