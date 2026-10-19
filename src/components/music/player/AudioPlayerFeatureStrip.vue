<template>
  <div class="player-features">
    <!-- 歌词 / 说明切换 -->
    <button
      type="button"
      class="feature-link"
      aria-label="歌词"
      title="歌词"
      data-hint="歌词 (Shift+F)"
      @click="$emit('toggle-lyrics')"
    >
      <span>{{ featureLabel }}</span>
    </button>

    <!-- 歌曲评论 -->
    <button
      type="button"
      class="feature-link"
      aria-label="评论"
      title="评论"
      @click="$emit('open-comments')"
    >
      <span>评</span>
    </button>

    <!-- 音量控制 -->
    <AudioPlayerVolume
      :volume="volume"
      @change="$emit('set-volume', $event)"
      @toggle-mute="$emit('toggle-mute')"
    />

    <!-- 播放队列触发按钮 -->
    <button
      class="queue-trigger"
      :class="{ active: showQueue }"
      type="button"
      aria-label="播放队列"
      title="播放队列"
      @click="$emit('toggle-queue')"
    >
      <List :size="20" aria-hidden="true" />
      <span class="queue-count">{{ queueCount || 0 }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { List } from 'lucide-vue-next'
import AudioPlayerVolume from '@/components/music/AudioPlayerVolume.vue'

defineProps<{
  featureLabel: string
  volume: number
  showQueue: boolean
  queueCount: number
}>()

defineEmits<{
  (e: 'toggle-lyrics'): void
  (e: 'open-comments'): void
  (e: 'set-volume', volume: number): void
  (e: 'toggle-mute'): void
  (e: 'toggle-queue'): void
}>()
</script>

<style scoped>
.player-features {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  min-width: 0;
  font-family: var(--a-font-sans);
  font-weight: 950;
  font-size: 10px;
  letter-spacing: 0.1em;
  box-shadow: none !important;
}

.feature-link {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  opacity: 0.65;
  padding: 0 0.55rem;
  box-shadow: none !important;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.feature-link:hover {
  opacity: 1;
  background: var(--a-color-surface-muted);
}

.queue-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--a-color-muted);
  transition:
    color var(--a-motion-state, 0.15s) ease,
    background-color var(--a-motion-state, 0.15s) ease,
    opacity var(--a-motion-state, 0.15s) ease;
  padding: 4px 8px;
  border-radius: var(--a-radius-control, 4px);
  background: rgba(0, 0, 0, 0.05);
  border: none;
  box-shadow: none !important;
}

:root.dark .queue-trigger {
  background: rgba(255, 255, 255, 0.1);
}

.queue-trigger:hover {
  color: var(--a-color-text);
  background: var(--a-color-overlay-soft);
}

.queue-trigger.active {
  color: var(--a-color-text);
  background: var(--a-color-overlay-soft);
}

.queue-count {
  font-family: monospace;
  font-size: 9px;
  font-weight: 500;
  min-width: 14px;
  text-align: center;
}

/* Tooltip 快捷键提示 */
[data-hint] {
  position: relative;
}

[data-hint]::before {
  content: attr(data-hint);
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  padding: 4px 8px;
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  border-radius: var(--a-radius-control, 4px);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  box-shadow: none !important;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    visibility 0.18s ease;
  transition-delay: 0s;
  z-index: 999;
}

[data-hint]:hover::before {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
  transition-delay: 1.2s;
}

@media (hover: none) {
  [data-hint]::before {
    display: none !important;
  }
}

@media (max-width: 767px) {
  .player-features {
    margin-left: 0;
    gap: 0;
  }

  .queue-trigger {
    width: 44px;
    height: 44px;
  }

  .feature-link {
    width: 44px;
    min-width: 44px;
    height: 44px;
    padding: 0;
    opacity: 1;
    border-bottom: 0;
  }

  .feature-link span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
