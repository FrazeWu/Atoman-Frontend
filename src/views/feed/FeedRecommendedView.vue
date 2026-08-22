<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { apiRequestResult } from '@/api/client'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PContentProgress from '@/components/ui/PContentProgress.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import BlogItemCard from '@/components/shared/BlogItemCard.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
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
  image_url?: string
  target_path: string
  score_label?: string
  bookmark_count?: number
  read_count?: number
  update_frequency_label?: string
  last_published_at?: string
  subscribed?: boolean
  recent_items?: Array<{ id: string; title: string }>
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

const modeOptions: Array<{ label: string; value: RecommendationMode }> = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

const targetOptions: Array<{ label: string; value: RecommendTarget }> = [
  { label: '文章', value: 'articles' },
  { label: '频道', value: 'channels' },
  { label: '混合', value: 'mixed' },
]

const sourceScopeOptions: Array<{ label: string; value: SourceScope }> = [
  { label: '站内', value: 'internal' },
  { label: '站外', value: 'external' },
]

const categoryOptions: Array<{ label: string; value: FeedSourceFilterCategory }> = [
  { label: '全部', value: ALL_CATEGORY },
  { label: '文章', value: 'blog' },
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

watch([mode, page, theme], () => {
  syncQuery()
  fetchRecommendations()
})

watch(language, () => {
  syncQuery()
  if (sourceScope.value === 'external') {
    if (externalPage.value === 1) void fetchExternalSources()
    else externalPage.value = 1
  }
  if (!recommendationsMounted) return
  if (page.value === 1) {
    void fetchRecommendations()
  } else {
    page.value = 1
  }
})

watch(sourceScope, () => {
  syncQuery()
  if (sourceScope.value === 'external') void fetchExternalSources()
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
  syncQuery()
  if (!recommendationsMounted) return
  if (page.value === 1) {
    fetchRecommendations()
  } else {
    page.value = 1
  }
})

watch([mode], () => {
  if (page.value === 1) {
    fetchRecommendations()
  } else {
    page.value = 1
  }
  if (sourceScope.value === 'external') {
    if (externalPage.value === 1) void fetchExternalSources()
    else externalPage.value = 1
  }
})

watch(category, async (nextCategory, previousCategory) => {
  if (nextCategory !== previousCategory) {
    theme.value = ALL_THEME
  }
  syncQuery()
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
  fetchThemes()
  fetchRecommendations()
  if (sourceScope.value === 'external') fetchExternalSources()
  if (authStore.isAuthenticated) {
    feedStore.fetchStarredIds()
    feedStore.fetchReadingListIds()
    feedStore.fetchBookmarkedPostIds()
  }
  await nextTick()
  recommendationsMounted = true
})
</script>

<template>
  <div class="a-page-xl feed-recommend-page">
    <FeedArticleSheet
      :show="showChannelArticleSheet"
      :article="selectedChannelArticle"
      :has-previous="selectedChannelArticleIndex > 0"
      :has-next="selectedChannelArticleIndex >= 0 && selectedChannelArticleIndex < channelArticles.length - 1"
      :index="showChannelSheet ? 1 : 0"
      @close="showChannelArticleSheet = false"
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
      title="探索订阅源"
      mb="1.25rem"
    >
      <template #action><PButton variant="secondary" label="返回订阅" @click="openTarget('/feed')" /></template>
    </PPageHeader>

    <div class="filters-wrap" data-test="feed-filter-wrap">
      <div class="filter-group" aria-label="来源范围">
        <PSegmentedControl v-model="sourceScope" :options="sourceScopeOptions" />
      </div>
      <div class="filter-group" data-test="feed-filter-group" aria-label="订阅推荐模式">
        <PSegmentedControl
          v-model="mode"
          :options="modeOptions"
        />
      </div>

      <div class="filter-group" data-test="feed-filter-group" aria-label="订阅推荐对象">
        <PSegmentedControl
          v-model="target"
          :options="targetOptions"
        />
      </div>

      <div class="filter-group" data-test="feed-filter-group" aria-label="内容类型筛选">
        <PSegmentedControl
          v-model="category"
          :options="categoryOptions"
        />
      </div>

      <div class="filter-group" data-test="feed-filter-group" aria-label="语言筛选">
        <PSelect
          v-model="language"
          label="语言"
          :options="recommendationLanguageOptions"
          data-test="recommendation-language"
        />
      </div>

      <div class="filter-group" data-test="feed-filter-group" aria-label="主题筛选">
        <PSegmentedControl
          v-model="theme"
          :options="themeOptions"
        />
      </div>
    </div>

    <p v-if="currentThemeDescription" class="state-line">{{ currentThemeDescription }}</p>
    <p v-else-if="themesLoading" class="state-line">正在加载主题...</p>

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
        <div class="section-head"><p class="section-kicker">站外</p><h2>RSS 订阅源</h2></div>
        <div class="external-source-controls">
          <label v-if="authStore.isAuthenticated" class="external-source-select-all">
            <input v-model="allExternalSourcesSelected" data-test="external-source-select-all" type="checkbox" :disabled="!externalSelectableSourceIds.length" />
            <span>全选当前页</span>
          </label>
          <input v-model="externalSearch" data-test="external-source-search" class="external-source-search" type="search" placeholder="搜索订阅源" />
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
          <p class="section-kicker">文章</p>
          <h2>推荐文章</h2>
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
            @click="openTarget(item.target_path)"
            @toggle-star="toggleStar(item)"
            @toggle-reading-list="toggleReadingList(item)"
          />
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

.filters-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: flex-start;
}

.filter-group {
  display: flex;
  align-items: center;
  min-width: 0;
}

.filter-group + .filter-group {
  position: relative;
}

.filter-group + .filter-group::before {
  content: '';
  position: absolute;
  left: -0.5rem;
  top: 50%;
  width: 1px;
  height: 1.5rem;
  background: var(--a-color-border-soft);
  transform: translateY(-50%);
}

.filter-group :deep(.p-segmented-control) {
  width: auto;
}

@media (max-width: 720px) {
  .filter-group + .filter-group::before {
    display: none;
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
