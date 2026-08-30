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
        <SearchSurface
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
          class="discovery-add-btn"
          data-test="open-discovery-add-subscription"
          :label="showAddModal ? '取消添加' : '+ 订阅'"
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
    <div class="discovery-pills-bar">
      <!-- 基础类型胶囊 -->
      <button
        v-for="cat in categoryOptions"
        :key="cat.value"
        type="button"
        class="topic-pill"
        :class="{ 'is-active': category === cat.value && theme === ALL_THEME }"
        @click="selectCategory(cat.value)"
      >
        {{ cat.label }}
      </button>

      <!-- 主题标签分隔与动态主题列表 -->
      <template v-if="themes.length">
        <span class="topic-pill-divider" aria-hidden="true">|</span>
        <button
          v-for="t in themes"
          :key="t.id"
          type="button"
          class="topic-pill"
          :class="{ 'is-active': theme === t.id }"
          @click="selectTheme(t.id)"
        >
          # {{ t.label }}
        </button>
      </template>
    </div>

    <p v-if="currentThemeDescription" class="theme-desc-banner">{{ currentThemeDescription }}</p>
    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>

    <!-- ═══════════════════════════════════════════════════════════════
         3. 核心左右双并列信息流（Dual Parallel Streams）
         ═══════════════════════════════════════════════════════════════ -->
    <PContentProgress :loading="loading" :retry="fetchRecommendations">
      <template #skeleton>
        <div class="dual-streams-container">
          <div class="stream-column">
            <div class="feed-timeline-box">
              <div v-for="i in 5" :key="`skel-art-${i}`" style="padding: 1rem; border-bottom: 1px solid rgba(0,0,0,0.05);">
                <PSkeleton width="40%" height="14px" style="margin-bottom: 6px;" />
                <PSkeleton width="85%" height="20px" style="margin-bottom: 6px;" />
                <PSkeleton width="60%" height="14px" />
              </div>
            </div>
          </div>
          <div class="stream-column">
            <div class="channels-stack">
              <div v-for="i in 4" :key="`skel-chan-${i}`" style="padding: 1rem; border: 1px solid rgba(0,0,0,0.06); border-radius: var(--a-radius-control);">
                <PSkeleton width="50%" height="18px" style="margin-bottom: 8px;" />
                <PSkeleton width="90%" height="14px" style="margin-bottom: 8px;" />
                <PSkeleton width="35%" height="12px" />
              </div>
            </div>
          </div>
        </div>
      </template>

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

          <PEmpty
            v-if="!articles.length"
            kicker="文章"
            title="当前分类下暂无文章"
            description="尝试切换其他分类或主题查看更多精选内容。"
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
                  <span class="feed-meta-stat"><Gauge :size="11" aria-hidden="true" />{{ item.rating_score ? `${item.rating_score.toFixed(1)} (${item.rating_count || 0})` : '—' }}</span>
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
                  <Bookmark :size="14" :fill="isStarred(item) ? 'currentColor' : 'none'" />
                </PClip>
                <PClip
                  v-if="authStore.isAuthenticated"
                  :active="isReadingList(item)"
                  :title="isReadingList(item) ? '移除稍后阅读' : '稍后阅读'"
                  @click.stop="toggleReadingList(item)"
                >
                  <Clock :size="14" />
                </PClip>
              </template>
            </PContentCard>
          </div>
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

          <PEmpty
            v-if="!channels.length"
            kicker="频道"
            title="当前分类下暂无频道"
            description="尝试切换其他分类或探索更多优质订阅源。"
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
              :show-subscribe="authStore.isAuthenticated"
              :show-previews="true"
              :show-meta="true"
              data-test="channel-card"
              @select="openRecommendedChannel(item)"
              @subscribe="subscribeRecommendedChannel(item)"
            />
          </div>
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
    </PContentProgress>

    <!-- 文章详情阅读抽屉 -->
    <FeedArticleSheet
      :index="showChannelSheet ? 1 : 0"
      :show="showChannelArticleSheet"
      :article="selectedChannelArticle"
      @close="closeChannelArticleSheet"
      @toggle-star="selectedChannelArticle && toggleChannelArticleStar(selectedChannelArticle)"
      @toggle-reading-list="selectedChannelArticle && toggleChannelArticleReadingList(selectedChannelArticle)"
    />

    <!-- 频道文章列表抽屉 -->
    <FeedSourceArticlesSheet
      :layer-index="0"
      :show="showChannelSheet"
      :source="selectedChannelSource"
      :items="channelArticles"
      :loading="channelArticlesLoading"
      @close="closeChannelSheet"
      @open-article="openChannelArticleFromSheet"
      @subscribe="subscribeSelectedChannel"
    />
  </div>
