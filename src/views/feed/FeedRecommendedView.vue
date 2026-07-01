<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PClip from '@/components/ui/PClip.vue'
import FeedTimelineFooter from '@/components/feed/FeedTimelineFooter.vue'
import { useApi } from '@/composables/useApi'
import { useFeedStore } from '@/stores/feed'
import { useAuthStore } from '@/stores/auth'

type RecommendationMode = 'hot' | 'featured' | 'discover'
type RecommendTarget = 'articles' | 'channels' | 'mixed'
type FeedSourceCategory = 'all' | 'blog' | 'news' | 'social' | 'video' | 'forum' | 'podcast'

type RecommendationItem = {
  id: string
  title: string
  summary?: string
  content_type?: string
  image_url?: string
  target_path: string
  score_label?: string
}

const router = useRouter()
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
const category = ref<FeedSourceCategory>('all')
const loading = ref(false)
const errorMessage = ref('')
const articles = ref<RecommendationItem[]>([])
const channels = ref<RecommendationItem[]>([])
const page = ref(1)
const pageSize = 20
const totalArticles = ref(0)

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

const categoryOptions: Array<{ label: string; value: FeedSourceCategory }> = [
  { label: '全部', value: 'all' },
  { label: '博客', value: 'blog' },
  { label: '新闻', value: 'news' },
  { label: '社交', value: 'social' },
  { label: '视频', value: 'video' },
  { label: '论坛', value: 'forum' },
  { label: '播客', value: 'podcast' },
]

