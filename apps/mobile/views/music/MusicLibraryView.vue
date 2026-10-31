<template>
  <div class="mobile-music-library">
    <!-- Header -->
    <header class="mobile-music-library__header">
      <h1 class="mobile-music-library__title">曲库</h1>
    </header>

    <!-- Search Input -->
    <div class="mobile-music-library__search">
      <MInput
        v-model="searchQuery"
        placeholder="搜索歌曲或专辑..."
        clearable
      />
    </div>

    <!-- Track List -->
    <section class="mobile-music-library__section" aria-label="歌曲列表">
      <div v-if="loading" class="mobile-music-library__empty" role="status">正在加载歌曲…</div>
      <div v-else-if="loadError" class="mobile-music-library__empty" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" class="mobile-music-library__retry" @click="loadTracks">重新加载</button>
      </div>
      <div v-else-if="filteredTracks.length > 0" class="mobile-music-library__tracks">
        <div
          v-for="(track, index) in filteredTracks"
          :key="track.id || index"
          class="mobile-music-library__track-row"
          :class="{ 'is-active': isCurrentSong(track) }"
        >
          <!-- Left: Clickable Track Area -->
          <button
            type="button"
            class="mobile-music-library__track-item"
            data-testid="library-track-item"
            :disabled="!canPlayMusicSong(track)"
            :aria-label="canPlayMusicSong(track) ? '播放' + track.title : track.title + '，暂无可播放音源'"
            @click="playTrack(track)"
          >
            <div class="mobile-music-library__track-index-col">
              <MIcon
                v-if="isCurrentSong(track) && player.isPlaying"
                name="waveform"
                size="xs"
                class="mobile-music-library__playing-icon"
              />
              <MIcon
                v-else-if="isCurrentSong(track)"
                name="player-play"
                size="xs"
                class="mobile-music-library__playing-icon"
              />
              <span v-else class="mobile-music-library__track-index">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
            </div>

            <div class="mobile-music-library__track-cover">
              <img
                v-if="track.cover_url"
                :src="track.cover_url"
                :alt="track.title"
                class="mobile-music-library__track-img"
              />
              <div v-else class="mobile-music-library__track-art">
                <MIcon name="note" size="sm" />
              </div>
            </div>

            <div class="mobile-music-library__track-meta">
              <span class="mobile-music-library__track-title">{{ track.title }}</span>
              <span class="mobile-music-library__track-sub">
                {{ track.artist || '未知艺术家' }} · {{ track.album || '未归类专辑' }}
              </span>
            </div>

            <span v-if="!canPlayMusicSong(track)" class="mobile-music-no-audio">暂无音源</span>
          </button>

          <!-- Right: Independent Favorite & Spotify-style More (...) Actions -->
          <div class="mobile-music-library__track-actions">
            <button
              type="button"
              class="mobile-music-library__action-btn"
              :class="{ 'is-favorited': isSongFavorited(track) }"
              data-testid="song-favorite-btn"
              :aria-label="isSongFavorited(track) ? '取消收藏' : '收藏歌曲'"
              @click="handleToggleFavorite(track, $event)"
            >
              <MIcon
                :name="isSongFavorited(track) ? 'check-circle-filled' : 'plus-circle'"
                :class="{ 'text-[#1ed760]': isSongFavorited(track) }"
                size="xs"
              />
            </button>

            <button
              type="button"
              class="mobile-music-library__action-btn"
              data-testid="song-more-btn"
              aria-label="更多操作"
              @click="openSongMenu(track, $event)"
            >
              <MIcon name="dots" size="xs" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="mobile-music-library__empty">
        <MIcon name="note" size="lg" class="mobile-music-library__empty-icon" />
        <p class="mobile-music-library__empty-text">
          {{ searchQuery ? '未找到相关歌曲' : '曲库暂无歌曲' }}
        </p>
      </div>
    </section>

    <!-- Spotify-style Bottom Action Sheet Drawer -->
    <Transition name="fade">
      <div
        v-if="activeMenuSong"
        class="mobile-action-sheet__backdrop"
        @click="closeSongMenu"
      />
    </Transition>

    <Transition name="slide-up">
      <div
        v-if="activeMenuSong"
        class="mobile-action-sheet"
        data-testid="song-action-sheet"
      >
        <div class="mobile-action-sheet__handle" />

        <!-- Header -->
        <div class="mobile-action-sheet__header">
          <div class="mobile-action-sheet__cover-wrap">
            <img
              v-if="activeMenuSong.cover_url"
              :src="activeMenuSong.cover_url"
              :alt="activeMenuSong.title"
              class="mobile-action-sheet__cover-img"
            />
            <div v-else class="mobile-action-sheet__cover-art">
              <MIcon name="note" size="sm" />
            </div>
          </div>
          <div class="mobile-action-sheet__header-info">
            <span class="mobile-action-sheet__header-title">{{ activeMenuSong.title }}</span>
            <span class="mobile-action-sheet__header-sub">
              {{ activeMenuSong.artist || '未知艺术家' }} · {{ activeMenuSong.album || '单曲' }}
            </span>
          </div>
        </div>

        <!-- Action Items -->
        <div class="mobile-action-sheet__actions">
          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleShareSong(activeMenuSong)"
          >
            <MIcon name="share" size="sm" />
            <span>分享</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleToggleFavoriteFromMenu(activeMenuSong)"
          >
            <MIcon
              :name="isSongFavorited(activeMenuSong) ? 'check-circle-filled' : 'plus-circle'"
              size="sm"
              :class="{ 'text-[#1ed760]': isSongFavorited(activeMenuSong) }"
            />
            <span>{{ isSongFavorited(activeMenuSong) ? '已添加至喜欢的音乐' : '添加至喜欢的音乐' }}</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleAddToPlaylist(activeMenuSong)"
          >
            <MIcon name="plus" size="sm" />
            <span>加入歌单</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleAddToQueue(activeMenuSong, false)"
          >
            <MIcon name="queue" size="sm" />
            <span>添加到播放队列</span>
          </button>

          <button
            type="button"
            class="mobile-action-sheet__item"
            @click="handleAddToQueue(activeMenuSong, true)"
          >
            <MIcon name="player-play" size="sm" />
            <span>下一首播放</span>
          </button>

          <button
            v-if="activeMenuSong.artist"
            type="button"
            class="mobile-action-sheet__item"
            @click="handleGoToArtist(activeMenuSong)"
          >
            <MIcon name="person" size="sm" />
            <span>转至艺人</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Floating Toast -->
    <Transition name="toast-fade">
      <div v-if="toastMessage" class="mobile-floating-toast" role="status">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listMusicSongs } from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import type { Song } from '@/types'
