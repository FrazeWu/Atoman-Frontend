<template>
  <div ref="pageRootRef" class="a-page-xl feed-page">
    <div 
      ref="headerRef"
      :class="{ 'feed-header-sticky': showAddModal }"
    >
      <PPageHeader accent :title="feedCopy.name" :sub="feedCopy.homepageSub" mb="1rem">
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
      :subscription-rules="feedStore.subscriptionRules"
      :rule-apply-summary="feedStore.ruleApplySummary"
      :filter-rules="feedStore.filterRules"
      :automation-rules="feedStore.automationRules"
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
      @save-rule="saveSubscriptionRule"
      @move-rule-up="moveSubscriptionRuleUp"
      @move-rule-down="moveSubscriptionRuleDown"
      @apply-rule="applySubscriptionRule"
      @apply-all-rules="applyAllSubscriptionRules"
      @delete-rule="deleteSubscriptionRule"
      @update-filter-rules="updateFilterRules"
      @update-automation-rules="updateAutomationRules"
    />
    <FeedArticleSheet
      :show="showArticleSheet"
      :article="selectedArticle"
      :is-podcast-playing="selectedArticle?.type === 'feed_item' && selectedArticle.feed_item ? isPodcastPlaying(selectedArticle.feed_item) : false"
      :has-previous="selectedArticleIndex > 0"
      :has-next="selectedArticleIndex >= 0 && selectedArticleIndex < visibleTimeline.length - 1"
      :index="showSourceSheet ? 1 : 0"
      @close="showArticleSheet = false"
      @play-podcast="playFeedItemFromSheet"
      @previous="openPreviousArticle"
      @next="openNextArticle"
    />
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
        <form class="feed-search" data-test="feed-search-form" @submit.prevent="submitSearch">
          <input
            v-model="searchInput"
            data-test="feed-search-input"
            class="feed-search__input"
            type="search"
            placeholder="搜索标题、来源、摘要"
            aria-label="搜索订阅内容"
          />
          <button class="feed-search__submit" type="submit">搜索</button>
          <button
            v-if="activeSearchLabel"
            class="feed-search__clear"
            data-test="feed-search-clear"
            type="button"
            aria-label="清空搜索"
            @click="clearSearch"
          >
            清空
          </button>
        </form>
        <div class="source-type-filters" aria-label="来源类型筛选">
          <PSegmentedControl
            v-model="sourceTypeFilter"
            :options="sourceTypeFilterOptions"
          />
        </div>
        <div v-if="themeFilters.length" class="theme-filters" aria-label="主题筛选">
          <button
            v-for="theme in themeFilters"
            :key="theme"
            type="button"
            class="theme-filter-btn"
            :class="{ active: activeTheme === theme }"
            :data-test="`theme-filter-${theme.toLowerCase()}`"
            @click="activeTheme = activeTheme === theme ? '' : theme"
          >
            {{ theme }}
          </button>
        </div>
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

      <PEmpty v-else-if="!visibleTimeline.length" class="a-empty" :text="emptyTimelineText" />

      <div v-else class="feed-timeline">
        <template v-for="(item, index) in visibleTimeline" :key="itemKey(item)">
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
                <PBadge type="blog">文章</PBadge>
              </div>
            </template>
            <template #meta>
              <button
                v-if="postSource(item)"
                type="button"
                class="a-label feed-source-link feed-source-trigger"
                data-test="feed-source-trigger"
                :title="sourceTriggerLabel(postSource(item)!)"
                :aria-label="sourceTriggerLabel(postSource(item)!)"
                @click.stop="openPostSourceSheet(item)"
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
                class="a-label feed-source-link feed-source-trigger"
                data-test="feed-source-trigger"
                :title="sourceTriggerLabel(feedItemSource(item.feed_item)!)"
                :aria-label="sourceTriggerLabel(feedItemSource(item.feed_item)!)"
                @click.stop="openFeedItemSourceSheet(item.feed_item)"
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
                :label="starredIds.has(item.feed_item.id) ? '取消收藏' : '收藏'"
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
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

