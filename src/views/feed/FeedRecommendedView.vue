<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSheet from '@/components/ui/PSheet.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
import SearchSurface from '@/components/search/SearchSurface.vue'
import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'
import FeedArticleSheet from '@/components/feed/FeedArticleSheet.vue'
import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { useApi } from '@/composables/useApi'
import { useFeedStore } from '@/stores/feed'
import { useAuthStore } from '@/stores/auth'
import { buildSourceAvatarLabel, buildSourceColor } from '@/utils/feedSourcePresentation'
import {
  ALL_RECOMMENDATION_LANGUAGE,
  detectDefaultRecommendationLanguage,
  normalizeRecommendationLanguage,
  recommendationLanguageOptions,
  type RecommendationLanguage,
} from '@/utils/recommendationLanguage'
import type { FeedArticleSource, FeedExploreRecentItem, FeedExploreSource, FeedRecommendationTheme, FeedSourceCategory, Post, TimelineItem } from '@/types'

type RecommendationMode = 'hot' | 'featured' | 'discover'
type RecommendTarget = 'articles' | 'channels' | 'mixed'
type SourceScope = 'internal' | 'external'

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
  score_label?: string
  bookmark_count?: number
  read_count?: number
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

const starredIds = computed(() => feedStore.starredItemIds)
const bookmarkedIds = computed(() => feedStore.bookmarkedPostIds)
const readingListIds = computed(() => feedStore.readingListItemIds)

const isStarred = (item: RecommendationItem) => {
  if (item.target_path.includes('/posts/')) {
    return bookmarkedIds.value.has(item.id)
  }
  return starredIds.value.has(item.id)
}

const isReadingList = (item: RecommendationItem) => {
  return readingListIds.value.has(item.id)
}

const toggleStar = async (item: RecommendationItem) => {
  if (item.target_path.includes('/posts/')) {
    await feedStore.togglePostBookmark(item.id)
  } else {
    await feedStore.toggleStar(item.id)
  }
}

const toggleReadingList = async (item: RecommendationItem) => {
  await feedStore.toggleReadingListItem(item.id)
}

const mode = ref<RecommendationMode>('hot')
const target = ref<RecommendTarget>('articles')
const category = ref<FeedSourceFilterCategory>(ALL_CATEGORY)
const theme = ref(ALL_THEME)
const language = ref<RecommendationLanguage>('en')
const themes = ref<FeedRecommendationTheme[]>([])
const themesLoading = ref(false)
const loading = ref(false)
const sourceScope = ref<SourceScope>('internal')
const externalSources = ref<FeedExploreSource[]>([])
const selectedExternalSourceIds = ref<string[]>([])
const externalLoading = ref(false)
const subscribingChannelIds = ref<string[]>([])
const errorMessage = ref('')
const articles = ref<RecommendationItem[]>([])
const channels = ref<RecommendationItem[]>([])
const showChannelSheet = ref(false)
const selectedChannelSource = ref<FeedArticleSource | null>(null)
const channelArticles = ref<TimelineItem[]>([])
const channelArticlesLoading = ref(false)
const channelArticleRequestId = ref(0)
const showChannelArticleSheet = ref(false)
const selectedChannelArticle = ref<TimelineItem | null>(null)
const page = ref(1)
const pageSize = 20
const totalArticles = ref(0)
const totalChannels = ref(0)
const externalSearch = ref('')
const externalPage = ref(1)
const externalPageSize = 20
const externalTotal = ref(0)
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
const filterOpen = ref(false)
const filterDraftMode = ref<RecommendationMode>('hot')
const filterDraftTarget = ref<RecommendTarget>('articles')
const filterDraftCategory = ref<FeedSourceFilterCategory>(ALL_CATEGORY)
const filterDraftLanguage = ref<RecommendationLanguage>('en')
const filterDraftTheme = ref(ALL_THEME)
const sourceSubscribeBusyIds = ref<string[]>([])
let skipFilterWatchers = false

const modeOptions: Array<{ label: string; value: RecommendationMode }> = [
  { label: '热门', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '新发现', value: 'discover' },
]

const targetOptions: Array<{ label: string; value: RecommendTarget }> = [
  { label: '文章', value: 'articles' },
  { label: '频道', value: 'channels' },
  { label: '综合', value: 'mixed' },
]

const sourceScopeOptions: Array<{ label: string; value: SourceScope }> = [
  { label: '热门内容', value: 'internal' },
  { label: '订阅源', value: 'external' },
]

const categoryOptions: Array<{ label: string; value: FeedSourceFilterCategory }> = [
  { label: '全部', value: ALL_CATEGORY },
  { label: '博客', value: 'blog' },
  { label: '新闻', value: 'news' },
  { label: '社交', value: 'social' },
  { label: '视频', value: 'video' },
  { label: '论坛', value: 'forum' },
  { label: '播客', value: 'podcast' },
]

const themeOptions = computed(() => ([
  { label: '全部', value: ALL_THEME },
  ...themes.value.map((item) => ({ label: item.label, value: item.id })),
]))

const currentThemeDescription = computed(() => {
  if (theme.value === ALL_THEME) return ''
  return themes.value.find((item) => item.id === theme.value)?.description ?? ''
})

const subscribedSourceIds = computed(() => new Set(
  feedStore.subscriptions.flatMap((subscription) => [
    subscription.feed_source_id,
    subscription.feed_source?.source_id,
  ]).filter((id): id is string => Boolean(id)),
))

