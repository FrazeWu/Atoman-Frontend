<template>
  <div ref="pageRootRef" class="a-page-xl feed-page">
    <div 
      ref="headerRef"
      :class="{ 'feed-header-sticky': showAddModal }"
    >
      <PPageHeader accent :title="feedCopy.name" :sub="feedCopy.homepageSub">
        <template #action>
          <div style="display:flex;gap:0.75rem;align-items:center">
            <PPress
              v-if="authStore.isAuthenticated"
              data-onboarding-anchor="feed-subscribe-trigger"
              @click="toggleAddModal"
              :label="showAddModal ? '取消添加' : '+ 订阅'"
              :variant="showAddModal ? 'secondary' : 'primary'"
            />
            <PPress
              v-if="authStore.isAuthenticated"
              variant="secondary"
              label="订阅源管理"
              @click="openManageSheet"
            />
          </div>
        </template>
      </PPageHeader>
    </div>
    <SubscriptionAddSheet
      v-if="!showManageSheet"
      :show="showAddModal"
      :top="headerBottom"
      :groups="groups"
      :submitting="addingSubscription"
      :error="addSubscriptionError"
      :reset-key="addSubscriptionResetKey"
      @close="closeAddModal"
      @submit="autoAddSubscription"
    />
    <SubscriptionManageSheet
      v-if="!showAddModal"
      :show="showManageSheet"
      :subscriptions="subscriptions"
      :groups="groups"
      :busy="manageBusy"
      :health-checking="feedStore.healthChecking"
      @close="showManageSheet = false"
      @create-group="createSubscriptionGroup"
      @rename-subscription="renameSubscription"
      @move-subscription="moveSubscription"
      @delete-subscription="deleteSubscription"
      @rename-group="renameGroup"
      @delete-group="deleteGroup"
      @check-subscription-health="checkSubscriptionHealth"
      @check-all-subscriptions-health="checkAllSubscriptionsHealth"
      @import-opml="importOPML"
      @export-opml="exportOPML"
    />
    <FeedArticleSheet :show="showArticleSheet" :article="selectedArticle" @close="showArticleSheet = false" />
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

    <PShortcutHints :hints="shortcutHints" />

    <section class="feed-content">
      <div class="feed-actions">
        <button
          v-if="authStore.isAuthenticated"
          class="filter-toggle-btn"
          :class="{ active: unreadOnly }"
          @click="toggleUnreadOnly"
          :title="unreadOnly ? '显示全部' : '只看未读'"
        >
          <Filter :size="20" aria-hidden="true" />
        </button>
        <div v-if="authStore.isAuthenticated" style="width: 2rem"></div>
        <PPress
          v-if="authStore.isAuthenticated"
          variant="secondary"
          :loading="markingAllRead"
          loading-text="处理中..."
          @click="toggleAllRead"
          :label="allRead ? '全部未读' : '全部已读'"
        />
      </div>

      <div v-if="loadingTimeline" class="feed-loading">
        <div v-for="i in 5" :key="i" class="a-skeleton feed-skeleton" />
      </div>

      <PEmpty v-else-if="!timeline.length" class="a-empty" :text="emptyTimelineText" />

      <div v-else class="feed-timeline">
        <template v-for="(item, index) in timeline" :key="itemKey(item)">
          <PEntry
            v-if="item.type === 'post' && item.post"
            :is-open="showArticleSheet && selectedArticle && itemKey(selectedArticle) === itemKey(item)"
            :is-read="item.is_read"
            :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
            @click="openArticleSheet(item, index)"
            :title="item.post.title"
            :summary="item.post.summary"
          >
            <template #visual>
              <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
                <PBadge type="internal" fill>内部</PBadge>
                <PBadge type="blog">博客</PBadge>
              </div>
            </template>
            <template #meta>
              <button
                v-if="postSource(item)"
                type="button"
                class="a-label a-muted feed-source-link feed-source-trigger"
                data-test="feed-source-trigger"
                @click.stop="openSourceSheet(postSource(item)!)"
              >
                {{ postSource(item)!.title }}
              </button>
              <span v-else class="a-label a-muted">未知频道</span>
              <span style="color:var(--a-color-muted-soft)">{{ formatDate(item.published_at) }}</span>
              <span v-if="item.is_read" class="a-label" style="color:var(--a-color-success)">已读</span>
            </template>

          </PEntry>

          <PEntry
            v-else-if="item.type === 'feed_item' && item.feed_item"
            :is-open="showArticleSheet && selectedArticle && itemKey(selectedArticle) === itemKey(item)"
            :is-read="item.is_read"
            :is-focused="uiStore.focusedSection === 'content' && focusedIndex === index"
            @click="openArticleSheet(item, index)"
            :title="item.feed_item.title"
            :summary="stripHtml(item.feed_item.summary || '')"
          >
            <template #visual>
              <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
                <PBadge type="external" fill>外部</PBadge>
                <PBadge type="external">{{ getExternalBadge(item.feed_item) }}</PBadge>
              </div>
            </template>

            <template #meta>
              <button
                v-if="feedItemSource(item.feed_item)"
                type="button"
                class="a-label a-muted feed-source-link feed-source-trigger"
                data-test="feed-source-trigger"
                @click.stop="openSourceSheet(feedItemSource(item.feed_item)!)"
              >
                {{ feedItemSource(item.feed_item)!.title }}
              </button>
              <span v-else class="a-label a-muted">RSS</span>
              <span v-if="item.feed_item.duration" style="color:var(--a-color-muted-soft);font-weight:700">
                时长: {{ item.feed_item.duration }}
              </span>
              <span style="color:var(--a-color-muted-soft)">{{ formatDate(item.feed_item.published_at) }}</span>
              <span v-if="item.is_read" class="a-label" style="color:var(--a-color-success)">已读</span>
            </template>

            <template #actions>
              <PClip
                v-if="item.feed_item.enclosure_url"
                :label="isPodcastPlaying(item.feed_item) ? '■ 播放中' : '▶ 播放播客'"
                @click="playPodcast(item.feed_item, $event)"
              />
              <PClip
                v-if="authStore.isAuthenticated"
                :active="starredIds.has(item.feed_item.id)"
                :label="starredIds.has(item.feed_item.id) ? '退藏' : '收藏'"
                @click="toggleStar(item.feed_item.id)"
              />
              <PClip
                v-if="authStore.isAuthenticated"
                :active="readingListIds.has(item.feed_item.id)"
                :label="readingListIds.has(item.feed_item.id) ? '移除' : '稍后阅读'"
                @click="toggleReadingList(item.feed_item.id)"
              />
              <div style="flex:1"></div>
              <a :href="item.feed_item.link" target="_blank" rel="noopener noreferrer" class="feed-item-external-link">
                ↗ 原文
              </a>
            </template>
          </PEntry>
        </template>

        <FeedTimelineFooter
          :page="currentPage"
          :page-size="pageLimit"
          :total="totalItems"
          :loading="loadingTimeline"
          @change-page="changePage"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PField from '@/components/ui/PField.vue'
