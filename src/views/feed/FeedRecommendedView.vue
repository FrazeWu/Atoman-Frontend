<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PTab from '@/components/ui/PTab.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useApi } from '@/composables/useApi'

type RecommendationMode = 'hot' | 'featured' | 'discover'
type RecommendTarget = 'articles' | 'channels'
type FeedSourceCategory = 'all' | 'blog' | 'news' | 'social' | 'video' | 'forum' | 'podcast'

type RecommendationItem = {
  id: string
  title: string
  summary?: string
  image_url?: string
  target_path: string
  score_label?: string
}

const router = useRouter()
const api = useApi()

const mode = ref<RecommendationMode>('hot')
const target = ref<RecommendTarget>('articles')
const category = ref<FeedSourceCategory>('all')
const loading = ref(false)
const errorMessage = ref('')
const articles = ref<RecommendationItem[]>([])
const channels = ref<RecommendationItem[]>([])

const modeOptions: Array<{ label: string; value: RecommendationMode }> = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

const targetOptions: Array<{ label: string; value: RecommendTarget }> = [
  { label: '文章', value: 'articles' },
  { label: '频道', value: 'channels' },
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
      fetch(`${api.url}/feed/recommend/articles?mode=${mode.value}`),
      fetch(`${api.url}/feed/recommend/channels?mode=${mode.value}`),
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
  } catch (error) {
    console.error('Failed to fetch feed recommendations:', error)
    errorMessage.value = '推荐内容加载失败'
    articles.value = []
    channels.value = []
  } finally {
    loading.value = false
  }
}

function changeMode(nextMode: RecommendationMode) {
  if (nextMode === mode.value) return
  mode.value = nextMode
}

function changeTarget(nextTarget: RecommendTarget) {
  if (nextTarget === target.value) return
  target.value = nextTarget
}

function changeCategory(nextCategory: FeedSourceCategory) {
  if (nextCategory === category.value) return
  category.value = nextCategory
}

function openTarget(path: string) {
  router.push(path)
}

function inferChannelCategory(item: RecommendationItem): FeedSourceCategory {
  const value = `${item.title || ''} ${item.summary || ''}`.toLowerCase()
  if (value.includes('podcast') || value.includes('播客') || value.includes('audio')) return 'podcast'
  if (value.includes('video') || value.includes('视频') || value.includes('youtube') || value.includes('bilibili')) return 'video'
  if (value.includes('forum') || value.includes('论坛') || value.includes('bbs') || value.includes('discourse')) return 'forum'
  if (value.includes('news') || value.includes('新闻') || value.includes('media') || value.includes('日报')) return 'news'
  if (value.includes('twitter') || value.includes('x.com') || value.includes('reddit') || value.includes('社交')) return 'social'
  return 'blog'
}

const visibleChannels = computed(() => {
  if (category.value === 'all') return channels.value
  return channels.value.filter((item) => inferChannelCategory(item) === category.value)
})

const visibleArticles = computed(() => articles.value)

watch(mode, () => {
  fetchRecommendations()
})

onMounted(() => {
  fetchRecommendations()
})
</script>

<template>
  <div class="a-page-xl feed-recommend-page">
    <PPageHeader
      title="探索"
      accent
      kicker="FEED RECOMMEND"
      sub="把订阅文章和频道拆开推荐，用热度、精选、探索三种模式浏览。"
    >
      <template #action><PPress variant="secondary" label="返回订阅" @click="openTarget('/feed')" /></template>
    </PPageHeader>

    <div class="filters-stack">
      <div class="filter-row" aria-label="订阅推荐模式">
        <PTab
          v-for="option in modeOptions"
          :key="option.value"
          :label="option.label"
          :active="mode === option.value"
          @click="changeMode(option.value)"
        />
      </div>

      <div class="filter-row" aria-label="订阅推荐对象">
        <PTab
          v-for="option in targetOptions"
          :key="option.value"
          :label="option.label"
          :active="target === option.value"
          @click="changeTarget(option.value)"
        />
      </div>

      <div v-if="target === 'channels'" class="filter-row filter-row--compact" aria-label="频道类型筛选">
        <PTab
          v-for="option in categoryOptions"
          :key="option.value"
          :label="option.label"
          :active="category === option.value"
          @click="changeCategory(option.value)"
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

        <div v-else class="card-stack">
          <article
            v-for="item in visibleArticles"
            :key="item.id"
            class="recommend-card"
            @click="openTarget(item.target_path)"
          >
            <div class="recommend-card__cover">
              <img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="recommend-card__img" />
              <span v-else class="recommend-card__fallback">POST</span>
            </div>
            <div class="recommend-card__body">
              <p class="recommend-card__meta">{{ item.score_label || '推荐' }}</p>
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary || '打开后查看完整文章内容。' }}</p>
            </div>
          </article>
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
  gap: 1.5rem;
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

.filter-row--compact :deep(.p-tab) {
  min-height: 30px;
  padding: 0 12px;
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
</style>
