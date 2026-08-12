<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Volume2,
  Volume1,
  VolumeX,
  Play,
  Pause,
  Maximize,
  Minimize,
  Settings,
  Tv,
  Captions
} from 'lucide-vue-next'
import type { VideoPreviewThumbnail } from '@/types'
import { formatTimestampLabel } from '@/composables/useMediaTimeAnchors'

const props = defineProps<{
  videoElement: HTMLVideoElement | null
  playerElement?: HTMLElement | null
  durationSec: number
  theaterMode?: boolean
  thumbnails?: VideoPreviewThumbnail[]
}>()

const emit = defineEmits<{
  toggleTheater: []
}>()

const isPlaying = ref(false)
const isMuted = ref(false)
const volume = ref(1)
const lastVolume = ref(1)
const playbackRate = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const bufferedTime = ref(0)
const hoverX = ref(0)
const hoverTime = ref<number | null>(null)
const isSeeking = ref(false)
const isFullscreen = ref(false)

let syncTimer: number | undefined
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

const progressPercent = computed(() => {
  if (!duration.value) return 0
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

const bufferedPercent = computed(() => {
  if (!duration.value) return 0
  return Math.min(100, Math.max(0, (bufferedTime.value / duration.value) * 100))
})

const hoverXClamped = computed(() => {
  return Math.min(92, Math.max(8, hoverX.value))
})

const activeThumbnail = computed(() => {
  if (hoverTime.value === null || !props.thumbnails?.length) return null
  const sorted = [...props.thumbnails].sort((a, b) => a.time_sec - b.time_sec)
  return [...sorted].reverse().find((item) => item.time_sec <= hoverTime.value!) ?? sorted[0]
})

function syncState() {
  const video = props.videoElement
  if (!video) return
  if (!isSeeking.value) {
    currentTime.value = video.currentTime || 0
  }
  duration.value = Number.isFinite(video.duration) ? video.duration : props.durationSec || 0
  isPlaying.value = !video.paused && !video.ended
  isMuted.value = video.muted
  volume.value = video.volume

  if (video.buffered.length > 0) {
    try {
      bufferedTime.value = video.buffered.end(video.buffered.length - 1)
    } catch {
      bufferedTime.value = 0
    }
  } else {
    bufferedTime.value = 0
  }

  playbackRate.value = video.playbackRate || 1
  isFullscreen.value = Boolean(document.fullscreenElement)
}

async function togglePlay() {
  const video = props.videoElement
  if (!video) return
  if (video.paused) {
    await video.play().catch(() => {})
  } else {
    video.pause()
  }
  syncState()
}

function seekFromPointer(event: PointerEvent | MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (!rect.width) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const nextTime = ratio * (duration.value || props.durationSec || 0)
  
  currentTime.value = nextTime
  const video = props.videoElement
  if (video) {
    video.currentTime = nextTime
  }
}

function updateHover(event: PointerEvent | MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (!rect.width) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  hoverX.value = ratio * 100
  hoverTime.value = ratio * (duration.value || props.durationSec || 0)
}

function startSeek(event: PointerEvent) {
  isSeeking.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  seekFromPointer(event)
  updateHover(event)
}

function dragSeek(event: PointerEvent) {
  if (!isSeeking.value) return
  seekFromPointer(event)
  updateHover(event)
}

function stopSeek(event: PointerEvent) {
  if (!isSeeking.value) return
  isSeeking.value = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
  syncState()
}

function toggleMute() {
  const video = props.videoElement
  if (!video) return
  if (video.muted || video.volume === 0) {
    video.muted = false
    video.volume = lastVolume.value > 0 ? lastVolume.value : 1
  } else {
    lastVolume.value = video.volume
    video.muted = true
  }
  syncState()
}

function updateVolume(event: Event) {
  const video = props.videoElement
  if (!video) return
  const nextVolume = Number((event.target as HTMLInputElement).value)
  video.volume = Math.min(1, Math.max(0, nextVolume))
  video.muted = video.volume === 0
  if (video.volume > 0) {
    lastVolume.value = video.volume
  }
  syncState()
}

function setPlaybackRate(value: number) {
  const video = props.videoElement
  if (!video) return
  video.playbackRate = value
  playbackRate.value = value
}

async function toggleFullscreen() {
  const target = props.playerElement || props.videoElement?.parentElement || props.videoElement
  if (!target) return
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {})
  } else {
    await target.requestFullscreen?.().catch(() => {})
  }
}

