<template>
  <div
    v-if="player.currentSong"
    class="player"
    :class="{ 'is-auto-hidden': !effectivePinned && !playerHovered }"
    @mouseenter="revealPlayer"
    @mouseleave="scheduleAutoHide"
    @focusin="revealPlayer"
    @focusout="scheduleAutoHide"
  >
    <div v-if="!effectivePinned" class="player-reveal-handle" aria-hidden="true" />
    <div ref="playerInnerRef" class="player-inner" :class="{ 'player-inner--meta-collapsed': isMetaCollapsed }">
      <!-- Left: Identity -->
      <div
        ref="playerInfoRef"
        class="player-info"
        :class="{ 'player-info--collapsed': isMetaCollapsed }"
      >
        <div class="cover-wrap" @click="player.toggleLyrics">
          <img
            v-if="player.currentSong.cover_url"
            :src="player.currentSong.cover_url"
            class="player-cover"
          />
          <div v-else class="player-cover-fallback">{{ coverFallback }}</div>
          <div class="cover-overlay">↑</div>
        </div>
        <div
          ref="playerMetaRef"
          class="player-meta"
          :class="{ 'player-meta--collapsed': isMetaCollapsed }"
        >
          <div class="player-tooltip-wrap">
            <h3 class="player-title">{{ player.currentSong.title }}</h3>
            <div class="player-tooltip">{{ player.currentSong.title }}</div>
          </div>
          <div class="player-tooltip-wrap">
            <p class="player-artist">{{ artistText }}</p>
            <div class="player-tooltip player-tooltip--subtle">{{ artistText }}</div>
          </div>
        </div>
      </div>

      <!-- Center: Controls -->
      <div ref="playerControlsRef" class="player-controls-hub">
        <div class="ctrl-row">
          <span class="skip-btn" @click="player.skip(-5)">-5S</span>
          <span class="nav-btn" @click="player.playPrevious()">上一首</span>
          <button class="main-play-btn" @click="player.togglePlay()">
            {{ player.isPlaying ? '暂停' : '播放' }}
          </button>
          <span class="nav-btn" @click="player.playNext()">下一首</span>
          <span class="skip-btn" @click="player.skip(5)">+5S</span>
          
          <button
            v-if="player.currentSong && !isPodcast"
            type="button"
            class="player-fav-btn"
            :class="{ 'is-active': favoriteSongIds.has(String(player.currentSong.id)) }"
            title="添加到最爱"
            @click="toggleTrackFavorite(String(player.currentSong.id))"
          >
            <Heart :size="16" :fill="favoriteSongIds.has(String(player.currentSong.id)) ? 'currentColor' : 'none'" />
          </button>

          <PDropdown v-if="player.currentSong && !isPodcast" class="player-add-dropdown" position="right">
            <template #trigger>
              <button class="player-add-btn" type="button" title="添加到歌单">
                <Plus :size="16" />
              </button>
            </template>
            <div class="track-add-menu">
              <div class="track-add-menu-header">添加到歌单</div>
              <div v-if="!playlists.length" class="track-add-menu-empty">暂无歌单</div>
              <button
                v-for="p in playlists"
                :key="p.id"
                type="button"
                class="track-add-menu-item"
                @click="addTrackToPlaylist(String(p.id), String(player.currentSong.id))"
              >
                {{ p.name }}
              </button>
            </div>
          </PDropdown>

          <button
            v-if="isPodcastEpisode"
            type="button"
            class="player-fav-btn"
            title="收藏单集"
            @click="addPodcastBookmark"
          >
            <Heart :size="16" />
          </button>

          <button
            v-if="isPodcastEpisode"
            type="button"
            class="player-add-btn"
            title="稍后听"
            @click="addPodcastListenLater"
          >
            <Clock :size="16" />
          </button>
        </div>
        <div class="progress-container">
          <span class="time-stamp">{{ formatTime(player.currentTime) }}</span>
          <input
            type="range"
            min="0"
            :max="player.duration || 100"
            step="0.1"
            :value="player.currentTime"
            @input="handleProgressInput"
            class="progress-slider"
            aria-label="播放进度"
            :style="{
              '--progress-pct': progressPct + '%'
            }"
          />
          <span class="time-stamp">{{ formatTime(player.duration) }}</span>
        </div>
      </div>

      <!-- Right: Feature Strip -->
      <div class="player-features">
        <div class="feature-link" @click="player.toggleLyrics">{{ featureLabel }}</div>
        
        <div class="feature-toggle" @click="player.cyclePlaybackMode()">
          <div v-if="player.playbackMode === 'single'" class="repeat-one-wrapper">
            <Repeat :size="20" />
            <span class="one-badge">1</span>
          </div>
          <span v-else style="display:flex;align-items:center">
            <Repeat v-if="player.playbackMode === 'loop'" :size="20" />
            <Shuffle v-else-if="player.playbackMode === 'random'" :size="20" />
          </span>
        </div>

        <div class="volume-container">
          <div class="volume-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="player.volume"
              @input="(e) => player.setVolume(parseFloat((e.target as HTMLInputElement).value))"
              class="vol-slider"
            />
          </div>
          <div class="vol-trigger">
            <span class="vol-icon" style="display:flex;align-items:center" @click="player.setVolume(player.volume > 0 ? 0 : 0.5)">
              <Volume2 v-if="player.volume > 0.6" :size="20" />
              <Volume1 v-else-if="player.volume > 0.2" :size="20" />
              <Volume v-else-if="player.volume > 0" :size="20" />
              <VolumeX v-else :size="20" />
            </span>
          </div>
        </div>

        <button 
          class="queue-trigger" 
          :class="{ active: player.showQueue }"
          type="button" 
          @click="player.toggleQueue()"
        >
          <List :size="22" />
          <span class="queue-count">{{ player.queue.length || 0 }}</span>
        </button>
        <button
          class="player-pin-btn"
          type="button"
          :aria-label="player.isPinned ? '取消固定播放器' : '固定播放器'"
          :title="player.isPinned ? '取消固定播放器' : '固定播放器'"
          @click="togglePlayerPin"
        >
          <PinOff v-if="player.isPinned" :size="20" aria-hidden="true" />
          <Pin v-else :size="20" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>

  <Transition name="slide-up">
    <MusicLyricsPanel
      v-if="player.showLyrics && player.currentSong"
      :song-id="String(player.currentSong.id)"
      :song-title="player.currentSong.title"
      :artist-text="artistText"
      :current-time-seconds="player.currentTime"
      @close="player.toggleLyrics"
    />
  </Transition>

  <Transition name="slide-up">
    <div v-if="player.showQueue" class="queue-panel">
      <div class="queue-header">
         <h2 class="queue-title">播放队列 ({{ player.queue.length }})</h2>
         <span class="close-btn" @click="player.toggleQueue">关闭</span>
      </div>
      <div class="queue-content">
         <div v-if="player.queue.length" class="queue-list">
           <div 
             v-for="(song, idx) in player.queue" 
             :key="idx"
             class="queue-item"
             :class="{ active: player.currentSong?.id === song.id }"
             @click="player.playQueuedSong(song)"
           >
             <span class="q-idx">{{ (idx + 1).toString().padStart(2, '0') }}.</span>
             <span class="q-title">{{ song.title }}</span>
             <span class="q-artist">{{ song.artist }}</span>
           </div>
         </div>
         <p v-else class="placeholder-text">队列为空</p>
      </div>
    </div>
  </Transition>
  <PToast v-model="toastVisible" :message="toastMessage" type="success" />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { 
  Repeat, 
  Shuffle, 
  List, 
  Volume2, 
  Volume1, 
  Volume, 
  VolumeX,
  Heart,
  Plus,
  Clock,
  Pin,
  PinOff,
} from 'lucide-vue-next'
import MusicLyricsPanel from '@/components/music/MusicLyricsPanel.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PToast from '@/components/ui/PToast.vue'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import {
  listMusicPlaylists,
} from '@/api/musicV1'

