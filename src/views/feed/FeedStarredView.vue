<template>
  <div ref="pageRootRef" class="a-page-xl feed-subpage">
    <PPageHeader title="收藏" accent sub="你保存的文章合集">
      <template #action>
        <div style="display:flex;gap:0.75rem;align-items:center">
          <PPress variant="secondary" label="← 返回订阅" @click="router.push('/feed')" />
        </div>
      </template>
    </PPageHeader>

    <div v-if="loading" class="feed-loading">
      <div v-for="i in 5" :key="i" class="a-skeleton feed-skeleton" />
    </div>

    <div v-if="!loading && starGroups.length > 1" class="star-groups-bar">
      <button 
        v-for="group in starGroups" 
        :key="group.id"
        class="star-group-button a-font-meta"
        :class="{ active: activeStarGroupId === group.id }"
        @click="selectStarGroup(group.id)"
      >
        {{ group.name }}
      </button>
    </div>

    <PEmpty v-else-if="!items.length" text="还没有收藏任何文章" sub="在订阅时间线中点击「收藏」保存" />

    <div v-else class="feed-timeline">
      <template v-for="(item, index) in items" :key="item.id">
        <PEntry
          :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
          :is-open="showArticleSheet && selectedArticle?.feed_item?.id === item.id"
          :is-read="false"
          :force-show-actions="true"
          @click="openArticleSheet(item, index)"
          :title="item.title"
          :summary="stripHtml(item.summary || '')"
        >
          <template #visual>
            <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
              <PBadge type="external" fill>外部</PBadge>
              <PBadge type="external">{{ getExternalBadge(item) }}</PBadge>
            </div>
          </template>

          <template #meta>
            <a 
              v-if="getFeedSourceHomeUrl(item)"
              :href="getFeedSourceHomeUrl(item)"
              target="_blank"
              rel="noopener noreferrer"
              class="a-label a-muted feed-source-link"
              @click.stop
            >
              {{ item.source_title || 'RSS' }} ↗
            </a>
            <span v-else class="a-label a-muted">{{ item.source_title || 'RSS' }}</span>
            <span v-if="item.author" class="a-label a-muted">· {{ item.author }}</span>
            <span style="color:var(--a-color-muted-soft)">{{ formatDate(item.published_at) }}</span>
          </template>

          <template #actions>
            <PClip
              active
              label="退藏"
              @click="unstar(item.id)"
            />
            
            <!-- Move to group dropdown -->
            <select 
              v-if="starGroups.length > 1"
              class="star-group-select a-font-meta"
              @change="moveStar(item.id, ($event.target as HTMLSelectElement).value)"
              @click.stop
            >
              <option value="">移动至分组...</option>
              <option 
                v-for="g in starGroups.filter(g => g.id !== activeStarGroupId)" 
                :key="g.id" 
                :value="g.id"
              >
                {{ g.name }}
              </option>
            </select>

            <div style="flex:1"></div>
            <a v-if="item.link" :href="item.link" target="_blank" rel="noopener noreferrer" class="feed-item-external-link">
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
      :has-previous="selectedArticleIndex > 0"
      :has-next="selectedArticleIndex >= 0 && selectedArticleIndex < items.length - 1"
      @close="showArticleSheet = false"
      @play-podcast="playFeedItemFromSheet"
      @previous="openPreviousArticle"
      @next="openNextArticle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
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
import type { FeedItem, StarredFeedItem, TimelineItem, FeedStarGroup } from '@/types'
import { useApi } from '@/composables/useApi'

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
const items = ref<StarredFeedItem[]>([])
const totalItems = ref(0)
const page = ref(1)
const pageLimit = 20
const activeStarGroupId = ref<string | null>(null)
const starGroups = ref<FeedStarGroup[]>([])

let starredRequestSeq = 0

const showArticleSheet = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)
const selectedArticleIndex = computed(() => {
  if (!selectedArticle.value?.feed_item?.id) return -1
  return items.value.findIndex((item) => item.id === selectedArticle.value?.feed_item?.id)
})

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
      window.open(item.link || '#', '_blank')
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

const openArticleSheet = (item: StarredFeedItem, index?: number) => {
  if (index !== undefined) focusedIndex.value = index
  // Convert StarredFeedItem to TimelineItem for FeedArticleSheet
  selectedArticle.value = {
    type: 'feed_item',
    feed_item: {
      ...item,
      id: item.id,
      feed_source_id: item.feed_source_id || '',
      guid: item.guid || '',
      fetched_at: item.fetched_at || '',
      content_html: item.full_text_html
    } as any,
    published_at: item.published_at,
    is_read: true
  }
  showArticleSheet.value = true
}

