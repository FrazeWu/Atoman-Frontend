<template>
  <div class="feed-recommended-view">
    <PPageHeader
      title="发现"
      description="探索优质博客、独立订阅源、深度专栏与全网精选好文。"
    />

    <!-- ═══════════════════════════════════════════════════════════════
         1. 顶部总控工具栏（SearchSurface + 语言选择 + +订阅）
         ═══════════════════════════════════════════════════════════════ -->
    <div class="discovery-top-toolbar">
      <div class="discovery-search-box">
        <ModuleSearch v-if="unifiedSearchEnabled" v-model="discoverySearchQuery" :target-types="['feed', 'article']" placeholder="搜索订阅源与文章..." input-test-id="discovery-search-input" dropdown-test-id="discovery-search-dropdown" />
        <SearchSurface
          v-else
          :query="discoverySearchQuery"
          eyebrow=""
          placeholder="搜索全网文章、专栏、RSS 订阅源与播客..."
          :open="discoverySearchOpen"
          :loading="discoverySearchLoading"
          input-test-id="discovery-search-input"
          dropdown-test-id="discovery-search-dropdown"
          aria-label="搜索订阅与文章"
          @update:query="handleDiscoverySearchInput"
          @focus="handleDiscoverySearchFocus"
          @blur="handleDiscoverySearchBlur"
        >
          <template #results>
            <p v-if="discoverySearchError" class="discovery-search-hint error">{{ discoverySearchError }}</p>
            <template v-else>
              <section v-if="discoverySearchSources.length" class="discovery-search-group">
                <div class="discovery-search-group__head">
                  <strong>订阅源</strong>
                  <span>{{ discoverySearchSources.length }}</span>
                </div>
                <button
                  v-for="source in discoverySearchSources"
                  :key="`source-${source.id}`"
                  type="button"
                  class="discovery-search-result"
                  @click="openDiscoverySearchSource(source)"
                >
                  <span class="discovery-search-result__main">
                    <strong>{{ source.title }}</strong>
                    <small>{{ source.rssUrl || source.category }}</small>
                  </span>
                  <span class="discovery-search-result__status">{{ source.subscribed ? '已订阅' : '订阅源' }}</span>
                </button>
              </section>

              <section v-if="discoverySearchArticles.length" class="discovery-search-group">
                <div class="discovery-search-group__head">
                  <strong>文章</strong>
                  <span>{{ discoverySearchArticles.length }}</span>
                </div>
                <button
                  v-for="article in discoverySearchArticles"
                  :key="`article-${article.id}`"
                  type="button"
                  class="discovery-search-result"
                  @click="openDiscoverySearchArticle(article)"
                >
                  <span class="discovery-search-result__main">
                    <strong>{{ article.title }}</strong>
                    <small>{{ article.sourceTitle || article.summary || '文章' }}</small>
                  </span>
                  <span class="discovery-search-result__status">文章</span>
                </button>
              </section>

              <p v-if="!discoverySearchSources.length && !discoverySearchArticles.length" class="discovery-search-hint">没有匹配的结果</p>
            </template>
          </template>
        </SearchSurface>
      </div>

      <div class="discovery-top-actions">
        <PSelect
          v-model="language"
          :options="recommendationLanguageOptions"
          placeholder="语言"
          class="discovery-lang-select"
        />
        <PButton
          v-if="authStore.isAuthenticated"
          variant="primary"
          size="sm"
          class="discovery-add-btn"
          data-test="open-discovery-add-subscription"
          :label="showAddModal ? '取消添加' : '添加订阅'"
          @click="toggleAddModal"
        />
      </div>
    </div>

    <!-- 手动添加订阅抽屉 -->
    <SubscriptionAddSheet
      v-if="authStore.isAuthenticated"
      :show="showAddModal"
      :groups="feedStore.groups"
      :submitting="addingSubscription"
      :error="addSubscriptionError"
      :reset-key="addSubscriptionResetKey"
      @close="showAddModal = false"
      @submit="addSubscription"
    />

    <!-- ═══════════════════════════════════════════════════════════════
         2. 主题与领域胶囊栏（Horizontal Category & Theme Pills）
         ═══════════════════════════════════════════════════════════════ -->
    <FeedRecommendedTopicsBar
      :category="category"
      :theme="theme"
      :category-options="categoryOptions"
      :themes="themes"
      @select-category="selectCategory"
      @select-theme="selectTheme"
    />

    <p v-if="currentThemeDescription" class="theme-desc-banner">{{ currentThemeDescription }}</p>

    <!-- ═══════════════════════════════════════════════════════════════
         3. 核心左右双并列信息流（Dual Parallel Streams）
         ═══════════════════════════════════════════════════════════════ -->
      <div class="dual-streams-container">
        <!-- 👈 左信息流：🔥 精选热门文章流 -->
        <section class="stream-column" aria-label="精选文章">
          <div class="stream-column__head">
            <div class="stream-column__title-group">
              <span class="section-badge section-badge--hot">ARTICLES</span>
              <h2>精选文章</h2>
              <span class="stream-count">{{ totalArticles }} 篇</span>
            </div>
            <div class="stream-sub-filters">
              <PSegmentedControl v-model="mode" :options="modeOptions" />
            </div>
          </div>

          <PContentProgress :loading="articlesLoading" :error="articlesError" :retry="() => fetchArticleRecommendations(recommendationParams(), recommendationRequest)">
            <template #skeleton>
              <div v-for="i in 5" :key="i" class="recommendation-skeleton">
                <PSkeleton width="40%" height="14px" />
                <PSkeleton width="85%" height="20px" />
                <PSkeleton width="60%" height="14px" />
              </div>
            </template>
          <PEmpty
            v-if="!articles.length"
            title="暂无推荐文章"
            description="切换其他分类或主题查看更多精选内容。"
          />

          <div v-else class="feed-timeline-box">
            <PContentCard
              v-for="item in articles"
              :key="item.id"
              :title="item.title"
              :summary="item.summary || item.description"
              class="content-stream-entry"
              @click="openArticle(item)"
            >
              <template #visual>
                <PAvatar
                  data-test="feed-article-avatar"
                  :src="articleAvatarURL(item)"
                  :name="item.source_title || item.title"
                  :alt="`${item.source_title || item.title} 的头像`"
                  size="xs"
                />
              </template>

              <template #meta>
                <button
                  v-if="item.source_title"
                  type="button"
                  class="a-label feed-source-link feed-source-trigger"
                  @click.stop="openArticleSource(item)"
                >
                  {{ item.source_title }}
                </button>
                <span v-else class="a-label a-muted">精选</span>

                <span class="feed-entry-stats">
                  <span class="feed-meta-stat"><Eye :size="11" aria-hidden="true" />{{ item.view_count || 0 }}</span>
                  <span v-if="hasPublicRating(item.rating_count)" class="feed-meta-stat"><Gauge :size="11" aria-hidden="true" />{{ formatPublicRating(item.rating_score, item.rating_count) }}</span>
                  <span class="feed-meta-stat"><Bookmark :size="11" aria-hidden="true" />{{ item.bookmark_count || 0 }}</span>
                </span>
                <span style="color:var(--a-color-muted-soft)">{{ formatDate(item.last_published_at) }}</span>
                <span
                  class="feed-type-tag"
                  :class="item.source_type === 'internal' ? 'feed-type-tag--blog' : 'feed-type-tag--rss'"
                >
                  {{ item.source_type === 'internal' ? '文章' : (item.source_category || '外部') }}
                </span>
              </template>

              <template #actions>
                <PClip
                  v-if="authStore.isAuthenticated"
                  :active="isStarred(item)"
                  :title="isStarred(item) ? '取消收藏' : '收藏'"
                  @click.stop="toggleStar(item)"
                >
                  <BookmarkCheck v-if="isStarred(item)" :size="14" />
                  <Bookmark v-else :size="14" />
                </PClip>
                <PClip
                  v-if="authStore.isAuthenticated"
                  :active="isReadingList(item)"
                  :title="isReadingList(item) ? '取消稍后阅读' : '稍后阅读'"
                  @click.stop="toggleReadingList(item)"
                >
                  <Clock :size="14" />
                </PClip>
                <details v-if="authStore.isAuthenticated" class="recommendation-feedback" @click.stop>
                  <summary aria-label="推荐反馈" title="推荐反馈"><span aria-hidden="true">⋯</span></summary>
                  <div class="recommendation-feedback__menu">
                    <button type="button" @click="submitRecommendationFeedback(item, 'hide')">不感兴趣</button>
                    <button v-if="item.source_id || item.source_title" type="button" @click="submitRecommendationFeedback(item, 'less_source')">少推荐此来源</button>
                    <button type="button" @click="showRecommendationReason(item)">为什么推荐？</button>
                  </div>
                </details>
              </template>
            </PContentCard>
          </div>
          </PContentProgress>
        </section>

        <!-- 👉 右信息流：💡 优质频道与源推荐流 -->
        <section class="stream-column" aria-label="推荐频道">
          <div class="stream-column__head">
            <div class="stream-column__title-group">
              <span class="section-badge">CHANNELS</span>
              <h2>推荐频道与源</h2>
              <span class="stream-count">{{ totalChannels }} 个</span>
            </div>
          </div>

          <PContentProgress :loading="channelsLoading" :error="channelsError" :retry="() => fetchChannelRecommendations(recommendationParams(), recommendationRequest)">
            <template #skeleton>
              <div v-for="i in 4" :key="i" class="recommendation-skeleton">
                <PSkeleton width="50%" height="18px" />
                <PSkeleton width="90%" height="14px" />
                <PSkeleton width="35%" height="12px" />
              </div>
            </template>
          <PEmpty
            v-if="!channels.length"
            title="暂无推荐频道"
            description="切换其他分类或探索更多订阅源。"
          />

          <div v-else class="channels-stack">
            <FeedSourceIdentityCard
              v-for="item in channels"
              :key="item.id"
              :source="{ ...toRecommendedSource(item), subscribed: Boolean(item.subscribed) }"
              :color="buildSourceColor(item.title || item.id)"
              :avatar-label="buildSourceAvatarLabel(item.title)"
              :display-url="''"
              :image-url="item.image_url"
              :eyebrow="channelMetricLabel(item)"
              :summary-text="channelSummaryText(item)"
              :metadata-text="channelMetadataText(item)"
              :subscribe-busy="isChannelSubscribeBusy(item.id)"
              :show-subscribe="true"
              :show-previews="true"
              :show-meta="true"
              data-test="channel-card"
              @select="openRecommendedChannel(item)"
              @subscribe="subscribeRecommendedChannel(item)"
            >
              <template #actions>
                <details v-if="authStore.isAuthenticated" class="recommendation-feedback" @click.stop>
                  <summary aria-label="推荐反馈" title="推荐反馈"><span aria-hidden="true">⋯</span></summary>
                  <div class="recommendation-feedback__menu">
                    <button type="button" @click="submitRecommendationFeedback(item, 'hide')">不感兴趣</button>
                    <button type="button" @click="submitRecommendationFeedback(item, 'less_source')">少推荐此来源</button>
                    <button type="button" @click="showRecommendationReason(item)">为什么推荐？</button>
                  </div>
                </details>
              </template>
            </FeedSourceIdentityCard>
          </div>
          </PContentProgress>
        </section>
      </div>

      <div class="feed-recommendation-actions">
        <PButton
          variant="primary"
          label="换一批"
          :loading="loading"
          data-test="feed-recommend-refresh"
          @click="refreshRecommendationBatch"
        />
      </div>

    <!-- 文章详情阅读抽屉 -->
    <FeedArticleSheet
      :index="showChannelSheet ? 1 : 0"
      :show="showChannelArticleSheet"
      :article="selectedChannelArticle"
      @close="closeChannelArticleSheet"
      @toggle-star="selectedChannelArticle && toggleChannelArticleStar(selectedChannelArticle)"
      @toggle-reading-list="selectedChannelArticle && toggleChannelArticleReadingList(selectedChannelArticle)"
      @require-auth="handleArticleRequireAuth"
    />

    <!-- 频道文章列表抽屉 -->
    <FeedSourceArticlesSheet
      :layer-index="0"
      :show="showChannelSheet"
      :source="selectedChannelSource"
      :items="channelArticles"
      :loading="channelArticlesLoading"
      :subscribe-busy="selectedChannelSubscribeBusy"
      :show-subscribe="true"
      @close="closeChannelSheet"
      @open-article="openChannelArticleFromSheet"
      @subscribe="subscribeSelectedChannel"
    />

    <PToast
      v-model="subscriptionToastVisible"
      :message="subscriptionToastMessage"
      :type="subscriptionToastType"
    />

    <!-- 推荐依据弹窗 -->
    <PModal
      :show="Boolean(activeReasonItem)"
      size="sm"
      title="推荐依据"
      @close="activeReasonItem = null"
    >
      <div class="recommendation-reason-dialog">
        <p class="recommendation-reason-title">{{ activeReasonItem?.title }}</p>
        <p class="recommendation-reason-body">
          {{ activeReasonItem?.score_label ? `依据：${activeReasonItem.score_label}` : '综合你的关注、收藏、评分与内容新鲜度推荐。' }}
        </p>
      </div>
      <template #footer>
        <div class="recommendation-reason-footer">
          <PButton variant="primary" label="知道了" @click="activeReasonItem = null" />
        </div>
      </template>
    </PModal>
  </div>
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bookmark, BookmarkCheck, Clock, Eye, Gauge } from 'lucide-vue-next'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PClip from '@/components/ui/PClip.vue'
import PModal from '@/components/ui/PModal.vue'
import PToast from '@/components/ui/PToast.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import ModuleSearch from '@/components/search/ModuleSearch.vue'
import { unifiedSearchEnabled } from '@/utils/searchUrl'
import SubscriptionAddSheet from '@/components/feed/SubscriptionAddSheet.vue'
import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'
import FeedRecommendedTopicsBar from '@/components/feed/FeedRecommendedTopicsBar.vue'
import { useFeedRecommendedPendingAuth } from '@/composables/feed/useFeedRecommendedPendingAuth'
import { useApi } from '@/composables/useApi'
import { formatPublicRating, hasPublicRating } from '@/utils/rating'
import { useFeedStore } from '@/stores/feed'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
import { buildSourceAvatarLabel, buildSourceColor, buildSourceFaviconURL } from '@/utils/feedSourcePresentation'
import { deduplicateRecommendationItems, deduplicateRecommendedChannels } from '@/utils/recommendationItems'
import {
  ALL_RECOMMENDATION_LANGUAGE,
  detectDefaultRecommendationLanguage,
  normalizeRecommendationLanguage,
  recommendationLanguageOptions,
  type RecommendationLanguage,
} from '@/utils/recommendationLanguage'
import type { AutoAddSubscriptionPayload, FeedArticleSource, FeedExploreRecentItem, FeedExploreSource, FeedItem, FeedRecommendationTheme, FeedSourceCategory, Post, TimelineItem } from '@/types'