const player = usePlayerStore()
const authStore = useAuthStore()
const api = useApi()
const playerInnerRef = ref<HTMLElement | null>(null)
const playerInfoRef = ref<HTMLElement | null>(null)
const playerMetaRef = ref<HTMLElement | null>(null)
const playerControlsRef = ref<HTMLElement | null>(null)
const isMetaCollapsed = ref(false)
const isMobileViewport = ref(false)
const playerHovered = ref(true)
const effectivePinned = computed(() => player.isPinned || isMobileViewport.value)

let resizeObserver: ResizeObserver | null = null
let viewportQuery: MediaQueryList | null = null
let hideTimer: number | null = null
const META_COLLAPSE_GAP = 12

const clearHideTimer = () => {
  if (hideTimer === null) return
  window.clearTimeout(hideTimer)
  hideTimer = null
}

const revealPlayer = () => {
  clearHideTimer()
  playerHovered.value = true
}

const scheduleAutoHide = () => {
  if (effectivePinned.value) return
  clearHideTimer()
  hideTimer = window.setTimeout(() => {
    playerHovered.value = false
    hideTimer = null
  }, 500)
}

const togglePlayerPin = () => {
  player.togglePinned()
  playerHovered.value = player.isPinned
  clearHideTimer()
}

const syncViewport = () => {
  isMobileViewport.value = viewportQuery?.matches ?? false
}

