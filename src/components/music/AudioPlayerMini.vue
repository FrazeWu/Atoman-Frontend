<template>
  <div
    class="player-mini-window"
    data-player-mode="cover"
  >
    <!-- Hover track info tooltip -->
    <div v-if="songTitle" class="player-mini-tooltip">
      <div class="player-mini-tooltip__title">{{ songTitle }}</div>
      <div v-if="artistText" class="player-mini-tooltip__artist">{{ artistText }}</div>
    </div>

    <!-- Quick skip previous button -->
    <button
      type="button"
      class="player-mini-skip-btn player-mini-skip-btn--prev"
      aria-label="上一首"
      title="上一首"
      @click.stop="$emit('play-previous')"
    >
      <SkipBack :size="12" aria-hidden="true" />
    </button>

    <button
      type="button"
      class="player-mini-cover"
      :aria-label="isPlaying ? '暂停播放' : '继续播放'"
      :title="isPlaying ? '暂停播放（双击打开歌词）' : '继续播放（双击打开歌词）'"
      @click="$emit('toggle-play')"
      @dblclick.stop="$emit('open-lyrics')"
    >
      <img
        v-if="coverUrl"
        :src="coverUrl"
        alt=""
        class="player-cover"
      />
      <span v-else class="player-cover-fallback">{{ coverFallback }}</span>
      <svg class="player-mini-progress-ring" :data-progress="miniProgressPercent" viewBox="0 0 100 100" aria-hidden="true">
        <rect class="player-mini-progress-ring__track" x="3" y="3" width="94" height="94" pathLength="100" />
        <rect
          class="player-mini-progress-ring__value"
          x="3"
          y="3"
          width="94"
          height="94"
          pathLength="100"
          :style="{ strokeDashoffset: String(100 - miniProgressPercent) }"
        />
      </svg>
      <span v-if="!isPlaying" class="player-mini-play-overlay" aria-hidden="true">
        <Play :size="22" fill="currentColor" />
      </span>
    </button>

    <!-- Quick skip next button -->
    <button
      type="button"
      class="player-mini-skip-btn player-mini-skip-btn--next"
      aria-label="下一首"
      title="下一首"
      @click.stop="$emit('play-next')"
    >
      <SkipForward :size="12" aria-hidden="true" />
    </button>

    <button
      type="button"
      class="player-mini-expand"
      aria-label="展开完整播放器"
      title="展开完整播放器"
      @click.stop="$emit('expand')"
    >
      <ChevronLeft :size="15" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Play, ChevronLeft, SkipBack, SkipForward } from 'lucide-vue-next'

defineProps<{
  coverUrl?: string
  coverFallback?: string
  songTitle?: string
  artistText?: string
  isPlaying: boolean
  miniProgressPercent: number
}>()

defineEmits<{
  'toggle-play': []
  'play-previous': []
  'play-next': []
  'open-lyrics': []
  'expand': []
}>()
</script>

<style scoped>
.player-mini-window {
  position: fixed;
  left: calc(2.5vw + 1.25rem);
  right: auto;
  bottom: calc(
    var(--a-footer-reserved-height) + var(--a-mobile-nav-reserved-height) +
      1.25rem
  );
  z-index: var(--a-z-player, 720);
  display: grid;
  place-items: center;
  width: 4.5rem;
  height: 4.5rem;
  overflow: visible;
  border: 0;
  border-radius: var(--a-radius-card, 4px);
  background: var(--a-color-bg);
  box-shadow: none;
}

.player-mini-cover {
  position: relative;
  display: block;
  width: 4.5rem;
  height: 4.5rem;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  overflow: hidden;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.player-mini-cover:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

.player-mini-cover .player-cover,
.player-mini-cover .player-cover-fallback {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-mini-cover .player-cover-fallback {
  display: grid;
  place-items: center;
  background: var(--a-color-surface);
  color: var(--a-color-muted);
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.player-mini-progress-ring {
  position: absolute;
  inset: -0.2rem;
  width: calc(100% + 0.4rem);
  height: calc(100% + 0.4rem);
  overflow: visible;
  pointer-events: none;
}

.player-mini-progress-ring__track,
.player-mini-progress-ring__value {
  fill: none;
  stroke-width: 3;
  stroke-linejoin: miter;
}

.player-mini-progress-ring__track {
  stroke: var(--a-color-border-soft);
}

.player-mini-progress-ring__value {
  stroke: var(--a-color-primary);
  stroke-dasharray: 100;
  transition: stroke-dashoffset 160ms linear;
}

.player-mini-play-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  color: #fff;
  background: rgba(19, 28, 46, 0.42);
  pointer-events: none;
}

.player-mini-expand {
  position: absolute;
  top: 50%;
  left: -1.25rem;
  display: grid;
  width: 1.25rem;
  height: 4.5rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control, 4px) 0 0 var(--a-radius-control, 4px);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  transform: translateY(-50%);
  z-index: 2;
}

.player-mini-expand:focus-visible {
  background: color-mix(in srgb, var(--a-color-primary) 12%, transparent);
  color: var(--a-color-primary);
  outline: none;
}

/* Quick skip buttons */
.player-mini-skip-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  box-shadow: none;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  z-index: 3;
  transition: opacity 0.2s ease, transform 0.2s ease, background 0.15s ease, color 0.15s ease;
}

.player-mini-skip-btn--prev {
  left: -28px;
}

.player-mini-skip-btn--next {
  right: -28px;
}

.player-mini-skip-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
}

.player-mini-window:hover .player-mini-skip-btn,
.player-mini-window:focus-within .player-mini-skip-btn {
  opacity: 0.95;
  pointer-events: auto;
}

/* Hover track info tooltip */
.player-mini-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 0;
  right: auto;
  max-width: 200px;
  padding: 6px 10px;
  background: var(--a-color-bg);
  border: 0;
  border-radius: var(--a-radius-card, 4px);
  box-shadow: none;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 10;
  text-align: left;
  white-space: nowrap;
}

.player-mini-tooltip__title {
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-fg);
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-mini-tooltip__artist {
  font-size: 10px;
  color: var(--a-color-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-mini-window:hover .player-mini-tooltip {
  opacity: 1;
  transform: translateY(0);
}

@media (min-width: 1440px) {
  .player-mini-window,
  .player-mini-cover {
    width: 6.75rem;
    height: 6.75rem;
  }

  .player-mini-expand {
    height: 6.75rem;
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .player-mini-window {
    left: calc(1rem + 1.25rem);
    right: auto;
  }
}

@media (max-width: 768px) {
  .player-mini-window {
    left: 1rem;
    right: auto;
    bottom: var(--a-mobile-nav-reserved-height);
    width: 3rem;
    height: 3rem;
  }

  .player-mini-cover {
    width: 3rem;
    height: 3rem;
  }

  .player-mini-expand {
    height: 3rem;
  }
}
</style>