import { musicAudioFromApi, musicPlaybackDetailsFromApi, canPlayMusicSong } from '@mobile/mobileMusicPlayback'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'

const router = useRouter()
const player = useAudioPlayerStore()
const { favoriteSongIds, loadFavoriteSongs, toggleFavoriteSong } = useMusicFavoritePlaylist()

const searchQuery = ref('')
const tracks = ref<Song[]>([])
const loading = ref(true)
const loadError = ref('')
const activeMenuSong = ref<Song | null>(null)
const toastMessage = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMessage.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
    toastTimer = null
  }, 2200)
}

function isCurrentSong(track: Song): boolean {
  return String(player.currentSong?.id) === String(track.id)
}

function isSongFavorited(track: Song): boolean {
  return favoriteSongIds.value.has(String(track.id))
}

async function handleToggleFavorite(song: Song, e?: Event) {
  e?.stopPropagation()
  const songId = String(song.id)
  try {
    const res = await toggleFavoriteSong(songId)
    showToast(res.isFavorite ? '已添加至喜欢的音乐' : '已从喜欢的音乐中移除')
  } catch {
    showToast('操作失败，请重试')
  }
}

function openSongMenu(song: Song, e?: Event) {
  e?.stopPropagation()
  activeMenuSong.value = song
}

function closeSongMenu() {
  activeMenuSong.value = null
}

async function handleToggleFavoriteFromMenu(song: Song) {
  closeSongMenu()
  await handleToggleFavorite(song)
}

function handleAddToPlaylist(song: Song) {
  closeSongMenu()
  showToast('已加入稍后收听')
}

function handleAddToQueue(song: Song, playNext: boolean) {
  closeSongMenu()
  player.addToQueue(song, playNext)
  showToast(playNext ? '将在下一首播放' : '已添加到播放队列')
}

