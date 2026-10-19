<template>
  <div class="player-controls-hub">
    <div class="ctrl-row">
      <!-- 播客模式下的后退 15 秒 -->
      <button
        v-if="isPodcast"
        type="button"
        class="skip-btn"
        aria-label="后退 15 秒"
        title="后退 15 秒"
        data-hint="后退 15S (←)"
        @click="$emit('skip', -15)"
      >
        -15S
      </button>

      <!-- 上一首 -->
      <button
        type="button"
        class="nav-btn"
        aria-label="上一首"
        title="上一首"
        data-hint="上一首 (Alt+←)"
        @click="$emit('play-previous')"
      >
        上一首
      </button>

      <!-- 主播放/暂停/错误重试按键 -->
      <button
        type="button"
        class="main-play-btn"
        :class="{ 'has-error': Boolean(playbackError) }"
        :aria-label="playbackError ? '重试播放' : (isPlaying ? '暂停' : '播放')"
        :title="playbackError ? '音频加载失败，点击重试' : (isPlaying ? '暂停' : '播放')"
        :data-hint="playbackError ? '重试' : (isPlaying ? '暂停 (Space)' : '播放 (Space)')"
        @click="playbackError ? $emit('retry-playback') : $emit('toggle-play')"
      >
        {{ playbackError ? '重试' : (isPlaying ? '暂停' : '播放') }}
      </button>

      <!-- 下一首 -->
      <button
        type="button"
        class="nav-btn"
        aria-label="下一首"
        title="下一首"
        data-hint="下一首 (Alt+→)"
        @click="$emit('play-next')"
      >
        下一首
      </button>

      <!-- 播客模式下的前进 15 秒 -->
      <button
        v-if="isPodcast"
        type="button"
        class="skip-btn"
        aria-label="前进 15 秒"
        title="前进 15 秒"
        data-hint="前进 15S (→)"
        @click="$emit('skip', 15)"
      >
        +15S
      </button>

      <!-- 播客模式下的倍速切换 -->
      <button
        v-if="isPodcast"
        type="button"
        class="feature-toggle player-rate-btn"
        aria-label="倍速播放"
        :title="`倍速播放 (${playbackRate}x)`"
        :data-hint="`倍速 ${playbackRate}x`"
        @click="$emit('cycle-rate')"
      >
        <span>{{ playbackRate }}x</span>
      </button>

      <!-- 音乐模式下的循环/单曲/随机模式切换 -->
      <button
        v-else
        type="button"
        class="feature-toggle player-mode-btn"
        aria-label="切换播放模式"
        title="切换播放模式"
        data-hint="播放模式"
        @click="$emit('cycle-mode')"
      >
        <div v-if="playbackMode === 'single'" class="repeat-one-wrapper">
          <Repeat :size="20" aria-hidden="true" />
          <span class="one-badge">1</span>
        </div>
        <span v-else style="display: flex; align-items: center">
          <Repeat v-if="playbackMode === 'loop'" :size="20" aria-hidden="true" />
          <Shuffle v-else-if="playbackMode === 'random'" :size="20" aria-hidden="true" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Repeat, Shuffle } from 'lucide-vue-next'

interface Props {
  isPlaying: boolean
  playbackError?: string | null | unknown
  isPodcast?: boolean
  playbackRate?: number
  playbackMode?: 'loop' | 'single' | 'random'
}

withDefaults(defineProps<Props>(), {
  isPodcast: false,
  playbackRate: 1,
  playbackMode: 'loop',
})

defineEmits<{
  (e: 'skip', seconds: number): void
  (e: 'play-previous'): void
  (e: 'toggle-play'): void
  (e: 'retry-playback'): void
  (e: 'play-next'): void
  (e: 'cycle-rate'): void
  (e: 'cycle-mode'): void
}>()
</script>

<style scoped>
.player-controls-hub {
  display: flex;
  align-items: center;
  min-width: 0;
  box-shadow: none !important;
}

.ctrl-row {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: clamp(0.25rem, 0.8vw, 0.75rem);
  font-family: var(--a-font-sans);
  font-weight: 950;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: inherit;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.skip-btn,
.nav-btn,
.main-play-btn {
  flex-shrink: 0;
}

.skip-btn,
.nav-btn {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.5;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none !important;
  transition:
    opacity 0.2s,
    color 0.2s;
}

.skip-btn:hover,
.nav-btn:hover {
  opacity: 1;
  text-decoration: underline;
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

.main-play-btn {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  padding: 4px 16px;
  font-weight: 500;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0;
  box-shadow: none !important;
  transition:
    transform 0.1s,
    background-color 0.15s;
}

.main-play-btn:active {
  transform: translateY(1px);
}

.main-play-btn.has-error {
  background: var(--a-color-danger, #ef4444);
  color: #fff;
  animation: pulse-subtle 1.8s infinite;
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.82; }
}

.feature-toggle {
  cursor: pointer;
  display: flex;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 4px;
  color: var(--a-color-muted);
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none !important;
  transition: color 0.2s;
}

.feature-toggle:hover {
  color: var(--a-color-text);
}

.player-rate-btn {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: var(--a-radius-control, 4px);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  line-height: 1.2;
  box-shadow: none !important;
}

.player-rate-btn:hover {
  background: var(--a-color-border-soft);
}

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
  font-family: var(--a-font-sans);
  color: currentColor;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -45%);
  line-height: 1;
}

@media (max-width: 767px) {
  .nav-btn,
  .feature-toggle:not(.player-mode-btn) {
    display: none;
  }

  .player-controls-hub {
    position: static;
    transform: none;
    width: auto;
    min-width: 0;
  }

  .ctrl-row {
    gap: 0.25rem;
  }

  .skip-btn {
    width: 32px;
    height: 44px;
    padding: 0;
    opacity: 1;
  }

  .main-play-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    white-space: nowrap;
  }
}
</style>