async function fetchRecommendations() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [articleRes, channelRes] = await Promise.all([
      fetch(`${api.url}/feed/recommend/articles?mode=${mode.value}&page=${page.value}&page_size=${pageSize}`),
      fetch(`${api.url}/feed/recommend/channels?mode=${mode.value}&page=${page.value}&page_size=${pageSize}`),
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
    totalArticles.value = articlePayload.meta?.total ?? articlePayload.total ?? articles.value.length
  } catch (error) {
    console.error('Failed to fetch feed recommendations:', error)
    errorMessage.value = '推荐内容加载失败'
    articles.value = []
    channels.value = []
    totalArticles.value = 0
  } finally {
    loading.value = false
  }
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

const visibleChannels = computed(() => {
  if (category.value === 'all') return channels.value
  return channels.value.filter((item) => normalizeItemCategory(item) === category.value)
})

const visibleArticles = computed(() => {
  if (category.value === 'all') return articles.value
  return articles.value.filter((item) => normalizeItemCategory(item) === category.value)
})

const visibleMixedArticles = computed(() => visibleArticles.value.slice(0, 4))
const visibleMixedChannels = computed(() => visibleChannels.value.slice(0, 4))

const changePage = (nextPage: number) => {
  if (nextPage < 1 || nextPage === page.value) return
  page.value = nextPage
}

watch([mode, page], () => {
  fetchRecommendations()
})

watch([mode, target, category], () => {
  page.value = 1
})

onMounted(() => {
  fetchRecommendations()
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
      kicker="FEED RECOMMEND"
      sub="把订阅文章和频道拆开推荐，用热度、精选、探索三种模式浏览。"
      mb="1rem"
    >
      <template #action><PPress variant="secondary" label="返回订阅" @click="openTarget('/feed')" /></template>
    </PPageHeader>

    <div class="filters-stack">
      <div class="filter-row" aria-label="订阅推荐模式">
        <PSegmentedControl
          v-model="mode"
          :options="modeOptions"
        />
      </div>

      <div class="filter-row" aria-label="订阅推荐对象">
        <PSegmentedControl
          v-model="target"
          :options="targetOptions"
        />
      </div>

      <div class="filter-row" aria-label="内容类型筛选">
        <PSegmentedControl
          v-model="category"
          :options="categoryOptions"
          class="category-segmented-control"
        />
      </div>
    </div>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载推荐内容...</p>

    <div v-else-if="target === 'articles'" class="recommend-grid recommend-grid--single">
      <section class="recommend-section">
        <div class="section-head">
          <p class="section-kicker">ARTICLES</p>
          <h2>推荐文章</h2>
        </div>

        <PEmpty
          v-if="!visibleArticles.length"
          kicker="Articles"
          title="当前没有推荐文章"
          description="等有更多内容和互动信号后，这里会显示文章推荐。"
        />

        <div v-else class="feed-timeline">
          <article
            v-for="item in visibleArticles"
            :key="item.id"
            class="recommend-card recommend-card--article"
            @click="openTarget(item.target_path)"
          >
            <PEntry
              :title="item.title"
              :summary="item.summary"
            >
              <template #visual>
                <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
                  <PBadge type="external" fill>外部</PBadge>
                  <PBadge type="external">{{ normalizeItemCategory(item) === 'podcast' ? '播客' : normalizeItemCategory(item) === 'video' ? '视频' : normalizeItemCategory(item) === 'news' ? '新闻' : normalizeItemCategory(item) === 'social' ? '社交' : normalizeItemCategory(item) === 'forum' ? '论坛' : '博客' }}</PBadge>
                </div>
              </template>
              <template #meta>
                <span class="a-label a-muted">{{ item.score_label || '推荐' }}</span>
              </template>
              <template #actions>
                <PClip
                  v-if="authStore.isAuthenticated"
                  :active="isStarred(item)"
                  :label="isStarred(item) ? '退藏' : '收藏'"
                  @click="toggleStar(item)"
                />
                <PClip
                  v-if="authStore.isAuthenticated && !item.target_path.includes('/posts/')"
                  :active="isReadingList(item)"
                  :label="isReadingList(item) ? '移除' : '稍后阅读'"
                  @click="toggleReadingList(item)"
                />
                <div style="flex:1"></div>
                <a :href="item.target_path" target="_blank" rel="noopener noreferrer" class="feed-item-external-link">
                  ↗ 原文
                </a>
              </template>
            </PEntry>
          </article>
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
          <p class="section-kicker">MIXED OVERVIEW</p>
          <h2>混合推荐</h2>
        </div>

        <PEmpty
          v-if="!visibleMixedArticles.length && !visibleMixedChannels.length"
          kicker="Mixed"
          title="当前没有混合推荐"
          description="等有更多内容和频道信号后，这里会把站内外推荐一起编排。"
        />

        <div v-else class="recommend-grid recommend-grid--mixed">
          <section class="recommend-section">
            <div class="section-head">
              <p class="section-kicker">ARTICLES</p>
              <h2>文章推荐</h2>
            </div>
            <div class="feed-timeline">
              <article
                v-for="item in visibleMixedArticles"
                :key="item.id"
                class="recommend-card recommend-card--article"
                @click="openTarget(item.target_path)"
              >
                <PEntry :title="item.title" :summary="item.summary" />
              </article>
            </div>
          </section>

          <section class="recommend-section">
            <div class="section-head">
              <p class="section-kicker">CHANNELS</p>
              <h2>频道推荐</h2>
            </div>
            <div class="card-stack">
              <article
                v-for="item in visibleMixedChannels"
                :key="item.id"
                class="recommend-card"
                @click="openTarget(item.target_path)"
              >
                <div class="recommend-card__cover recommend-card__cover--channel">
                  <img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="recommend-card__img" />
                  <span v-else class="recommend-card__fallback">CHANNEL</span>
                </div>
                <div class="recommend-card__body">
                  <p class="recommend-card__meta">{{ item.score_label || '推荐' }}</p>
                  <h3>{{ item.title }}</h3>
                  <p>{{ item.summary || '打开后查看频道文章和归档内容。' }}</p>
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>
    </div>

    <div v-else class="recommend-grid recommend-grid--single">
      <section class="recommend-section">
        <div class="section-head">
          <p class="section-kicker">CHANNELS</p>
          <h2>推荐频道</h2>
        </div>

        <PEmpty
          v-if="!visibleChannels.length"
          kicker="Channels"
          title="当前没有推荐频道"
          description="等频道侧积累更多更新和质量信号后，这里会显示频道推荐。"
        />

        <div v-else class="card-stack">
          <article
            v-for="item in visibleChannels"
            :key="item.id"
            class="recommend-card"
            data-test="channel-card"
            @click="openTarget(item.target_path)"
          >
            <div class="recommend-card__cover recommend-card__cover--channel">
              <img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="recommend-card__img" />
              <span v-else class="recommend-card__fallback">CHANNEL</span>
            </div>
            <div class="recommend-card__body">
              <p class="recommend-card__meta">{{ item.score_label || '推荐' }}</p>
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary || '打开后查看频道文章和归档内容。' }}</p>
            </div>
          </article>
        </div>
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

.filters-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.category-segmented-control :deep(.p-segmented-control-item) {
  min-height: 24px;
  padding: 0 10px;
  font-size: 10px;
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
  font-family: var(--a-font-meta);
  font-size: 0.7rem;
  letter-spacing: 0.18em;
}

.card-stack {
  display: grid;
  gap: 1rem;
}

.recommend-card {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper);
  cursor: pointer;
}

.recommend-card__cover {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--a-color-line-soft);
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.04), rgba(0, 0, 0, 0.08));
}

.recommend-card__cover--channel {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.06));
}

.recommend-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recommend-card__fallback {
  color: var(--a-color-muted);
  font-family: var(--a-font-meta);
  letter-spacing: 0.16em;
}

.recommend-card__body {
  min-width: 0;
}

.recommend-card__body h3,
.recommend-card__body p {
  margin: 0;
}

.recommend-card__meta {
  margin-bottom: 0.45rem !important;
  color: var(--a-color-muted);
  font-size: 0.78rem;
}

.recommend-card__body h3 {
  margin-bottom: 0.45rem !important;
  font-size: 1.15rem;
  line-height: 1.25;
}

.recommend-card__body p:last-child {
  color: var(--a-color-muted);
  line-height: 1.6;
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