watch(effectivePinned, (pinned) => {
  document.documentElement.dataset.playerActive = 'true'
  document.documentElement.dataset.playerPinned = String(pinned)
}, { immediate: true })

const progressPct = computed(() => {
  if (!player.duration) return 0
  return (player.currentTime / player.duration) * 100
})

const artistText = computed(() => {
  if (!player.currentSong) return '未知艺术家'
  if (player.currentSong.artists?.length) {
    return player.currentSong.artists.map((artist) => artist.name).join(', ')
  }
  return player.currentSong.artist || '未知艺术家'
})

const coverFallback = computed(() => {
  const text = player.currentSong?.album || player.currentSong?.artist || player.currentSong?.title || 'P'
  const firstChar = text.trim().charAt(0)
  return firstChar || 'P'
})

const isPodcast = computed(() =>
  player.currentSong?.source_type === 'podcast_episode'
  || player.currentSong?.source_type === 'feed_podcast'
)

const isPodcastEpisode = computed(() => player.currentSong?.source_type === 'podcast_episode')
const featureLabel = computed(() => isPodcast.value ? '说明' : '词')

const updateMetaCollapse = () => {
  const playerInner = playerInnerRef.value
  if (!playerInner) return
  isMetaCollapsed.value = playerInner.getBoundingClientRect().width <= 760
}

const playlists = ref<any[]>([])
const playlistsLoaded = ref(false)
const toastVisible = ref(false)
const toastMessage = ref('')
const {
  favoriteSongIds,
  loadFavoriteSongs,
  toggleFavoriteSong,
  addSongToPlaylist,
} = useMusicFavoritePlaylist()

async function loadPlaylists() {
  try {
    const res = await listMusicPlaylists()
    playlists.value = res.data || []
    playlistsLoaded.value = true
  } catch (err) {
    if (err instanceof ApiErrorResponseError && err.status === 401) {
      playlists.value = []
      playlistsLoaded.value = true
      return
    }
    console.error('Failed to load playlists in AudioPlayer:', err)
  }
}

async function loadFavorites() {
  try {
    await loadFavoriteSongs()
  } catch (err) {
    console.error('Failed to load favorites in AudioPlayer:', err)
  }
}

async function toggleTrackFavorite(songId: string) {
  try {
    const result = await toggleFavoriteSong(songId)
    toastMessage.value = result.message
    toastVisible.value = true
    await loadPlaylists()
  } catch (err) {
    console.error('Failed to toggle favorite:', err)
    toastMessage.value = '操作失败'
    toastVisible.value = true
  }
}

async function addPodcastBookmark() {
  const episodeId = player.currentSong?.source_id
  if (!episodeId) return
  if (!authStore.token) {
    toastMessage.value = '请先登录'
    toastVisible.value = true
    return
  }
  try {
    const res = await fetch(api.podcast.bookmarks, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ episode_id: episodeId }),
    })
    if (!res.ok) throw new Error('bookmark failed')
    toastMessage.value = '已收藏'
    toastVisible.value = true
  } catch (err) {
    console.error('Failed to bookmark podcast episode:', err)
    toastMessage.value = '操作失败'
    toastVisible.value = true
  }
}

