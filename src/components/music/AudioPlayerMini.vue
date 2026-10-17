<template>
  <div
    class="player-mini-window"
    data-player-mode="cover"
  >
    <button
      type="button"
      class="player-mini-cover"
      :aria-label="isPlaying ? '暂停播放' : '继续播放'"
      :title="isPlaying ? '暂停播放' : '继续播放'"
      @click="$emit('toggle-play')"
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
  isPlaying: boolean
  miniProgressPercent: number
}>()

defineEmits<{
  'toggle-play': []
  'expand': []
}>()
</script>

<style scoped>
.player-mini-window {
  position: fixed;
  right: 0;
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
  border: 1px solid var(--a-color-border-soft);
  border-right: 0;
  border-radius: 0;
  background: var(--a-color-bg);
  box-shadow: var(--a-shadow-md);
}

.player-mini-cover {
  position: relative;
  display: block;
  width: 4.5rem;
  height: 4.5rem;
  padding: 0;
  border: 0;
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
  border: 1px solid var(--a-color-border-soft);
  border-right: 0;
  border-radius: 0;
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

@media (max-width: 768px) {
  .player-mini-window {
    right: 0;
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
