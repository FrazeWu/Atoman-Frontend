<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Headphones, Play } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useApiUrl } from '@/composables/useApi'
import { usePlayerStore } from '@/stores/player'
import type { PodcastEpisode } from '@/types'
import ContentContinueSection from '@/components/content/ContentContinueSection.vue'

type RecommendedEpisode = {
  id: string
  title: string
  summary: string
  targetPath: string
  scoreLabel: string
  imageUrl: string
}

const player = usePlayerStore()

const API_URL = useApiUrl()
const episodes = ref<PodcastEpisode[]>([])
const loading = ref(false)
const recommendedEpisodes = ref<RecommendedEpisode[]>([])
const recommendationLoading = ref(false)
const recommendationMode = ref<'hot' | 'featured' | 'discover'>('hot')
const recommendationOptions = [
  { label: '热度', value: 'hot' },
  { label: '精选', value: 'featured' },
  { label: '探索', value: 'discover' },
]

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetch(`${API_URL}/podcast/episodes`)
    if (res.ok) episodes.value = await res.json()
  } finally {
    loading.value = false
  }
  void fetchRecommendedEpisodes()
})

async function fetchRecommendedEpisodes() {
  recommendationLoading.value = true
  try {
    const res = await fetch(`${API_URL}/podcast/recommend/episodes?mode=${recommendationMode.value}&page=1&page_size=8`)
    if (!res.ok) {
      recommendedEpisodes.value = []
      return
    }
    const data = await res.json()
    recommendedEpisodes.value = Array.isArray(data.data)
      ? data.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          targetPath: item.target_path,
          scoreLabel: item.score_label,
          imageUrl: item.image_url || item.episode_cover_url || item.channel_cover_url || '',
        }))
      : []
  } finally {
    recommendationLoading.value = false
  }
}

function fmtDuration(sec: number) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function episodeCover(ep: PodcastEpisode) {
  return ep.episode_cover_url || ep.post?.cover_url || ep.post?.collections?.[0]?.cover_url || ep.collections?.[0]?.cover_url || ep.channel?.cover_url || ''
}

function playEpisode(ep: PodcastEpisode) {
  player.setQueueFromPodcastEpisodes(episodes.value)
  player.playQueuedSong(player.createPodcastEpisodeSong(ep))
}
</script>

<template>
  <div class="a-page-lg ph-page">
    <PPageHeader title="播客" accent mb="2rem">
    </PPageHeader>

    <ContentContinueSection module="podcast" />

    <section class="ph-recommendations" aria-labelledby="ph-recommendations-title">
      <div class="ph-section-header">
        <div>
          <h2 id="ph-recommendations-title">推荐</h2>
          <p>发现值得收听的新单集。</p>
        </div>
        <PSegmentedControl
          v-model="recommendationMode"
          :options="recommendationOptions"
          @change="() => void fetchRecommendedEpisodes()"
        />
      </div>

      <div v-if="recommendationLoading" class="ph-recommendation-grid" aria-label="正在加载推荐">
        <div v-for="i in 2" :key="i" class="a-skeleton ph-recommendation-skeleton" />
      </div>
      <PEmpty v-else-if="recommendedEpisodes.length === 0" title="暂无推荐" />
      <div v-else class="ph-recommendation-grid">
        <RouterLink
          v-for="item in recommendedEpisodes"
          :key="item.id"
          :to="item.targetPath"
          class="ph-recommendation-card"
        >
          <div class="ph-recommendation-cover">
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" loading="lazy" />
            <Headphones v-else :size="28" aria-hidden="true" />
          </div>
          <div class="ph-recommendation-content">
            <span class="ph-score">{{ item.scoreLabel }}</span>
            <h3>{{ item.title }}</h3>
            <p v-if="item.summary">{{ item.summary }}</p>
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="ph-latest" aria-labelledby="ph-latest-title">
      <div class="ph-section-header ph-section-header--compact">
        <div>
          <h2 id="ph-latest-title">最新单集</h2>
          <p>最近发布的播客内容。</p>
        </div>
      </div>

      <div v-if="loading" class="ph-episode-list" aria-label="正在加载单集">
        <div v-for="i in 3" :key="i" class="a-skeleton ph-episode-skeleton" />
      </div>
      <PEmpty v-else-if="episodes.length === 0" title="暂无单集" />
      <div v-else class="ph-episode-list">
        <article v-for="ep in episodes" :key="ep.id" class="ph-episode-row">
          <div class="ph-episode-cover">
            <img v-if="episodeCover(ep)" :src="episodeCover(ep)" :alt="ep.post?.title || '单集封面'" loading="lazy" />
            <Headphones v-else :size="24" aria-hidden="true" />
          </div>
          <div class="ph-episode-content">
            <div class="ph-episode-meta">
              <span v-if="ep.channel">{{ ep.channel.name }}</span>
              <span v-if="ep.duration_sec">{{ fmtDuration(ep.duration_sec) }}</span>
              <time :datetime="ep.created_at">{{ new Date(ep.created_at).toLocaleDateString() }}</time>
            </div>
            <RouterLink :to="`/podcasts/episode/${ep.id}`" class="ph-episode-title">
              {{ ep.post?.title || '未命名单集' }}
            </RouterLink>
            <p v-if="ep.post?.summary">{{ ep.post.summary }}</p>
          </div>
          <PButton
            variant="ghost"
            size="sm"
            class="ph-play"
            :aria-label="`播放${ep.post?.title || '未命名单集'}`"
            :title="`播放${ep.post?.title || '未命名单集'}`"
            @click="playEpisode(ep)"
          >
            <Play :size="17" fill="currentColor" aria-hidden="true" />
          </PButton>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ph-page {
  padding-bottom: 5rem;
}