async function addPodcastListenLater() {
  const episodeId = player.currentSong?.source_id
  if (!episodeId) return
  if (!authStore.token) {
    toastMessage.value = '请先登录'
    toastVisible.value = true
    return
  }
  try {
    const res = await fetch(api.podcast.listenLater, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ episode_id: episodeId }),
    })
    if (!res.ok) throw new Error('listen later failed')
    toastMessage.value = '已加入稍后听'
    toastVisible.value = true
  } catch (err) {
    console.error('Failed to add podcast listen later:', err)
    toastMessage.value = '操作失败'
    toastVisible.value = true
  }
}

async function addTrackToPlaylist(playlistId: string, songId: string) {
  try {
    await addSongToPlaylist(playlistId, songId)
    toastMessage.value = '已成功添加到歌单'
    toastVisible.value = true
  } catch (err) {
    console.error('Failed to add song to playlist:', err)
    toastMessage.value = '添加失败'
    toastVisible.value = true
  }
}

watch(
  () => player.currentSong?.id,
  async (newId) => {
    if (isPodcast.value) return
    if (newId) {
      if (!playlistsLoaded.value) {
        await loadPlaylists()
      }
      await loadFavorites()
    }
  },
  { immediate: true }
)

const formatTime = (s: number) => {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const seek = (e: MouseEvent) => {
  const bar = e.currentTarget as HTMLElement
  const pct = e.offsetX / bar.offsetWidth
  player.seek(pct * player.duration)
}

const handleProgressInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  player.seek(parseFloat(target.value))
}

watch(
  () => player.currentSong?.id,
  async () => {
    await nextTick()
    updateMetaCollapse()
  },
)

onMounted(() => {
  viewportQuery = window.matchMedia?.('(max-width: 767px)') ?? null
  syncViewport()
  viewportQuery?.addEventListener('change', syncViewport)

  resizeObserver = new ResizeObserver(() => {
    updateMetaCollapse()
  })

  if (playerInnerRef.value) {
    resizeObserver.observe(playerInnerRef.value)
  }

  void nextTick(() => {
    updateMetaCollapse()
  })
})

onBeforeUnmount(() => {
  clearHideTimer()
  viewportQuery?.removeEventListener('change', syncViewport)
  delete document.documentElement.dataset.playerActive
  delete document.documentElement.dataset.playerPinned
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped>
.player {
  position: fixed;
  bottom: var(--a-mobile-nav-reserved-height);
  width: 100%;
  z-index: var(--a-z-player, 720);
  background: var(--a-color-paper);
  border-top: 1px solid var(--a-color-line-soft);
  height: var(--a-player-height);
  transition: transform 0.3s cubic-bezier(0.2, 0, 0, 1);
}

.player.is-auto-hidden {
  transform: translateY(calc(100% - 10px));
}

.player-reveal-handle {
  position: absolute;
  top: 3px;
  left: 50%;
  width: 40px;
  height: 3px;
  transform: translateX(-50%);
  background: var(--a-color-muted-soft);
  pointer-events: none;
}

.player-inner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  height: 100%;
}

/* Left Section */
.player-info {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 0 0 460px;
  min-width: 0;
  transition:
    flex-basis 0.22s ease,
    width 0.22s ease,
    gap 0.22s ease;
}
.player-info--collapsed {
  flex-basis: 52px;
  width: 52px;
  gap: 0;
}
.cover-wrap {
  position: relative;
  width: 52px;
  height: 52px;
  border: 1px solid var(--a-color-line-soft);
  cursor: pointer;
  flex-shrink: 0;
}
.player-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.player-cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  font-size: 1.4rem;
  font-weight: var(--a-font-weight-strong, 700);
  color: var(--a-color-ink);
  background: var(--a-color-paper-soft);
  text-transform: uppercase;
}
.cover-overlay {
  position: absolute; inset: 0;
  background: color-mix(in srgb, var(--a-color-ink) 40%, transparent);
  color: var(--a-color-paper);
  display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.2s;
  font-size: 20px;
  font-weight: bold;
}
.cover-wrap:hover .cover-overlay { opacity: 1; }

