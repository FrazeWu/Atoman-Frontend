<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { PodcastEpisode, Channel } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import PPress from '@/components/ui/PPress.vue'

const api = useApi()
const authStore = useAuthStore()
const player = usePlayerStore()
const route = useRoute()
const channel = ref<Channel | null>(null)
const episodes = ref<PodcastEpisode[]>([])
const loading = ref(true)
const actionMessage = ref('')

onMounted(async () => {
  const slug = route.params.channelSlug as string
  try {
    const res = await fetch(`${api.url}/podcast/shows/${slug}/episodes`)
    if (res.ok) {
      const data = await res.json()
      channel.value = data.channel
      episodes.value = data.episodes
    }
  } finally {
    loading.value = false
  }
})

function episodeCover(ep: PodcastEpisode) {
  return ep.episode_cover_url || ep.post?.cover_url || ep.post?.collections?.[0]?.cover_url || ep.collections?.[0]?.cover_url || channel.value?.cover_url || ''
}

function playEpisode(ep: PodcastEpisode) {
  player.setQueueFromPodcastEpisodes(episodes.value)
  player.playQueuedSong(player.createPodcastEpisodeSong(ep))
}

async function subscribeShow() {
  if (!channel.value?.id) return
  if (!authStore.token) {
    actionMessage.value = '请先登录'
    return
  }
  const res = await fetch(api.podcast.showBookmarks, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
    body: JSON.stringify({ channel_id: channel.value.id }),
  })
  actionMessage.value = res.ok ? '已订阅' : '订阅失败'
}
</script>

<template>
  <div v-if="loading" class="ps-state">加载中…</div>
  <div v-else-if="!channel" class="ps-state">节目不存在</div>
  <div v-else class="ps-wrap">
    <header class="ps-header">
      <img :src="channel.cover_url || ''" class="ps-cover" :alt="channel.name" />
      <div>
        <h1 class="ps-name">{{ channel.name }}</h1>
        <p v-if="channel.description" class="ps-desc">{{ channel.description }}</p>
        <div class="ps-actions">
          <PPress label="订阅" @click="subscribeShow" />
          <a :href="`${api.url}/channels/${channel.slug}/rss/podcast`" class="ps-rss" target="_blank">RSS</a>
        </div>
        <p v-if="actionMessage" class="ps-message">{{ actionMessage }}</p>
      </div>
    </header>

    <div v-if="episodes.length === 0" class="ps-empty">暂无单集</div>
    <ul v-else class="ps-list">
      <li v-for="ep in episodes" :key="ep.id" class="ps-ep">
        <img :src="episodeCover(ep)" class="ps-ep-cover" :alt="ep.post?.title" />
        <span v-if="ep.episode_number" class="ps-ep-num">第 {{ ep.episode_number }} 集</span>
        <RouterLink :to="`/podcasts/episode/${ep.id}`" class="ps-ep-title">
          {{ ep.post?.title }}
        </RouterLink>
        <button type="button" class="ps-play" @click="playEpisode(ep)">播放</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ps-state { text-align: center; padding: 6rem 0; color: #9ca3af; }
.ps-wrap { max-width: 48rem; margin: 0 auto; padding: 2rem 1rem; }
.ps-header { display: flex; gap: 1.5rem; margin-bottom: 2rem; }
.ps-cover { width: 8rem; height: 8rem; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.ps-name { font-size: 1.5rem; font-weight: 500; }
.ps-desc { font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem; }
.ps-actions { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.75rem; }
.ps-rss { font-size: 0.75rem; color: #9ca3af; display: inline-block; }
.ps-rss:hover { text-decoration: underline; }
.ps-message { margin: 0.5rem 0 0; color: #6b7280; font-size: 0.8125rem; }
.ps-empty { color: #9ca3af; padding: 2rem 0; }
.ps-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.ps-ep { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: none; }
.ps-ep-cover { width: 2.5rem; height: 2.5rem; border-radius: 4px; object-fit: cover; flex-shrink: 0; }
.ps-ep-num { font-size: 0.75rem; color: #9ca3af; width: 3rem; flex-shrink: 0; }
.ps-ep-title { min-width: 0; flex: 1; font-size: 0.875rem; text-decoration: none; color: inherit; }
.ps-ep-title:hover { text-decoration: underline; }
.ps-play { border: 1px solid #111827; border-radius: 6px; background: #fff; padding: 0.25rem 0.5rem; font-size: 0.75rem; cursor: pointer; }
</style>