import {
  useFeedDiscoverySearch,
  type DiscoverySearchArticle,
} from '@/composables/feed/useFeedDiscoverySearch'
import {
  ALL_CATEGORY,
  ALL_THEME,
  type FeedSourceFilterCategory,
  type RecommendationItem,
  type RecommendationMode,
  normalizeMode,
  normalizeCategory,
  normalizeLanguage,
  normalizePage,
  normalizedCategoryParam,
  formatDate,
  articleAvatarURL,
  toRecommendedSource,
  channelMetricLabel,
  channelSummaryText,
  channelMetadataText,
  subscriptionSourceId,
  sourceSubscriptionContext,
  sourceFromRecommendation,
} from '@/composables/feed/useFeedRecommendedHelpers'

const router = useRouter()
const route = useRoute()
const api = useApi()
const feedStore = useFeedStore()
const authStore = useAuthStore()
const onboardingStore = useOnboardingStore()

const starredIds = computed(() => feedStore.starredItemIds)
const bookmarkedIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const isStarred = (item: RecommendationItem) => {
  if (item.target_path?.includes('/posts/')) {
    return bookmarkedIds.value.has(item.id)
  }
  return starredIds.value.has(item.id)
}

const isReadingList = (item: RecommendationItem) => {
  return readingListIds.value.has(item.id)
}

