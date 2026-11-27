<script setup lang="ts">
import { addPodcastShowBookmark, getPodcastShowEpisodes } from '@/api/podcast'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Headphones } from 'lucide-vue-next'
import type { PodcastEpisode, Channel } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSkeleton from '@/components/ui/PSkeleton.vue'

const authStore = useAuthStore()
const player = usePlayerStore()
const route = useRoute()
const channel = ref<Channel | null>(null)
const episodes = ref<PodcastEpisode[]>([])
const loading = ref(true)
const error = ref('')
const actionMessage = ref('')
const coverFailed = ref(false)
const failedCovers = ref(new Set<string>())
let latestRequest = 0

watch(() => route.params.channelSlug as string | undefined, (slug) => {
  if (slug) void loadShow(slug)
}, { immediate: true })

async function loadShow(slug: string) {
  const request = ++latestRequest
  channel.value = null
  episodes.value = []
  actionMessage.value = ''
  error.value = ''
  loading.value = true

  try {
    const data = await getPodcastShowEpisodes<{ channel: Channel; episodes: PodcastEpisode[] }>(slug)
    if (request !== latestRequest) return
    channel.value = data.channel
    episodes.value = data.episodes
  } catch {
    if (request !== latestRequest) return
    error.value = '节目加载失败，请重试'
  } finally {
    if (request === latestRequest) loading.value = false
  }
}

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
  try {
    const ok = await addPodcastShowBookmark(channel.value.id, authStore.token ?? undefined)
    actionMessage.value = ok ? '已订阅' : '订阅失败'
  } catch {
    actionMessage.value = '订阅失败，请重试'
  }
}
</script>

<template>
  <div v-if="loading" class="ps-wrap" role="status" aria-label="正在加载播客节目">
    <span class="sr-only">加载中...</span>
    <header class="ps-header">
      <PSkeleton width="8rem" height="8rem" variant="rect" style="border-radius: var(--a-radius-card); flex-shrink: 0;" />
      <div style="display: flex; flex-direction: column; gap: 0.5rem; justify-content: center;">
        <PSkeleton width="40%" height="28px" />
        <PSkeleton width="80%" height="16px" />
        <PSkeleton width="60%" height="16px" />
        <PSkeleton width="80px" height="32px" variant="rect" style="border-radius: var(--a-radius-control); margin-top: 0.35rem;" />
      </div>
    </header>
    <ul class="ps-list">
      <li v-for="i in 5" :key="i" class="ps-ep">
        <PSkeleton width="2.75rem" height="2.75rem" variant="rect" style="border-radius: var(--a-radius-control); flex-shrink: 0;" />
        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.35rem;">
          <PSkeleton width="60%" height="18px" />
          <PSkeleton width="30%" height="14px" />
        </div>
        <PSkeleton width="56px" height="32px" variant="rect" style="border-radius: var(--a-radius-control);" />
      </li>
    </ul>
  </div>
  <PEmpty v-else-if="error" title="节目加载失败" :description="error">
    <template #action><PButton variant="secondary" @click="route.params.channelSlug && loadShow(String(route.params.channelSlug))">重试</PButton></template>
  </PEmpty>
  <PEmpty v-else-if="!channel" title="节目不存在" description="该播客节目可能已被移除或地址有误。" />
  <div v-else class="ps-wrap">
    <header class="ps-header">
      <img
        v-if="channel.cover_url && !coverFailed"
        :src="channel.cover_url"
        class="ps-cover"
        :alt="channel.name"
        @error="coverFailed = true"
      />
      <div v-else class="ps-cover ps-cover--fallback">
        <Headphones :size="40" aria-hidden="true" />
      </div>
      <div class="ps-header-info">
        <h1 class="ps-name">{{ channel.name }}</h1>
        <p v-if="channel.description" class="ps-desc">{{ channel.description }}</p>
        <div class="ps-actions">
          <PButton size="sm" @click="subscribeShow">订阅节目</PButton>
        </div>
        <p v-if="actionMessage" class="ps-message">{{ actionMessage }}</p>
      </div>
    </header>

    <PEmpty v-if="episodes.length === 0" title="暂无单集" description="该节目暂未发布单集内容。" />
    <ul v-else class="ps-list">
      <li v-for="ep in episodes" :key="ep.id" class="ps-ep">
        <img
          v-if="episodeCover(ep) && !failedCovers.has(ep.id)"
          :src="episodeCover(ep)"
          class="ps-ep-cover"
          :alt="ep.post?.title || '单集封面'"
          @error="failedCovers.add(ep.id)"
        />
        <div v-else class="ps-ep-cover ps-ep-cover--fallback">
          <Headphones :size="18" aria-hidden="true" />
        </div>
        <span v-if="ep.episode_number" class="ps-ep-num">第 {{ ep.episode_number }} 集</span>
        <RouterLink :to="`/podcasts/episode/${ep.id}`" class="ps-ep-title">
          {{ ep.post?.title || '未命名单集' }}
        </RouterLink>
        <PButton variant="secondary" size="sm" @click="playEpisode(ep)">播放</PButton>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.ps-wrap { width: 100%; max-width: 56rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
.ps-header { display: flex; gap: 1.5rem; margin-bottom: 2rem; border-bottom: 1px solid var(--a-color-border-soft); padding-bottom: 1.75rem; min-width: 0; }
.ps-header-info { flex: 1; min-width: 0; }
.ps-cover { width: 8rem; height: 8rem; border-radius: var(--a-radius-card); object-fit: cover; flex: 0 0 auto; border: 1px solid var(--a-color-border-soft); }
.ps-cover--fallback { display: flex; align-items: center; justify-content: center; background: var(--a-color-surface-muted); color: var(--a-color-muted); }
.ps-name { font-size: 1.5rem; font-weight: 500; color: var(--a-color-fg); margin: 0; }
.ps-desc { font-size: 0.875rem; color: var(--a-color-muted); margin-top: 0.35rem; line-height: 1.5; }
.ps-actions { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.85rem; }
.ps-message { margin: 0.5rem 0 0; color: var(--a-color-muted); font-size: 0.8125rem; }
.ps-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.ps-ep { display: flex; align-items: center; gap: 0.85rem; padding: 0.85rem 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.ps-ep:hover { border-color: var(--a-color-border); background: var(--a-color-surface-muted); box-shadow: none; }
.ps-ep-cover { width: 2.75rem; height: 2.75rem; border-radius: var(--a-radius-control); object-fit: cover; flex-shrink: 0; }
.ps-ep-cover--fallback { display: flex; align-items: center; justify-content: center; background: var(--a-color-surface-muted); color: var(--a-color-muted); border: 1px solid var(--a-color-border-soft); }
.ps-ep-num { font-size: 0.75rem; color: var(--a-color-muted); flex-shrink: 0; }
.ps-ep-title { min-width: 0; flex: 1; font-size: 0.9rem; font-weight: 500; text-decoration: none; color: var(--a-color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ps-ep-title:hover { text-decoration: underline; }

@media (max-width: 640px) {
  .ps-wrap {
    padding: 0.75rem 0 4rem;
  }
  .ps-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
  }
  .ps-cover {
    width: 6rem;
    height: 6rem;
  }
  .ps-actions {
    justify-content: center;
  }
}
</style>
