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

    <!-- Play / Pause Cover Button with progress ring and play overlay -->
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

    <!-- Expand button (fixed at the far right, matching collapse tab position) -->
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
import { Play, ChevronLeft } from 'lucide-vue-next'

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
  'open-lyrics': []
  'expand': []
}>()
</script>

<style scoped>
.player-mini-window {
  position: fixed;
  right: 0;
  left: auto;
  bottom: 0;
  z-index: var(--a-z-player, 720);
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 4.5rem;
  width: auto !important;
  max-width: none;
  overflow: visible;
  border: 0;
  background: var(--a-color-bg);
  box-shadow: none !important;
}

.player-mini-cover {
  position: relative;
  display: block;
  width: 4.5rem;
  height: 4.5rem;
  padding: 0;
  border: 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-left: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  overflow: hidden;
  background: transparent;
  font: inherit;
  cursor: pointer;
  flex-shrink: 0;
}

.player-mini-cover:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 4.5rem;
  padding: 0;
  border: 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-left: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  background: var(--a-color-bg);
  color: var(--a-color-muted);
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: none !important;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.player-mini-expand:hover,
.player-mini-expand:focus-visible {
  background: color-mix(in srgb, var(--a-color-primary) 12%, transparent);
  color: var(--a-color-primary);
  outline: none;
}

/* Hover track info tooltip */
.player-mini-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  left: auto;
  max-width: 220px;
  padding: 6px 10px;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border: 0;
  border-radius: var(--a-radius-card, 4px);
  box-shadow: none !important;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 10;
  text-align: right;
  white-space: nowrap;
}

.player-mini-tooltip__title {
  font-size: 12px;
  font-weight: 500;
  color: var(--a-color-bg);
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-mini-tooltip__artist {
  font-size: 10px;
  color: color-mix(in srgb, var(--a-color-bg) 75%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-mini-window:hover .player-mini-tooltip {
  opacity: 1;
  transform: translateY(0);
}

@media (min-width: 1440px) {
  .player-mini-cover {
    width: 4.5rem;
    height: 4.5rem;
  }

  .player-mini-expand {
    height: 4.5rem;
    width: 28px;
  }
}

@media (min-width: 768px) and (max-width: 1024px) {
  .player-mini-window {
    right: 0;
    left: auto;
  }
}

@media (max-width: 768px) {
  .player-mini-window {
    right: 0;
    left: auto;
    bottom: var(--a-mobile-nav-reserved-height);
    height: 3rem;
  }

  .player-mini-cover {
    width: 3rem;
    height: 3rem;
  }

  .player-mini-expand {
    height: 3rem;
    width: 24px;
  }
}
</style>
