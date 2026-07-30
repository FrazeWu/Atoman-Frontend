<script setup lang="ts">
import { apiRequest } from '@/api/client'
import { computed, onMounted, ref, watch } from 'vue'
import type { Channel, PodcastEpisode } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'

type TabKey = 'episodes' | 'shows' | 'collections' | 'listenLater'
type EpisodeBookmark = { id: string; episode?: PodcastEpisode }
type ShowBookmark = { id: string; channel?: Channel }

const api = useApi()
const authStore = useAuthStore()
const player = usePlayerStore()

const activeTab = ref<TabKey>('episodes')
const episodeBookmarks = ref<EpisodeBookmark[]>([])
const showBookmarks = ref<ShowBookmark[]>([])
const listenLaterRows = ref<EpisodeBookmark[]>([])
const loading = ref(false)
let latestLoadRequest = 0

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'episodes', label: '单集' },
  { key: 'shows', label: '节目' },
  { key: 'collections', label: '合集' },
  { key: 'listenLater', label: '稍后听' },
]

const listenLaterEpisodes = computed(() =>
  listenLaterRows.value.map(row => row.episode).filter((ep): ep is PodcastEpisode => Boolean(ep))
)

function headers() {
  return { Authorization: `Bearer ${authStore.token}` }
}

function playEpisode(ep: PodcastEpisode, queue: PodcastEpisode[]) {
  player.setQueueFromPodcastEpisodes(queue)
  player.playQueuedSong(player.createPodcastEpisodeSong(ep))
}

async function loadActiveTab() {
  const tab = activeTab.value
  const request = ++latestLoadRequest
  loading.value = true
  try {
    if (tab === 'episodes') {
      const res = await apiRequest(`${api.podcast.bookmarks}?kind=favorite`, { headers: headers() })
      if (!res.ok) throw new Error('Failed to load episode bookmarks')
      const data = await res.json()
      if (request === latestLoadRequest && activeTab.value === tab) {
        episodeBookmarks.value = Array.isArray(data?.data) ? data.data : []
      }
    } else if (tab === 'shows') {
      const res = await apiRequest(api.podcast.showBookmarks, { headers: headers() })
      if (!res.ok) throw new Error('Failed to load show bookmarks')
      const data = await res.json()
      if (request === latestLoadRequest && activeTab.value === tab) {
        showBookmarks.value = Array.isArray(data?.data) ? data.data : []
      }
    } else if (tab === 'listenLater') {
      const res = await apiRequest(`${api.podcast.bookmarks}?kind=listen_later`, { headers: headers() })
      if (!res.ok) throw new Error('Failed to load listen later bookmarks')
      const data = await res.json()
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
  <div class="a-page-md">
    <PPageHeader title="收藏" accent />

    <div class="pf-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="pf-state">加载中...</div>

    <div v-else-if="activeTab === 'episodes'" class="pf-list">
      <PEmpty v-if="episodeBookmarks.length === 0" title="暂无收藏单集" />
      <article v-for="bookmark in episodeBookmarks" :key="bookmark.id" class="pf-row">
        <RouterLink v-if="bookmark.episode" :to="`/podcasts/episode/${bookmark.episode.id}`" class="pf-title">
          {{ bookmark.episode.post?.title || '未命名单集' }}
        </RouterLink>
        <button v-if="bookmark.episode" type="button" @click="playEpisode(bookmark.episode, episodeBookmarks.map(item => item.episode).filter(Boolean) as PodcastEpisode[])">播放</button>
      </article>
    </div>

    <div v-else-if="activeTab === 'shows'" class="pf-list">
      <PEmpty v-if="showBookmarks.length === 0" title="暂无收藏节目" />
      <RouterLink
        v-for="bookmark in showBookmarks"
        :key="bookmark.id"
        :to="`/podcasts/show/${bookmark.channel?.slug}`"
        class="pf-row pf-title"
      >
        {{ bookmark.channel?.name || '节目' }}
      </RouterLink>
    </div>

    <PEmpty v-else-if="activeTab === 'collections'" title="暂无收藏合集" />

    <div v-else class="pf-list">
      <PEmpty v-if="listenLaterRows.length === 0" title="暂无稍后听" />
      <article v-for="row in listenLaterRows" :key="row.id" class="pf-row">
        <RouterLink v-if="row.episode" :to="`/podcasts/episode/${row.episode.id}`" class="pf-title">
          {{ row.episode.post?.title || '未命名单集' }}
        </RouterLink>
        <button v-if="row.episode" type="button" @click="playEpisode(row.episode, listenLaterEpisodes)">播放</button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.pf-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
.pf-tabs button,
.pf-row button { border: 1px solid #111827; border-radius: 6px; background: #fff; padding: 0.35rem 0.65rem; font-size: 0.8125rem; cursor: pointer; }
.pf-tabs button.active { color: #fff; background: #111827; }
.pf-state { color: #6b7280; font-size: 0.875rem; }
.pf-list { display: grid; gap: 0.75rem; }
.pf-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #e5e7eb; padding: 0.875rem 0; }
.pf-title { min-width: 0; color: #111827; font-weight: 500; text-decoration: none; }
.pf-title:hover { text-decoration: underline; }
</style>
