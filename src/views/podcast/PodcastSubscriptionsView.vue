<script setup lang="ts">
import { addPodcastEpisodeBookmark, getPodcastShowBookmarks, getPodcastShowEpisodes } from '@/api/podcast'
import { computed, onMounted, ref } from 'vue'
import type { PodcastEpisode, PodcastEpisodeProgress } from '@/types'
import { listPodcastProgress } from '@/composables/usePodcastProgress'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import ContentNotificationMode from '@/components/content/ContentNotificationMode.vue'

const authStore = useAuthStore()
const player = usePlayerStore()

const episodes = ref<PodcastEpisode[]>([])
const progressRows = ref<PodcastEpisodeProgress[]>([])
const loading = ref(true)
const message = ref('')
const shows = ref<Array<{ id: string; channel?: { id: string; name: string; slug?: string } }>>([])

const progressByEpisode = computed(() => new Map(progressRows.value.map(row => [row.episode_id, row])))

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
  try {
    await addPodcastEpisodeBookmark(ep.id, 'listen_later', authStore.token ?? undefined)
    message.value = '已加入稍后听'
  } catch {
    message.value = '操作失败'
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const subscriptionsData = await getPodcastShowBookmarks<{ data?: typeof shows.value }>(authStore.token ?? undefined)
    shows.value = Array.isArray(subscriptionsData?.data) ? subscriptionsData.data : []
    const episodeData = await Promise.all(shows.value
      .map((show: { channel?: { slug?: string } }) => show.channel?.slug)
      .filter((slug): slug is string => Boolean(slug))
      .map((slug) => getPodcastShowEpisodes<{ episodes?: PodcastEpisode[] }>(slug)))
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
  <div class="a-page-md psub-page">
    <PPageHeader title="播客订阅" mb="1.25rem" />

    <div v-if="!authStore.isAuthenticated" class="psub-unauth">
      <PEmpty
        title="请登录后查看播客订阅"
        description="登录账号以同步你订阅的播客节目和最新更新。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <p v-if="message" class="psub-message">{{ message }}</p>
      <div v-if="shows.length" class="psub-sources">
        <div v-for="show in shows" :key="show.id">
          <span>{{ show.channel?.name || '播客' }}</span>
          <ContentNotificationMode v-if="show.channel?.id" source-type="internal_channel" :source-id="show.channel.id" />
        </div>
      </div>

      <div v-if="loading" class="psub-state">加载中...</div>
      <PEmpty v-else-if="episodes.length === 0" title="暂无更新" description="订阅节目后新发布的单集将显示在这里。" />
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
            <PButton size="sm" @click="playEpisode(ep)">播放</PButton>
            <PButton size="sm" outline @click="listenLater(ep)">稍后听</PButton>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.psub-page { padding-bottom: 3rem; }
.psub-unauth { padding: 3rem 0; }
.psub-state,
.psub-message { color: var(--a-color-muted); font-size: 0.875rem; }
.psub-sources { display: grid; gap: 0.75rem; margin-bottom: 1.25rem; padding: 0.85rem 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); }
.psub-sources > div { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.psub-list { display: grid; gap: 0.6rem; }
.psub-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); padding: 0.85rem 1rem; transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.psub-row:hover { border-color: var(--a-color-border); box-shadow: var(--a-shadow-sm); background: var(--a-color-surface-muted); }
.psub-main { min-width: 0; }
.psub-title { color: var(--a-color-fg); font-weight: 600; text-decoration: none; font-size: 0.925rem; }
.psub-title:hover { text-decoration: underline; }
.psub-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.775rem; }
.psub-actions { display: flex; flex: 0 0 auto; gap: 0.5rem; }
</style>