async function handleShareSong(song: Song) {
  closeSongMenu()
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/music/song/${song.id}` : ''
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast('歌曲链接已复制到剪贴板')
      return
    } catch {
      // ignore
    }
  }
  showToast('歌曲链接已生成')
}

function handleGoToArtist(song: Song) {
  closeSongMenu()
  const artistName = song.artist || ''
  if (artistName) {
    void router.push({ path: '/music/search', query: { q: artistName } })
  }
}

function toPlayerSong(item: any): Song {
  return {
    id: item.id,
    title: item.title,
    artist: typeof item.artist === 'string'
      ? item.artist
      : item.artists?.map((a: any) => a.name).join(' / ') || '未知艺术家',
    album: typeof item.album === 'string'
      ? item.album
      : item.album?.title || '',
    duration: typeof item.duration === 'number' && item.duration > 0
      ? item.duration
      : (item.duration_sec ?? item.duration_seconds ?? item.durationSeconds ?? 0),
    ...musicAudioFromApi(item),
    ...musicPlaybackDetailsFromApi(item),
    cover_url: item.cover_url || item.album?.cover_url || '',
  }
}

const filteredTracks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return tracks.value
  return tracks.value.filter((track) => {
    const titleMatch = track.title?.toLowerCase().includes(query)
    const artistMatch = track.artist?.toLowerCase().includes(query)
    const albumMatch = track.album?.toLowerCase().includes(query)
    return Boolean(titleMatch || artistMatch || albumMatch)
  })
})

async function loadTracks() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listMusicSongs({ page: 1, page_size: 50 })
    if (!Array.isArray(res?.data)) throw new Error('Invalid songs response')
    tracks.value = res.data.map(toPlayerSong)
    if (tracks.value.length > 0) {
      void loadFavoriteSongs(tracks.value.map((t) => String(t.id)))
    }
  } catch {
    tracks.value = []
    loadError.value = '歌曲加载失败，请检查网络后重试。'
  } finally {
    loading.value = false
  }
}

function playTrack(track: Song) {
  if (!canPlayMusicSong(track)) return
  player.playSong(track)
}

onMounted(() => {
  void loadTracks()
})
</script>

<style scoped>
.mobile-music-library {
  padding: 1rem 1rem calc(56px + env(safe-area-inset-bottom, 16px) + 2rem);
  padding-bottom: var(--mobile-music-page-bottom, calc(56px + env(safe-area-inset-bottom, 16px) + 2rem));
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
}

.mobile-music-library__header {
  margin-bottom: 0.75rem;
}

.mobile-music-library__title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  margin: 0;
}

.mobile-music-library__search {
  margin-bottom: 1rem;
}

.mobile-music-library__section {
  display: flex;
  flex-direction: column;
}

/* Borderless Track Rows */
.mobile-music-library__tracks {
  display: flex;
  flex-direction: column;
  border: none !important;
  background: transparent !important;
}

.mobile-music-library__track-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: none !important;
  border-bottom: none !important;
  transition: background-color 0.15s ease;
  border-radius: 4px;
}

.mobile-music-library__track-row:active {
  background-color: var(--a-color-surface-hover, #fafafa);
}

.mobile-music-library__track-row.is-active {
  background-color: #f7faf8;
}

.mobile-music-library__track-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  min-height: 48px !important;
  border: none !important;
  border-bottom: none !important;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.mobile-music-library__track-index-col {
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mobile-music-library__track-index {
  font-size: 13px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.mobile-music-library__playing-icon {
  color: #1ed760;
}

.mobile-music-library__track-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #f1f5f9;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-music-library__track-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-music-library__track-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
}

.mobile-music-library__track-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-music-library__track-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--a-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-library__track-row.is-active .mobile-music-library__track-title {
  color: #1ed760;
  font-weight: 600;
}

.mobile-music-library__track-sub {
  font-size: 12px;
  color: var(--a-color-text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-music-no-audio {
  font-size: 11px;
  color: #ef4444;
  flex-shrink: 0;
}

/* Track Actions: + and ... */
.mobile-music-library__track-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
}

.mobile-music-library__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px !important;
  height: 32px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  aspect-ratio: 1 / 1;
  border: none;
  background: transparent;
  color: var(--a-color-text-muted, #999999);
  cursor: pointer;
  border-radius: 50% !important;
  padding: 0;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.mobile-music-library__action-btn:active {
  background-color: var(--a-color-surface-hover, #f0f0f0);
}

.mobile-music-library__action-btn.is-favorited {
  color: #1ed760;
}

/* Empty State */
.mobile-music-library__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: var(--a-color-muted, #94a3b8);
  border: none;
  margin-top: 0.5rem;
}

.mobile-music-library__empty-icon {
  margin-bottom: 0.5rem;
  opacity: 0.6;
}

.mobile-music-library__empty-text {
  font-size: 0.875rem;
  margin: 0;
}

.mobile-music-library__retry {
  margin-top: 0.75rem;
  padding: 6px 14px;
  font-size: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}

/* ActionSheet (Spotify Style) */
.mobile-action-sheet__backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 150;
}

.mobile-action-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 160;
  background-color: #ffffff;
  border-top-left-radius: 14px;
  border-top-right-radius: 14px;
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 16px)) 16px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

.mobile-action-sheet__handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background-color: #dddddd;
  align-self: center;
  margin-bottom: 12px;
}

.mobile-action-sheet__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 6px;
}

.mobile-action-sheet__cover-wrap {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  overflow: hidden;
  background: #f4f4f5;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-action-sheet__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mobile-action-sheet__cover-art {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--a-color-text-muted, #999999);
}

.mobile-action-sheet__header-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mobile-action-sheet__header-title {
  font-size: 14px;
  font-weight: 600;
  color: #111111;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-action-sheet__header-sub {
  font-size: 12px;
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-action-sheet__actions {
  display: flex;
  flex-direction: column;
}

.mobile-action-sheet__item {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 46px;
  border: none;
  background: transparent;
  color: #111111;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  padding: 0 4px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.mobile-action-sheet__item:active {
  background-color: #f5f5f5;
}

/* Floating Toast */
.mobile-floating-toast {
  position: fixed;
  bottom: calc(56px + env(safe-area-inset-bottom, 16px) + 56px);
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(17, 17, 17, 0.9);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  z-index: 200;
  pointer-events: none;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active,
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to,
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
