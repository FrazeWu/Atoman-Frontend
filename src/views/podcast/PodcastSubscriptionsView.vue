<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PodcastEpisode, PodcastEpisodeProgress } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'

const api = useApi()
const authStore = useAuthStore()
const player = usePlayerStore()

const episodes = ref<PodcastEpisode[]>([])
const progressRows = ref<PodcastEpisodeProgress[]>([])
const loading = ref(true)
const message = ref('')

const progressByEpisode = computed(() => new Map(progressRows.value.map(row => [row.episode_id, row])))

function headers() {
  return { Authorization: `Bearer ${authStore.token}` }
}

function fmtDuration(sec: number) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function progressText(ep: PodcastEpisode) {
  const progress = progressByEpisode.value.get(ep.id)
  if (!progress) return '未听'
  if (progress.completed) return '已听完'
  return `听到 ${fmtDuration(progress.position_sec)}`
}

function playEpisode(ep: PodcastEpisode) {
  player.setQueueFromPodcastEpisodes(episodes.value)
  player.playQueuedSong(player.createPodcastEpisodeSong(ep))
}

async function listenLater(ep: PodcastEpisode) {
  const res = await fetch(api.podcast.listenLater, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ episode_id: ep.id }),
  })
  message.value = res.ok ? '已加入稍后听' : '操作失败'
}

onMounted(async () => {
  loading.value = true
  try {
    const [episodeRes, progressRes] = await Promise.all([
      fetch(api.podcast.subscriptionEpisodes, { headers: headers() }),
      fetch(api.podcast.progress, { headers: headers() }),
    ])
    const episodeData = await episodeRes.json()
    const progressData = await progressRes.json()
    episodes.value = Array.isArray(episodeData?.data) ? episodeData.data : []
    progressRows.value = Array.isArray(progressData?.data) ? progressData.data : []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="a-page-md">
    <PPageHeader title="订阅" accent />
    <p v-if="message" class="psub-message">{{ message }}</p>

    <div v-if="loading" class="psub-state">加载中...</div>
    <PEmpty v-else-if="episodes.length === 0" title="暂无更新" description="订阅节目后会显示新单集。" />
    <div v-else class="psub-list">
      <article v-for="ep in episodes" :key="ep.id" class="psub-row">
        <div class="psub-main">
          <RouterLink :to="`/podcasts/episode/${ep.id}`" class="psub-title">
            {{ ep.post?.title || '未命名单集' }}
          </RouterLink>
          <div class="psub-meta">
            <span>{{ ep.channel?.name || '播客' }}</span>
            <span v-if="ep.duration_sec">{{ fmtDuration(ep.duration_sec) }}</span>
            <span>{{ progressText(ep) }}</span>
          </div>
        </div>
        <div class="psub-actions">
          <button type="button" @click="playEpisode(ep)">播放</button>
          <button type="button" @click="listenLater(ep)">稍后听</button>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.psub-state,
.psub-message { color: #6b7280; font-size: 0.875rem; }
.psub-list { display: grid; gap: 0.75rem; }
.psub-row { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #e5e7eb; padding: 0.875rem 0; }
.psub-main { min-width: 0; }
.psub-title { color: #111827; font-weight: 500; text-decoration: none; }
.psub-title:hover { text-decoration: underline; }
.psub-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.25rem; color: #6b7280; font-size: 0.75rem; }
.psub-actions { display: flex; flex: 0 0 auto; gap: 0.5rem; }
.psub-actions button { border: 1px solid #111827; border-radius: 6px; background: #fff; padding: 0.25rem 0.5rem; font-size: 0.75rem; cursor: pointer; }
</style>
