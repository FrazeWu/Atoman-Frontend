<template>
  <div ref="pageRootRef" class="a-page-xl feed-subpage">
    <PPageHeader title="订阅收藏" mb="1.25rem">
      <template #action>
        <div style="display:flex;gap:0.75rem;align-items:center">
          <PSegmentedControl
            :model-value="activeView"
            :options="viewOptions"
            data-test="feed-saved-view-filter"
            @update:model-value="selectView"
          />
          <PButton variant="secondary" label="← 返回订阅" @click="router.push('/feed')" />
        </div>
      </template>
    </PPageHeader>

    <div v-if="!authStore.isAuthenticated" class="feed-unauth">
      <PEmpty
        title="请登录后查看订阅收藏"
        description="登录账号以同步你收藏的文章合集与订阅内容。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <FeedReadingListView v-if="activeView === 'reading'" embedded />
      <template v-else>
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

      <PEmpty v-if="!loading && errorMessage" title="收藏加载失败" :description="errorMessage" />

      <PEmpty v-if="!loading && !errorMessage && !items.length" title="暂无收藏文章" description="在订阅时间线中点击「收藏」保存喜爱的文章。" />

    <div v-if="!loading && !errorMessage && items.length" class="feed-timeline">
      <template v-for="(item, index) in items" :key="item.id">
        <PContentCard
          :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
          :is-open="showArticleSheet && selectedArticle?.feed_item?.id === item.id"
          :is-read="false"
          class="content-stream-entry"
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
              label="取消收藏"
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
        </PContentCard>
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
      :has-next="selectedArticleIndex >= 0 && selectedArticleIndex < items.length - 1"
      @close="showArticleSheet = false"
      @play-podcast="playFeedItemFromSheet"
      @previous="openPreviousArticle"
      @next="openNextArticle"
    />
    </template>
  </div>
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
import PButton from '@/components/ui/PButton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedReadingListView from '@/views/feed/FeedReadingListView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import { usePlayerStore } from '@/stores/player'
import { useUIStore } from '@/stores/ui'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { feedArticleRouteState } from '@/composables/feed/feedArticleRouteState'
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

const viewOptions: Array<{ label: string; value: 'starred' | 'reading'; test: string }> = [
  { label: '收藏', value: 'starred', test: 'feed-saved-view-starred' },
  { label: '稍后阅读', value: 'reading', test: 'feed-saved-view-reading' },
]
const activeView = computed<'starred' | 'reading'>(() => route.query.type === 'reading' ? 'reading' : 'starred')

const selectView = async (view: 'starred' | 'reading') => {
  await router.push({
    query: {
      ...route.query,
      type: view === 'reading' ? 'reading' : undefined,
      page: undefined,
      group: view === 'reading' ? undefined : route.query.group,
    },
  })
}

const normalizePage = (value: unknown) => {
  const parsed = Number.parseInt(String(value || '1'), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const loading = ref(true)
const errorMessage = ref('')
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
  const wasRead = item.is_read === true
  item.is_read = true
  // Convert StarredFeedItem to TimelineItem for FeedArticleSheet
  const feedItem: FeedItem = {
    ...item,
    feed_source_id: item.feed_source_id || '',
    guid: item.guid || '',
    fetched_at: item.fetched_at || '',
  }
  const article: TimelineItem = {
    type: 'feed_item',
    feed_item: feedItem,
    published_at: item.published_at,
    is_read: true,
  }
  selectedArticle.value = article
  void router.push({
    path: `/feed/item/${feedItem.id}`,
    state: feedArticleRouteState({ article, articles: items.value.map((entry) => ({
      type: 'feed_item',
      feed_item: {
        ...entry,
        feed_source_id: entry.feed_source_id || '',
        guid: entry.guid || '',
        fetched_at: entry.fetched_at || '',
      },
      published_at: entry.published_at,
      is_read: entry.is_read === true,
    })), source: null, sourceArticles: [] }),
  })
  if (!wasRead) {
    void markItemsReadAndRefresh([item.id])
  }
}

const markItemsReadAndRefresh = async (ids: string[]) => {
  const success = await feedStore.markItemsRead(ids)
  if (success) await feedStore.fetchSubscriptions()
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
  return '文章'
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
  errorMessage.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), limit: String(pageLimit) })
    if (groupId) params.set('group_id', groupId)

    const res = await apiRequestResult(`${api.url}/feed/stars?${params.toString()}`, {
      headers: authHeaders(),
    })
    if (res.ok) {
      const data = await Promise.resolve(res.data)
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
    } else {
      errorMessage.value = '收藏加载失败，请稍后重试'
    }
  } catch (e) {
    if (requestId === starredRequestSeq) {
      errorMessage.value = '收藏加载失败，请稍后重试'
    }
    reportError(e, 'Failed to fetch starred items')
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
    if (activeView.value !== 'starred') return
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
  if (activeView.value === 'starred') await feedStore.fetchStarGroups()
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
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
}

.star-group-button {
  border-radius: var(--a-radius-card);
  border: 1px solid transparent;
  padding: 0.4rem 0.75rem;
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.star-group-button:hover {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft);
}

.star-group-button.active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
  font-weight: 650;
}

.star-group-select {
  max-width: 9rem;
  padding: 0.25rem 0.45rem;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  border: 1px solid var(--a-color-border-soft);
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