</template>

<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bookmark, Clock, Eye, Gauge } from 'lucide-vue-next'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PContentCard from '@/components/ui/PContentCard.vue'
import PClip from '@/components/ui/PClip.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import SubscriptionAddSheet from '@/components/feed/SubscriptionAddSheet.vue'
import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'
import { useApi } from '@/composables/useApi'
import { useFeedStore } from '@/stores/feed'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingStore } from '@/stores/onboarding'
import { buildSourceAvatarLabel, buildSourceColor } from '@/utils/feedSourcePresentation'
import {
  ALL_RECOMMENDATION_LANGUAGE,
  detectDefaultRecommendationLanguage,
  normalizeRecommendationLanguage,
  recommendationLanguageOptions,
  type RecommendationLanguage,
} from '@/utils/recommendationLanguage'
import type { AutoAddSubscriptionPayload, FeedArticleSource, FeedExploreRecentItem, FeedExploreSource, FeedRecommendationTheme, FeedSourceCategory, Post, TimelineItem } from '@/types'

type RecommendationMode = 'hot' | 'featured' | 'discover'

const ALL_CATEGORY = 'all'
const ALL_THEME = 'all'

type FeedSourceFilterCategory = typeof ALL_CATEGORY | FeedSourceCategory
type ExploreSourcePayload = Partial<FeedExploreSource> & {
  rss_url?: string
  subscription_count?: number
  recent_item_count?: number
  last_published_at?: string
  language_code?: string
  recent_items?: Array<{ id: string; title: string; published_at?: string }>
}

type RecommendationItem = {
  id: string
  title: string
  summary?: string
  description?: string
  content_type?: string
  language_code?: string
  source_subscribed?: boolean
  image_url?: string
  target_path: string
  source_id?: string
  source_title?: string
  source_type?: string
  source_category?: string
  source_path?: string
  rss_url?: string
  score_label?: string
  bookmark_count?: number
  read_count?: number
  view_count?: number
  rating_score?: number
  rating_count?: number
  update_frequency_label?: string
  last_published_at?: string
  subscribed?: boolean
  recent_items?: Array<{ id: string; title: string }>
}

type DiscoverySearchArticle = {
  id: string
  title: string
  summary: string
  sourceTitle: string
  targetPath: string
}

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

function normalizeMode(raw: unknown): RecommendationMode {
  return raw === 'featured' || raw === 'discover' ? raw : 'hot'
}

function normalizeCategory(raw: unknown): FeedSourceFilterCategory {
  return raw === 'blog' || raw === 'news' || raw === 'social' || raw === 'video' || raw === 'forum' || raw === 'podcast'
    ? raw
    : ALL_CATEGORY
}

function normalizeLanguage(raw: unknown): RecommendationLanguage {
  if (raw === ALL_RECOMMENDATION_LANGUAGE) return ALL_RECOMMENDATION_LANGUAGE
  return normalizeRecommendationLanguage(raw) ?? detectDefaultRecommendationLanguage()
}

// ── 核心响应式筛选状态 ──
const mode = ref<RecommendationMode>(normalizeMode(route.query.mode))
const category = ref<FeedSourceFilterCategory>(normalizeCategory(route.query.category))
const theme = ref(typeof route.query.theme === 'string' ? route.query.theme : ALL_THEME)
const language = ref<RecommendationLanguage>(normalizeLanguage(route.query.language))
const themes = ref<FeedRecommendationTheme[]>([])
const themesLoading = ref(false)
const loading = ref(false)
const subscribingChannelIds = ref<string[]>([])
const errorMessage = ref('')
const articles = ref<RecommendationItem[]>([])
const channels = ref<RecommendationItem[]>([])

function normalizeRecommendationContentFingerprint(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() || ''
}

function recommendationDisplayKey(item: RecommendationItem) {
  if (item.source_type !== 'external_rss') return `id:${item.id}`

  const fingerprint = [
    item.source_title,
    item.title,
    item.summary || item.description,
    item.image_url,
    item.last_published_at,
  ].map(normalizeRecommendationContentFingerprint)
  if (!fingerprint[0] || !fingerprint[1]) return `id:${item.id}`
  return `external:${fingerprint.join('\x1f')}`
}

