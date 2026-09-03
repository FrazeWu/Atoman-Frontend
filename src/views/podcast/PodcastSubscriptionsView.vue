<script setup lang="ts">
import { computed, ref } from 'vue'

import { addPodcastEpisodeBookmark } from '@/api/podcast'
import ModuleSubscriptionSourcesPicker from '@/components/feed/ModuleSubscriptionSourcesPicker.vue'
import PButton from '@/components/ui/PButton.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import { useModuleSubscriptionTimeline } from '@/composables/feed/useModuleSubscriptionTimeline'
import { listPodcastProgress } from '@/composables/usePodcastProgress'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import type { PodcastEpisode } from '@/types'

const authStore = useAuthStore()
const player = usePlayerStore()
const timeline = useModuleSubscriptionTimeline('podcast')
const episodes = computed(() => timeline.items.value
  .filter((item) => item.type === 'podcast_episode' && item.podcast_episode)
  .map((item) => item.podcast_episode as PodcastEpisode))
const progressByEpisode = new Map(listPodcastProgress().map((row) => [row.episode_id, row]))
const message = ref('')

function fmtDuration(sec: number) {
  if (!sec) return ''
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function progressText(episode: PodcastEpisode) {
  const progress = progressByEpisode.get(episode.id)
  if (!progress) return '未听'
  if (progress.completed) return '已听完'
  return `听到 ${fmtDuration(progress.position_sec)}`
}

function playEpisode(episode: PodcastEpisode) {
  player.setQueueFromPodcastEpisodes(episodes.value)
  player.playQueuedSong(player.createPodcastEpisodeSong(episode))
}

async function listenLater(episode: PodcastEpisode) {
  try {
    await addPodcastEpisodeBookmark(episode.id, 'listen_later', authStore.token ?? undefined)
    message.value = '已加入稍后听'
  } catch {
    message.value = '操作失败'
  }
}
</script>

<template>
  <div class="a-page-md psub-page">
    <ModuleSubscriptionSourcesPicker subscription-type="podcast" subscription-path="/podcasts/subscriptions" />
    <PPageHeader title="播客订阅" mb="1.25rem" />

    <div v-if="!authStore.isAuthenticated" class="psub-unauth">
      <PEmpty title="请登录后查看播客订阅" description="登录账号以同步你订阅的播客节目和最新更新。">
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <p v-if="message" class="psub-message">{{ message }}</p>
      <div v-if="timeline.loading.value && !episodes.length" class="psub-state">加载中...</div>
      <PEmpty v-else-if="timeline.error.value && !episodes.length" title="订阅内容加载失败">
        <template #action>
          <PButton size="sm" @click="timeline.retry">重试</PButton>
        </template>
      </PEmpty>
      <PEmpty v-else-if="episodes.length === 0" title="暂无更新" description="订阅节目后新发布的单集将显示在这里。" />
      <div v-else class="psub-list">
        <article v-for="episode in episodes" :key="episode.id" class="psub-row">
          <div class="psub-main">
            <RouterLink :to="`/podcasts/episode/${episode.id}`" class="psub-title">
              {{ episode.post?.title || '未命名单集' }}
            </RouterLink>
            <div class="psub-meta">
              <span>{{ episode.channel?.name || '播客' }}</span>
              <span v-if="episode.duration_sec">{{ fmtDuration(episode.duration_sec) }}</span>
              <span>{{ progressText(episode) }}</span>
            </div>
          </div>
          <div class="psub-actions">
            <PButton size="sm" @click="playEpisode(episode)">播放</PButton>
            <PButton size="sm" outline @click="listenLater(episode)">稍后听</PButton>
          </div>
        </article>
      </div>
      <div v-if="timeline.hasMore.value && !timeline.loading.value" class="psub-more">
        <PButton outline @click="timeline.loadMore">加载更多</PButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
.psub-page { padding-bottom: 3rem; }
.psub-unauth { padding: 3rem 0; }
.psub-state,
.psub-message { color: var(--a-color-muted); font-size: 0.875rem; }
.psub-list { display: grid; gap: 0.6rem; }
.psub-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); padding: 0.85rem 1rem; transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.psub-row:hover { border-color: var(--a-color-border); box-shadow: var(--a-shadow-sm); background: var(--a-color-surface-muted); }
.psub-main { min-width: 0; }
.psub-title { color: var(--a-color-fg); font-weight: 600; text-decoration: none; font-size: 0.925rem; }
.psub-title:hover { text-decoration: underline; }
.psub-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.25rem; color: var(--a-color-muted); font-size: 0.775rem; }
.psub-actions { display: flex; flex: 0 0 auto; gap: 0.5rem; }
.psub-more { display: flex; justify-content: center; margin-top: 2rem; }

@media (max-width: 640px) {
  .psub-row { align-items: flex-start; flex-direction: column; }
  .psub-actions { width: 100%; }
}
</style>
