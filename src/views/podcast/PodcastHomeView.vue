<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEntry from '@/components/ui/PEntry.vue'
import PBadge from '@/components/ui/PBadge.vue'
import PPress from '@/components/ui/PPress.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import { useAuthStore } from '@/stores/auth'
import { useSiteAccessStore } from '@/stores/siteAccess'
import { usePlayerStore } from '@/stores/player'
import type { PodcastEpisode } from '@/types'
import { useApiUrl } from '@/composables/useApi'

const router = useRouter()
const authStore = useAuthStore()
const siteAccessStore = useSiteAccessStore()
const player = usePlayerStore()
const canPublishPodcast = computed(() => siteAccessStore.isFeatureEnabled('podcast', 'podcast.publish'))

const API_URL = useApiUrl()
const episodes = ref<PodcastEpisode[]>([])
const loading = ref(false)
const recommendedEpisodes = ref<Array<{
  id: string
  title: string
  summary: string
  targetPath: string
  scoreLabel: string
}>>([])
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
  <div class="a-page-md">
    <PPageHeader title="播客" accent>
      <template #action>
        <PPress v-if="authStore.isAuthenticated && canPublishPodcast" @click="router.push('/podcasts/editor')" label="+ 发布节目" />
      </template>
    </PPageHeader>

    <section class="ph-recommendations" aria-label="播客推荐">
      <div class="ph-recommendations__header">
        <div>
          <h2 class="ph-recommendations__title">推荐</h2>
          <p class="ph-recommendations__note">按热度、精选、探索切换当前播客推荐。</p>
        </div>
        <PSegmentedControl
          v-model="recommendationMode"
          :options="recommendationOptions"
          @change="() => void fetchRecommendedEpisodes()"
        />
      </div>

      <div v-if="recommendationLoading" class="ph-state">
        <div v-for="i in 2" :key="i" class="a-skeleton" style="height: 8rem; margin-bottom: 1rem" />
      </div>
      <PEmpty v-else-if="recommendedEpisodes.length === 0" title="暂无推荐" description="稍后再来看新的播客推荐。" />
      <div v-else class="ph-list">
        <PEntry
          v-for="item in recommendedEpisodes"
          :key="item.id"
          :title="item.title"
          :summary="item.summary"
          @click="router.push(item.targetPath)"
        >
          <template #visual>
            <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
              <PBadge type="podcast">播客</PBadge>
            </div>
          </template>
          <template #meta>
            <span class="a-label a-muted">{{ item.scoreLabel }}</span>
          </template>
        </PEntry>
      </div>
    </section>

    <div v-if="loading" class="ph-state">
      <div v-for="i in 3" :key="i" class="a-skeleton" style="height: 10rem; margin-bottom: 1.5rem" />
    </div>
    <div v-else-if="episodes.length === 0" class="ph-state">暂无节目</div>

    <div v-else class="ph-list">
      <PEntry
        v-for="ep in episodes"
        :key="ep.id"
        :title="ep.post?.title || '未命名单集'"
        :summary="ep.post?.summary"
        @click="router.push(`/podcasts/episode/${ep.id}`)"
      >
        <template #visual>
          <div style="display:flex;flex-direction:column;gap:0.35rem;align-items:flex-start;flex-shrink:0">
            <PBadge type="podcast">播客</PBadge>
            <img
              v-if="episodeCover(ep)"
              :src="episodeCover(ep)"
              style="width:5rem;height:5rem;object-fit:cover;border:1px solid var(--a-color-line-soft);filter:grayscale(100%);flex-shrink:0;border-radius:4px;margin-top:0.25rem"
            />
          </div>
        </template>

        <template #meta>
          <span v-if="ep.channel" class="a-label a-muted">{{ ep.channel.name }}</span>
          <span v-if="ep.duration_sec" style="font-weight:700;color:var(--a-color-muted-soft)">
            时长: {{ fmtDuration(ep.duration_sec) }}
          </span>
          <span style="color:var(--a-color-muted-soft)">{{ new Date(ep.created_at).toLocaleDateString() }}</span>
          <button class="ph-play" type="button" @click.stop="playEpisode(ep)">播放</button>
        </template>
      </PEntry>
    </div>
  </div>
</template>

<style scoped>
.ph-state { padding: 4rem 0; color: #9ca3af; }
.ph-list { display: flex; flex-direction: column; }

.ph-recommendations {
  margin-bottom: 2rem;
}

.ph-recommendations__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.ph-recommendations__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.ph-recommendations__note {
  margin: 0.35rem 0 0;
  color: var(--a-color-muted-soft);
  font-size: 0.85rem;
}

.ph-play {
  border: 1px solid var(--a-color-ink);
  border-radius: 6px;
  background: var(--a-color-paper);
  padding: 0.25rem 0.5rem;
  color: var(--a-color-ink);
  font-size: 0.75rem;
  cursor: pointer;
}
</style>