.player-meta {
  min-width: 0;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow: hidden;
  transition:
    max-width 0.22s ease,
    opacity 0.18s ease,
    transform 0.22s ease,
    margin 0.22s ease;
}
.player-meta--collapsed {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transform: translateX(-6px);
}
.player-tooltip-wrap {
  position: relative;
  min-width: 0;
}
.player-title {
  font-family: var(--a-font-serif);
  font-weight: 950;
  font-size: 1.05rem;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.player-artist {
  font-family: var(--a-font-meta);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0;
  color: var(--a-color-muted);
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-tooltip {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  max-width: min(36rem, 80vw);
  padding: 0.5rem 0.7rem;
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.4;
  letter-spacing: 0.04em;
  white-space: normal;
  word-break: break-word;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0s linear 0.18s;
  transition-delay: 0s, 0s, 0s;
  z-index: 20;
}
.player-tooltip::after {
  content: '';
  position: absolute;
  left: 18px;
  top: 100%;
  border: 6px solid transparent;
  border-top-color: var(--a-color-ink);
}
.player-tooltip-wrap:hover .player-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition-delay: 0s, 0s, 0s;
}
.player-tooltip--subtle {
  font-size: 0.66rem;
  letter-spacing: 0.12em;
}

/* Center Section */
.player-controls-hub {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(600px, calc(100% - 780px));
  min-width: 320px;
}
.ctrl-row {
  display: flex; gap: 24px; align-items: center;
  font-family: var(--a-font-meta);
  font-weight: 950;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--a-color-ink);
}
.skip-btn, .nav-btn {
  cursor: pointer;
  transition: opacity 0.2s;
}
.skip-btn { opacity: 0.4; }
.skip-btn:hover, .nav-btn:hover { opacity: 1; }

.main-play-btn {
  background: var(--a-color-ink); color: var(--a-color-bg);
  border: 1px solid var(--a-color-line-soft);
  padding: 6px 20px; font-weight: 950;
  font-size: 11px;
  cursor: pointer; letter-spacing: 0.1em;
  transition: transform 0.1s;
}
.main-play-btn:active { transform: translateY(2px); }

.progress-container {
  width: 100%;
  max-width: 600px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.time-stamp {
  font-family: var(--a-font-mono, monospace);
  font-size: 9px;
  color: var(--a-color-muted);
  min-width: 32px;
}
.progress-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 20px;
  background: transparent;
  outline: none;
  cursor: pointer;
}
.progress-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(
    to right,
    var(--a-color-ink) 0%,
    var(--a-color-ink) var(--progress-pct, 0%),
    var(--a-color-line-soft) var(--progress-pct, 0%),
    var(--a-color-line-soft) 100%
  );
  transition: height 0.1s ease;
}
.progress-slider::-moz-range-track {
  width: 100%;
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(
    to right,
    var(--a-color-ink) 0%,
    var(--a-color-ink) var(--progress-pct, 0%),
    var(--a-color-line-soft) var(--progress-pct, 0%),
    var(--a-color-line-soft) 100%
  );
}
.progress-slider:hover::-webkit-slider-runnable-track {
  height: 4px;
}
.progress-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--a-color-ink);
  margin-top: -4px;
  opacity: 0;
  transition: opacity 0.1s ease, margin-top 0.1s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.progress-slider:hover::-webkit-slider-thumb {
  opacity: 1;
  margin-top: -3px;
}
.progress-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 0;
  border-radius: 50%;
  background: var(--a-color-ink);
  opacity: 0;
  transition: opacity 0.1s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.progress-slider:hover::-moz-range-thumb {
  opacity: 1;
}

/* Right Section */
.player-features {
  margin-left: auto;
  display: flex; align-items: center; gap: 20px;
  font-family: var(--a-font-meta);
  font-weight: 950; font-size: 10px; letter-spacing: 0.1em;
  flex-shrink: 0;
}
.feature-link {
  cursor: pointer;
  border-bottom: 1.5px solid transparent;
  font-size: 0.9rem;
  padding: 0 4px;
}
.feature-link:hover { border-bottom-color: var(--a-color-ink); }

.feature-toggle {
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--a-color-muted);
  transition: color 0.2s;
}
.feature-toggle:hover { color: var(--a-color-ink); }

.repeat-one-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.one-badge {
  position: absolute;
  font-size: 8px;
  font-weight: 950;
  font-family: var(--a-font-mono);
  color: currentColor;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -45%);
  line-height: 1;
}