function deduplicateRecommendationItems(items: RecommendationItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = recommendationDisplayKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizePage(value: unknown) {
  const pageValue = Number.parseInt(String(value || '1'), 10)
  return Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1
}

const page = ref(normalizePage(route.query.page))
const pageSize = 20
const totalArticles = ref(0)
const totalChannels = ref(0)

// ── 抽屉与详情交互状态 ──
const showChannelSheet = ref(false)
const selectedChannelSource = ref<FeedArticleSource | null>(null)
const channelArticles = ref<TimelineItem[]>([])
const channelArticlesLoading = ref(false)
const channelArticleRequestId = ref(0)
const showChannelArticleSheet = ref(false)
const selectedChannelArticle = ref<TimelineItem | null>(null)

// ── 全局搜索与快捷订阅 ──
const discoverySearchQuery = ref('')
const discoverySearchOpen = ref(false)
const discoverySearchLoading = ref(false)
const discoverySearchError = ref('')
const discoverySearchSources = ref<FeedExploreSource[]>([])
const discoverySearchArticles = ref<DiscoverySearchArticle[]>([])
let discoverySearchTimer: ReturnType<typeof setTimeout> | null = null
let discoverySearchCloseTimer: ReturnType<typeof setTimeout> | null = null
let discoverySearchController: AbortController | null = null
let discoverySearchRequestId = 0

const showAddModal = ref(false)
const addingSubscription = ref(false)
const addSubscriptionError = ref('')
const addSubscriptionResetKey = ref(0)

const modeOptions: Array<{ label: string; value: RecommendationMode }> = [
  { label: '热门', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '最新', value: 'discover' },
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

function normalizedCategoryParam(value: FeedSourceFilterCategory) {
  return value === ALL_CATEGORY ? 'all' : value
}

function normalizeExploreSource(payload: ExploreSourcePayload): FeedExploreSource {
  return {
    id: payload.id || '',
    title: payload.title || '',
    rssUrl: payload.rssUrl ?? payload.rss_url,
    category: payload.category || 'blog',
    subscriptionCount: payload.subscriptionCount ?? payload.subscription_count ?? 0,
    recentItemCount: payload.recentItemCount ?? payload.recent_item_count ?? 0,
    lastPublishedAt: payload.lastPublishedAt ?? payload.last_published_at,
    language_code: payload.language_code,
    subscribed: Boolean(payload.subscribed),
    recentItems: (payload.recentItems ?? payload.recent_items ?? []).map((item) => {
      const recent = item as FeedExploreRecentItem & { published_at?: string }
      return {
        id: recent.id,
        title: recent.title,
        publishedAt: recent.publishedAt ?? recent.published_at,
      }
    }),
  }
}

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

async function fetchRecommendations() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = new URLSearchParams({
      mode: mode.value,
      page: String(page.value),
      page_size: String(pageSize),
      category: normalizedCategoryParam(category.value),
      theme: theme.value,
      language: language.value,
    })

    // 并行获取推荐文章和推荐频道（双流）
    const [articleRes, channelRes] = await Promise.all([
      apiRequestResult(`${api.url}/feed/recommend/articles?${params.toString()}`),
      apiRequestResult(`${api.url}/feed/recommend/channels?${params.toString()}`),
    ])

    if (!articleRes.ok || !channelRes.ok) {
      throw new Error(`feed recommend failed: ${articleRes.status}/${channelRes.status}`)
    }

    const [articlePayload, channelPayload] = await Promise.all([
      articleRes.data,
      channelRes.data,
    ])

    const recommendationArticles = Array.isArray(articlePayload?.data) ? articlePayload.data : []
    articles.value = deduplicateRecommendationItems(recommendationArticles)
    channels.value = Array.isArray(channelPayload?.data) ? channelPayload.data : []

    if (authStore.isAuthenticated && channels.value.length) {
      const subscribedStates = await Promise.all(
        channels.value.map((item) => item.source_type === 'external_rss'
          ? Promise.resolve(feedStore.subscriptions.some((subscription) => (
            subscription.feed_source_id === (item.source_id || item.id)
            || subscription.feed_source?.id === (item.source_id || item.id)
          )))
          : feedStore.isSubscribedToChannel(item.id)),
      )
      channels.value = channels.value.map((item, index) => ({
        ...item,
        subscribed: subscribedStates[index] ?? false,
      }))
    }
    const reportedArticleTotal = Number(articlePayload?.meta?.total ?? articlePayload?.total)
    const duplicateCount = recommendationArticles.length - articles.value.length
    totalArticles.value = Number.isFinite(reportedArticleTotal)
      ? Math.max(articles.value.length, reportedArticleTotal - duplicateCount)
      : articles.value.length
    totalChannels.value = channelPayload?.meta?.total ?? channelPayload?.total ?? channels.value.length
  } catch (error) {
    reportError(error, 'Failed to fetch feed recommendations:')
    errorMessage.value = '推荐内容加载失败'
    articles.value = []
    channels.value = []
    totalArticles.value = 0
    totalChannels.value = 0
  } finally {
    loading.value = false
  }
}