function handleFullscreenChange() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

onMounted(() => {
  syncState()
  syncTimer = window.setInterval(syncState, 250)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
})

onUnmounted(() => {
  if (syncTimer) window.clearInterval(syncTimer)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<template>
  <div class="vpc" @click.stop>
    <!-- 时间轴/进度条 -->
    <div
      class="vpc-timeline"
      @mousemove="updateHover"
      @mouseleave="hoverTime = null"
      @pointerdown="startSeek"
      @pointermove="dragSeek"
      @pointerup="stopSeek"
      @pointercancel="stopSeek"
    >
      <div class="vpc-timeline-track">
        <div class="vpc-buffer" :style="{ width: `${bufferedPercent}%` }" />
        <div class="vpc-progress" :style="{ width: `${progressPercent}%` }">
          <span class="vpc-scrubber-handle" />
        </div>
      </div>

      <!-- 浮动预览图与时间轴指示 -->
      <div v-if="hoverTime !== null" class="vpc-preview" :style="{ left: `${hoverXClamped}%` }">
        <img v-if="activeThumbnail" :src="activeThumbnail.url" alt="" class="vpc-preview-image" />
        <span class="vpc-preview-time">{{ formatTimestampLabel(Math.floor(hoverTime)) }}</span>
      </div>
    </div>

    <!-- 底部控制工具栏 -->
    <div class="vpc-bottom">
      <div class="vpc-left">
        <button
          class="vpc-icon-button vpc-play"
          type="button"
          :aria-label="isPlaying ? '暂停' : '播放'"
          @click="togglePlay"
        >
          <Pause v-if="isPlaying" :size="20" fill="currentColor" />
          <Play v-else :size="20" fill="currentColor" style="margin-left: 2px;" />
        </button>

        <span class="vpc-time">
          {{ formatTimestampLabel(Math.floor(currentTime)) }} / {{ formatTimestampLabel(Math.floor(duration || durationSec)) }}
        </span>
      </div>

      <div class="vpc-right">
        <!-- 画质 -->
        <button class="vpc-text-control" type="button" data-control="quality" disabled>
          1080P 高清
        </button>

        <!-- 倍速菜单 -->
        <div class="vpc-menu">
          <button
            class="vpc-text-control vpc-speed-trigger"
            type="button"
            aria-label="播放速度"
          >
            {{ playbackRate }}x
          </button>
          <div class="vpc-speed-menu">
            <button
              v-for="rate in playbackRates"
              :key="rate"
              class="vpc-speed-option"
              :class="{ 'vpc-speed-option--active': rate === playbackRate }"
              type="button"
              :data-speed="rate"
              @click="setPlaybackRate(rate)"
            >
              {{ rate }}x
            </button>
          </div>
        </div>

        <!-- 字幕 -->
        <button class="vpc-text-control" type="button" data-control="subtitle" disabled>
          <Captions :size="18" />
        </button>

        <!-- 音量图标与浮动音量条 -->
        <div class="vpc-volume-wrap">
          <button class="vpc-icon-button" type="button" :aria-label="isMuted || volume === 0 ? '取消静音' : '静音'" @click="toggleMute">
            <VolumeX v-if="isMuted || volume === 0" :size="20" class="vpc-vol-icon--muted" />
            <Volume1 v-else-if="volume < 0.5" :size="20" />
            <Volume2 v-else :size="20" />
          </button>

          <div class="vpc-volume-popover">
            <input
              class="vpc-volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.02"
              :value="isMuted ? 0 : volume"
              aria-label="音量调节"
              @input="updateVolume"
            />
          </div>
        </div>

        <!-- 设置 -->
        <button class="vpc-icon-button" type="button" data-control="settings" aria-label="设置" disabled>
          <Settings :size="18" />
        </button>

        <!-- 宽屏/剧院模式 -->
        <button class="vpc-icon-button vpc-text-control" type="button" :title="theaterMode ? '退出宽屏' : '宽屏'" @click="emit('toggleTheater')">
          <Tv :size="18" />
        </button>

        <!-- 全屏 -->
        <button class="vpc-icon-button" type="button" :aria-label="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
          <Minimize v-if="isFullscreen" :size="20" />
          <Maximize v-else :size="20" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vpc {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 1rem 0.6rem;
  color: #ffffff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.45) 60%, rgba(0, 0, 0, 0) 100%);
  font-family: var(--a-font-sans);
  opacity: 0;
  transform: translateY(0.5rem);
  transition: opacity 200ms ease, transform 200ms ease;
  pointer-events: none;
  z-index: 50;
}

.vpc:hover,
.vpc:focus-within,
.vpc:has(.vpc-timeline:active) {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* 进度条与拖拽区域 */
.vpc-timeline {
  position: relative;
  height: 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}

.vpc-timeline-track {
  position: relative;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  transition: height 150ms ease;
}

.vpc-timeline:hover .vpc-timeline-track,
.vpc-timeline:active .vpc-timeline-track {
  height: 6px;
}

.vpc-buffer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  pointer-events: none;
}

.vpc-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--a-color-primary, #3b82f6);
  border-radius: 999px;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.vpc-scrubber-handle {
  width: 12px;
  height: 12px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
  transform: scale(0);
  transition: transform 150ms ease;
  margin-right: -6px;
}

.vpc-timeline:hover .vpc-scrubber-handle,
.vpc-timeline:active .vpc-scrubber-handle {
  transform: scale(1.25);
}

/* 悬浮画面与时间预览 */
.vpc-preview {
  position: absolute;
  bottom: calc(100% + 8px);
  padding: 0.35rem;
  color: #ffffff;
  text-align: center;
  pointer-events: none;
  background: rgba(18, 18, 20, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  transform: translateX(-50%);
  z-index: 60;
}

.vpc-preview-image {
  display: block;
  width: 140px;
  height: 80px;
  margin-bottom: 0.25rem;
  object-fit: cover;
  border-radius: 4px;
}

.vpc-preview-time {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* 控制条布局 */
.vpc-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  height: 2.2rem;
}

.vpc-left,
.vpc-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.vpc-icon-button,
.vpc-text-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 2rem;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: color 150ms ease, opacity 150ms ease;
  padding: 0 0.25rem;
}

.vpc-icon-button:hover,
.vpc-icon-button:focus-visible,
.vpc-text-control:hover,
.vpc-text-control:focus-visible {
  color: #ffffff;
  opacity: 1;
  outline: none;
}

.vpc-text-control {
  font-weight: 600;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.vpc-text-control:disabled,
.vpc-icon-button:disabled {
  cursor: default;
  opacity: 0.45;
}

.vpc-time {
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.85);
  margin-left: 0.25rem;
}

/* 菜单与 Popover */
.vpc-menu,
.vpc-volume-wrap {
  position: relative;
}

.vpc-vol-icon--muted {
  color: #ef4444;
}

.vpc-speed-menu,
.vpc-volume-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.5rem);
  background: rgba(18, 18, 20, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  transform: translate(-50%, 0.25rem);
  opacity: 0;
  transition: opacity 160ms ease, transform 160ms ease;
  pointer-events: none;
  z-index: 60;
}

.vpc-speed-menu {
  display: flex;
  flex-direction: column;
  padding: 0.35rem;
  min-width: 4.5rem;
}

.vpc-menu:hover .vpc-speed-menu,
.vpc-menu:focus-within .vpc-speed-menu {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
}

.vpc-speed-option {
  padding: 0.35rem 0.6rem;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
  border-radius: 4px;
  transition: all 120ms ease;
}

.vpc-speed-option:hover,
.vpc-speed-option--active {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-weight: 700;
}

/* 音量滑动条 */
.vpc-volume-popover {
  padding: 0.75rem 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 110px;
}

.vpc-volume-wrap:hover .vpc-volume-popover,
.vpc-volume-wrap:focus-within .vpc-volume-popover {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
}

.vpc-volume-slider {
  width: 80px;
  height: 4px;
  accent-color: var(--a-color-primary, #3b82f6);
  cursor: pointer;
  transform: rotate(-90deg);
  background: rgba(255, 255, 255, 0.25);
  border-radius: 999px;
}

@media (max-width: 720px) {
  .vpc-time,
  .vpc-volume-wrap,
  [data-control="quality"],
  [data-control="subtitle"],
  [data-control="settings"] {
    display: none;
  }

  .vpc-bottom {
    gap: 0.5rem;
  }

  .vpc-right {
    gap: 0.5rem;
  }
}
</style>