.volume-container {
  display: flex;
  align-items: center;
  position: relative;
}
.volume-control {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(8px);
  width: 44px;
  height: 112px;
  opacity: 0;
  visibility: hidden;
  overflow: hidden;
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.25s;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line-soft);
  padding: 16px 0;
  z-index: 100;
  box-shadow: 4px 4px 0px var(--a-color-ink);
  border-radius: 0px;
}
.volume-control::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--a-color-paper);
}
.volume-container:hover .volume-control {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
.vol-trigger {
  display: flex;
  align-items: center;
}
.vol-icon {
  cursor: pointer;
  color: var(--a-color-muted);
  transition: color 0.2s;
  flex-shrink: 0;
}
.vol-icon:hover { color: var(--a-color-ink); }

.vol-slider {
  height: 80px;
  width: 2px;
  appearance: none;
  background: var(--a-color-line-soft);
  cursor: pointer;
  writing-mode: bt-lr; /* IE/Edge */
  -webkit-appearance: slider-vertical; /* Webkit */
}
.vol-slider::-webkit-slider-runnable-track { background: transparent; }
.vol-slider::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 10px;
  background: var(--a-color-ink);
  border-radius: 50%;
}

.queue-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--a-color-muted);
  transition: all 0.2s;
  padding: 4px 8px;
  border-radius: 0px;
  background: transparent;
  border: none;
}

.player-pin-btn {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--a-color-ink-soft);
  cursor: pointer;
}

.player-pin-btn:hover,
.player-pin-btn:focus-visible {
  background: var(--a-color-paper-wash);
  color: var(--a-color-fg);
}

@media (prefers-reduced-motion: reduce) {
  .player {
    transition-duration: 0.01ms;
  }
}
.queue-trigger:hover { 
  color: var(--a-color-ink);
  background: var(--a-color-tape);
}
.queue-trigger.active {
  color: var(--a-color-ink);
  background: var(--a-color-tape);
}
.queue-count {
  font-family: var(--a-font-mono, monospace);
  font-size: 10px;
  font-weight: 900;
  min-width: 14px;
  text-align: center;
}

@media (max-width: 1023px) {
  .player-inner {
    gap: 1rem;
    padding: 0 1rem;
  }

  .player-info {
    flex: 0 0 auto;
    max-width: 18rem;
  }

  .player-controls-hub {
    width: min(440px, calc(100% - 420px));
    min-width: 240px;
  }

  .ctrl-row {
    gap: 14px;
  }

  .player-features {
    gap: 12px;
  }
}

@media (max-width: 1024px) {
  .player-inner { gap: 1rem; }
  .player-info { flex-basis: 320px; }
  .player-controls-hub {
    width: min(420px, calc(100% - 620px));
    min-width: 240px;
  }
  .player-features { gap: 12px; }
  .volume-container { display: none; }
}

.lyrics-panel {
  position: fixed; top: var(--a-topbar-height); bottom: var(--a-content-bottom-offset); left: 0; right: 0;
  width: 100%;
  height: calc(100dvh - var(--a-topbar-height) - var(--a-content-bottom-offset)); background: var(--a-color-paper);
  border-top: 1px solid var(--a-color-line-soft);
  z-index: var(--a-z-player-lyrics); padding: 3rem;
  display: flex; flex-direction: column;
}
.lyrics-header {
  display: flex; justify-content: flex-end; margin-bottom: 2rem;
}
.close-btn {
  font-family: inherit; font-weight: var(--a-font-weight-strong, 700); font-size: 10px;
  letter-spacing: 0.1em; cursor: pointer; border-bottom: 1px solid var(--a-color-line);
}
.lyrics-content {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center;
}
.placeholder-text {
  font-family: inherit; font-size: 2rem; font-weight: var(--a-font-weight-black, 900);
  margin-bottom: 1rem; color: var(--a-color-fg);
}
.song-meta {
  font-family: inherit; font-weight: var(--a-font-weight-strong, 700); font-size: 0.75rem;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--a-color-muted);
}