.ph-recommendations,
.ph-latest {
  display: grid;
  gap: 1.25rem;
}

.ph-latest {
  margin-top: 3rem;
}

.ph-section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
}

.ph-section-header h2,
.ph-section-header p {
  margin: 0;
}

.ph-section-header h2 {
  color: var(--a-color-text);
  font-size: 1.25rem;
  font-weight: 600;
}

.ph-section-header p {
  margin-top: 0.35rem;
  color: var(--a-color-muted);
  font-size: 0.875rem;
}

.ph-recommendation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.ph-recommendation-card {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  min-height: 7rem;
  overflow: hidden;
  border-radius: var(--a-radius-card);
  background: var(--a-color-surface-muted);
  color: inherit;
  text-decoration: none;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.ph-recommendation-card:hover {
  background: var(--a-color-surface);
  box-shadow: var(--a-shadow-sm);
}

.ph-recommendation-card:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.ph-recommendation-cover,
.ph-episode-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--a-color-disabled-bg);
  color: var(--a-color-muted);
}

.ph-recommendation-cover img,
.ph-episode-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ph-recommendation-content {
  display: grid;
  align-content: center;
  gap: 0.35rem;
  min-width: 0;
  padding: 1rem;
}

.ph-score {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.ph-recommendation-content h3,
.ph-recommendation-content p {
  margin: 0;
}

.ph-recommendation-content h3 {
  color: var(--a-color-text);
  font-size: 1rem;
  font-weight: 600;
}

.ph-recommendation-content p {
  display: -webkit-box;
  overflow: hidden;
  color: var(--a-color-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ph-recommendation-skeleton {
  min-height: 7rem;
  border-radius: var(--a-radius-card);
}

.ph-episode-list {
  display: grid;
}

.ph-episode-row {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr) 40px;
  gap: 1rem;
  align-items: center;
  min-height: 7rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.ph-episode-cover {
  width: 5rem;
  aspect-ratio: 1;
  border-radius: var(--a-radius-control);
}

.ph-episode-content {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
}

.ph-episode-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.ph-episode-title {
  width: fit-content;
  color: var(--a-color-text);
  font-size: 1.05rem;
  font-weight: 600;
  text-decoration: none;
}

.ph-episode-title:hover {
  text-decoration: underline;
  text-decoration-thickness: 1px;
}

.ph-episode-content > p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--a-color-text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.ph-play {
  width: 40px;
  min-width: 40px;
  padding: 0;
}

.ph-episode-skeleton {
  height: 7rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

@media (max-width: 760px) {
  .ph-section-header {
    align-items: stretch;
    flex-direction: column;
  }

  .ph-recommendation-grid {
    grid-template-columns: 1fr;
  }

  .ph-recommendation-card {
    grid-template-columns: 5.5rem minmax(0, 1fr);
  }

  .ph-episode-row {
    grid-template-columns: 4.5rem minmax(0, 1fr) 40px;
    gap: 0.75rem;
  }

  .ph-episode-cover {
    width: 4.5rem;
  }
}

@media (max-width: 440px) {
  .ph-episode-row {
    grid-template-columns: 4rem minmax(0, 1fr);
  }

  .ph-episode-cover {
    width: 4rem;
  }

  .ph-play {
    grid-column: 2;
    justify-self: end;
  }
}
</style>