const sourceTypeFilterOptions = [
  { label: '全部', value: 'all', test: 'source-type-filter-all' },
  { label: '站内', value: 'internal', test: 'source-type-filter-internal' },
  { label: '文章', value: 'blog', test: 'source-type-filter-blog' },
  { label: '播客', value: 'podcast', test: 'source-type-filter-podcast' },
]
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
import type {
  AutoAddSubscriptionPayload,
  FeedArticleSource,
  FeedItem,
  FeedSubscriptionRuleMatchType,
  TimelineItem,
} from '@/types'
import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'
import { looksLikeUrl } from '@/utils/feedTitles'
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
const querySearch = computed(() => typeof route.query.q === 'string' ? route.query.q : '')
const searchInput = ref(querySearch.value)
const sourceTypeFilter = ref<'all' | 'internal' | 'blog' | 'podcast'>('all')
const activeTheme = ref('')
const activeSearchLabel = computed(() => querySearch.value.trim())
const defaultGroupId = computed(() => groups.value.find((group) => group.name === '默认分组')?.id || '')
const nonDefaultGroups = computed(() => groups.value.filter((group) => group.name !== '默认分组'))

function findSubscriptionByTimelineItem(item: TimelineItem) {
  if (item.type === 'feed_item' && item.feed_item) {
    const sourceId = item.feed_item.feed_source?.id || item.feed_item.feed_source_id
    if (!sourceId) return undefined
    return subscriptions.value.find((sub) => (
      sub.feed_source_id === sourceId
      || sub.feed_source?.id === sourceId
      || (!!item.feed_item?.feed_source?.rss_url && sub.feed_source?.rss_url === item.feed_item.feed_source.rss_url)
    ))
  }

  if (item.type === 'post' && item.post) {
    const channelId = item.post.channel_id || item.post.channel?.id
    if (!channelId) return undefined
    return subscriptions.value.find((sub) => (
      sub.feed_source?.source_type === 'internal_channel'
      && sub.feed_source.source_id === channelId
    ))
  }

  return undefined
}

const emptyTimelineText = computed(() => {
  if (querySearch.value.trim()) return `没有找到“${querySearch.value.trim()}”`
  if (querySourceId.value || queryGroupId.value) return '当前筛选暂无更新'
  return subscriptions.value.length ? '订阅源暂无更新' : '订阅后开始探索'
})

const timeline = ref<TimelineItem[]>([])
const visibleTimeline = computed(() => {
  const hiddenKeywords = feedStore.filterRules.hiddenKeywords.map((keyword) => keyword.toLocaleLowerCase())

  return timeline.value.filter((item) => {
    if (!matchesSourceTypeFilter(item, sourceTypeFilter.value)) return false
    if (!matchesThemeFilter(item, activeTheme.value)) return false

    if (findSubscriptionByTimelineItem(item)?.is_muted) return false

    if (!hiddenKeywords.length) return true

    const title = item.type === 'feed_item'
      ? (item.feed_item?.title || '')
      : (item.post?.title || '')
    const summary = item.type === 'feed_item'
      ? stripHtml(item.feed_item?.summary || '')
      : (item.post?.summary || '')

    const haystack = `${title}\n${summary}`.toLocaleLowerCase()
    return !hiddenKeywords.some((keyword) => haystack.includes(keyword))
  })
})

const themeFilters = computed(() => {
  const counts = new Map<string, number>()

  timeline.value.forEach((item) => {
    extractThemesFromItem(item).forEach((theme) => {
      counts.set(theme, (counts.get(theme) || 0) + 1)
    })
  })

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([theme]) => theme)
})

const shortcutHints = [
  { key: 'H', label: '聚焦侧边栏' },
  { key: 'L', label: '聚焦内容区' },
  { key: 'J / K', label: '上下切换项目' },
  { key: 'Enter', label: '打开当前项' },
  { key: 'Esc', label: '关闭面板' },
  { key: 'M', label: '标记已读/未读' },
  { key: 'S', label: '收藏/取消收藏' },
  { key: 'L', label: '稍后阅读' },
  { key: 'V', label: '查看原文' }
]

const { focusedIndex, scrollToFocused } = useKeyboardList({
  items: visibleTimeline,
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
  if (section === 'content' && focusedIndex.value === -1 && visibleTimeline.value.length > 0) {
    focusedIndex.value = 0
    scrollToFocused()
  }
})