const activeFilterCount = computed(() => {
  let count = 0
  if (sourceScope.value === 'internal' && mode.value !== 'hot') count += 1
  if (sourceScope.value === 'internal' && target.value !== 'articles') count += 1
  if (category.value !== ALL_CATEGORY) count += 1
  if (language.value !== defaultRecommendationLanguage()) count += 1
  if (theme.value !== ALL_THEME) count += 1
  return count
})

const filterSummary = computed(() => {
  const values: string[] = []
  if (sourceScope.value === 'internal' && mode.value !== 'hot') {
    values.push(modeOptions.find((option) => option.value === mode.value)?.label ?? '')
  }
  if (sourceScope.value === 'internal' && target.value !== 'articles') {
    values.push(targetOptions.find((option) => option.value === target.value)?.label ?? '')
  }
  if (category.value !== ALL_CATEGORY) {
    values.push(categoryOptions.find((option) => option.value === category.value)?.label ?? '')
  }
  if (language.value !== defaultRecommendationLanguage()) {
    values.push(recommendationLanguageOptions.find((option) => option.value === language.value)?.label ?? language.value)
  }
  if (theme.value !== ALL_THEME) {
    values.push(themeOptions.value.find((option) => option.value === theme.value)?.label ?? '')
  }
  return values.filter(Boolean)
})

function normalizeMode(raw: unknown): RecommendationMode {
  return raw === 'featured' || raw === 'discover' ? raw : 'hot'
}

function normalizeTarget(raw: unknown): RecommendTarget {
  return raw === 'channels' || raw === 'mixed' ? raw : 'articles'
}

function normalizeCategory(raw: unknown): FeedSourceFilterCategory {
  return raw === 'blog' || raw === 'news' || raw === 'social' || raw === 'video' || raw === 'forum' || raw === 'podcast'
    ? raw
    : ALL_CATEGORY
}

function normalizeSourceScope(raw: unknown): SourceScope {
  return raw === 'external' ? 'external' : 'internal'
}

function defaultRecommendationLanguage(): RecommendationLanguage {
  return detectDefaultRecommendationLanguage()
}

function normalizeLanguage(raw: unknown): RecommendationLanguage {
  if (raw === ALL_RECOMMENDATION_LANGUAGE) return ALL_RECOMMENDATION_LANGUAGE
  return normalizeRecommendationLanguage(raw) ?? defaultRecommendationLanguage()
}

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
      target: target.value,
      category: category.value,
      theme: theme.value,
      language: language.value,
      scope: sourceScope.value,
      source_q: externalSearch.value || undefined,
      source_page: sourceScope.value === 'external' && externalPage.value > 1 ? String(externalPage.value) : undefined,
    },
  })
}

function openFilterPanel() {
  filterDraftMode.value = mode.value
  filterDraftTarget.value = target.value
  filterDraftCategory.value = category.value
  filterDraftLanguage.value = language.value
  filterDraftTheme.value = theme.value
  filterOpen.value = true
}

function resetFilterDraft() {
  filterDraftMode.value = 'hot'
  filterDraftTarget.value = 'articles'
  filterDraftCategory.value = ALL_CATEGORY
  filterDraftLanguage.value = defaultRecommendationLanguage()
  filterDraftTheme.value = ALL_THEME
}

function applyFilters() {
  skipFilterWatchers = true
  mode.value = filterDraftMode.value
  target.value = filterDraftTarget.value
  category.value = filterDraftCategory.value
  language.value = filterDraftLanguage.value
  theme.value = filterDraftTheme.value
  page.value = 1
  filterOpen.value = false
  syncQuery()

  if (sourceScope.value === 'internal') {
    void fetchThemes()
    void fetchRecommendations()
  } else {
    void fetchExternalSources()
  }

  void nextTick(() => {
    skipFilterWatchers = false
  })
}

