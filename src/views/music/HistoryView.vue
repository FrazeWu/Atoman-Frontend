<script setup lang="ts">
import { reportError } from '@/utils/logger'
import { computed, ref, watch } from 'vue'
import { Clock3, Heart, ListPlus, MoreHorizontal, Play, StepForward, Trash2 } from 'lucide-vue-next'
import {
  addMusicSongToLater,
  clearMusicListeningHistory,
  listMusicListeningHistory,
  type MusicListeningHistory,
} from '@/api/musicV1'
import PButton from '@/components/ui/PButton.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PToast from '@/components/ui/PToast.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PaginationBar from '@/components/ui/PaginationBar.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import type { Song } from '@/types'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import { useRequestGeneration } from '@/composables/useRequestGeneration'

const pageSize = 20
const player = usePlayerStore()
const authStore = useAuthStore()
const { openAlbum, openArtist } = useMusicDrawers()
const { favoriteSongIds, loadFavoriteSongs, toggleFavoriteSong } = useMusicFavoritePlaylist()
const historyRequests = useRequestGeneration()
const historyItems = ref<MusicListeningHistory[]>([])
const currentPage = ref(0)
const historyMeta = ref({ page: 1, page_size: pageSize, total: 0, has_more: false })
const loading = ref(false)
const loadingMore = ref(false)
const errorMessage = ref('')
const actionBusy = ref('')
const toastVisible = ref(false)
const toastMessage = ref('')
const clearPending = ref(false)

const playableSongs = computed<Song[]>(() => historyItems.value
  .filter((item) => Boolean(item.song.audio_url))
  .map((item) => ({
    id: item.song.id,
    title: item.song.title,
    artist: item.song.artists?.map((artist) => artist.name).join(' / ') || '未知艺术家',
    album: item.song.album?.title || '',
    album_id: item.song.album?.id || '',
    year: 0,
    release_date: '',
    lyrics: item.song.lyrics || '',
    audio_url: item.song.audio_url || '',
    waveform_peaks: item.song.waveform_peaks,
    cover_url: item.song.cover_url || item.song.album?.cover_url || '',
    track_number: item.song.track_number,
    status: (item.song.status as Song['status']) || 'open',
    artists: item.song.artists?.map((artist) => ({
      id: artist.id,
      name: artist.name,
      username: '',
      email: '',
    })),
  })))