// Reset focus when timeline changes
watch(visibleTimeline, () => {
  if (focusedIndex.value >= visibleTimeline.value.length) {
    focusedIndex.value = visibleTimeline.value.length > 0 ? 0 : -1
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
const selectedArticleIndex = computed(() => {
  if (!selectedArticle.value) return -1
  return visibleTimeline.value.findIndex((item) => itemKey(item) === itemKey(selectedArticle.value!))
})
const showSourceSheet = ref(false)
const selectedSource = ref<FeedArticleSource | null>(null)
const sourceArticles = ref<TimelineItem[]>([])
const sourceArticlesLoading = ref(false)
const sourceSubscribeBusy = ref(false)

const headerRef = ref<HTMLElement | null>(null)
const pageRootRef = ref<HTMLElement | null>(null)
const headerBottom = computed(() => {
  if (!showAddModal.value) return '56px'
  const height = headerRef.value?.offsetHeight || 160
  return `${height}px`
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

const openPreviousArticle = () => {
  if (selectedArticleIndex.value <= 0) return
  const nextItem = visibleTimeline.value[selectedArticleIndex.value - 1]
  if (!nextItem) return
  openArticleSheet(nextItem, selectedArticleIndex.value - 1)
}

const openNextArticle = () => {
  if (selectedArticleIndex.value < 0 || selectedArticleIndex.value >= visibleTimeline.value.length - 1) return
  const nextItem = visibleTimeline.value[selectedArticleIndex.value + 1]
  if (!nextItem) return
  openArticleSheet(nextItem, selectedArticleIndex.value + 1)
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

const sourceDisplayTitle = (source: FeedArticleSource, subscriptionTitle?: string) => {
  const customTitle = subscriptionTitle?.trim()
  if (customTitle && !looksLikeUrl(customTitle)) return customTitle

  const normalizedTitle = source.title?.trim()
  if (normalizedTitle) return normalizedTitle

  if (customTitle) return customTitle

  if (source.type === 'external_rss') {
    const rssUrl = source.rssUrl?.trim()
    if (rssUrl) return rssUrl
  }

  return source.type === 'external_rss' ? 'RSS' : '未命名频道'
}

const postSource = (item: TimelineItem): FeedArticleSource | null => {
  if (item.type !== 'post' || !item.post) return null
  const channelId = item.post.channel_id || item.post.channel?.id
  if (!channelId) return null
  const subscription = findSubscriptionForSource({
    type: 'internal_channel',
    id: channelId,
    title: item.post.channel?.name || '',
    subscribed: false,
  })
  return withSubscriptionState({
    type: 'internal_channel',
    id: channelId,
    title: sourceDisplayTitle(
      {
        type: 'internal_channel',
        id: channelId,
        title: item.post.channel?.name || '',
        subscribed: false,
      },
      subscription?.title,
    ),
    subscribed: false,
  })
}

const feedItemSource = (item: FeedItem): FeedArticleSource | null => {
  const sourceId = item.feed_source?.id || item.feed_source_id
  if (!sourceId) return null
  const subscription = findSubscriptionForSource({
    type: 'external_rss',
    id: sourceId,
    title: item.feed_source?.title || '',
    rssUrl: item.feed_source?.rss_url,
    subscribed: false,
  })
  return withSubscriptionState({
    type: 'external_rss',
    id: sourceId,
    title: sourceDisplayTitle(
      {
        type: 'external_rss',
        id: sourceId,
        title: item.feed_source?.title || '',
        rssUrl: item.feed_source?.rss_url,
        subscribed: false,
      },
      subscription?.title,
    ),
    rssUrl: item.feed_source?.rss_url,
    subscribed: false,
  })
}

const sourceTriggerLabel = (source: FeedArticleSource) => `查看 ${source.title} 的所有文章`

const openPostSourceSheet = async (item: TimelineItem) => {
  const source = postSource(item)
  if (!source) return
  await openSourceSheet(source)
}

const openFeedItemSourceSheet = async (item: FeedItem) => {
  const source = feedItemSource(item)
  if (!source) return
  await openSourceSheet(source)
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

type SubscriptionRuleSavePayload = {
  id: string | null
  payload: {
    name: string
    enabled: boolean
    match_type: FeedSubscriptionRuleMatchType
    conditions_json: Record<string, unknown>
    action_group_id?: string | null
    action_muted?: boolean | null
    action_auto_mark_read?: boolean | null
    action_auto_add_reading_list?: boolean | null
  }
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

const withManageBusy = async <T>(task: () => Promise<T>): Promise<T> => {
  manageBusy.value = true
  try {
    return await task()
  } finally {
    manageBusy.value = false
  }
}

const createSubscriptionGroup = async (name: string) => {
  await withManageBusy(async () => {
    const success = await feedStore.createGroup(name)
    if (!success) return
    await Promise.all([feedStore.fetchGroups(), feedStore.fetchSubscriptions()])
    await fetchTimeline()
  })
}

const renameSubscription = async (id: string, title: string) => {
  await withManageBusy(async () => {
    const success = await feedStore.updateSubscription(id, { title })
    if (success) await fetchTimeline()
  })
}

const moveSubscription = async (id: string, groupId: string) => {
  await withManageBusy(async () => {
    await feedStore.setSubscriptionGroup(id, groupId || null)
    await fetchTimeline()
  })
}

const deleteSubscription = async (id: string) => {
  await withManageBusy(async () => {
    await feedStore.unsubscribe(id)
    currentPage.value = 1
    await fetchTimeline()
  })
}

const renameGroup = async (id: string, name: string) => {
  await withManageBusy(async () => {
    await feedStore.updateGroup(id, name)
  })
}

const deleteGroup = async (id: string) => {
  await withManageBusy(async () => {
    await feedStore.deleteGroup(id)
    currentPage.value = 1
    await fetchTimeline()
  })
}

const checkSubscriptionHealth = async (id: string) => {
  await withManageBusy(async () => {
    await feedStore.checkSubscriptionHealth(id)
  })
}

const checkAllSubscriptionsHealth = async () => {
  await withManageBusy(async () => {
    await feedStore.checkAllSubscriptionsHealth()
  })
}

const importOPML = async (file: File) => {
  await withManageBusy(async () => {
    const result = await feedStore.importOPML(file)
    if (result) {
      currentPage.value = 1
      await fetchTimeline()
    }
  })
}

const exportOPML = async () => {
  await withManageBusy(async () => {
    const blob = await feedStore.exportOPML()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'atoman-subscriptions.opml'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  })
}

const findSavedRuleId = (saved: SubscriptionRuleSavePayload) => {
  if (saved.id) return saved.id
  const matchedRules = feedStore.subscriptionRules.filter((rule) =>
    rule.name === saved.payload.name
    && rule.match_type === saved.payload.match_type
    && JSON.stringify(rule.conditions_json) === JSON.stringify(saved.payload.conditions_json),
  )
  return matchedRules[matchedRules.length - 1]?.id || null
}

const confirmApplySavedRule = async (ruleId: string | null) => {
  if (!ruleId) return
  if (!window.confirm('规则已保存，是否立即应用到已有订阅？')) return
  await feedStore.applySubscriptionRules({ rule_id: ruleId })
}

const saveSubscriptionRule = async (saved: SubscriptionRuleSavePayload) => {
  await withManageBusy(async () => {
    const success = saved.id
      ? await feedStore.updateSubscriptionRule(saved.id, saved.payload)
      : await feedStore.createSubscriptionRule(saved.payload)
    if (!success) return

    await confirmApplySavedRule(findSavedRuleId(saved))
    await fetchTimeline()
  })
}

const reorderSubscriptionRules = async (nextRuleIds: string[]) => {
  await withManageBusy(async () => {
    await feedStore.reorderSubscriptionRules(nextRuleIds)
  })
}

const moveSubscriptionRuleUp = async (id: string) => {
  const index = feedStore.subscriptionRules.findIndex((rule) => rule.id === id)
  if (index <= 0) return
  const next = [...feedStore.subscriptionRules]
  const [target] = next.splice(index, 1)
  next.splice(index - 1, 0, target)
  await reorderSubscriptionRules(next.map((rule) => rule.id))
}

const moveSubscriptionRuleDown = async (id: string) => {
  const index = feedStore.subscriptionRules.findIndex((rule) => rule.id === id)
  if (index < 0 || index >= feedStore.subscriptionRules.length - 1) return
  const next = [...feedStore.subscriptionRules]
  const [target] = next.splice(index, 1)
  next.splice(index + 1, 0, target)
  await reorderSubscriptionRules(next.map((rule) => rule.id))
}

const applySubscriptionRule = async (id: string) => {
  await withManageBusy(async () => {
    await feedStore.applySubscriptionRules({ rule_id: id })
    await fetchTimeline()
  })
}

const applyAllSubscriptionRules = async () => {
  await withManageBusy(async () => {
    await feedStore.applySubscriptionRules({ all: true })
    await fetchTimeline()
  })
}

const deleteSubscriptionRule = async (id: string) => {
  await withManageBusy(async () => {
    await feedStore.deleteSubscriptionRule(id)
  })
}

const updateFilterRules = (rules: { mutedSourceIds: string[]; hiddenKeywords: string[] }) => {
  feedStore.setFilterRules(rules)
}

const updateAutomationRules = (rules: {
  autoMarkReadSourceIds: string[]
  autoAddReadingListSourceIds: string[]
}) => {
  feedStore.setAutomationRules(rules)
}

const getExternalBadge = (item: FeedItem) => {
  if (item.enclosure_url) {
    if (item.enclosure_type?.startsWith('audio/')) return '播客'
    if (item.enclosure_type?.startsWith('video/')) return '视频'
  }
  // Check common RSS feed type indicators or categories if available in the future
  return '文章'
}

const matchesSourceTypeFilter = (
  item: TimelineItem,
  filter: 'all' | 'internal' | 'blog' | 'podcast',
) => {
  if (filter === 'all') return true
  if (filter === 'internal') return item.type === 'post'
  if (item.type !== 'feed_item' || !item.feed_item) return false

  const badge = getExternalBadge(item.feed_item)
  if (filter === 'podcast') return badge === '播客'
  if (filter === 'blog') return badge === '文章'
  return true
}

const extractThemesFromItem = (item: TimelineItem) => {
  const parts = item.type === 'feed_item'
    ? [
        item.feed_item?.title || '',
        item.feed_item?.summary || '',
        item.feed_item?.feed_source?.title || '',
      ]
    : [
        item.post?.title || '',
        item.post?.summary || '',
        item.post?.channel?.name || '',
      ]

  const text = parts.join(' ')
  const matches = text.match(/\b[A-Z][A-Z0-9+\-]{1,}\b/g) || []
  return Array.from(new Set(matches.map((value) => value.trim()).filter(Boolean)))
}

const matchesThemeFilter = (item: TimelineItem, theme: string) => {
  if (!theme) return true
  return extractThemesFromItem(item).includes(theme)
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

const setSearchInRoute = async (value: string) => {
  const search = value.trim()
  await router.replace({
    query: {
      ...route.query,
      q: search || undefined,
      page: undefined,
    },
  })
}

const submitSearch = async () => {
  await setSearchInRoute(searchInput.value)
}

const clearSearch = async () => {
  searchInput.value = ''
  await setSearchInRoute('')
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
    if (!authStore.isAuthenticated) {
      timeline.value = []
      totalItems.value = 0
      return
    }

    const params = buildFeedTimelineQuery({
      page: currentPage.value,
      limit: pageLimit,
      sourceId: querySourceId.value,
      groupId: queryGroupId.value,
      unreadOnly: unreadOnly.value,
      q: querySearch.value,
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
      await applyAutomationRules(items)
    }
  } catch (error) {
    console.error(error)
  } finally {
    loadingTimeline.value = false
  }
}

const applyAutomationRules = async (items: TimelineItem[]) => {
  if (!authStore.isAuthenticated) return

  const autoReadSubscriptionSourceIds = new Set(
    subscriptions.value
      .filter((sub) => sub.auto_mark_read)
      .map((sub) => sub.feed_source?.id || sub.feed_source_id)
      .filter(Boolean),
  )
  const autoReadingListSubscriptionSourceIds = new Set(
    subscriptions.value
      .filter((sub) => sub.auto_add_reading_list)
      .map((sub) => sub.feed_source?.id || sub.feed_source_id)
      .filter(Boolean),
  )
  if (!autoReadSubscriptionSourceIds.size && !autoReadingListSubscriptionSourceIds.size) return

  const pendingReadIds = items
    .filter((item) => (
      item.type === 'feed_item'
      && item.feed_item
      && !item.is_read
      && autoReadSubscriptionSourceIds.has(item.feed_item.feed_source?.id || item.feed_item.feed_source_id || '')
    ))
    .map((item) => item.feed_item!.id)

  items.forEach((item) => {
    if (
      item.type === 'feed_item'
      && item.feed_item
      && pendingReadIds.includes(item.feed_item.id)
    ) {
      item.is_read = true
    }
  })

  if (pendingReadIds.length) {
    await feedStore.markItemsRead(pendingReadIds)
  }

  const pendingReadingListIds = items
    .filter((item) => (
      item.type === 'feed_item'
      && item.feed_item
      && !readingListIds.value.has(item.feed_item.id)
      && autoReadingListSubscriptionSourceIds.has(item.feed_item.feed_source?.id || item.feed_item.feed_source_id || '')
    ))
    .map((item) => item.feed_item!.id)

  for (const feedItemId of pendingReadingListIds) {
    await feedStore.toggleReadingListItem(feedItemId)
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
  playFeedItemFromSheet(feedItem)
}

const isPodcastPlaying = (feedItem: FeedItem) =>
  playerStore.currentSong?.audio_url === feedItem.enclosure_url && playerStore.isPlaying

const playFeedItemFromSheet = (feedItem: FeedItem) => {
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
  playerStore.playQueuedSong(tempSong)
}

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
    void Promise.all([
      feedStore.fetchSubscriptions(),
      feedStore.fetchGroups(),
      feedStore.fetchSubscriptionRules(),
    ])
  }
})

watch(subscriptions, async (nextSubscriptions, previousSubscriptions) => {
  if (!authStore.isAuthenticated || !timeline.value.length) return

  const previousCount = previousSubscriptions?.length || 0
  const nextCount = nextSubscriptions.length
  if (!nextCount || nextCount === previousCount) return

  await applyAutomationRules(timeline.value)
}, { deep: true })

watch(querySearch, (next) => {
  searchInput.value = next
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

watch([querySourceId, queryGroupId, queryPage, querySearch], async () => {
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

.source-type-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.theme-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.source-type-filter-btn {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  padding: 0.45rem 0.7rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.source-type-filter-btn.active {
  background: var(--a-color-paper-wash);
  border-color: var(--a-color-text);
}

.theme-filter-btn {
  border: 1px dashed var(--a-color-line-soft);
  background: transparent;
  color: var(--a-color-text);
  padding: 0.45rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.theme-filter-btn.active {
  border-style: solid;
  background: var(--a-color-paper-wash);
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
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.feed-search {
  display: grid;
  grid-template-columns: minmax(12rem, 22rem) auto auto;
  align-items: center;
  gap: 0.5rem;
  margin-right: auto;
}

.feed-search__input {
  min-width: 0;
  height: 2.25rem;
  border: 0;
  border-bottom: 2px solid var(--a-color-ink);
  border-radius: 0;
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  font: inherit;
  padding: 0 0.65rem;
  outline: none;
}

.feed-search__input:focus {
  border-bottom-color: var(--a-color-accent-confirm);
}

.feed-search__submit,
.feed-search__clear {
  height: 2.25rem;
  border: 0;
  border-radius: 0;
  padding: 0 0.75rem;
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  font-family: var(--a-font-meta);
  font-weight: 800;
  cursor: pointer;
}

.feed-search__clear {
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink);
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
  box-shadow: var(--a-shadow-paper-sm);
}

.feed-source-trigger {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.16em;
}

.feed-source-trigger:hover {
  color: var(--a-color-ink);
  text-decoration-thickness: 2px;
}

.feed-source-trigger:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: 2px;
}

@media (max-width: 720px) {
  .feed-actions {
    align-items: stretch;
  }

  .feed-search {
    grid-template-columns: 1fr auto;
    width: 100%;
  }

  .feed-search__clear {
    grid-column: 1 / -1;
  }
}

</style>