.queue-panel {
  position: fixed; top: var(--a-topbar-height); bottom: var(--a-content-bottom-offset); right: 0;
  width: 420px;
  height: calc(100dvh - var(--a-topbar-height) - var(--a-content-bottom-offset)); background: var(--a-color-paper);
  border-left: 1px solid var(--a-color-line-soft);
  border-top: 1px solid var(--a-color-line-soft);
  z-index: var(--a-z-player-queue); padding: 2rem 3rem;
  display: flex; flex-direction: column;
}
.queue-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;
}
.queue-title {
  font-family: inherit; font-weight: var(--a-font-weight-strong, 700); font-size: 1.1rem;
  margin: 0; text-transform: uppercase; letter-spacing: 0.08em;
}
.queue-content {
  flex: 1; overflow-y: auto;
}
.queue-list {
  display: flex; flex-direction: column; gap: 4px;
}
.queue-item {
  display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem;
  cursor: pointer; transition: all 0.15s;
  border-bottom: 1px solid var(--a-color-line-soft);
}
.queue-item:hover { background: var(--a-color-paper-wash); }
.queue-item.active { background: var(--a-color-ink); color: var(--a-color-paper); }
.q-idx { font-family: var(--a-font-meta); font-size: 0.7rem; opacity: 0.5; }
.q-title { font-family: inherit; font-weight: var(--a-font-weight-strong, 700); flex: 1; }
.q-artist { font-family: inherit; font-size: 0.7rem; opacity: 0.7; text-transform: uppercase; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.5s cubic-bezier(0.2, 0, 0, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }

.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.4s cubic-bezier(0.2, 0, 0, 1); }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }

/* Player Center Favorite & Add button styles */
.player-fav-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-ink-soft);
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background-color 0.15s ease;
  margin-left: 0.5rem;
}
.player-fav-btn.is-active {
  color: #e05e5e !important;
}
.player-fav-btn:hover {
  background-color: var(--a-color-paper-wash);
}
.player-add-dropdown {
  position: relative;
  display: inline-flex;
}
.player-add-dropdown :deep(.p-dropdown-panel) {
  top: auto;
  bottom: calc(100% + 8px);
}
.player-add-btn {
  background: transparent;
  border: 0;
  color: var(--a-color-ink-soft);
  cursor: pointer;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.player-add-btn:hover {
  background-color: var(--a-color-paper-wash);
}

.track-add-menu {
  background: var(--a-color-paper);
  border: 1px solid var(--a-color-line-soft);
  box-shadow: var(--a-shadow-dropdown);
  padding: 0.4rem 0;
  min-width: 130px;
  max-width: 200px;
  display: flex;
  flex-direction: column;
}
.track-add-menu-header {
  font-family: var(--a-font-meta);
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--a-color-ink-soft);
  padding: 0.3rem 0.8rem;
  border-bottom: 1px solid var(--a-color-line-soft);
  margin-bottom: 0.25rem;
}
.track-add-menu-empty {
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  color: var(--a-color-muted-soft);
  padding: 0.4rem 0.8rem;
}
.track-add-menu-item {
  background: transparent;
  border: 0;
  text-align: left;
  font-size: 0.82rem;
  padding: 0.4rem 0.8rem;
  color: var(--a-color-fg);
  cursor: pointer;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}
.track-add-menu-item:hover {
  background-color: var(--a-color-paper-wash);
}

@media (max-width: 767px) {
  .player {
    height: var(--a-mobile-player-height);
    transform: none !important;
  }

  .player-reveal-handle,
  .player-pin-btn,
  .feature-link,
  .feature-toggle,
  .volume-container,
  .progress-container,
  .skip-btn,
  .nav-btn,
  .player-fav-btn,
  .player-add-dropdown,
  .player-add-btn {
    display: none;
  }

  .player-inner {
    gap: 0.75rem;
    padding: 0 0.75rem;
  }

  .player-info,
  .player-info--collapsed {
    flex: 1 1 auto;
    width: auto;
    max-width: none;
    gap: 0.75rem;
  }

  .cover-wrap {
    width: 44px;
    height: 44px;
  }

  .player-meta,
  .player-meta--collapsed {
    display: block;
    min-width: 0;
    opacity: 1;
  }

  .player-controls-hub {
    width: auto;
    min-width: 0;
  }

  .ctrl-row {
    gap: 0;
  }

  .main-play-btn,
  .queue-trigger {
    width: 44px;
    height: 44px;
  }

  .player-features {
    margin-left: 0;
    gap: 0;
  }

  .queue-panel {
    width: 100%;
    padding: 1.25rem 1rem;
  }
}
</style>