const openPreviousArticle = () => {
  if (selectedArticleIndex.value <= 0) return
  const item = items.value[selectedArticleIndex.value - 1]
  if (!item) return
  openArticleSheet(item, selectedArticleIndex.value - 1)
}

const openNextArticle = () => {
  if (selectedArticleIndex.value < 0 || selectedArticleIndex.value >= items.value.length - 1) return
  const item = items.value[selectedArticleIndex.value + 1]
  if (!item) return
  openArticleSheet(item, selectedArticleIndex.value + 1)
}

const formatDate = (d?: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

const getExternalBadge = (item: StarredFeedItem) => {
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  return '博客'
}

const getFeedSourceHomeUrl = (item: StarredFeedItem) => {
  if (!item.link) return ''
  try {
    return new URL(item.link).origin
  } catch {
    return item.link
  }
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()

const isPodcastPlaying = (feedItem: FeedItem) =>
  playerStore.currentSong?.audio_url === feedItem.enclosure_url && playerStore.isPlaying

const playFeedItemFromSheet = (feedItem: FeedItem) => {
  const queueItems: TimelineItem[] = items.value.map((item) => ({
    type: 'feed_item',
    feed_item: {
      ...item,
      id: item.id,
      feed_source_id: item.feed_source_id || '',
      guid: item.guid || '',
      fetched_at: item.fetched_at || '',
      content_html: item.full_text_html,
    } as FeedItem,
    published_at: item.published_at,
    is_read: true,
  }))
  playerStore.setQueueFromCurrentItems(queueItems)
  const tempSong = playerStore.createPodcastSong(feedItem)
  if (!tempSong) return
  playerStore.playQueuedSong(tempSong)
}

const fetchStarred = async () => {
  if (!authStore.isAuthenticated) return
  const requestId = ++starredRequestSeq
  const groupId = activeStarGroupId.value
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: String(pageLimit) })
    if (groupId) params.set('group_id', groupId)

    const res = await fetch(`${api.url}/feed/stars?${params.toString()}`, {
      headers: authHeaders(),
    })
    if (res.ok) {
      const data = await res.json()
      if (requestId !== starredRequestSeq || activeStarGroupId.value !== groupId) return

      const newItems: StarredFeedItem[] = data.items || []
      const total = data.total || 0
      const totalPages = Math.max(1, Math.ceil(total / pageLimit))
      if (total > 0 && page.value > totalPages) {
        await setRouteState(totalPages, groupId, true)
        return
      }

      const previousIds = items.value.map((item) => item.id)
      const nextIds = newItems.map((item) => item.id)
      items.value = newItems
      feedStore.syncStarredPageIds(previousIds, nextIds)
      totalItems.value = total
    }
  } catch (e) {
    console.error('Failed to fetch starred items', e)
  } finally {
    if (requestId === starredRequestSeq) {
      loading.value = false
    }
  }
}

const scrollToTop = async () => {
  await nextTick()
  pageRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const setRouteState = async (nextPage: number, groupId: string | null, replace = false) => {
  const normalizedPage = normalizePage(nextPage)
  const query = {
    ...route.query,
    page: normalizedPage > 1 ? String(normalizedPage) : undefined,
    group: groupId || undefined,
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
  await setRouteState(normalizedPage, activeStarGroupId.value)
  await scrollToTop()
}

const selectStarGroup = async (groupId: string | null) => {
  await setRouteState(1, groupId)
}

const moveStar = async (feedItemId: string, groupId: string | null) => {
  if (!groupId) return
  const success = await feedStore.moveStarToGroup(feedItemId, groupId)
  if (success && activeStarGroupId.value) {
    items.value = items.value.filter((item) => item.id !== feedItemId)
  }
}

const unstar = async (feedItemId: string) => {
  const result = await feedStore.toggleStar(feedItemId)
  if (result === false) {
    if (items.value.length === 1 && page.value > 1) {
      await setRouteState(page.value - 1, activeStarGroupId.value)
      return
    }
    await fetchStarred()
  }
}

watch(
  () => route.query,
  async (query) => {
    activeStarGroupId.value = typeof query.group === 'string' ? query.group : null
    page.value = normalizePage(query.page)
    await fetchStarred()
  },
  { immediate: true },
)

const handleKeyDownGlobal = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    showArticleSheet.value = false
  }
}

onMounted(async () => {
  await feedStore.fetchStarGroups()
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

.star-groups-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: none;
}

.star-group-button {
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  min-height: 2rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.star-group-button.active,
.star-group-button:hover {
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  border-color: var(--a-color-ink);
}

.star-group-select {
  max-width: 9rem;
  padding: 0.25rem 0.45rem;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  border: 1px solid var(--a-color-line-soft);
  background: #fff;
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