async function loadPage(page: number) {
  if (!authStore.isAuthenticated) return
  if (loading.value || loadingMore.value) return
  const isFirst = page === 1
  const { isCurrent } = historyRequests.beginRequest()
  if (isFirst) {
    loading.value = true
  } else {
    loadingMore.value = true
  }
  errorMessage.value = ''
  try {
    const response = await listMusicListeningHistory({ page, page_size: pageSize })
    if (!isCurrent()) return
    await loadFavoriteSongs(response.data.map((item) => String(item.song.id)))
    if (!isCurrent()) return
    historyItems.value = response.data
    currentPage.value = page
    historyMeta.value = response.meta
  } catch (error) {
    if (!isCurrent()) return
    reportError(error, 'Failed to load music listening history:')
    errorMessage.value = '加载播放历史失败'
  } finally {
    if (isCurrent()) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

async function clearHistory() {
  if (actionBusy.value || !historyItems.value.length) return
  clearPending.value = true
}

async function confirmClearHistory() {
  if (actionBusy.value || !historyItems.value.length) return
  historyRequests.beginRequest()
  loading.value = false
  loadingMore.value = false
  actionBusy.value = 'clear'
  try {
    await clearMusicListeningHistory()
    historyItems.value = []
    historyMeta.value = { page: 1, page_size: pageSize, total: 0, has_more: false }
    currentPage.value = 0
    toastMessage.value = '播放历史已清空'
    toastVisible.value = true
  } catch (error) {
    reportError(error, 'Failed to clear music listening history:')
    toastMessage.value = '清空历史失败，请重试'
    toastVisible.value = true
  } finally {
    actionBusy.value = ''
    clearPending.value = false
  }
}

function playHistorySong(songId: string) {
  const targetIndex = playableSongs.value.findIndex((song) => song.id === songId)
  if (targetIndex < 0) return
  player.playAlbum(playableSongs.value, targetIndex)
}

function queueHistorySong(songId: string, next: boolean) {
  const target = playableSongs.value.find((song) => song.id === songId)
  if (!target) return
  player.addToQueue(target, next)
  toastMessage.value = next ? '已设为下一首播放' : '已加入播放队列'
  toastVisible.value = true
}

async function addHistoryToLater(songId: string) {
  if (actionBusy.value === `later:${songId}`) return
  actionBusy.value = `later:${songId}`
  try {
    await addMusicSongToLater(songId)
    toastMessage.value = '已添加至稍后播放'
    toastVisible.value = true
  } catch (error) {
    reportError(error, 'Failed to add song to later:')
    toastMessage.value = '添加至稍后播放失败'
    toastVisible.value = true
  } finally {
    actionBusy.value = ''
  }
}

function toggleHistoryFavorite(songId: string) {
  void toggleFavoriteSong(songId)
}

function formatPlayedAt(rawDate: string): string {
  if (!rawDate) return ''
  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

watch(
  () => authStore.isAuthenticated,
  (authenticated) => {
    historyRequests.beginRequest()
    historyItems.value = []
    historyMeta.value = { page: 1, page_size: pageSize, total: 0, has_more: false }
    loadingMore.value = false
    if (authenticated) void loadPage(1)
  },
  { immediate: true },
)
</script>

<template>
  <div class="music-history-view">
    <PPageHeader title="播放历史" mb="0" />

    <div v-if="!authStore.isAuthenticated" class="history-unauth">
      <PEmpty
        title="请登录后查看播放历史"
        description="登录账号以记录与跨端同步你的音乐播放历史。"
      >
        <template #action>
          <RouterLink to="/login" class="a-btn a-btn--primary">立即登录</RouterLink>
        </template>
      </PEmpty>
    </div>

    <template v-else>
      <ol class="history-list" aria-label="播放历史列表">
        <li
          v-for="item in historyItems"
          :key="item.id"
          class="history-row"
          data-testid="history-row"
        >
          <div class="history-song">
            <button
              type="button"
              class="history-cover"
              :data-testid="`history-play-${item.song.id}`"
              :disabled="!item.song.audio_url"
              :aria-label="`播放 ${item.song.title}`"
              @click="playHistorySong(String(item.song.id))"
            >
              <img
                v-if="item.song.cover_url || item.song.album?.cover_url"
                :src="item.song.cover_url || item.song.album?.cover_url"
                :alt="item.song.title"
              />
              <span v-else class="history-cover__empty" aria-hidden="true" />
              <span v-if="item.song.audio_url" class="history-play-icon" aria-hidden="true">
                <Play :size="15" fill="currentColor" />
              </span>
            </button>
            <span class="history-copy">
              <RouterLink :to="`/music/song/${item.song.id}`">{{ item.song.title }}</RouterLink>
              <span class="history-entity-links">
                <template v-if="item.song.artists?.length">
                  <template v-for="(artist, index) in item.song.artists" :key="artist.id">
                    <span v-if="index" aria-hidden="true"> / </span>
                    <button type="button" :data-testid="`history-artist-${artist.id}`" @click="openArtist(String(artist.id))">{{ artist.name }}</button>
                  </template>
                </template>
                <span v-else>未知艺术家</span>
              </span>
            </span>
          </div>

          <button v-if="item.song.album?.id" type="button" class="history-album" :data-testid="`history-album-${item.song.album.id}`" @click="openAlbum(String(item.song.album.id))">{{ item.song.album.title }}</button>
          <span v-else class="history-album">未知专辑</span>
          <span class="history-count">播放 {{ item.play_count }} 次</span>
          <time class="history-time" :datetime="item.last_played_at">
            {{ formatPlayedAt(item.last_played_at) }}
          </time>
          <div class="history-actions">
            <button type="button" :class="{ 'is-active': favoriteSongIds.has(String(item.song.id)) }" :aria-label="`${favoriteSongIds.has(String(item.song.id)) ? '移出最爱' : '加入最爱'} ${item.song.title}`" title="加入最爱" @click="toggleHistoryFavorite(String(item.song.id))"><Heart :size="16" :fill="favoriteSongIds.has(String(item.song.id)) ? 'currentColor' : 'none'" aria-hidden="true" /></button>
            <PDropdown position="right">
              <template #trigger><button type="button" :aria-label="`${item.song.title} 的更多操作`" title="更多操作"><MoreHorizontal :size="17" aria-hidden="true" /></button></template>
              <div class="history-action-menu">
                <button type="button" :disabled="!item.song.audio_url" @click="queueHistorySong(String(item.song.id), true)"><StepForward :size="16" aria-hidden="true" />下一首播放</button>
                <button type="button" :disabled="!item.song.audio_url" @click="queueHistorySong(String(item.song.id), false)"><ListPlus :size="16" aria-hidden="true" />加入队列</button>
                <button type="button" :disabled="actionBusy === `later:${item.song.id}`" @click="addHistoryToLater(String(item.song.id))"><Clock3 :size="16" aria-hidden="true" />稍后播放</button>
              </div>
            </PDropdown>
          </div>
        </li>
      </ol>

      <p v-if="errorMessage" class="history-state history-state--error">{{ errorMessage }}</p>
      <PaginationBar
        :meta="historyMeta"
        :loading="loading || loadingMore"
        @change="loadPage"
      />
    </template>
    <PToast v-model="toastVisible" :message="toastMessage" type="success" />
  </div>
  <PConfirm
    :show="clearPending"
    title="清空播放历史"
    message="确定要清空播放历史吗？"
    confirm-text="清空"
    danger
    :loading="actionBusy === 'clear'"
    @confirm="confirmClearHistory"
    @cancel="clearPending = false"
  />
</template>

<style scoped>
.music-history-view {
  display: grid;
  gap: 1.5rem;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--a-color-border-soft);
}

.history-row {
  display: grid;
  grid-template-columns: minmax(15rem, 1.8fr) minmax(10rem, 1fr) 7rem 10rem 4.5rem;
  gap: 1rem;
  align-items: center;
  min-height: 72px;
  margin-inline: -0.65rem;
  padding: 0.65rem;
  border: 1px solid transparent;
  border-bottom-color: var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.history-row:hover,
.history-row:focus-within {
  background: var(--a-color-surface-muted);
  border-color: var(--a-color-border-soft);
  box-shadow: inset 4px 0 0 var(--a-color-text), var(--a-shadow-sm);
}

.history-song {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  color: inherit;
  text-align: left;
}

.history-cover {
  position: relative;
  width: 48px;
  height: 48px;
  flex: 0 0 48px;
  overflow: hidden;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  padding: 0;
  color: inherit;
  cursor: pointer;
}
.history-cover:disabled { cursor: default; }

.history-cover img,
.history-cover__empty {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.history-play-icon {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--a-color-text) 56%, transparent);
  color: var(--a-color-bg);
  opacity: 0;
  transition: opacity 0.16s ease;
}

.history-song:hover .history-play-icon,
.history-song:focus-visible .history-play-icon {
  opacity: 1;
}

.history-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.history-copy > a,
.history-copy span,
.history-album {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-copy > a {
  color: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
}

.history-copy span,
.history-album {
  color: var(--a-color-muted);
  font-size: 0.8rem;
}
.history-entity-links button,
.history-album {
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.history-copy > a:hover,
.history-entity-links button:hover,
.history-album:hover { text-decoration: underline; }

.history-count,
.history-time {
  color: var(--a-color-muted);
  font-size: 11px;
  font-family: monospace;
  white-space: nowrap;
}

.history-time {
  text-align: right;
}

.history-more {
  display: flex;
  justify-content: center;
}
.history-toolbar { display: flex; justify-content: flex-end; }
.history-actions { display: flex; justify-content: flex-end; gap: 0.25rem; }
.history-actions > button,
.history-actions :deep(.p-dropdown-root > div:first-child > button) { width: 32px; height: 32px; display: inline-grid; place-items: center; border: 0; background: transparent; color: inherit; cursor: pointer; }
.history-actions button.is-active { color: var(--a-color-accent); }
.history-action-menu { min-width: 11rem; padding: 0.3rem; }
.history-action-menu button { width: 100%; display: flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.7rem; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.history-action-menu button:hover { background: var(--a-color-surface-muted); }

.history-state {
  margin: 0;
  color: var(--a-color-muted);
}

.history-state--error {
  color: var(--a-color-accent-destructive);
}

.history-empty {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 4rem 1rem;
  border-top: 1px solid var(--a-color-border-soft);
  color: var(--a-color-muted);
}

.history-empty h2 {
  margin: 0;
  font-size: 1rem;
}

@media (max-width: 900px) {
  .history-row {
    grid-template-columns: minmax(12rem, 1fr) auto;
  }

  .history-album {
    display: none;
  }

  .history-count {
    text-align: right;
  }

  .history-time {
    grid-column: 2;
    font-size: 0.72rem;
  }
}

@media (max-width: 600px) {
  .music-history-view {
    padding-bottom: calc(6rem + env(safe-area-inset-bottom));
  }

  .history-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem 0.75rem;
  }

  .history-count {
    align-self: start;
  }

  .history-time {
    grid-column: 1 / -1;
    text-align: left;
    padding-left: calc(48px + 0.85rem);
  }
}
</style>
