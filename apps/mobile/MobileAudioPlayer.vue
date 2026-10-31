<template>
  <section
    class="mobile-mini-player"
    :class="{ 'is-dragging': isDragging }"
    :style="miniPlayerStyle"
    aria-label="正在播放"
  >
    <!-- Track Info (Click opens full-screen player, swipes expand or switch tracks) -->
    <button
      type="button"
      class="mobile-mini-player__track"
      @click="handleTrackClick"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <img
        v-if="player.currentSong?.cover_url"
        :src="player.currentSong.cover_url"
        alt=""
        class="mobile-mini-player__cover"
      />
      <span v-else class="mobile-mini-player__cover mobile-mini-player__cover--fallback">
        <MIcon name="note" size="sm" />
      </span>
      <span class="mobile-mini-player__meta">
        <strong>{{ player.currentSong?.title || '未在播放' }}</strong>
        <span>{{ artistText }}</span>
      </span>
    </button>

    <!-- Spotify-style Controls: Favorite Heart & Play/Pause -->
    <div class="mobile-mini-player__controls">
      <button
        type="button"
        class="mobile-mini-player__action mobile-mini-player__action--favorite"
        :class="{ 'is-favorited': isCurrentFavorite }"
        data-testid="mini-player-favorite-btn"
        :aria-label="isCurrentFavorite ? '已收藏' : '收藏'"
        :title="isCurrentFavorite ? '已收藏' : '收藏'"
        @click.stop="handleToggleFavorite"
      >
        <MIcon :name="isCurrentFavorite ? 'heart-filled' : 'heart'" size="sm" />
      </button>

      <button
        type="button"
        class="mobile-mini-player__action mobile-mini-player__action--play"
        data-testid="player-play-btn"
        :aria-label="player.isPlaying ? '暂停' : '播放'"
        :title="player.isPlaying ? '暂停' : '播放'"
        @click.stop="player.togglePlay()"
      >
        <span class="mobile-play-icon-stage" aria-hidden="true">
          <Transition name="player-icon-swap" mode="out-in">
            <span v-if="player.isLoading" key="loading" class="play-icon-glyph play-icon-glyph--loading">
              <span class="mobile-mini-player__spinner" />
            </span>
            <span v-else-if="player.isPlaying" key="pause" class="play-icon-glyph">
              <MIcon name="player-pause" size="sm" />
            </span>
            <span v-else key="play" class="play-icon-glyph play-icon-glyph--play">
              <MIcon name="player-play" size="sm" />
            </span>
          </Transition>
        </span>
      </button>
    </div>

    <!-- 2px Bottom Progress Line (Flush with capsule bottom) -->
    <div class="mobile-mini-player__progress" aria-hidden="true">
      <span :style="{ width: `${progressRatio}%` }" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useMusicFavoritePlaylist } from '@/composables/useMusicFavoritePlaylist'
import MIcon from '@mobile/components/ui/MIcon.vue'

const player = usePlayerStore()
const router = useRouter()
const route = useRoute()

const { favoriteSongIds, toggleFavoriteSong } = useMusicFavoritePlaylist()

const isCurrentFavorite = computed(() => {
  const songId = player.currentSong?.id
  return !!songId && favoriteSongIds.value.has(String(songId))
})

async function handleToggleFavorite() {
  const songId = player.currentSong?.id
  if (!songId) return
  try {
    await toggleFavoriteSong(String(songId))
  } catch (err) {
    console.error('Toggle favorite failed:', err)
  }
}

const isDragging = ref(false)
const dragOffsetY = ref(0)
const hasInteracted = ref(false)

const miniPlayerStyle = computed<CSSProperties>(() => {
  if (isDragging.value && dragOffsetY.value < 0) {
    return {
      transform: `translateY(${dragOffsetY.value}px)`,
      transition: 'none',
    }
  }
  if (hasInteracted.value) {
    return {
      transform: 'translateY(0px)',
      transition: 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    }
  }
  return {}
})

const progressRatio = computed(() => {
  const duration = player.duration
  if (!duration || Number.isNaN(duration)) return 0
  const ratio = (player.currentTime / duration) * 100
  return Math.min(100, Math.max(0, ratio))
})

const artistText = computed(() => {
  const current = player.currentSong
  if (!current) return '轻触开始探索'
  if (current.artist && current.album) {
    return `${current.artist} · ${current.album}`
  }
  return current.artist || current.album || '未知艺术家'
})

function openPlayer() {
  if (router && typeof router.push === 'function') {
    void router.push('/music/player').catch(() => {})
  }
}

// Micro-displacement & Swipe to Expand Gestures
let startTouchX = 0
let startTouchY = 0
let isTrackingY = false
let isSwiped = false

function handleTouchStart(e: TouchEvent) {
  if (!e.touches || e.touches.length === 0) return
  const touch = e.touches[0]
  startTouchX = touch.clientX
  startTouchY = touch.clientY
  isTrackingY = false
  isSwiped = false
}