import PClip from '@/components/ui/PClip.vue'
import PPress from '@/components/ui/PPress.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PShortcutHints from '@/components/ui/PShortcutHints.vue'
import SubscriptionAddSheet from '@/components/feed/SubscriptionAddSheet.vue'
import SubscriptionManageSheet from '@/components/feed/SubscriptionManageSheet.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { useFeedStore } from '@/stores/feed'
import { useOnboardingStore } from '@/stores/onboarding'
import { useUIStore } from '@/stores/ui'
import { useKeyboardList } from '@/composables/useKeyboardList'
import { Filter } from 'lucide-vue-next'
import type { AutoAddSubscriptionPayload, FeedArticleSource, FeedItem, TimelineItem } from '@/types'
import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'
import { useApiUrl } from '@/composables/useApi'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const playerStore = usePlayerStore()
const feedStore = useFeedStore()
const onboardingStore = useOnboardingStore()
const uiStore = useUIStore()

const API_URL = useApiUrl()
const feedCopy = {
  name: '订阅',
  homepageSub: '聚合你感兴趣的 RSS 订阅源与内容更新。',
}
const authHeaders = () => ({ Authorization: `Bearer ${authStore.token}` })

const subscriptions = computed(() => feedStore.subscriptions)
const groups = computed(() => feedStore.groups)
const starredIds = computed(() => feedStore.starredItemIds)
const readingListIds = computed(() => feedStore.readingListItemIds)
const normalizePage = (value: unknown) => {
  const parsed = Number.parseInt(String(value || '1'), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const querySourceId = computed(() => typeof route.query.source_id === 'string' ? route.query.source_id : null)
const queryGroupId = computed(() => typeof route.query.group_id === 'string' ? route.query.group_id : null)
const queryPage = computed(() => normalizePage(route.query.page))
const defaultGroupId = computed(() => groups.value.find((group) => group.name === '默认分组')?.id || '')
const nonDefaultGroups = computed(() => groups.value.filter((group) => group.name !== '默认分组'))
const emptyTimelineText = computed(() => {
  if (querySourceId.value || queryGroupId.value) return '当前筛选暂无更新'
  return subscriptions.value.length ? '订阅源暂无更新' : '订阅后开始探索'
})

const timeline = ref<TimelineItem[]>([])

const shortcutHints = [
  { key: 'H', label: '聚焦侧边栏' },
  { key: 'L', label: '聚焦内容区' },
  { key: 'J / K', label: '上下切换项目' },
  { key: 'Enter', label: '打开当前项' },
  { key: 'Esc', label: '关闭面板' },
  { key: 'M', label: '标记已读/未读' },
  { key: 'S', label: '收藏/退藏' },
  { key: 'L', label: '稍后阅读' },
  { key: 'V', label: '查看原文' }
]

const { focusedIndex, scrollToFocused } = useKeyboardList({
  items: timeline,
  section: 'content',
  onEnter: (item, index) => openArticleSheet(item, index),
  onAction: (key, item) => {
    switch (key) {
      case 'm': toggleRead(item); break
      case 's':
        if (item.type === 'feed_item' && item.feed_item) toggleStar(item.feed_item.id)
        break
      case 'l':
        if (item.type === 'feed_item' && item.feed_item) toggleReadingList(item.feed_item.id)
        break
      case 'v': window.open(item.feed_item?.link || '#', '_blank'); break
    }
  },
})

// Auto-focus first item when switching to content area
watch(() => uiStore.focusedSection, (section) => {
  if (section === 'content' && focusedIndex.value === -1 && timeline.value.length > 0) {
    focusedIndex.value = 0
    scrollToFocused()
  }
})

// Reset focus when timeline changes
watch(timeline, () => {
  if (focusedIndex.value >= timeline.value.length) {
    focusedIndex.value = timeline.value.length > 0 ? 0 : -1
  }
})

const totalItems = ref(0)
const currentPage = ref(1)
const pageLimit = 20
const unreadOnly = ref(false)
const loadingTimeline = ref(false)
const markingAllRead = ref(false)
const addingSubscription = ref(false)
const allRead = ref(false)
const showAddModal = ref(false)
const showManageSheet = ref(false)
const manageBusy = ref(false)
const addSubscriptionError = ref('')
const addSubscriptionResetKey = ref(0)

const showArticleSheet = ref(false)
const selectedArticle = ref<TimelineItem | null>(null)
const showSourceSheet = ref(false)
const selectedSource = ref<FeedArticleSource | null>(null)
const sourceArticles = ref<TimelineItem[]>([])
const sourceArticlesLoading = ref(false)
const sourceSubscribeBusy = ref(false)

const headerRef = ref<HTMLElement | null>(null)
const pageRootRef = ref<HTMLElement | null>(null)
const headerBottom = computed(() => {
  if (!showAddModal.value) return '56px'
  // 56px topbar + header content
  const height = headerRef.value?.offsetHeight || 160
  return `${56 + height}px`
})

const openArticleSheet = (item: TimelineItem, index?: number) => {
  if (index !== undefined) focusedIndex.value = index
  if (!item.post && !item.feed_item) return

  selectedArticle.value = item
  showArticleSheet.value = true
  if (authStore.isAuthenticated && item.type === 'feed_item' && item.feed_item && !item.is_read) {
    item.is_read = true
    void feedStore.markItemsRead([item.feed_item.id])
  }
}

const openSourceArticle = (item: TimelineItem) => {
  selectedArticle.value = item
  showArticleSheet.value = true
  if (authStore.isAuthenticated && item.type === 'feed_item' && item.feed_item && !item.is_read) {
    item.is_read = true
    void feedStore.markItemsRead([item.feed_item.id])
  }
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

const postSource = (item: TimelineItem): FeedArticleSource | null => {
  if (item.type !== 'post' || !item.post) return null
  const channelId = item.post.channel_id || item.post.channel?.id
  if (!channelId) return null
  return withSubscriptionState({
    type: 'internal_channel',
    id: channelId,
    title: item.post.channel?.name || '未命名频道',
    subscribed: false,
  })
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
    const response = await fetch(`${API_URL}/feed/timeline?${params}`, { headers })
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

const subscribeSelectedSource = async () => {
  if (!selectedSource.value || selectedSource.value.subscribed || !authStore.isAuthenticated) return

  sourceSubscribeBusy.value = true
  try {
    let success = false
    if (selectedSource.value.type === 'internal_channel') {
      success = await feedStore.subscribeToChannel(selectedSource.value.id)
    } else if (selectedSource.value.type === 'external_rss' && selectedSource.value.rssUrl) {
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

const closeAddModal = () => {
  showAddModal.value = false
  addSubscriptionError.value = ''
}

const toggleAddModal = () => {
  if (showAddModal.value) {
    closeAddModal()
    return
  }

  showManageSheet.value = false
  addSubscriptionError.value = ''
  showAddModal.value = true
}

const openManageSheet = () => {
  showAddModal.value = false
  addSubscriptionError.value = ''
  showManageSheet.value = true
}

const autoAddSubscription = async (payload: AutoAddSubscriptionPayload) => {
  addSubscriptionError.value = ''
  addingSubscription.value = true
  try {
    const success = await feedStore.autoAddSubscription(payload)
    if (success) {
      addSubscriptionResetKey.value += 1
      showAddModal.value = false
      await fetchTimeline()
      await onboardingStore.handleSubscriptionSuccess()
    } else {
      addSubscriptionError.value = feedStore.error || '添加失败，请检查地址是否正确'
    }
  } catch (error) {
    addSubscriptionError.value = error instanceof Error ? error.message : '添加失败'
  } finally {
    addingSubscription.value = false
  }
}

const createSubscriptionGroup = async (name: string) => {
  manageBusy.value = true
  try {
    const success = await feedStore.createGroup(name)
    if (!success) return
    await Promise.all([feedStore.fetchGroups(), feedStore.fetchSubscriptions()])
    await fetchTimeline()
  } finally {
    manageBusy.value = false
  }
}

const renameSubscription = async (id: string, title: string) => {
  manageBusy.value = true
  try {
    const success = await feedStore.updateSubscription(id, { title })
    if (success) await fetchTimeline()
  } finally {
    manageBusy.value = false
  }
}

const moveSubscription = async (id: string, groupId: string) => {
  manageBusy.value = true
  try {
    const success = await feedStore.updateSubscription(id, { group_id: groupId })
    if (success) await fetchTimeline()
  } finally {
    manageBusy.value = false
  }
}

const deleteSubscription = async (id: string) => {
  manageBusy.value = true
  try {
    await feedStore.unsubscribe(id)
    currentPage.value = 1
    await fetchTimeline()
  } finally {
    manageBusy.value = false
  }
}

const renameGroup = async (id: string, name: string) => {
  manageBusy.value = true
  try {
    await feedStore.updateGroup(id, name)
  } finally {
    manageBusy.value = false
  }
}

const deleteGroup = async (id: string) => {
  manageBusy.value = true
  try {
    await feedStore.deleteGroup(id)
    currentPage.value = 1
    await fetchTimeline()
  } finally {
    manageBusy.value = false
  }
}

const checkSubscriptionHealth = async (id: string) => {
  manageBusy.value = true
  try {
    await feedStore.checkSubscriptionHealth(id)
  } finally {
    manageBusy.value = false
  }
}

const checkAllSubscriptionsHealth = async () => {
  manageBusy.value = true
  try {
    await feedStore.checkAllSubscriptionsHealth()
  } finally {
    manageBusy.value = false
  }
}

const importOPML = async (file: File) => {
  manageBusy.value = true
  try {
    const result = await feedStore.importOPML(file)
    if (result) {
      currentPage.value = 1
      await fetchTimeline()
    }
  } finally {
    manageBusy.value = false
  }
}

const exportOPML = async () => {
  manageBusy.value = true
  try {
    const blob = await feedStore.exportOPML()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'atoman-subscriptions.opml'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } finally {
    manageBusy.value = false
  }
}

const getExternalBadge = (item: FeedItem) => {
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  // Check common RSS feed type indicators or categories if available in the future
  return '博客'
}

const toggleStar = async (feedItemId: string) => {
  if (!authStore.isAuthenticated) return
  await feedStore.toggleStar(feedItemId)
}

const toggleReadingList = async (feedItemId: string) => {
  if (!authStore.isAuthenticated) return
  await feedStore.toggleReadingListItem(feedItemId)
}

const toggleRead = (item: TimelineItem) => {
  if (!authStore.isAuthenticated || item.type !== 'feed_item' || !item.feed_item) return
  const id = item.feed_item.id
  item.is_read = !item.is_read
  if (item.is_read) {
    void feedStore.markItemsRead([id])
  } else {
    void feedStore.markItemsUnread([id])
  }
}

const itemKey = (item: TimelineItem) => {
  if (item.type === 'post' && item.post) return `post-${item.post.id}`
  if (item.type === 'feed_item' && item.feed_item) return `feed-${item.feed_item.id}`
  return `${item.type}-${item.published_at || ''}`
}

const formatDate = (date?: string) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()

const scrollToTop = async () => {
  await nextTick()
  pageRootRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const setPageInRoute = async (page: number, replace = false) => {
  const normalizedPage = normalizePage(page)
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

const changePage = async (page: number) => {
  const normalizedPage = normalizePage(page)
  if (normalizedPage === currentPage.value) return
  await setPageInRoute(normalizedPage)
  await scrollToTop()
}

const fetchTimeline = async () => {
  loadingTimeline.value = true

  try {
    const params = buildFeedTimelineQuery({
      page: currentPage.value,
      limit: pageLimit,
      sourceId: querySourceId.value,
      groupId: queryGroupId.value,
      unreadOnly: unreadOnly.value,
    })

    const headers = authStore.isAuthenticated ? authHeaders() : {}
    const response = await fetch(`${API_URL}/feed/timeline?${params}`, { headers })
    if (response.ok) {
      const data = await response.json()
      const items: TimelineItem[] = data.data || []
      const total = data.total ?? data.meta?.total ?? 0
      const totalPages = Math.max(1, Math.ceil(total / pageLimit))

      if (total > 0 && currentPage.value > totalPages) {
        await setPageInRoute(totalPages, true)
        return
      }

      timeline.value = items
      totalItems.value = total
    }
  } catch (error) {
    console.error(error)
  } finally {
    loadingTimeline.value = false
  }
}

const toggleUnreadOnly = () => {
  if (!authStore.isAuthenticated) return
  unreadOnly.value = !unreadOnly.value
  currentPage.value = 1
  void fetchTimeline()
}

const onItemClick = (item: TimelineItem) => {
  if (!authStore.isAuthenticated || item.type !== 'feed_item' || !item.feed_item || item.is_read) return
  item.is_read = true
  void feedStore.markItemsRead([item.feed_item.id])
}

const playPodcast = (feedItem: FeedItem, event: Event) => {
  event.preventDefault()
  event.stopPropagation()
  
  // Set the queue from current timeline items
  playerStore.setQueueFromCurrentItems(timeline.value)
  
  const timelineItem = timeline.value.find(
    (entry) => entry.type === 'feed_item' && entry.feed_item?.id === feedItem.id,
  )
  if (authStore.isAuthenticated && timelineItem && !timelineItem.is_read) {
    timelineItem.is_read = true
    void feedStore.markItemsRead([feedItem.id])
  }
  const tempSong = playerStore.createPodcastSong(feedItem)
  if (!tempSong) return
  playerStore.playSong(tempSong)
}

const isPodcastPlaying = (feedItem: FeedItem) =>
  playerStore.currentSong?.audio_url === feedItem.enclosure_url && playerStore.isPlaying

const toggleAllRead = async () => {
  markingAllRead.value = true
  try {
    if (allRead.value) {
      await feedStore.markAllFeedUnread()
      timeline.value.forEach((item) => {
        if (item.type === 'feed_item') item.is_read = false
      })
      allRead.value = false
    } else {
      await feedStore.markAllFeedRead()
      timeline.value.forEach((item) => {
        if (item.type === 'feed_item') item.is_read = true
      })
      allRead.value = true
    }
  } finally {
    markingAllRead.value = false
  }
}

watch(showManageSheet, (visible) => {
  if (visible && authStore.isAuthenticated) {
    void Promise.all([feedStore.fetchSubscriptions(), feedStore.fetchGroups()])
  }
})

watch(() => route.query.manage_subscriptions, async (value) => {
  if (value !== '1') return
  const query = { ...route.query }
  delete query.manage_subscriptions
  await router.replace({ query })
  if (authStore.isAuthenticated) {
    showManageSheet.value = true
  }
}, { immediate: true })

watch([querySourceId, queryGroupId, queryPage], async () => {
  currentPage.value = queryPage.value
  await fetchTimeline()
}, { immediate: true })

const handleKeyDownGlobal = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    showArticleSheet.value = false
    showAddModal.value = false
    showManageSheet.value = false
  }
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    void feedStore.fetchStarredIds()
    void feedStore.fetchReadingListIds()
  }
  window.addEventListener('keydown', handleKeyDownGlobal)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDownGlobal)
})
</script>

<style scoped>
.feed-page {
  padding-bottom: 12rem;
}

.feed-header-sticky {
  position: sticky;
  top: 56px;
  z-index: 1100;
  background: var(--a-color-bg);
  margin-top: -3rem;
  padding-top: 3rem;
  padding-left: 2rem;
  padding-right: 2rem;
  margin-left: -2rem;
  margin-right: -2rem;
}

.feed-login-state {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.feed-login-title {
  margin-bottom: 1.5rem;
}

.feed-login-copy {
  max-width: 28rem;
  margin-bottom: 2rem;
}

.feed-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1rem;
}

.filter-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s;
}

.filter-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #000;
}

.filter-toggle-btn.active {
  background: rgba(0, 0, 0, 0.08);
  color: #000;
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

.feed-source-trigger {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

</style>
