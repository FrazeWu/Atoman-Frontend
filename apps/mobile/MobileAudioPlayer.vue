<template>
  <section class="mobile-mini-player" aria-label="正在播放">
    <!-- 2px Top Progress Line -->
    <div class="mobile-mini-player__progress" aria-hidden="true">
      <span :style="{ width: `${progressRatio}%` }" />
    </div>

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
        {{ coverFallback }}
      </span>
      <span class="mobile-mini-player__meta">
        <strong>{{ player.currentSong?.title || '未在播放' }}</strong>
        <span>{{ artistText }}</span>
      </span>
    </button>

    <!-- Controls: Previous, Play/Pause, Next -->
    <div class="mobile-mini-player__controls">
      <button
        type="button"
        class="mobile-mini-player__action"
        aria-label="上一首"
        title="上一首"
        @click="player.playPrevious()"
      >
        <MIcon name="player-prev" size="sm" />
      </button>

      <button
        type="button"
        class="mobile-mini-player__action mobile-mini-player__action--primary"
        data-testid="player-play-btn"
        :aria-label="player.isPlaying ? '暂停' : '播放'"
        :title="player.isPlaying ? '暂停' : '播放'"
        @click="player.togglePlay()"
      >
        <span v-if="player.isLoading" class="mobile-mini-player__spinner" aria-hidden="true" />
        <MIcon v-else-if="player.isPlaying" name="player-pause" size="sm" />
        <MIcon v-else name="player-play" size="sm" />
      </button>

      <button
        type="button"
        class="mobile-mini-player__action"
        aria-label="下一首"
        title="下一首"
        @click="player.playNext()"
      >
        <MIcon name="player-next" size="sm" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import MIcon from '@mobile/components/ui/MIcon.vue'

const player = usePlayerStore()
const router = useRouter()
const route = useRoute()

const artistText = computed(() => {
  const song = player.currentSong
  if (!song) return '未知艺术家'
  return song.artist || '未知艺术家'
})

const coverFallback = computed(() => {
  const text = player.currentSong?.album || player.currentSong?.artist || player.currentSong?.title || 'P'
  return text.trim().charAt(0) || 'P'
})

const progressRatio = computed(() => {
  if (!player.duration) return 0
  return Math.min(100, Math.max(0, (player.currentTime / player.duration) * 100))
})

function openPlayer() {
  if (route.path !== '/music/player') {
    player.savePlaybackState()
    void router.push('/music/player')
  }
}

let touchStartX = 0
let touchStartY = 0
let touchCurrentX = 0
let touchCurrentY = 0
let isSwiped = false

function handleTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  touchCurrentX = touchStartX
  touchCurrentY = touchStartY
  isSwiped = false
}

function handleTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  touchCurrentX = touch.clientX
  touchCurrentY = touch.clientY
}

function handleTouchEnd(e: TouchEvent) {
  const touch = e.changedTouches?.[0] || e.touches?.[0]
  if (touch) {
    touchCurrentX = touch.clientX
    touchCurrentY = touch.clientY
  }
  const deltaX = touchCurrentX - touchStartX
  const deltaY = touchCurrentY - touchStartY
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  // Swipe up to expand to full player
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
  right: 0;
  bottom: var(--mobile-app-player-bottom, calc(56px + env(safe-area-inset-bottom, 0px)));
  left: 0;
  z-index: var(--a-z-player, 720);
  transition: bottom 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: var(--mobile-app-player-height, 64px);
  padding: 0.5rem 0.875rem;
  border-top: 1px solid var(--a-color-border-soft, #e2e8f0);
  background: #ffffff;
  box-shadow: none !important;
}

.mobile-mini-player__progress {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 2px;
  background: var(--a-color-border-soft, #e2e8f0);
}

.mobile-mini-player__progress span {
  display: block;
  height: 100%;
  background: var(--a-color-primary, #0f172a);
  transition: width 120ms linear;
}

.mobile-mini-player__track {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 0.625rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-text, #0f172a);
  text-align: left;
  cursor: pointer;
}

.mobile-mini-player__cover {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  object-fit: cover;
  border: 1px solid var(--a-color-border-soft, #e2e8f0);
  border-radius: var(--a-radius-control, 4px);
}

.mobile-mini-player__cover--fallback {
  display: grid;
  place-items: center;
  background: var(--a-color-surface-muted, #f8fafc);
  color: var(--a-color-muted, #64748b);
  font-size: 1.125rem;
  font-weight: 600;
}

.mobile-mini-player__meta {
  display: grid;
  min-width: 0;
  gap: 0.125rem;
}

.mobile-mini-player__meta strong,
.mobile-mini-player__meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-mini-player__meta strong {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text, #0f172a);
}

.mobile-mini-player__meta span {
  color: var(--a-color-muted, #64748b);
  font-size: 0.75rem;
}

.mobile-mini-player__controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.mobile-mini-player__action {
  position: relative;
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-text, #0f172a);
  cursor: pointer;
  border-radius: var(--a-radius-control, 4px);
  transition: background-color 0.1s ease;
}

.mobile-mini-player__action:active {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.mobile-mini-player__action--primary {
  width: 36px;
  height: 36px;
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-text, #0f172a);
  color: #ffffff;
}

.mobile-mini-player__action--primary:active {
  opacity: 0.9;
  background: var(--a-color-text, #0f172a);
}

.mobile-mini-player__action:focus-visible,
.mobile-mini-player__track:focus-visible {
  outline: 2px solid var(--a-color-primary, #0f172a);
  outline-offset: 2px;
}

.mobile-mini-player__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: mobile-player-spin 0.8s linear infinite;
}

@keyframes mobile-player-spin {
  to { transform: rotate(360deg); }
}
</style>