function refreshRecommendationBatch() {
  const totalPages = Math.max(1, Math.ceil(totalArticles.value / pageSize))
  page.value = page.value >= totalPages ? 1 : page.value + 1
  syncQuery()
  void fetchRecommendations()
}

// ── 格式化与辅助方法 ──
function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function toRecommendedSource(item: RecommendationItem): FeedExploreSource {
  return {
    id: item.source_id || item.id,
    title: item.title,
    rssUrl: item.rss_url,
    category: (item.source_category as FeedSourceCategory) || 'blog',
    subscriptionCount: item.bookmark_count ?? item.read_count ?? 0,
    recentItemCount: item.recent_items?.length ?? 0,
    lastPublishedAt: item.last_published_at,
    subscribed: Boolean(item.subscribed),
    recentItems: item.recent_items ?? [],
    description: item.summary || item.description,
  }
}

function channelMetricLabel(item: RecommendationItem) {
  return item.source_category ? item.source_category.toUpperCase() : 'RECOMMENDED'
}

function channelSummaryText(item: RecommendationItem) {
  return item.summary || item.description || ''
}

function channelMetadataText(item: RecommendationItem) {
  const parts: string[] = []
  if (item.bookmark_count !== undefined) parts.push(`${item.bookmark_count} 订阅`)
  if (item.update_frequency_label) parts.push(item.update_frequency_label)
  return parts.join(' · ')
}

function isChannelSubscribeBusy(id: string) {
  return subscribingChannelIds.value.includes(id)
}

async function subscribeRecommendedChannel(item: RecommendationItem) {
  if (item.subscribed) return
  subscribingChannelIds.value.push(item.id)
  try {
    const success = item.source_type === 'external_rss'
      ? await feedStore.subscribeToRSS(item.rss_url || '', item.title)
      : await feedStore.subscribeToChannel(item.id)
    if (success) item.subscribed = true
  } catch (error) {
    reportError(error, 'Failed to subscribe channel:')
  } finally {
    subscribingChannelIds.value = subscribingChannelIds.value.filter((id) => id !== item.id)
  }
}

async function subscribeSelectedChannel() {
  const source = selectedChannelSource.value
  if (!source || source.subscribed) return
  if (source.type === 'external_rss') {
    const success = await feedStore.subscribeToRSS(source.rssUrl || '', source.title)
    if (success) source.subscribed = true
    return
  }
  const success = await feedStore.subscribeToChannel(source.id)
  if (success) source.subscribed = true
}

// ── 交互事件处理 ──
function openArticle(item: RecommendationItem) {
  if (item.target_path?.startsWith('/posts/')) {
    router.push(item.target_path)
    return
  }
  void router.push(`/feed/item/${encodeURIComponent(item.id)}`)
}

function openArticleSource(item: RecommendationItem) {
  const isInternalChannel = item.source_type === 'internal_channel' || item.target_path?.startsWith('/channels/')
  selectedChannelSource.value = {
    id: item.source_id || item.id,
    title: item.source_title || item.title,
    rssUrl: item.rss_url,
    type: isInternalChannel ? 'internal_channel' : 'external_rss',
    subscribed: Boolean(item.source_subscribed || item.subscribed),
  }
  showChannelSheet.value = true
  if (selectedChannelSource.value) {
    void fetchChannelArticles(selectedChannelSource.value)
  }
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
  if (article.type === 'feed_item' && article.feed_item) {
    void feedStore.toggleStar(article.feed_item.id)
  }
}

function toggleChannelArticleReadingList(article: TimelineItem) {
  if (article.type === 'feed_item' && article.feed_item) {
    void feedStore.toggleReadingListItem(article.feed_item.id)
  }
}