function handleTouchMove(e: TouchEvent) {
  if (!e.touches || e.touches.length === 0) return
  const touch = e.touches[0]
  const deltaX = touch.clientX - startTouchX
  const deltaY = touch.clientY - startTouchY

  if (!isTrackingY && Math.abs(deltaY) > Math.abs(deltaX) && deltaY < 0) {
    isTrackingY = true
    isDragging.value = true
    hasInteracted.value = true
  }

  if (isTrackingY) {
    const upwardDist = Math.max(0, -deltaY)
    const dampedY = -Math.pow(upwardDist, 0.82)
    dragOffsetY.value = dampedY
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (isTrackingY) {
    isTrackingY = false
    isDragging.value = false
    const upwardMoved = -dragOffsetY.value
    dragOffsetY.value = 0

    if (upwardMoved > 40) {
      isSwiped = true
      openPlayer()
      return
    }
  }

  if (!e.changedTouches || e.changedTouches.length === 0) return
  const touch = e.changedTouches[0]
  const deltaX = touch.clientX - startTouchX
  const deltaY = touch.clientY - startTouchY
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  // Swipe up to expand player
  if (deltaY < -40 && absY > 1.2 * absX) {
    isSwiped = true
    openPlayer()
    return
  }

  // Swipe left for next track
  if (deltaX < -50 && absX > 1.2 * absY) {
    isSwiped = true
    player.playNext()
    return
  }

  // Swipe right for previous track
  if (deltaX > 50 && absX > 1.2 * absY) {
    isSwiped = true
    player.playPrevious()
    return
  }
}

function handleTrackClick() {
  if (isSwiped) {
    isSwiped = false
    return
  }
  openPlayer()
}
</script>

<style scoped>
.mobile-mini-player {
  position: fixed;
  right: 8px;
  bottom: calc(var(--mobile-app-player-bottom, calc(56px + env(safe-area-inset-bottom, 0px))) + 6px);
  left: 8px;
  z-index: var(--a-z-player, 720);
  transition: bottom 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 52px;
  min-height: 0 !important;
  box-sizing: border-box;
  padding: 0 8px 0 8px;
  border: none !important;
  border-radius: 8px;
  background-color: #212124;
  color: #ffffff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24);
  overflow: hidden;
  user-select: none;
}

.mobile-app-shell .mobile-app-dock > .mobile-mini-player {
  position: relative;
  inset: auto;
  margin: 0 8px 6px 8px;
  width: calc(100% - 16px);
  max-width: 464px;
  pointer-events: auto;
}

.mobile-app-dock--without-nav > .mobile-mini-player {
  margin-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
}

.mobile-mini-player__progress {
  position: absolute;
  bottom: 0;
  right: 0;
  left: 0;
  height: 2px;
  background-color: rgba(255, 255, 255, 0.16);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  pointer-events: none;
}

.mobile-mini-player__progress span {
  display: block;
  height: 100%;
  background-color: #ffffff;
  transition: width 120ms linear;
}

.mobile-mini-player__track {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 1;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0 !important;
  background: transparent !important;
  color: #ffffff;
  text-align: left;
  cursor: pointer;
  user-select: none;
  min-height: 0 !important;
}

.mobile-mini-player__cover {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  object-fit: cover;
  border: none !important;
  border-radius: 4px;
}

.mobile-mini-player__cover--fallback {
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.12);
  color: #a1a1aa;
}

.mobile-mini-player__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.mobile-mini-player__meta strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-mini-player__meta span {
  display: block;
  font-size: 11.5px;
  line-height: 1.2;
  color: #a1a1aa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.mobile-mini-player__controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.mobile-mini-player__action {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px !important;
  height: 36px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0;
  border: none !important;
  background: transparent !important;
  color: #ffffff;
  cursor: pointer;
  border-radius: 50% !important;
  transition: transform 0.1s ease, color 0.15s ease;
}

.mobile-mini-player__action:active {
  transform: scale(0.92);
}

.mobile-mini-player__action--favorite {
  color: #a1a1aa;
}

.mobile-mini-player__action--favorite.is-favorited {
  color: #1ed760;
}

.mobile-mini-player__action--play {
  color: #ffffff;
}

.mobile-mini-player__action:focus-visible,
.mobile-mini-player__track:focus-visible {
  outline: none;
}

.mobile-mini-player__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: mobile-player-spin 0.8s linear infinite;
}

.mobile-play-icon-stage {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  position: relative;
  flex-shrink: 0;
  pointer-events: none;
}

.play-icon-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  transform-origin: center center;
}

.play-icon-glyph--play {
  transform: translateX(0.5px);
}

.player-icon-swap-enter-active,
.player-icon-swap-leave-active {
  transition:
    opacity 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.player-icon-swap-enter-from,
.player-icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.82);
}

@media (prefers-reduced-motion: reduce) {
  .player-icon-swap-enter-active,
  .player-icon-swap-leave-active {
    transition: opacity 0.05s linear !important;
    transform: none !important;
  }
}

@keyframes mobile-player-spin {
  to { transform: rotate(360deg); }
}
</style>