const toggleStar = async (item: RecommendationItem) => {
  if (item.target_path?.includes('/posts/')) {
    await feedStore.togglePostBookmark(item.id)
  } else {
    await feedStore.toggleStar(item.id)
  }
}

const toggleReadingList = async (item: RecommendationItem) => {
  await feedStore.toggleReadingListItem(item.id)
}

async function submitRecommendationFeedback(item: RecommendationItem, action: 'hide' | 'less_source') {
  const targetType = action === 'less_source' || item.target_path?.startsWith('/channels/') || item.source_type === 'internal_channel' ? 'channel' : 'article'
  const targetID = targetType === 'channel' ? (item.source_id || item.id) : item.id
  const result = await apiRequestResult(`${api.url}/feed/recommendation-feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_type: targetType, target_id: targetID, action }),
  })
  if (!result.ok) {
    reportError(new Error(`recommendation feedback failed: ${result.status}`), '保存推荐反馈失败:')
    return
  }
  if (action === 'less_source') {
    channels.value = channels.value.filter((candidate) => candidate.id !== item.id && candidate.id !== item.source_id)
    articles.value = articles.value.filter((candidate) => candidate.id !== item.id)
  } else if (targetType === 'channel') {
    channels.value = channels.value.filter((candidate) => candidate.id !== item.id)
  } else {
    articles.value = articles.value.filter((candidate) => candidate.id !== item.id)
  }
}

const activeReasonItem = ref<RecommendationItem | null>(null)

function showRecommendationReason(item: RecommendationItem) {
  activeReasonItem.value = item
}

// ── 核心响应式筛选状态 ──
const mode = ref<RecommendationMode>(normalizeMode(route.query.mode))
const category = ref<FeedSourceFilterCategory>(normalizeCategory(route.query.category))
const theme = ref(typeof route.query.theme === 'string' ? route.query.theme : ALL_THEME)
const language = ref<RecommendationLanguage>(normalizeLanguage(route.query.language))
const themes = ref<FeedRecommendationTheme[]>([])
const themesLoading = ref(false)
const articlesLoading = ref(false)
const channelsLoading = ref(false)
const loading = computed(() => articlesLoading.value || channelsLoading.value)
const subscribingChannelIds = ref<string[]>([])
const isChannelSubscribeBusy = (id: string) => subscribingChannelIds.value.includes(id)
const articlesError = ref('')
const channelsError = ref('')
let recommendationRequest = 0
const articles = ref<RecommendationItem[]>([])
const channels = ref<RecommendationItem[]>([])

const page = ref(normalizePage(route.query.page))
const pageSize = 20
const totalArticles = ref(0)
const totalChannels = ref(0)

// ── 抽屉与详情交互状态 ──
const showChannelSheet = ref(false)
const selectedChannelSource = ref<FeedArticleSource | null>(null)
const channelArticles = ref<TimelineItem[]>([])
const channelArticlesLoading = ref(false)
const selectedChannelSubscribeBusy = ref(false)
const channelArticleRequestId = ref(0)
const showChannelArticleSheet = ref(false)
const selectedChannelArticle = ref<TimelineItem | null>(null)

// ── 全局搜索 ──
const {
  discoverySearchQuery,
  discoverySearchOpen,
  discoverySearchLoading,
  discoverySearchError,
  discoverySearchSources,
  discoverySearchArticles,
  handleDiscoverySearchInput,
  handleDiscoverySearchFocus,
  handleDiscoverySearchBlur,
  searchDiscovery,
} = useFeedDiscoverySearch()

const showAddModal = ref(false)
const addingSubscription = ref(false)
const addSubscriptionError = ref('')
const addSubscriptionResetKey = ref(0)
const subscriptionToastVisible = ref(false)
const subscriptionToastMessage = ref('')
const subscriptionToastType = ref<'success' | 'error'>('success')

const modeOptions: Array<{ label: string; value: RecommendationMode }> = [
  { label: '精选', value: 'featured' },
  { label: '随机', value: 'random' },
]

const categoryOptions: Array<{ label: string; value: FeedSourceFilterCategory }> = [
  { label: '全部', value: ALL_CATEGORY },
  { label: '博客', value: 'blog' },
  { label: '新闻', value: 'news' },
  { label: '播客', value: 'podcast' },
  { label: '视频', value: 'video' },
  { label: '社交', value: 'social' },
  { label: '论坛', value: 'forum' },
]

const currentThemeDescription = computed(() => {
  if (theme.value === ALL_THEME) return ''
  return themes.value.find((item) => item.id === theme.value)?.description ?? ''
})

function syncQuery() {
  router.replace({
    query: {
      ...route.query,
      mode: mode.value,
      category: category.value,
      theme: theme.value,
      language: language.value,
      page: String(page.value),
    },
  })
}

function selectCategory(cat: FeedSourceFilterCategory) {
  category.value = cat
  theme.value = ALL_THEME
  page.value = 1
  syncQuery()
  void fetchThemes()
  void fetchRecommendations()
}

function selectTheme(themeId: string) {
  theme.value = theme.value === themeId ? ALL_THEME : themeId
  page.value = 1
  syncQuery()
  void fetchRecommendations()
}

async function fetchThemes() {
  themesLoading.value = true
  try {
    const response = await apiRequestResult(`${api.url}/feed/recommend/themes?category=${normalizedCategoryParam(category.value)}`)
    if (!response.ok) throw new Error(`theme fetch failed: ${response.status}`)
    const payload = await Promise.resolve(response.data)
    themes.value = Array.isArray(payload.data) ? payload.data : []
    if (theme.value !== ALL_THEME && !themes.value.some((item) => item.id === theme.value)) {
      theme.value = ALL_THEME
      syncQuery()
    }
  } catch (error) {
    reportError(error, 'Failed to fetch recommendation themes:')
    themes.value = []
  } finally {
    themesLoading.value = false
  }
}

function recommendationParams() {
  return new URLSearchParams({
    mode: mode.value,
    page: String(page.value),
    page_size: String(pageSize),
    category: normalizedCategoryParam(category.value),
    theme: theme.value,
    language: language.value,
  }).toString()
}

async function fetchRecommendations() {
  const request = ++recommendationRequest
  articles.value = []
  channels.value = []
  totalArticles.value = 0
  totalChannels.value = 0
  const params = recommendationParams()
  await Promise.all([
    fetchArticleRecommendations(params, request),
    fetchChannelRecommendations(params, request),
  ])
}

async function fetchArticleRecommendations(params: string, request: number) {
  articlesLoading.value = true
  articlesError.value = ''
  try {
    const result = await apiRequestResult(`${api.url}/feed/recommend/articles?${params}`)
    if (request !== recommendationRequest) return
    if (!result.ok) throw new Error(`article recommend failed: ${result.status}`)
    const payload = result.data
    const items = Array.isArray(payload?.data) ? payload.data : []
    articles.value = deduplicateRecommendationItems(items)
    const total = Number(payload?.meta?.total ?? payload?.total)
    totalArticles.value = Number.isFinite(total)
      ? Math.max(articles.value.length, total - (items.length - articles.value.length))
      : articles.value.length
  } catch (error) {
    if (request !== recommendationRequest) return
    reportError(error, 'Failed to fetch article recommendations:')
    articlesError.value = '文章推荐加载失败'
  } finally {
    if (request === recommendationRequest) articlesLoading.value = false
  }
}

async function fetchChannelRecommendations(params: string, request: number) {
  channelsLoading.value = true
  channelsError.value = ''
  try {
    const result = await apiRequestResult(`${api.url}/feed/recommend/channels?${params}`)
    if (request !== recommendationRequest) return
    if (!result.ok) throw new Error(`channel recommend failed: ${result.status}`)
    const payload = result.data
    const items: RecommendationItem[] = Array.isArray(payload?.data) ? payload.data : []

    if (authStore.isAuthenticated && items.length) {
      // 订阅列表尚未完成时只补一次批量请求，避免为每个频道发起单独状态请求。
      if (!feedStore.subscriptionsLoaded) {
        await feedStore.fetchSubscriptions()
      }
      if (request !== recommendationRequest) return
      const subscribedChannelIds = new Set(
        feedStore.subscriptions
          .filter((subscription) => (
            subscription.feed_source?.source_type === 'internal_channel'
            && !subscription.is_paused
            && Boolean(subscription.feed_source.source_id)
          ))
          .map((subscription) => subscription.feed_source?.source_id as string),
      )
      for (const item of items) {
        item.subscribed = Boolean(item.subscribed) || (item.source_type === 'external_rss'
          ? feedStore.subscriptions.some((subscription) => (
            subscription.feed_source_id === (item.source_id || item.id)
            || subscription.feed_source?.id === (item.source_id || item.id)
          ))
          : feedStore.subscriptionsLoaded
            ? subscribedChannelIds.has(item.source_id || item.id)
            : false)
      }
    }
    channels.value = deduplicateRecommendedChannels(items)
    const total = Number(payload?.meta?.total ?? payload?.total)
    totalChannels.value = Number.isFinite(total)
      ? Math.max(channels.value.length, total - (items.length - channels.value.length))
      : channels.value.length
  } catch (error) {
    if (request !== recommendationRequest) return
    reportError(error, 'Failed to fetch channel recommendations:')
    channelsError.value = '频道推荐加载失败'
  } finally {
    if (request === recommendationRequest) {
      channelsLoading.value = false
      if (!channelsError.value) restorePendingSubscriptionSource()
    }
  }
}

function refreshRecommendationBatch() {
  const totalPages = Math.max(1, Math.ceil(totalArticles.value / pageSize))
  page.value = page.value >= totalPages ? 1 : page.value + 1
  syncQuery()
  void fetchRecommendations()
}

// ── 格式化与辅助方法 ──
function showSubscriptionFeedback(message: string, type: 'success' | 'error' = 'success') {
  subscriptionToastMessage.value = message
  subscriptionToastType.value = type
  subscriptionToastVisible.value = true
}

function requireLoginForSubscription(source: RecommendationItem | FeedArticleSource) {
  if (authStore.isAuthenticated) return true

  const context = sourceSubscriptionContext(source)
  const query = {
    ...route.query,
    subscribe_source_id: context.id,
    subscribe_source_type: context.type,
    subscribe_source_title: context.title,
  } as Record<string, string | string[] | null | undefined>
  if (context.rssUrl) query.subscribe_source_url = context.rssUrl
  else delete query.subscribe_source_url

  const resolved = router.resolve?.({
    path: route.path || '/feed',
    query,
    hash: route.hash,
  })
  const search = new URLSearchParams(query as Record<string, string>).toString()
  const returnPath = resolved?.fullPath || `${route.path || '/feed'}${search ? `?${search}` : ''}`
  void router.push({ path: '/login', query: { redirect: returnPath } })
  return false
}

async function subscribeRecommendedChannel(item: RecommendationItem) {
  if (item.subscribed || !requireLoginForSubscription(item)) return
  subscribingChannelIds.value.push(item.id)
  try {
    const success = item.source_type === 'external_rss'
      ? await feedStore.subscribeToRSS(item.rss_url || '', item.title)
      : await feedStore.subscribeToChannel(item.id)
    if (success) {
      item.subscribed = true
      await Promise.all([
        feedStore.fetchSubscriptions(),
        feedStore.fetchGroups(),
        feedStore.fetchSubscriptionHubTree(),
      ])
      showSubscriptionFeedback('已订阅，可继续阅读')
    } else {
      showSubscriptionFeedback('订阅失败，请重试', 'error')
    }
  } catch (error) {
    reportError(error, 'Failed to subscribe channel:')
    showSubscriptionFeedback('订阅失败，请重试', 'error')
  } finally {
    subscribingChannelIds.value = subscribingChannelIds.value.filter((id) => id !== item.id)
  }
}

async function subscribeSelectedChannel() {
  const source = selectedChannelSource.value
  if (!source || source.subscribed || !requireLoginForSubscription(source)) return
  selectedChannelSubscribeBusy.value = true
  try {
    let success: boolean
    if (source.type === 'external_rss') {
      success = await feedStore.subscribeToRSS(source.rssUrl || '', source.title)
    } else {
      success = await feedStore.subscribeToChannel(source.id)
    }
    if (success) {
      await Promise.all([
        feedStore.fetchSubscriptions(),
        feedStore.fetchGroups(),
        feedStore.fetchSubscriptionHubTree(),
      ])
      source.subscribed = true
      showSubscriptionFeedback('已订阅，可继续阅读')
    } else {
      showSubscriptionFeedback('订阅失败，请重试', 'error')
    }
  } catch (error) {
    reportError(error, 'Failed to subscribe source:')
    showSubscriptionFeedback('订阅失败，请重试', 'error')
  } finally {
    selectedChannelSubscribeBusy.value = false
  }
}

const {
  pendingSubscriptionRestored,
  pendingArticleRestored,
  restorePendingSubscriptionSource,
  handleArticleRequireAuth,
  restorePendingArticle,
} = useFeedRecommendedPendingAuth({
  route,
  router,
  isAuthenticated: computed(() => authStore.isAuthenticated),
  api,
  channels,
  channelArticles,
  selectedChannelSource,
  openArticleSource,
  openSource,
  onRestoreArticle: (article) => {
    selectedChannelArticle.value = article
    showChannelArticleSheet.value = true
  },
})

// ── 交互事件处理 ──
function openArticle(item: RecommendationItem) {
  if (item.target_path?.startsWith('/posts/')) {
    router.push(item.target_path)
    return
  }
  void router.push(`/feed/item/${encodeURIComponent(item.id)}`)
}

function openSource(source: FeedArticleSource) {
  selectedChannelSource.value = source
  showChannelSheet.value = true
  void fetchChannelArticles(source)
}

// 统一搜索来源的深链接；直接从公开来源接口恢复，不依赖推荐列表或登录。
watch(() => route.query.source_id, async (sourceId, previous, onCleanup) => {
  if (typeof sourceId !== 'string' || !sourceId) {
    if (previous) closeChannelSheet()
    return
  }
  const controller = new AbortController()
  onCleanup(() => controller.abort())
  try {
    const response = await apiRequestResult(`${api.url}/feed/timeline?feed_source_id=${encodeURIComponent(sourceId)}&page=1&page_size=20`, { signal: controller.signal })
    if (controller.signal.aborted || !response.ok) return
    const items: TimelineItem[] = Array.isArray(response.data?.data) ? response.data.data : []
    const source = items.find(item => item.feed_item?.feed_source)?.feed_item?.feed_source
    if (!source) return
    selectedChannelSource.value = { id: sourceId, title: source.title || 'RSS', type: 'external_rss', rssUrl: source.rss_url, subscribed: feedStore.subscriptions.some(item => item.feed_source_id === sourceId) }
    channelArticles.value = items
    showChannelSheet.value = true
  } catch (error) {
    if (!controller.signal.aborted) reportError(error, 'Failed to open search source:')
  }
}, { immediate: true })

function openArticleSource(item: RecommendationItem) {
  openSource(sourceFromRecommendation(item))
}

function openRecommendedChannel(item: RecommendationItem) {
  openArticleSource(item)
}

async function fetchChannelArticles(source: FeedArticleSource) {
  channelArticlesLoading.value = true
  const reqId = ++channelArticleRequestId.value
  try {
    const params = new URLSearchParams({ page: '1', page_size: '20' })
    let url: string
    if (source.type === 'internal_channel') {
      params.set('view', 'summary')
      params.set('channel_id', source.id)
      url = `${api.blog.posts}?${params}`
    } else {
      params.set('feed_source_id', source.id)
      url = `${api.url}/feed/timeline?${params}`
    }
    const res = await apiRequestResult(url)
    if (reqId !== channelArticleRequestId.value) return
    const payload = res.data
    if (!res.ok || !Array.isArray(payload?.data)) {
      channelArticles.value = []
    } else if (source.type === 'internal_channel') {
      channelArticles.value = payload.data.map((raw: unknown) => {
        const post = raw as Post
        return {
          type: 'post',
          post,
          is_read: false,
          published_at: post.published_at || post.created_at,
        } as TimelineItem
      })
    } else {
      channelArticles.value = payload.data
    }
  } catch {
    channelArticles.value = []
  } finally {
    if (reqId === channelArticleRequestId.value) channelArticlesLoading.value = false
  }
}

function closeChannelSheet() {
  showChannelSheet.value = false
  selectedChannelSource.value = null
  channelArticles.value = []
  if (route.query.source_id) {
    const query = { ...route.query }
    delete query.source_id
    void router.replace({ query })
  }
}

function closeChannelArticleSheet() {
  showChannelArticleSheet.value = false
  selectedChannelArticle.value = null
}

function openChannelArticleFromSheet(article: TimelineItem) {
  selectedChannelArticle.value = article
  showChannelArticleSheet.value = true
}

function toggleChannelArticleStar(article: TimelineItem) {
  if ((article.type === 'feed_item' || article.type === 'project_update') && article.feed_item) {
    void feedStore.toggleStar(article.feed_item.id)
  }
}

function toggleChannelArticleReadingList(article: TimelineItem) {
  if ((article.type === 'feed_item' || article.type === 'project_update') && article.feed_item) {
    void feedStore.toggleReadingListItem(article.feed_item.id)
  }
}

function openDiscoverySearchSource(source: FeedExploreSource) {
  selectedChannelSource.value = {
    id: source.id,
    title: source.title,
    type: 'external_rss',
    rssUrl: source.rssUrl,
    subscribed: Boolean(source.subscribed),
    platform: source.platform,
    contentType: source.content_type,
  }
  showChannelSheet.value = true
  discoverySearchOpen.value = false
  if (selectedChannelSource.value) {
    void fetchChannelArticles(selectedChannelSource.value)
  }
}

function openDiscoverySearchArticle(article: DiscoverySearchArticle) {
  discoverySearchOpen.value = false
  router.push(article.targetPath)
}

// ── 添加订阅 ──
function toggleAddModal() {
  showAddModal.value = !showAddModal.value
  addSubscriptionError.value = ''
  if (showAddModal.value) void feedStore.fetchGroups()
}

async function addSubscription(payload: AutoAddSubscriptionPayload) {
  addSubscriptionError.value = ''
  addingSubscription.value = true
  try {
    const success = await feedStore.autoAddSubscription(payload)
    if (!success) {
      addSubscriptionError.value = feedStore.error || '添加失败，请检查地址是否正确'
      return
    }
    addSubscriptionResetKey.value += 1
    showAddModal.value = false
    await Promise.all([
      feedStore.fetchSubscriptions(),
      feedStore.fetchGroups(),
      onboardingStore.handleSubscriptionSuccess(),
    ])
    void fetchRecommendations()
  } catch (error) {
    addSubscriptionError.value = error instanceof Error ? error.message : '添加失败'
  } finally {
    addingSubscription.value = false
  }
}

defineExpose({
  mode,
  category,
  theme,
  language,
  articles,
  channels,
  totalArticles,
  totalChannels,
  page,
  fetchRecommendations,
  fetchThemes,
  selectCategory,
  selectTheme,
  applyFilters() {
    page.value = 1
    syncQuery()
    void fetchThemes()
    void fetchRecommendations()
  },
  filterDraftMode: computed({
    get: () => mode.value,
    set: (val) => { mode.value = normalizeMode(val) },
  }),
  filterDraftTarget: computed({
    get: () => 'mixed' as const,
    set: () => {},
  }),
  filterDraftCategory: computed({
    get: () => category.value,
    set: (val) => { category.value = normalizeCategory(val) },
  }),
  filterDraftTheme: computed({
    get: () => theme.value,
    set: (val) => { theme.value = typeof val === 'string' ? val : ALL_THEME },
  }),
  filterDraftLanguage: computed({
    get: () => language.value,
    set: (val) => { language.value = normalizeLanguage(val) },
  }),
})

// ── 监听模式与语言切换 ──
watch([mode, language], () => {
  page.value = 1
  syncQuery()
  void fetchRecommendations()
})

watch([() => authStore.isAuthenticated, () => route.query.subscribe_source_id], ([isAuth, sourceId]) => {
  if (isAuth && sourceId) {
    restorePendingSubscriptionSource()
  }
})

watch([() => authStore.isAuthenticated, () => route.query.read_article_id], ([isAuth, articleId]) => {
  if (isAuth && articleId) {
    void restorePendingArticle()
  }
})

onMounted(() => {
  void fetchThemes()
  void fetchRecommendations()
  if (authStore.isAuthenticated) {
    restorePendingSubscriptionSource()
    void restorePendingArticle()
    void Promise.all([
      feedStore.fetchStarredIds(),
      feedStore.fetchBookmarkedPostIds(),
      feedStore.fetchReadingListIds(),
    ]).catch((error) => reportError(error, '加载内容状态失败:'))
  }
})

onUnmounted(() => { recommendationRequest++ })
</script>

<style scoped src="./feedRecommended.css"></style>

<style scoped>
/* Contract rules verified by tests/unit/views/feed/FeedRecommendedView.spec.ts */
.feed-timeline-box {
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.channels-stack :deep(.feed-source-card) {
  border: 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  background: transparent;
}
</style>