async function fetchThemes() {
  themesLoading.value = true
  try {
    const response = await apiRequestResult(`${api.url}/feed/recommend/themes?category=${normalizedCategoryParam(category.value)}`)
    if (!response.ok) {
      throw new Error(`theme fetch failed: ${response.status}`)
    }
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
    const [articleRes, channelRes] = await Promise.all([
      target.value !== 'channels'
        ? apiRequestResult(`${api.url}/feed/recommend/articles?${params.toString()}`)
        : Promise.resolve(null),
      target.value !== 'articles'
        ? apiRequestResult(`${api.url}/feed/recommend/channels?${params.toString()}`)
        : Promise.resolve(null),
    ])

    if ((articleRes && !articleRes.ok) || (channelRes && !channelRes.ok)) {
      throw new Error(`feed recommend failed: ${articleRes?.status ?? '-'}/${channelRes?.status ?? '-'}`)
    }

    const [articlePayload, channelPayload] = await Promise.all([
      articleRes?.data ?? null,
      channelRes?.data ?? null,
    ])

    articles.value = Array.isArray(articlePayload?.data) ? articlePayload.data : []
    channels.value = Array.isArray(channelPayload?.data) ? channelPayload.data : []
    if (authStore.isAuthenticated && channels.value.length) {
      const subscribedStates = await Promise.all(
        channels.value.map((item) => feedStore.isSubscribedToChannel(item.id)),
      )
      channels.value = channels.value.map((item, index) => ({
        ...item,
        subscribed: subscribedStates[index] ?? false,
      }))
    }
    totalArticles.value = articlePayload?.meta?.total ?? articlePayload?.total ?? articles.value.length
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

async function fetchExternalSources() {
  externalLoading.value = true
  try {
    const params = new URLSearchParams({ page: String(externalPage.value), limit: String(externalPageSize) })
    if (category.value !== ALL_CATEGORY) params.set('category', category.value)
    if (language.value !== ALL_RECOMMENDATION_LANGUAGE) params.set('language', language.value)
    if (externalSearch.value.trim()) params.set('q', externalSearch.value.trim())
    const res = await apiRequestResult(`${api.url}/feed/explore/sources?${params}`, authStore.isAuthenticated
      ? { headers: { Authorization: `Bearer ${authStore.token}` } }
      : undefined)
    const data = await Promise.resolve(res.data)
    externalSources.value = res.ok && Array.isArray(data.data)
      ? data.data.map((item: ExploreSourcePayload) => normalizeExploreSource(item))
      : []
    externalTotal.value = Number(data.meta?.total ?? externalSources.value.length)
  } catch {
    externalSources.value = []
    externalTotal.value = 0
    errorMessage.value = '订阅源加载失败'
  } finally { externalLoading.value = false }
}

async function searchDiscovery(queryValue = discoverySearchQuery.value) {
  discoverySearchController?.abort()
  discoverySearchController = null
  const query = queryValue.trim()
  const requestId = ++discoverySearchRequestId
  if (query.length < 2) {
    discoverySearchSources.value = []
    discoverySearchArticles.value = []
    discoverySearchError.value = ''
    discoverySearchLoading.value = false
    return
  }

  discoverySearchLoading.value = true
  discoverySearchError.value = ''
  const controller = new AbortController()
  discoverySearchController = controller
  const sourceParams = new URLSearchParams({ page: '1', limit: '6', q: query })
  const articleParams = new URLSearchParams({ page: '1', page_size: '6', q: query, sort: 'recent' })
  if (category.value !== ALL_CATEGORY) {
    sourceParams.set('category', category.value)
    articleParams.set('category', category.value)
  }
  if (language.value !== ALL_RECOMMENDATION_LANGUAGE) {
    sourceParams.set('language', language.value)
    articleParams.set('language', language.value)
  }
  const options: RequestInit = {
    signal: controller.signal,
    ...(authStore.token ? { headers: { Authorization: `Bearer ${authStore.token}` } } : {}),
  }
  try {
    const [sourceRes, articleRes] = await Promise.all([
      apiRequestResult(`${api.url}/feed/explore/sources?${sourceParams}`, options),
      apiRequestResult(`${api.url}/feed/explore?${articleParams}`, options),
    ])
    if (requestId !== discoverySearchRequestId) return

    const sourcePayload = sourceRes.data
    const articlePayload = articleRes.data
    const searchArticles = Array.isArray(articlePayload?.data) ? articlePayload.data as TimelineItem[] : []
    discoverySearchSources.value = sourceRes.ok && Array.isArray(sourcePayload?.data)
      ? sourcePayload.data.map((item: ExploreSourcePayload) => normalizeExploreSource(item))
      : []
    discoverySearchArticles.value = articleRes.ok
      ? searchArticles
        .map((item: TimelineItem) => normalizeDiscoverySearchArticle(item))
        .filter((item): item is DiscoverySearchArticle => Boolean(item))
      : []
    if (!sourceRes.ok && !articleRes.ok) discoverySearchError.value = '搜索失败，请稍后重试'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    if (requestId !== discoverySearchRequestId) return
    reportError(error, 'Failed to search discovery content:')
    discoverySearchSources.value = []
    discoverySearchArticles.value = []
    discoverySearchError.value = '搜索失败，请稍后重试'
  } finally {
    if (discoverySearchController === controller) discoverySearchController = null
    if (requestId === discoverySearchRequestId) discoverySearchLoading.value = false
  }
}

function normalizeDiscoverySearchArticle(item: TimelineItem): DiscoverySearchArticle | null {
  if (item.type === 'post' && item.post) {
    return {
      id: item.post.id,
      title: item.post.title,
      summary: item.post.summary || '',
      sourceTitle: item.post.channel?.name || '',
      targetPath: `/posts/post/${item.post.id}`,
    }
  }
  if (item.type === 'feed_item' && item.feed_item) {
    return {
      id: item.feed_item.id,
      title: item.feed_item.title,
      summary: item.feed_item.summary || '',
      sourceTitle: item.feed_item.feed_source?.title || '',
      targetPath: `/feed/item/${item.feed_item.id}`,
    }
  }
  return null
}

function handleDiscoverySearchInput(value: string) {
  discoverySearchQuery.value = value
  discoverySearchOpen.value = true
  if (discoverySearchCloseTimer) clearTimeout(discoverySearchCloseTimer)
  if (discoverySearchTimer) clearTimeout(discoverySearchTimer)
  if (value.trim().length < 2) {
    void searchDiscovery(value)
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

function submitDiscoverySearch() {
  if (discoverySearchTimer) clearTimeout(discoverySearchTimer)
  void searchDiscovery()
}

async function openDiscoverySearchSource(source: FeedExploreSource) {
  discoverySearchOpen.value = false
  let subscription = feedStore.subscriptions.find((entry) => (
    entry.feed_source_id === source.id
    || entry.feed_source?.source_id === source.id
    || entry.feed_source?.id === source.id
  ))
  if (!subscription && source.subscribed && authStore.isAuthenticated) {
    await feedStore.fetchSubscriptions()
    subscription = feedStore.subscriptions.find((entry) => (
      entry.feed_source_id === source.id
      || entry.feed_source?.source_id === source.id
      || entry.feed_source?.id === source.id
    ))
  }
  if (subscription) {
    void router.push({ path: '/feed/subscriptions', query: { source_id: subscription.id } })
    return
  }
  void router.push({ path: '/feed', query: { scope: 'external', source_q: source.title } })
}

function openDiscoverySearchArticle(article: DiscoverySearchArticle) {
  discoverySearchOpen.value = false
  void router.push(article.targetPath)
}

async function subscribeSelectedExternalSources() {
  const result = await feedStore.batchSubscribeSources(selectedExternalSourceIds.value)
  if (!result) { errorMessage.value = '订阅失败，请重试'; return }
  if (result.missingIds.length) errorMessage.value = `${result.missingIds.length} 个来源已不可用`
  selectedExternalSourceIds.value = []
  await fetchExternalSources()
}

const externalSelectableSourceIds = computed(() => externalSources.value
  .filter((source) => !source.subscribed)
  .map((source) => source.id))

const allExternalSourcesSelected = computed({
  get: () => externalSelectableSourceIds.value.length > 0
    && externalSelectableSourceIds.value.every((id) => selectedExternalSourceIds.value.includes(id)),
  set: (selected: boolean) => {
    selectedExternalSourceIds.value = selected ? [...externalSelectableSourceIds.value] : []
  },
})

function changeExternalPage(nextPage: number) {
  if (nextPage < 1 || nextPage === externalPage.value) return
  externalPage.value = nextPage
}

function openTarget(path: string) {
  router.push(path)
}

function isRecommendedExternalSource(item: RecommendationItem) {
  return item.target_path.includes('/feed?source_id=')
}

function toRecommendedArticleSource(item: RecommendationItem): FeedArticleSource {
  return {
    type: isRecommendedExternalSource(item) ? 'external_rss' : 'internal_channel',
    id: item.id,
    title: item.title,
    subscribed: Boolean(item.subscribed),
    itemCount: item.recent_items?.length,
  }
}

function channelArticleKey(item: TimelineItem) {
  if (item.type === 'post' && item.post) return item.post.id
  if (item.type === 'feed_item' && item.feed_item) return item.feed_item.id
  return item.published_at
}

const selectedChannelArticleIndex = computed(() => {
  if (!selectedChannelArticle.value) return -1
  const key = channelArticleKey(selectedChannelArticle.value)
  return channelArticles.value.findIndex((item) => channelArticleKey(item) === key)
})

async function openRecommendedChannel(item: RecommendationItem) {
  const requestId = ++channelArticleRequestId.value
  selectedChannelSource.value = toRecommendedArticleSource(item)
  selectedChannelArticle.value = null
  channelArticles.value = []
  showChannelArticleSheet.value = false
  showChannelSheet.value = true
  channelArticlesLoading.value = true

  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
    const externalSource = isRecommendedExternalSource(item)
    const params = externalSource
      ? new URLSearchParams({ feed_source_id: item.id, page: '1', limit: '100' })
      : new URLSearchParams({ channel_id: item.id, page: '1', page_size: '100' })
    const url = externalSource
      ? `${api.url}/feed/timeline?${params}`
      : `${api.blog.posts}?${params}`
    const response = await apiRequestResult(url, { headers })
    if (requestId !== channelArticleRequestId.value || !response.ok) return

    const payload = response.data
    if (externalSource) {
      const items = Array.isArray(payload?.data) ? payload.data as TimelineItem[] : []
      channelArticles.value = items
      selectedChannelSource.value = {
        ...selectedChannelSource.value!,
        itemCount: Number(payload?.meta?.total ?? items.length),
      }
    } else {
      const posts = Array.isArray(payload?.data) ? payload.data as Post[] : []
      channelArticles.value = posts.map((post) => ({
        type: 'post',
        post,
        published_at: post.published_at || post.created_at,
        is_read: true,
      }))
      selectedChannelSource.value = {
        ...selectedChannelSource.value!,
        itemCount: Number(payload?.meta?.total ?? posts.length),
      }
    }
  } catch (error) {
    if (requestId === channelArticleRequestId.value) {
      reportError(error, 'Failed to fetch recommended channel articles:')
      channelArticles.value = []
    }
  } finally {
    if (requestId === channelArticleRequestId.value) channelArticlesLoading.value = false
  }
}

function openRecommendedArticle(item: TimelineItem) {
  selectedChannelArticle.value = item
  showChannelArticleSheet.value = true
}

function openPreviousRecommendedArticle() {
  if (selectedChannelArticleIndex.value <= 0) return
  const previous = channelArticles.value[selectedChannelArticleIndex.value - 1]
  if (previous) openRecommendedArticle(previous)
}

function openNextRecommendedArticle() {
  if (selectedChannelArticleIndex.value < 0 || selectedChannelArticleIndex.value >= channelArticles.value.length - 1) return
  const next = channelArticles.value[selectedChannelArticleIndex.value + 1]
  if (next) openRecommendedArticle(next)
}

function returnToRecommendedChannel() {
  showChannelArticleSheet.value = false
}

function closeRecommendedChannel() {
  showChannelArticleSheet.value = false
  showChannelSheet.value = false
  selectedChannelArticle.value = null
}

async function subscribeSelectedRecommendedChannel() {
  const source = selectedChannelSource.value
  if (!source || source.type !== 'internal_channel') return
  const item = channels.value.find((channel) => channel.id === source.id)
  if (!item) return
  await subscribeRecommendedChannel(item)
  if (channels.value.find((channel) => channel.id === source.id)?.subscribed) {
    selectedChannelSource.value = { ...source, subscribed: true }
  }
}

function normalizeItemCategory(item: RecommendationItem): FeedSourceCategory {
  switch ((item.content_type || '').trim().toLowerCase()) {
    case 'news':
      return 'news'
    case 'social':
      return 'social'
    case 'video':
      return 'video'
    case 'forum':
      return 'forum'
    case 'podcast':
      return 'podcast'
    default:
      return 'blog'
  }
}

function channelScoreLabel(item: RecommendationItem) {
  return item.score_label?.trim() || '推荐'
}

function toRecommendedSource(item: RecommendationItem): FeedExploreSource {
  return {
    id: item.id,
    title: item.title,
    rssUrl: item.target_path,
    category: normalizeItemCategory(item),
    language_code: item.language_code,
    subscriptionCount: item.bookmark_count ?? 0,
    recentItemCount: item.recent_items?.length ?? 0,
    lastPublishedAt: item.last_published_at,
    subscribed: false,
    recentItems: (item.recent_items ?? []).map((recent) => ({
      id: recent.id,
      title: recent.title,
    })),
    description: item.description,
    updateFrequencyLabel: item.update_frequency_label,
    bookmarkCount: item.bookmark_count ?? 0,
    readCount: item.read_count ?? 0,
  }
}

function channelSummaryText(item: RecommendationItem) {
  return item.description?.trim() || item.summary?.trim() || ''
}

function compactMetric(value?: number) {
  if (!value) return '0'
  if (value >= 10000) return `${Math.round(value / 1000) / 10}万`
  if (value >= 1000) return `${Math.round(value / 100) / 10}K`
  return String(value)
}

function channelMetricLabel(item: RecommendationItem) {
  return `${channelScoreLabel(item)} · 收藏 ${compactMetric(item.bookmark_count)} · 阅读 ${compactMetric(item.read_count)}`
}

function channelMetadataText(item: RecommendationItem) {
  const bits = [item.update_frequency_label?.trim()]
  if (item.last_published_at) {
    bits.push(new Date(item.last_published_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }))
  }
  return bits.filter(Boolean).join(' · ')
}

function isChannelSubscribeBusy(channelId: string) {
  return subscribingChannelIds.value.includes(channelId)
}

async function subscribeRecommendedChannel(item: RecommendationItem) {
  if (!authStore.isAuthenticated || item.subscribed || isChannelSubscribeBusy(item.id)) return

  subscribingChannelIds.value = [...subscribingChannelIds.value, item.id]
  try {
    const success = await feedStore.subscribeToChannel(item.id)
    if (!success) {
      errorMessage.value = '订阅失败，请重试'
      return
    }

    channels.value = channels.value.map((channel) => (
      channel.id === item.id
        ? { ...channel, subscribed: true }
        : channel
    ))
  } finally {
    subscribingChannelIds.value = subscribingChannelIds.value.filter((id) => id !== item.id)
  }
}

function isRecommendationSourceSubscribed(item: RecommendationItem) {
  return Boolean(item.source_subscribed || (item.source_id && subscribedSourceIds.value.has(item.source_id)))
}

function isRecommendationSourceSubscribeBusy(sourceId: string) {
  return sourceSubscribeBusyIds.value.includes(sourceId)
}

async function subscribeRecommendationSource(item: RecommendationItem) {
  const sourceId = item.source_id
  if (!authStore.isAuthenticated || !sourceId || isRecommendationSourceSubscribed(item) || isRecommendationSourceSubscribeBusy(sourceId)) return

  sourceSubscribeBusyIds.value = [...sourceSubscribeBusyIds.value, sourceId]
  try {
    if (item.source_type === 'internal_channel') {
      const success = await feedStore.subscribeToChannel(sourceId)
      if (!success) {
        errorMessage.value = '订阅失败，请重试'
        return
      }
    } else {
      const result = await feedStore.batchSubscribeSources([sourceId])
      if (!result || result.missingIds.includes(sourceId)) {
        errorMessage.value = '订阅失败，请重试'
        return
      }
    }
    articles.value = articles.value.map((article) => (
      article.source_id === sourceId
        ? { ...article, source_subscribed: true }
        : article
    ))
  } finally {
    sourceSubscribeBusyIds.value = sourceSubscribeBusyIds.value.filter((id) => id !== sourceId)
  }
}

const visibleChannels = computed(() => {
  return channels.value
})

const visibleArticles = computed(() => {
  return articles.value
})

const visibleMixedArticles = computed(() => visibleArticles.value.slice(0, 4))
const visibleMixedChannels = computed(() => visibleChannels.value.slice(0, 4))

const changePage = (nextPage: number) => {
  if (nextPage < 1 || nextPage === page.value) return
  page.value = nextPage
}

watch(filterDraftCategory, (nextCategory, previousCategory) => {
  if (nextCategory !== previousCategory) filterDraftTheme.value = ALL_THEME
})

watch([mode, page, theme], () => {
  if (skipFilterWatchers || sourceScope.value !== 'internal') return
  syncQuery()
  fetchRecommendations()
})

watch(language, () => {
  if (skipFilterWatchers) return
  syncQuery()
  if (!recommendationsMounted) return
  if (sourceScope.value === 'external') {
    if (externalPage.value === 1) void fetchExternalSources()
    else externalPage.value = 1
    return
  }
  if (page.value === 1) {
    void fetchRecommendations()
  } else {
    page.value = 1
  }
})

watch(sourceScope, () => {
  syncQuery()
  if (skipFilterWatchers || !recommendationsMounted) return
  page.value = 1
  if (sourceScope.value === 'external') {
    void fetchExternalSources()
  } else {
    void fetchThemes()
    void fetchRecommendations()
  }
})

watch(externalSearch, () => {
  if (externalPage.value === 1) {
    void fetchExternalSources()
  } else {
    externalPage.value = 1
  }
})

watch(externalPage, () => {
  syncQuery()
  if (sourceScope.value === 'external') void fetchExternalSources()
})

let recommendationsMounted = false

watch(target, () => {
  if (skipFilterWatchers) return
  syncQuery()
  if (!recommendationsMounted || sourceScope.value !== 'internal') return
  if (page.value === 1) {
    fetchRecommendations()
  } else {
    page.value = 1
  }
})

watch(category, async (nextCategory, previousCategory) => {
  if (skipFilterWatchers) return
  if (nextCategory !== previousCategory) {
    theme.value = ALL_THEME
  }
  syncQuery()
  if (!recommendationsMounted) return
  if (sourceScope.value === 'external') {
    if (externalPage.value === 1) void fetchExternalSources()
    else externalPage.value = 1
    return
  }
  await fetchThemes()
  if (page.value === 1) {
    fetchRecommendations()
  } else {
    page.value = 1
  }
})

onMounted(async () => {
  mode.value = normalizeMode(route.query.mode)
  target.value = normalizeTarget(route.query.target)
  category.value = normalizeCategory(route.query.category)
  language.value = normalizeLanguage(route.query.language)
  theme.value = typeof route.query.theme === 'string' && route.query.theme.trim() ? route.query.theme.trim() : ALL_THEME
  sourceScope.value = normalizeSourceScope(route.query.scope)
  externalSearch.value = typeof route.query.source_q === 'string' ? route.query.source_q.trim() : ''
  const sourcePage = Number(route.query.source_page)
  externalPage.value = Number.isInteger(sourcePage) && sourcePage > 0 ? sourcePage : 1
  syncQuery()
  if (sourceScope.value === 'internal') {
    fetchThemes()
    fetchRecommendations()
  } else {
    fetchExternalSources()
  }
  if (authStore.isAuthenticated) {
    feedStore.fetchSubscriptions()
    feedStore.fetchStarredIds()
    feedStore.fetchReadingListIds()
    feedStore.fetchBookmarkedPostIds()
  }
  await nextTick()
  recommendationsMounted = true
})
onBeforeUnmount(() => {
  if (discoverySearchTimer) clearTimeout(discoverySearchTimer)
  if (discoverySearchCloseTimer) clearTimeout(discoverySearchCloseTimer)
  discoverySearchController?.abort()
})

</script>

<template>
  <div class="a-page-xl feed-recommend-page">
    <FeedArticleSheet
      :show="showChannelArticleSheet"
      :article="selectedChannelArticle"
      :source="selectedChannelSource"
      :show-source-subscribe="Boolean(authStore.isAuthenticated && selectedChannelSource?.type === 'internal_channel')"
      :source-subscribe-busy="selectedChannelSource ? isChannelSubscribeBusy(selectedChannelSource.id) : false"
      :has-previous="selectedChannelArticleIndex > 0"
      :has-next="selectedChannelArticleIndex >= 0 && selectedChannelArticleIndex < channelArticles.length - 1"
      :index="showChannelSheet ? 1 : 0"
      @close="showChannelArticleSheet = false"
      @open-source="returnToRecommendedChannel"
      @subscribe-source="subscribeSelectedRecommendedChannel"
      @previous="openPreviousRecommendedArticle"
      @next="openNextRecommendedArticle"
    />
    <FeedSourceArticlesSheet
      :show="showChannelSheet"
      :source="selectedChannelSource"
      :items="channelArticles"
      :loading="channelArticlesLoading"
      :show-subscribe="Boolean(authStore.isAuthenticated && selectedChannelSource?.type === 'internal_channel')"
      :subscribe-busy="selectedChannelSource ? isChannelSubscribeBusy(selectedChannelSource.id) : false"
      :stack-size="showChannelArticleSheet ? 2 : 1"
      :is-shifted="showChannelArticleSheet"
      :is-top-layer="!showChannelArticleSheet"
      @close="closeRecommendedChannel"
      @activate="returnToRecommendedChannel"
      @subscribe="subscribeSelectedRecommendedChannel"
      @open-article="openRecommendedArticle"
    />

    <PPageHeader
      title="发现"
      mb="1.25rem"
    >
      <template #action><PButton variant="secondary" label="返回订阅" @click="openTarget('/feed/subscriptions')" /></template>
    </PPageHeader>

    <div class="discovery-search-row">
      <SearchSurface
        :query="discoverySearchQuery"
        :open="discoverySearchOpen"
        eyebrow="发现搜索"
        placeholder="搜索订阅源和文章"
        input-test-id="discovery-search-input"
        dropdown-test-id="discovery-search-dropdown"
        overlay-results
        :loading="discoverySearchLoading"
        @update:query="handleDiscoverySearchInput"
        @focus="handleDiscoverySearchFocus"
        @blur="handleDiscoverySearchBlur"
        @submit="submitDiscoverySearch"
      >
        <template #results>
          <p v-if="discoverySearchQuery.trim().length < 2" class="discovery-search-hint">输入至少 2 个字符</p>
          <p v-else-if="discoverySearchError" class="discovery-search-hint discovery-search-hint--error">{{ discoverySearchError }}</p>
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
                  <small>{{ source.rssUrl || '订阅源' }}</small>
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

    <div class="discovery-toolbar" data-test="feed-filter-wrap">
      <div class="discovery-view-switch" aria-label="发现内容">
        <PSegmentedControl v-model="sourceScope" :options="sourceScopeOptions" />
      </div>
      <div class="discovery-toolbar__summary">
        <strong>{{ sourceScope === 'internal' ? '热门内容' : '订阅源' }}</strong>
        <span v-for="item in filterSummary" :key="item">· {{ item }}</span>
      </div>
      <PButton
        data-test="open-recommendation-filters"
        variant="secondary"
        :label="activeFilterCount ? `筛选 · ${activeFilterCount}` : '筛选'"
        @click="openFilterPanel"
      />
    </div>

    <PSheet
      :show="filterOpen"
      title="筛选"
      side="right"
      close-type="bookmark"
      @close="filterOpen = false"
    >
      <div class="recommend-filter-panel">

        <div v-if="sourceScope === 'internal'" class="recommend-filter-panel__section">
          <PSelect data-test="filter-mode" v-model="filterDraftMode" label="推荐方式" :options="modeOptions" />
          <PSelect data-test="filter-target" v-model="filterDraftTarget" label="查看" :options="targetOptions" />
        </div>

        <div class="recommend-filter-panel__section">
          <PSelect data-test="filter-category" v-model="filterDraftCategory" label="来源类型" :options="categoryOptions" />
          <PSelect data-test="filter-language" v-model="filterDraftLanguage" label="语言" :options="recommendationLanguageOptions" />
        </div>

        <div v-if="sourceScope === 'internal'" class="recommend-filter-panel__section">
          <PSelect data-test="filter-theme" v-model="filterDraftTheme" label="主题" :options="themeOptions" :disabled="themesLoading" />
        </div>

        <div class="recommend-filter-panel__actions">
          <PButton data-test="reset-recommendation-filters" variant="ghost" label="重置" @click="resetFilterDraft" />
          <PButton data-test="apply-recommendation-filters" label="应用筛选" @click="applyFilters" />
        </div>
      </div>
    </PSheet>

    <p v-if="currentThemeDescription" class="state-line">{{ currentThemeDescription }}</p>
    <p v-else-if="themesLoading && sourceScope === 'internal'" class="state-line">正在加载主题...</p>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>

    <PContentProgress
      :loading="loading"
      :retry="fetchRecommendations"
    >
      <template #skeleton>
        <div class="recommend-grid">
          <div v-for="i in 6" :key="i" style="padding: 1.25rem; border: 1px solid rgba(0,0,0,0.05); border-radius: var(--a-radius-control);">
            <PSkeleton width="60%" height="22px" style="margin-bottom: 8px;" />
            <PSkeleton width="90%" height="16px" style="margin-bottom: 8px;" />
            <PSkeleton width="40%" height="14px" />
          </div>
        </div>
      </template>

      <div v-if="sourceScope === 'external'" class="recommend-grid recommend-grid--single">
      <section class="recommend-section">
        <div class="section-head"><p class="section-kicker">订阅源</p><h2>RSS 订阅源</h2></div>
        <div class="external-source-controls">
          <label v-if="authStore.isAuthenticated" class="external-source-select-all">
            <input v-model="allExternalSourcesSelected" data-test="external-source-select-all" type="checkbox" :disabled="!externalSelectableSourceIds.length" />
            <span>全选当前页</span>
          </label>
          <input v-model="externalSearch" data-test="external-source-search" class="external-source-search" type="search" placeholder="筛选当前列表" aria-label="筛选当前订阅源列表" />
          <PButton v-if="authStore.isAuthenticated && selectedExternalSourceIds.length" label="订阅选中来源" :loading="externalLoading" @click="subscribeSelectedExternalSources" />
        </div>
        <PEmpty v-if="!externalLoading && !externalSources.length" title="暂无订阅源" />
        <div v-else class="card-stack">
          <label v-for="source in externalSources" :key="source.id" class="external-source-row">
            <input v-if="authStore.isAuthenticated && !source.subscribed" v-model="selectedExternalSourceIds" type="checkbox" :value="source.id" />
            <FeedSourceIdentityCard :source="source" :color="buildSourceColor(source.title)" :avatar-label="buildSourceAvatarLabel(source.title)" :display-url="source.rssUrl || ''" :show-subscribe="false" />
          </label>
        </div>
        <FeedTimelineFooter
          :page="externalPage"
          :page-size="externalPageSize"
          :total="externalTotal"
          :loading="externalLoading"
          @change-page="changeExternalPage"
        />
      </section>
    </div>

    <div v-else-if="target === 'articles'" class="recommend-grid recommend-grid--single">
      <section class="recommend-section">
        <div class="section-head">
          <p class="section-kicker">热门内容</p>
          <h2>热门文章</h2>
        </div>

        <PEmpty
          v-if="!visibleArticles.length"
          kicker="文章"
          title="当前没有推荐文章"
          description="等有更多内容和互动信号后，这里会显示文章推荐。"
        />

        <div v-else class="feed-timeline">
          <BlogItemCard
            v-for="item in visibleArticles"
            :key="item.id"
            :item="item"
            :type="item.target_path.includes('/posts/') ? 'post' : 'feed_item'"
            :starred="isStarred(item)"
            :in-reading-list="isReadingList(item)"
            :source-title="item.source_title"
            :source-path="item.source_path"
            @click="openTarget(item.target_path)"
            @toggle-star="toggleStar(item)"
            @toggle-reading-list="toggleReadingList(item)"
          >
            <template v-if="item.source_id && authStore.isAuthenticated" #source-action>
              <PButton
                data-test="article-source-subscribe"
                variant="secondary"
                size="sm"
                :label="isRecommendationSourceSubscribed(item) ? '已订阅' : '订阅'"
                :loading="isRecommendationSourceSubscribeBusy(item.source_id)"
                :disabled="isRecommendationSourceSubscribed(item)"
                @click.stop="subscribeRecommendationSource(item)"
              />
            </template>
          </BlogItemCard>
        </div>

        <FeedTimelineFooter
          :page="page"
          :page-size="pageSize"
          :total="totalArticles"
          :loading="loading"
          @change-page="changePage"
        />
      </section>
    </div>

    <div v-else-if="target === 'mixed'" class="recommend-grid recommend-grid--single">
      <section class="recommend-section">
        <div class="section-head">
          <p class="section-kicker">综合</p>
          <h2>混合推荐</h2>
        </div>

        <PEmpty
          v-if="!visibleMixedArticles.length && !visibleMixedChannels.length"
          kicker="综合"
          title="当前没有混合推荐"
          description="等有更多内容和频道信号后，这里会把站内外推荐一起编排。"
        />

        <div v-else class="recommend-grid recommend-grid--mixed">
          <section class="recommend-section">
            <div class="section-head">
              <p class="section-kicker">文章</p>
              <h2>文章推荐</h2>
            </div>
            <div class="feed-timeline">
              <PEntry
                v-for="item in visibleMixedArticles"
                :key="item.id"
                :title="item.title"
                :summary="item.summary"
                @click="openTarget(item.target_path)"
              />
            </div>
          </section>

          <section class="recommend-section">
            <div class="section-head">
              <p class="section-kicker">频道</p>
              <h2>频道推荐</h2>
            </div>
            <div class="card-stack">
              <FeedSourceIdentityCard
                v-for="item in visibleMixedChannels"
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
                :show-meta="false"
                compact
                variant="recommend"
                data-test="channel-card"
                @select="openRecommendedChannel(item)"
                @subscribe="subscribeRecommendedChannel(item)"
              />
            </div>
          </section>
        </div>
      </section>
    </div>

    <div v-else class="recommend-grid recommend-grid--single">
      <section class="recommend-section">
        <div class="section-head">
          <p class="section-kicker">频道</p>
          <h2>推荐频道</h2>
        </div>

        <PEmpty
          v-if="!visibleChannels.length"
          kicker="频道"
          title="当前没有推荐频道"
          description="等频道侧积累更多更新和质量信号后，这里会显示频道推荐。"
        />

        <div v-else class="card-stack">
          <FeedSourceIdentityCard
            v-for="item in visibleChannels"
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
            :show-meta="false"
            compact
            variant="recommend"
            data-test="channel-card"
            @select="openRecommendedChannel(item)"
            @subscribe="subscribeRecommendedChannel(item)"
          />
        </div>

        <FeedTimelineFooter
          :page="page"
          :page-size="pageSize"
          :total="totalChannels"
          :loading="loading"
          @change-page="changePage"
        />
      </section>
    </div>
    </PContentProgress>
  </div>
</template>

<style scoped>
.feed-recommend-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-bottom: 6rem;
}

.discovery-search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.discovery-search-row > :deep(.search-surface) {
  min-width: 0;
}

.discovery-search-result {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 1rem;
  border: 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  text-align: left;
}

.discovery-search-result:hover,
.discovery-search-result:focus-visible {
  background: var(--a-color-surface-muted);
}

.discovery-search-result:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
}

