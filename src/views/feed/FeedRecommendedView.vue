<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { useApi } from '@/composables/useApi'
import { useFeedStore } from '@/stores/feed'
import { useAuthStore } from '@/stores/auth'
import { buildSourceAvatarLabel, buildSourceColor } from '@/utils/feedSourcePresentation'
import type { FeedExploreSource, FeedRecommendationTheme, FeedSourceCategory } from '@/types'

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
  recent_items?: Array<{ id: string; title: string; published_at?: string }>
}
type RecommendationItem = {
  id: string
  title: string
  summary?: string
  description?: string
  content_type?: string
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
    subscribed: Boolean(payload.subscribed),
    recentItems: (payload.recentItems ?? payload.recent_items ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      publishedAt: item.publishedAt ?? item.published_at,
    })),
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
      scope: sourceScope.value,
      source_q: externalSearch.value || undefined,
      source_page: sourceScope.value === 'external' && externalPage.value > 1 ? String(externalPage.value) : undefined,
    },
  })
}

async function fetchThemes() {
  themesLoading.value = true
  try {
    const response = await fetch(`${api.url}/feed/recommend/themes?category=${normalizedCategoryParam(category.value)}`)
    if (!response.ok) {
      throw new Error(`theme fetch failed: ${response.status}`)
    }
    const payload = await response.json()
    themes.value = Array.isArray(payload.data) ? payload.data : []
    if (theme.value !== ALL_THEME && !themes.value.some((item) => item.id === theme.value)) {
      theme.value = ALL_THEME
      syncQuery()
    }
  } catch (error) {
    console.error('Failed to fetch recommendation themes:', error)
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
    })
    const [articleRes, channelRes] = await Promise.all([
      fetch(`${api.url}/feed/recommend/articles?${params.toString()}`),
      fetch(`${api.url}/feed/recommend/channels?${params.toString()}`),
    ])

    if (!articleRes.ok || !channelRes.ok) {
      throw new Error(`feed recommend failed: ${articleRes.status}/${channelRes.status}`)
    }

    const [articlePayload, channelPayload] = await Promise.all([
      articleRes.json(),
      channelRes.json(),
    ])

    articles.value = Array.isArray(articlePayload.data) ? articlePayload.data : []
    channels.value = Array.isArray(channelPayload.data) ? channelPayload.data : []
    if (authStore.isAuthenticated && channels.value.length) {
      const subscribedStates = await Promise.all(
        channels.value.map((item) => feedStore.isSubscribedToChannel(item.id)),
      )
      channels.value = channels.value.map((item, index) => ({
        ...item,
        subscribed: subscribedStates[index] ?? false,
      }))
    }
    totalArticles.value = articlePayload.meta?.total ?? articlePayload.total ?? articles.value.length
    totalChannels.value = channelPayload.meta?.total ?? channelPayload.total ?? channels.value.length
  } catch (error) {
    console.error('Failed to fetch feed recommendations:', error)
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
    if (externalSearch.value.trim()) params.set('q', externalSearch.value.trim())
    const res = await fetch(`${api.url}/feed/explore/sources?${params}`, authStore.isAuthenticated
      ? { headers: { Authorization: `Bearer ${authStore.token}` } }
      : undefined)
    const data = await res.json()
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

watch([target], () => {
  syncQuery()
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

onMounted(() => {
  mode.value = normalizeMode(route.query.mode)
  target.value = normalizeTarget(route.query.target)
  category.value = normalizeCategory(route.query.category)
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
})
</script>

<template>
  <div class="a-page-xl feed-recommend-page">
    <PPageHeader
      title="探索"
      accent
      mb="1rem"
    >
      <template #action><PPress variant="secondary" label="返回订阅" @click="openTarget('/feed')" /></template>
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
    <p v-else-if="loading" class="state-line">正在加载...</p>

    <div v-else-if="sourceScope === 'external'" class="recommend-grid recommend-grid--single">
      <section class="recommend-section">
        <div class="section-head"><p class="section-kicker">站外</p><h2>RSS 订阅源</h2></div>
        <div class="external-source-controls">
          <label v-if="authStore.isAuthenticated" class="external-source-select-all">
            <input v-model="allExternalSourcesSelected" data-test="external-source-select-all" type="checkbox" :disabled="!externalSelectableSourceIds.length" />
            <span>全选当前页</span>
          </label>
          <input v-model="externalSearch" data-test="external-source-search" class="external-source-search" type="search" placeholder="搜索订阅源" />
          <PPress v-if="authStore.isAuthenticated && selectedExternalSourceIds.length" label="订阅选中来源" :loading="externalLoading" @click="subscribeSelectedExternalSources" />
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
          <PEntry
            v-for="item in visibleArticles"
            :key="item.id"
            :title="item.title"
            :summary="item.summary"
            @click="openTarget(item.target_path)"
          >
            <template #visual>
              <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
                <PBadge type="external" fill>外部</PBadge>
                <PBadge type="external">{{ normalizeItemCategory(item) === 'podcast' ? '播客' : normalizeItemCategory(item) === 'video' ? '视频' : normalizeItemCategory(item) === 'news' ? '新闻' : normalizeItemCategory(item) === 'social' ? '社交' : normalizeItemCategory(item) === 'forum' ? '论坛' : '文章' }}</PBadge>
              </div>
            </template>
            <template #meta>
              <span class="a-label a-muted">{{ item.score_label || '推荐' }}</span>
            </template>
            <template #actions>
              <PClip
                v-if="authStore.isAuthenticated"
                :active="isStarred(item)"
                :label="isStarred(item) ? '取消收藏' : '收藏'"
                @click.stop="toggleStar(item)"
              />
              <PClip
                v-if="authStore.isAuthenticated && !item.target_path.includes('/posts/')"
                :active="isReadingList(item)"
                :label="isReadingList(item) ? '移除' : '稍后阅读'"
                @click.stop="toggleReadingList(item)"
              />
              <div style="flex:1"></div>
              <a :href="item.target_path" target="_blank" rel="noopener noreferrer" class="feed-item-external-link" @click.stop>
                ↗ 原文
              </a>
            </template>
          </PEntry>
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
                @select="openTarget(item.target_path)"
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
            @select="openTarget(item.target_path)"
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
