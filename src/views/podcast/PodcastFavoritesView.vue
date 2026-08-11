<script setup lang="ts">
import { getPodcastBookmarks, getPodcastShowBookmarks } from '@/api/podcast'
import { computed, onMounted, ref, watch } from 'vue'
import type { Channel, PodcastEpisode } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PButton from '@/components/ui/PButton.vue'

import { getActivePinia } from 'pinia'

type TabKey = 'episodes' | 'shows' | 'collections' | 'listenLater'
type EpisodeBookmark = { id: string; episode?: PodcastEpisode }
type ShowBookmark = { id: string; channel?: Channel }

const authStore = getActivePinia() ? useAuthStore() : null
const isAuth = computed(() => !authStore || authStore.isAuthenticated || Boolean(authStore.token))
const player = usePlayerStore()

const activeTab = ref<TabKey>('episodes')
const episodeBookmarks = ref<EpisodeBookmark[]>([])
const showBookmarks = ref<ShowBookmark[]>([])
const listenLaterRows = ref<EpisodeBookmark[]>([])
const loading = ref(false)
let latestLoadRequest = 0

const tabOptions = [
  { label: '单集', value: 'episodes' },
  { label: '节目', value: 'shows' },
  { label: '合集', value: 'collections' },
  { label: '稍后听', value: 'listenLater' },
]

const listenLaterEpisodes = computed(() =>
  listenLaterRows.value.map(row => row.episode).filter((ep): ep is PodcastEpisode => Boolean(ep))
)

function playEpisode(ep: PodcastEpisode, queue: PodcastEpisode[]) {
  player.setQueueFromPodcastEpisodes(queue)
  player.playQueuedSong(player.createPodcastEpisodeSong(ep))
}

async function loadActiveTab() {
  if (!isAuth.value) return
  const tab = activeTab.value
  const request = ++latestLoadRequest
  loading.value = true
  try {
    if (tab === 'episodes') {
      const data = await getPodcastBookmarks<{ data?: EpisodeBookmark[] }>('favorite', authStore?.token ?? undefined)
      if (request === latestLoadRequest && activeTab.value === tab) {
        episodeBookmarks.value = Array.isArray(data?.data) ? data.data : []
      }
    } else if (tab === 'shows') {
      const data = await getPodcastShowBookmarks<{ data?: ShowBookmark[] }>(authStore?.token ?? undefined)
      if (request === latestLoadRequest && activeTab.value === tab) {
        showBookmarks.value = Array.isArray(data?.data) ? data.data : []
      }
    } else if (tab === 'listenLater') {
      const data = await getPodcastBookmarks<{ data?: EpisodeBookmark[] }>('listen_later', authStore?.token ?? undefined)
      if (request === latestLoadRequest && activeTab.value === tab) {
        listenLaterRows.value = Array.isArray(data?.data) ? data.data : []
      }
    }
  } catch {
    // 加载失败时保留当前内容，避免异步监听器产生未处理拒绝。
  } finally {
    if (request === latestLoadRequest && activeTab.value === tab) {
      loading.value = false
    }
  }
}

onMounted(loadActiveTab)
watch(activeTab, loadActiveTab)
</script>

<template>
  <div class="a-page-md pf-page">
    <PPageHeader title="播客收藏" mb="1.25rem" />

    <div v-if="!isAuth" class="pf-unauth">
      <PEmpty
        title="请登录后查看播客收藏"
        description="登录账号以同步你收藏的单集、播客节目与稍后听列表。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <div class="pf-bar" style="margin-bottom: 1.5rem">
        <PSegmentedControl v-model="activeTab" :options="tabOptions" />
      </div>
      <div v-if="loading" class="pf-state">加载中...</div>

      <div v-else-if="activeTab === 'episodes'" class="pf-list">
        <PEmpty v-if="episodeBookmarks.length === 0" title="暂无收藏单集" description="收听播客时收藏喜爱的单集。" />
        <article v-for="bookmark in episodeBookmarks" :key="bookmark.id" class="pf-row">
          <RouterLink v-if="bookmark.episode" :to="`/podcasts/episode/${bookmark.episode.id}`" class="pf-title">
            {{ bookmark.episode.post?.title || '未命名单集' }}
          </RouterLink>
          <PButton v-if="bookmark.episode" size="sm" @click="playEpisode(bookmark.episode, episodeBookmarks.map(item => item.episode).filter(Boolean) as PodcastEpisode[])">播放</PButton>
        </article>
      </div>

      <div v-else-if="activeTab === 'shows'" class="pf-list">
        <PEmpty v-if="showBookmarks.length === 0" title="暂无收藏节目" description="发现页面收藏你喜爱的播客节目。" />
        <RouterLink
          v-for="bookmark in showBookmarks"
          :key="bookmark.id"
          :to="`/podcasts/show/${bookmark.channel?.slug}`"
          class="pf-row pf-title"
        >
          {{ bookmark.channel?.name || '节目' }}
        </RouterLink>
      </div>

      <PEmpty v-else-if="activeTab === 'collections'" title="暂无收藏合集" description="作者整理合集后将呈现在这里。" />

      <div v-else class="pf-list">
        <PEmpty v-if="listenLaterRows.length === 0" title="暂无稍后听" description="添加单集至稍后听列表，随时复听。" />
        <article v-for="row in listenLaterRows" :key="row.id" class="pf-row">
          <RouterLink v-if="row.episode" :to="`/podcasts/episode/${row.episode.id}`" class="pf-title">
            {{ row.episode.post?.title || '未命名单集' }}
          </RouterLink>
          <PButton v-if="row.episode" size="sm" @click="playEpisode(row.episode, listenLaterEpisodes)">播放</PButton>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pf-page { padding-bottom: 3rem; }
.pf-unauth { padding: 3rem 0; }
.pf-state { color: var(--a-color-muted); font-size: 0.875rem; text-align: center; padding: 2rem 0; }
.pf-list { display: grid; gap: 0.6rem; }
.pf-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-card); background: var(--a-color-bg); padding: 0.85rem 1rem; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.pf-row:hover { border-color: var(--a-color-border); box-shadow: var(--a-shadow-sm); background: var(--a-color-surface-muted); }
.pf-title { min-width: 0; color: var(--a-color-fg); font-weight: 600; text-decoration: none; font-size: 0.925rem; }
.pf-title:hover { text-decoration: underline; }
</style>
