<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { PodcastEpisode } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import PPress from '@/components/ui/PPress.vue'
import PodcastShownotes from '@/components/podcast/PodcastShownotes.vue'
import PodcastCommentSection from '@/components/podcast/PodcastCommentSection.vue'

const api = useApi()
const authStore = useAuthStore()
const player = usePlayerStore()
const route = useRoute()
const ep = ref<PodcastEpisode | null>(null)
const loading = ref(true)
const error = ref('')
const actionMessage = ref('')

onMounted(async () => {
  const id = route.params.id as string
  try {
    const res = await fetch(`${api.url}/podcast/episodes/${id}`)
    if (res.ok) {
      ep.value = await res.json()
      const startAt = typeof route.query.t === 'string' ? Number(route.query.t) : NaN
      if (Number.isFinite(startAt) && startAt >= 0) {
        playEpisode()
        player.seek(startAt)
      }
    } else {
      error.value = '单集不存在'
    }
  } catch {
    error.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
})

function fmtDuration(sec: number) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function episodeCover(episode: PodcastEpisode) {
  return episode.episode_cover_url || episode.post?.cover_url || episode.post?.collections?.[0]?.cover_url || episode.collections?.[0]?.cover_url || episode.channel?.cover_url || ''
}

function playEpisode() {
  if (!ep.value) return
  player.setQueueFromPodcastEpisodes([ep.value])
  player.playQueuedSong(player.createPodcastEpisodeSong(ep.value))
}

async function subscribeShow() {
  if (!ep.value?.channel_id) return
  if (!authStore.token) {
    actionMessage.value = '请先登录'
    return
  }
  const res = await fetch(api.podcast.showBookmarks, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify({ channel_id: ep.value.channel_id }),
  })
  actionMessage.value = res.ok ? '已订阅' : '订阅失败'
}

async function favoriteEpisode() {
  if (!ep.value?.id) return
  if (!authStore.token) {
    actionMessage.value = '请先登录'
    return
  }
  const res = await fetch(api.podcast.bookmarks, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify({ episode_id: ep.value.id }),
  })
  actionMessage.value = res.ok ? '已收藏' : '收藏失败'
}

async function listenLater() {
  if (!ep.value?.id) return
  if (!authStore.token) {
    actionMessage.value = '请先登录'
    return
  }
  const res = await fetch(api.podcast.listenLater, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify({ episode_id: ep.value.id }),
  })
  actionMessage.value = res.ok ? '已加入稍后听' : '操作失败'
}

async function shareEpisode() {
  await navigator.clipboard?.writeText(window.location.href)
  actionMessage.value = '已复制链接'
}
</script>

<template>
  <div v-if="loading" class="pev-state">加载中…</div>
  <div v-else-if="error" class="pev-state pev-error">{{ error }}</div>
  <div v-else-if="ep" class="pev-wrap">
    <!-- 封面 + 标题区 -->
    <div class="pev-header">
      <img
        :src="episodeCover(ep)"
        class="pev-cover"
        :alt="ep.post?.title"
      />
      <div class="pev-info">
        <h1 class="pev-title">{{ ep.post?.title }}</h1>
        <RouterLink
          v-if="ep.channel"
          :to="`/podcasts/show/${ep.channel.slug}`"
          class="pev-show"
        >{{ ep.channel.name }}</RouterLink>
        <div class="pev-meta">
          <span v-if="ep.season_number > 1">第 {{ ep.season_number }} 季</span>
          <span v-if="ep.episode_number">第 {{ ep.episode_number }} 集</span>
          <span v-if="ep.duration_sec">{{ fmtDuration(ep.duration_sec) }}</span>
        </div>
        <div class="pev-actions">
          <PPress label="播放" @click="playEpisode" />
          <PPress label="订阅" variant="secondary" @click="subscribeShow" />
          <PPress label="收藏" variant="secondary" @click="favoriteEpisode" />
          <PPress label="稍后听" variant="secondary" @click="listenLater" />
          <PPress
            v-if="ep.post?.visibility !== 'private'"
            label="分享"
            variant="secondary"
            @click="shareEpisode"
          />
        </div>
        <p v-if="actionMessage" class="pev-action-message">{{ actionMessage }}</p>
      </div>
    </div>

    <!-- Shownotes / 节目说明 -->
    <div v-if="ep.post?.content" class="pev-notes">
      <h2 class="pev-notes-title">节目说明</h2>
      <PodcastShownotes :text="ep.post.content" />
    </div>

    <div class="pev-comments">
      <h2 class="pev-notes-title">评论</h2>
      <PodcastCommentSection :episode-id="ep.id" />
    </div>
  </div>
</template>

<style scoped>
.pev-state { text-align: center; padding: 6rem 0; color: #9ca3af; }
.pev-error { color: #ef4444; }
.pev-wrap { max-width: 40rem; margin: 0 auto; padding: 2rem 1rem; }
.pev-header { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; }
.pev-cover { width: 7rem; height: 7rem; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.pev-info { display: flex; flex-direction: column; gap: 0.25rem; }
.pev-title { font-size: 1.25rem; font-weight: 500; line-height: 1.3; }
.pev-show { font-size: 0.875rem; color: #6b7280; text-decoration: none; }
.pev-show:hover { text-decoration: underline; }
.pev-meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }
.pev-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
.pev-action-message { margin: 0.5rem 0 0; color: #6b7280; font-size: 0.8125rem; }
.pev-notes { margin-top: 2rem; }
.pev-notes-title { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
.pev-comments { margin-top: 2rem; }
</style>