// ── 搜索处理 ──
function handleDiscoverySearchInput(value: string) {
  discoverySearchQuery.value = value
  discoverySearchOpen.value = true
  if (discoverySearchCloseTimer) clearTimeout(discoverySearchCloseTimer)
  if (discoverySearchTimer) clearTimeout(discoverySearchTimer)
  if (value.trim().length < 2) {
    discoverySearchSources.value = []
    discoverySearchArticles.value = []
    discoverySearchError.value = ''
    discoverySearchLoading.value = false
    return
  }
  discoverySearchTimer = setTimeout(() => {
    void searchDiscovery(value)
  }, 250)
}

function handleDiscoverySearchFocus() {
  if (discoverySearchCloseTimer) clearTimeout(discoverySearchCloseTimer)
  discoverySearchOpen.value = true
}

function handleDiscoverySearchBlur() {
  if (discoverySearchCloseTimer) clearTimeout(discoverySearchCloseTimer)
  discoverySearchCloseTimer = setTimeout(() => {
    discoverySearchOpen.value = false
  }, 150)
}

async function searchDiscovery(queryValue = discoverySearchQuery.value) {
  discoverySearchController?.abort()
  discoverySearchController = null
  const query = queryValue.trim()
  const requestId = ++discoverySearchRequestId
  if (query.length < 2) return

  discoverySearchLoading.value = true
  discoverySearchError.value = ''
  const controller = new AbortController()
  discoverySearchController = controller

  try {
    const [sourceRes, articleRes] = await Promise.all([
      apiRequestResult(`${api.url}/feed/explore/sources?page=1&limit=6&q=${encodeURIComponent(query)}`, { signal: controller.signal }),
      apiRequestResult(`${api.url}/feed/explore?page=1&page_size=6&q=${encodeURIComponent(query)}&sort=recent`, { signal: controller.signal }),
    ])
    if (requestId !== discoverySearchRequestId) return

    discoverySearchSources.value = sourceRes.ok && Array.isArray(sourceRes.data?.data)
      ? sourceRes.data.data.map((item: ExploreSourcePayload) => normalizeExploreSource(item))
      : []
    discoverySearchArticles.value = articleRes.ok && Array.isArray(articleRes.data?.data)
      ? (articleRes.data.data as TimelineItem[]).map((item: TimelineItem) => {
        if (item.type === 'post' && item.post) {
          return { id: item.post.id, title: item.post.title, summary: item.post.summary || '', sourceTitle: item.post.channel?.name || '', targetPath: `/posts/post/${item.post.id}` }
        }
        if (item.type === 'feed_item' && item.feed_item) {
          return { id: item.feed_item.id, title: item.feed_item.title, summary: item.feed_item.summary || '', sourceTitle: item.feed_item.feed_source?.title || '', targetPath: `/feed/item/${item.feed_item.id}` }
        }
        return null
      }).filter((item): item is DiscoverySearchArticle => Boolean(item))
      : []
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (requestId !== discoverySearchRequestId) return
    discoverySearchError.value = '搜索失败，请稍后重试'
  } finally {
    if (discoverySearchController === controller) discoverySearchController = null
    if (requestId === discoverySearchRequestId) discoverySearchLoading.value = false
  }
}

