<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { PodcastEpisode, PodcastEpisodeProgress } from '@/types'
import { useApi } from '@/composables/useApi'
import { listPodcastProgress } from '@/composables/usePodcastProgress'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import ContentNotificationMode from '@/components/content/ContentNotificationMode.vue'

const api = useApi()
const authStore = useAuthStore()
const player = usePlayerStore()

const episodes = ref<PodcastEpisode[]>([])
const progressRows = ref<PodcastEpisodeProgress[]>([])
const loading = ref(true)
const message = ref('')
const shows = ref<Array<{ id: string; channel?: { id: string; name: string; slug?: string } }>>([])

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
  const res = await fetch(api.podcast.bookmarks, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers() },
    body: JSON.stringify({ episode_id: ep.id }),
  })
  message.value = res.ok ? '已加入稍后听' : '操作失败'
}

onMounted(async () => {
  loading.value = true
  try {
    const subscriptionsRes = await fetch(api.podcast.showBookmarks, { headers: headers() })
    const subscriptionsData = await subscriptionsRes.json()
    shows.value = Array.isArray(subscriptionsData?.data) ? subscriptionsData.data : []
    const episodeResponses = await Promise.all(shows.value
      .map((show: { channel?: { slug?: string } }) => show.channel?.slug)
      .filter((slug): slug is string => Boolean(slug))
      .map((slug) => fetch(api.podcast.showEpisodes(slug))))
    const episodeData = await Promise.all(episodeResponses.map((response) => response.json()))
    episodes.value = episodeData.flatMap((data) => Array.isArray(data?.episodes) ? data.episodes : [])
    progressRows.value = listPodcastProgress().map((record) => ({
      id: record.episode_id,
      user_id: '',
      episode_id: record.episode_id,
      position_sec: record.position_sec,
      duration_sec: record.duration_sec,
      completed: record.completed,
      last_played_at: record.last_played_at,
    }))
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="a-page-md">
    <PPageHeader title="订阅" accent />
    <p v-if="message" class="psub-message">{{ message }}</p>
    <div v-if="shows.length" class="psub-sources">
      <div v-for="show in shows" :key="show.id">
        <span>{{ show.channel?.name || '播客' }}</span>
        <ContentNotificationMode v-if="show.channel?.id" source-type="internal_channel" :source-id="show.channel.id" />
      </div>
    </div>

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
.psub-sources { display: grid; gap: 0.75rem; margin-bottom: 1.25rem; padding-block: 0.75rem; border-block: 1px solid var(--a-color-border-soft); }
.psub-sources > div { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.psub-list { display: grid; gap: 0.75rem; }
.psub-row { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #e5e7eb; padding: 0.875rem 0; }
.psub-main { min-width: 0; }
.psub-title { color: #111827; font-weight: 500; text-decoration: none; }
.psub-title:hover { text-decoration: underline; }
.psub-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.25rem; color: #6b7280; font-size: 0.75rem; }
.psub-actions { display: flex; flex: 0 0 auto; gap: 0.5rem; }
.psub-actions button { border: 1px solid #111827; border-radius: 6px; background: #fff; padding: 0.25rem 0.5rem; font-size: 0.75rem; cursor: pointer; }
</style>