.discovery-search-result__main {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.discovery-search-result__main strong,
.discovery-search-result__main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discovery-search-result__main strong {
  font-size: 0.88rem;
  font-weight: 650;
}

.discovery-search-result__main small,
.discovery-search-result__status {
  color: var(--a-color-muted);
  font-size: 0.72rem;
}

.discovery-search-result__status {
  flex-shrink: 0;
}

.discovery-search-group + .discovery-search-group {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.discovery-search-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem 0.35rem;
  color: var(--a-color-muted);
  font-size: 0.72rem;
}

.discovery-search-group__head strong {
  color: var(--a-color-text);
  font-size: 0.75rem;
}

.discovery-search-hint {
  margin: 0;
  padding: 0.85rem 1rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.discovery-search-hint--error {
  color: var(--a-color-error, #8a2f2f);
}

.discovery-toolbar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.discovery-view-switch :deep(.p-segmented-control) {
  width: auto;
}

.discovery-toolbar__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: var(--a-color-muted);
  font-size: 0.85rem;
}

.discovery-toolbar__summary strong {
  color: var(--a-color-text);
  font-weight: 600;
}

.recommend-filter-panel {
  display: grid;
  gap: 1.25rem;
  padding: 1.25rem 1rem 2rem;
}

.recommend-filter-panel__section {
  display: grid;
  gap: 1rem;
}

.recommend-filter-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--a-color-border-soft);
}