function openDiscoverySearchSource(source: FeedExploreSource) {
  selectedChannelSource.value = {
    id: source.id,
    title: source.title,
    type: 'external_rss',
    rssUrl: source.rssUrl,
    subscribed: Boolean(source.subscribed),
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

onMounted(() => {
  void fetchThemes()
  void fetchRecommendations()
})
</script>

<style scoped>
.feed-recommendation-actions {
  display: flex;
  justify-content: center;
  padding: 1.25rem 0 0.5rem;
}

.feed-recommended-view {
  max-width: 78rem;
  margin: 0 auto;
  padding: 0 1.25rem 5rem;
  display: grid;
  gap: 1.75rem;
}

/* ═══════════════════════════════════════════════════════════════
   1. 顶部总控工具栏
   ═══════════════════════════════════════════════════════════════ */
.discovery-top-toolbar {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.discovery-search-box {
  flex: 1 1 auto;
  min-width: 0;
}

.discovery-top-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

.discovery-lang-select {
  width: 7.5rem;
}

.discovery-add-btn {
  white-space: nowrap;
}

/* 搜索结果下拉 */
.discovery-search-group {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}
.discovery-search-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.2rem 0.5rem;
  font-size: 0.72rem;
  color: var(--a-color-muted);
}
.discovery-search-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: none;
  border-radius: var(--a-radius-control);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}
.discovery-search-result:hover { background: var(--a-color-surface-muted); }
.discovery-search-result__main { display: grid; min-width: 0; }
.discovery-search-result__main strong { font-size: 0.85rem; color: var(--a-color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.discovery-search-result__main small { font-size: 0.72rem; color: var(--a-color-muted); }
.discovery-search-result__status { font-size: 0.7rem; color: var(--a-color-muted-soft); flex-shrink: 0; }
.discovery-search-hint { font-size: 0.8rem; color: var(--a-color-muted); padding: 0.5rem; margin: 0; }
.discovery-search-hint.error { color: var(--a-color-danger); }

/* ═══════════════════════════════════════════════════════════════
   2. 主题与领域胶囊栏
   ═══════════════════════════════════════════════════════════════ */
.discovery-pills-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  padding-bottom: 0.25rem;
}

.topic-pill {
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  font-size: 0.78rem;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.15s ease;
}
.topic-pill:hover {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
}
.topic-pill.is-active {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
}

.topic-pill-divider {
  color: var(--a-color-border-soft);
  padding: 0 0.2rem;
  font-size: 0.8rem;
}

.theme-desc-banner {
  margin: -0.75rem 0 0;
  font-size: 0.8rem;
  color: var(--a-color-muted);
  background: var(--a-color-surface-muted);
  padding: 0.45rem 0.85rem;
  border-radius: var(--a-radius-control);
}

.state-line {
  margin: 0;
  font-size: 0.82rem;
  color: var(--a-color-muted);
}
.state-line--error { color: var(--a-color-danger); }

/* ═══════════════════════════════════════════════════════════════
   3. 左右双并列信息流
   ═══════════════════════════════════════════════════════════════ */
.dual-streams-container {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  align-items: start;
  gap: 1.75rem;
}

.stream-column {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.stream-column__head {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 0.5rem;
}

.stream-column__title-group {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 0.55rem;
}

.stream-column__title-group h2 {
  min-width: 0;
  margin: 0;
  color: var(--a-color-fg);
  font-size: 1.05rem;
  font-weight: 650;
  white-space: nowrap;
}

.stream-count {
  font-size: 0.74rem;
  color: var(--a-color-muted-soft);
}

.section-badge {
  font-size: 0.65rem;
  font-weight: 650;
  padding: 0.15em 0.5em;
  border-radius: var(--a-radius-control);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  letter-spacing: 0.05em;
}
.section-badge--hot {
  background: color-mix(in srgb, #ea580c 15%, transparent);
  color: #ea580c;
}

.stream-sub-filters {
  display: flex;
  align-items: center;
}

/* 文章流容器：文章条目自身提供分隔线，不再包裹卡片边框 */
.feed-timeline-box {
  border: 0;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.feed-source-trigger {
  appearance: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.16em;
}
.feed-source-trigger:hover {
  color: var(--a-color-text);
  text-decoration-thickness: 2px;
}

.feed-meta-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: var(--a-color-muted-soft);
  font-size: 0.72rem;
  font-weight: 500;
}

.feed-type-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1em 0.45em;
  border-radius: var(--a-radius-control);
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.5;
}
.feed-type-tag--blog {
  background: color-mix(in srgb, #16a34a 12%, transparent);
  color: #16a34a;
}
.feed-type-tag--rss {
  background: color-mix(in srgb, #2563eb 12%, transparent);
  color: #2563eb;
}

/* 频道流容器：与文章流保持无外框的信息流样式 */
.channels-stack {
  display: grid;
  gap: 0;
}

.channels-stack :deep(.feed-source-card) {
  border: 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  background: transparent;
}

.channels-stack :deep(.feed-source-card:first-child) {
  border-top: 0;
}

@media (max-width: 880px) {
  .dual-streams-container {
    grid-template-columns: 1fr;
  }

  .discovery-top-toolbar {
    flex-wrap: wrap;
  }

  .discovery-search-box {
    width: 100%;
    order: 2;
  }

  .discovery-top-actions {
    width: 100%;
    justify-content: flex-end;
    order: 1;
  }
}

@media (max-width: 720px) {
  .stream-column__head {
    display: grid;
    align-items: start;
  }

  .stream-column__title-group {
    width: 100%;
  }

  .stream-sub-filters {
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stream-sub-filters :deep(.p-segmented-control) {
    min-width: 0;
    flex: 1 1 auto;
  }

  .stream-sub-filters :deep(.p-segmented-control-item) {
    min-width: 0;
    flex: 1 1 0;
    padding-inline: 0.5rem;
  }
}
</style>
