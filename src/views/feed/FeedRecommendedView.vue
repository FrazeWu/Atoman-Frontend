<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PPress from '@/components/ui/PPress.vue'
import PTab from '@/components/ui/PTab.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useApi } from '@/composables/useApi'

type RecommendationMode = 'hot' | 'featured' | 'discover'

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
const loading = ref(false)
const errorMessage = ref('')
const articles = ref<RecommendationItem[]>([])
const channels = ref<RecommendationItem[]>([])

const modeOptions: Array<{ label: string; value: RecommendationMode }> = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
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

function openTarget(path: string) {
  router.push(path)
}

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
      <template #action>
        <div class="header-actions">
          <div class="mode-tabs" aria-label="订阅推荐模式">
            <PTab
              v-for="option in modeOptions"
              :key="option.value"
              :label="option.label"
              :active="mode === option.value"
              @click="changeMode(option.value)"
            />
          </div>
          <PPress variant="secondary" label="返回订阅" @click="openTarget('/feed')" />
        </div>
      </template>
    </PPageHeader>

    <p v-if="errorMessage" class="state-line state-line--error">{{ errorMessage }}</p>
    <p v-else-if="loading" class="state-line">正在加载推荐内容...</p>

    <div v-else class="recommend-grid">
      <section class="recommend-section">
        <div class="section-head">
          <p class="section-kicker">ARTICLES</p>
          <h2>推荐文章</h2>
        </div>

        <PEmpty
          v-if="!articles.length"
          kicker="Articles"
          title="当前没有推荐文章"
          description="等有更多内容和互动信号后，这里会显示文章推荐。"
        />

        <div v-else class="card-stack">
          <article
            v-for="item in articles"
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

      <section class="recommend-section">
        <div class="section-head">
          <p class="section-kicker">CHANNELS</p>
          <h2>推荐频道</h2>
        </div>

        <PEmpty
          v-if="!channels.length"
          kicker="Channels"
          title="当前没有推荐频道"
          description="等频道侧积累更多更新和质量信号后，这里会显示频道推荐。"
        />

        <div v-else class="card-stack">
          <article
            v-for="item in channels"
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.mode-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
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

@media (max-width: 960px) {
  .recommend-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .recommend-card {
    grid-template-columns: 1fr;
  }
}
</style>