@media (max-width: 720px) {
  .discovery-search-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .discovery-search-row :deep(.ui-action) {
    min-height: 2.75rem;
  }

  .discovery-toolbar {
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
  }

  .discovery-view-switch {
    grid-column: 1 / -1;
  }

  .discovery-view-switch :deep(.p-segmented-control) {
    width: 100%;
  }

  .discovery-toolbar__summary {
    min-height: 2.5rem;
  }
}

.state-line {
  margin: 0;
  color: var(--a-color-muted);
}

.state-line--error {
  color: #8a2f2f;
}

.recommend-grid {
  display: grid;
  gap: 1.5rem;
}

.recommend-grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.recommend-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-head {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.section-head h2,
.section-kicker {
  margin: 0;
}

.section-kicker {
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.7rem;
  letter-spacing: 0;
}

.card-stack {
  display: grid;
  gap: 1rem;
}

.external-source-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.external-source-select-all {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.5rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.external-source-search {
  min-width: min(100%, 16rem);
  min-height: 2.5rem;
  padding: 0 0.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font: inherit;
}

.external-source-search:focus {
  outline: 2px solid color-mix(in srgb, var(--a-color-primary) 24%, transparent);
  outline-offset: 1px;
  border-color: var(--a-color-primary);
}

.external-source-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.75rem;
}

.recommend-card {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  cursor: pointer;
}

@media (max-width: 640px) {
  .recommend-card {
    grid-template-columns: 1fr;
  }
}

.feed-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
