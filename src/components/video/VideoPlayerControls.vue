<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { VideoPreviewThumbnail } from '@/types'
import { formatTimestampLabel } from '@/composables/useVideoTimestamp'

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
const playbackRate = ref(1)
const currentTime = ref(0)
const duration = ref(0)
const hoverX = ref(0)
const hoverTime = ref<number | null>(null)
const isSeeking = ref(false)

let syncTimer: number | undefined
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

const progressPercent = computed(() => {
  if (!duration.value) return 0
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

const activeThumbnail = computed(() => {
  if (hoverTime.value === null || !props.thumbnails?.length) return null
  const sorted = [...props.thumbnails].sort((a, b) => a.time_sec - b.time_sec)
  return [...sorted].reverse().find((item) => item.time_sec <= hoverTime.value!) ?? sorted[0]
})

function syncState() {
  const video = props.videoElement
  if (!video) return
  currentTime.value = Math.floor(video.currentTime || 0)
  duration.value = Number.isFinite(video.duration) ? Math.floor(video.duration) : props.durationSec || 0
  isPlaying.value = !video.paused && !video.ended
  isMuted.value = video.muted
  volume.value = video.volume
  playbackRate.value = video.playbackRate || 1
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
  const video = props.videoElement
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const nextTime = Math.floor(ratio * (duration.value || props.durationSec || 0))
  if (video) video.currentTime = nextTime
  currentTime.value = nextTime
}

function updateHover(event: PointerEvent | MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  hoverX.value = ratio * 100
  hoverTime.value = Math.floor(ratio * (duration.value || props.durationSec || 0))
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
}

function toggleMute() {
  const video = props.videoElement
  if (!video) return
  video.muted = !video.muted
  syncState()
}

function updateVolume(event: Event) {
  const video = props.videoElement
  if (!video) return
  const nextVolume = Number((event.target as HTMLInputElement).value)
  video.volume = Math.min(1, Math.max(0, nextVolume))
  video.muted = video.volume === 0
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

onMounted(() => {
  syncState()
  syncTimer = window.setInterval(syncState, 500)
})

onUnmounted(() => {
  if (syncTimer) window.clearInterval(syncTimer)
})
</script>

<template>
  <div class="vpc" @click.stop>
    <div
      class="vpc-timeline"
      @mousemove="updateHover"
      @mouseleave="hoverTime = null"
      @pointerdown="startSeek"
      @pointermove="dragSeek"
      @pointerup="stopSeek"
      @pointercancel="stopSeek"
    >
      <div class="vpc-progress" :style="{ width: `${progressPercent}%` }" />
      <div v-if="hoverTime !== null" class="vpc-preview" :style="{ left: `${hoverX}%` }">
        <img v-if="activeThumbnail" :src="activeThumbnail.url" alt="" class="vpc-preview-image" />
        <span>{{ formatTimestampLabel(hoverTime) }}</span>
      </div>
    </div>

    <div class="vpc-bottom">
      <div class="vpc-left">
        <button class="vpc-icon-button vpc-play" type="button" :aria-label="isPlaying ? '暂停' : '播放'" @click="togglePlay">
          <span v-if="isPlaying" class="vpc-pause-mark" />
          <span v-else class="vpc-play-mark" />
        </button>

        <span class="vpc-time">
          {{ formatTimestampLabel(currentTime) }} / {{ formatTimestampLabel(duration || durationSec) }}
        </span>
      </div>

      <div class="vpc-right">
        <button class="vpc-text-control" type="button" data-control="quality" disabled>
          1080P 高清
        </button>

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

        <button class="vpc-text-control" type="button" data-control="subtitle" disabled>
          字幕
        </button>

        <div class="vpc-volume-wrap">
          <button class="vpc-icon-button" type="button" :aria-label="isMuted ? '取消静音' : '静音'" @click="toggleMute">
            <span class="vpc-volume-mark" :class="{ 'vpc-volume-mark--muted': isMuted || volume === 0 }" />
          </button>
          <div class="vpc-volume-popover">
            <input
              class="vpc-volume"
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="isMuted ? 0 : volume"
              aria-label="音量"
              @input="updateVolume"
            />
          </div>
        </div>

        <button class="vpc-icon-button" type="button" data-control="settings" aria-label="设置" disabled>
          <span class="vpc-gear-mark" />
          <span class="vpc-sr-only">设置</span>
        </button>
        <button class="vpc-text-control" type="button" @click="emit('toggleTheater')">
          {{ theaterMode ? '退出宽屏' : '宽屏' }}
        </button>
        <button class="vpc-icon-button" type="button" aria-label="全屏" @click="toggleFullscreen">
          <span class="vpc-fullscreen-mark" />
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
  gap: 0.24rem;
  padding: 0.45rem 1rem 0.55rem;
  color: var(--a-color-paper);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.86), rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0));
  font-family: var(--a-font-meta);
  opacity: 0;
  transform: translateY(0.65rem);
  transition: opacity 160ms ease, transform 160ms ease;
  pointer-events: none;
}

.vpc:hover,
.vpc:focus-within,
.vpc:has(.vpc-timeline:active) {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.vpc-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 2.1rem;
}

.vpc-left,
.vpc-right {
  display: flex;
  align-items: center;
  gap: 0.74rem;
  min-width: 0;
}

.vpc-icon-button,
.vpc-text-control {
  height: 1.7rem;
  border: 0;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  opacity: 0.88;
}

.vpc-icon-button:hover,
.vpc-icon-button:focus-visible,
.vpc-text-control:hover,
.vpc-text-control:focus-visible {
  opacity: 1;
  outline: none;
}

.vpc-text-control {
  padding: 0;
  font-weight: 800;
  font-size: 0.76rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.vpc-text-control:disabled,
.vpc-icon-button:disabled {
  cursor: default;
  opacity: 0.72;
}

.vpc-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  padding: 0;
}

.vpc-play {
  width: 2rem;
}

.vpc-play-mark {
  width: 0;
  height: 0;
  border-top: 0.43rem solid transparent;
  border-bottom: 0.43rem solid transparent;
  border-left: 0.72rem solid currentColor;
  transform: translateX(0.08rem);
}

.vpc-pause-mark {
  width: 0.72rem;
  height: 0.86rem;
  border-right: 0.24rem solid currentColor;
  border-left: 0.24rem solid currentColor;
}

.vpc-volume-mark {
  position: relative;
  width: 1rem;
  height: 0.72rem;
  border-left: 0.32rem solid currentColor;
  border-top: 0.2rem solid transparent;
  border-bottom: 0.2rem solid transparent;
}

.vpc-volume-mark::after {
  position: absolute;
  top: -0.18rem;
  left: 0.34rem;
  width: 0.48rem;
  height: 0.72rem;
  content: '';
  border-right: 0.18rem solid currentColor;
  border-radius: 50%;
}

.vpc-volume-mark--muted::after {
  display: none;
}

.vpc-gear-mark {
  width: 0.9rem;
  height: 0.9rem;
  border: 0.18rem solid currentColor;
  border-radius: 50%;
  box-shadow: 0 -0.42rem 0 -0.28rem currentColor, 0 0.42rem 0 -0.28rem currentColor, 0.42rem 0 0 -0.28rem currentColor, -0.42rem 0 0 -0.28rem currentColor;
}

.vpc-fullscreen-mark {
  width: 1rem;
  height: 1rem;
  border: 0.16rem solid currentColor;
  box-shadow: inset 0 0 0 0.16rem rgba(0, 0, 0, 0.48);
}

.vpc-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip: rect(0 0 0 0);
}

.vpc-timeline {
  position: relative;
  height: 0.58rem;
  cursor: pointer;
}

.vpc-timeline::before,
.vpc-progress {
  position: absolute;
  top: 50%;
  left: 0;
  height: 0.14rem;
  content: '';
  transform: translateY(-50%);
  transition: height 120ms ease;
}

.vpc-timeline:hover::before,
.vpc-timeline:hover .vpc-progress {
  height: 0.24rem;
}

.vpc-timeline::before {
  right: 0;
  background: rgba(255, 255, 255, 0.34);
}

.vpc-progress {
  background: var(--a-color-paper);
}

.vpc-preview {
  position: absolute;
  bottom: 1.75rem;
  min-width: 4.25rem;
  padding: 0.35rem;
  color: #fff;
  text-align: center;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.22);
  transform: translateX(-50%);
}

.vpc-preview-image {
  display: block;
  width: 160px;
  height: 90px;
  margin-bottom: 0.25rem;
  object-fit: cover;
}

.vpc-time {
  min-width: 7.5rem;
  font-size: 0.78rem;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.82);
}

.vpc-menu,
.vpc-volume-wrap {
  position: relative;
}

.vpc-speed-menu,
.vpc-volume-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.45rem);
  padding: 0.35rem;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.28);
  transform: translate(-50%, 0.25rem);
}

.vpc-speed-menu {
  display: grid;
  gap: 0.2rem;
  min-width: 4.5rem;
  opacity: 0;
  transition: opacity 140ms ease, transform 140ms ease;
  pointer-events: none;
}

.vpc-menu:hover .vpc-speed-menu,
.vpc-menu:focus-within .vpc-speed-menu {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
}

.vpc-speed-option {
  height: 1.6rem;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  text-align: left;
}

.vpc-speed-option:hover,
.vpc-speed-option--active {
  background: #fff;
  color: #000;
}

.vpc-volume-popover {
  display: flex;
  justify-content: center;
  width: 1.4rem;
  height: 6.5rem;
  opacity: 0;
  transition: opacity 140ms ease, transform 140ms ease;
  pointer-events: none;
}

.vpc-volume-wrap:hover .vpc-volume-popover,
.vpc-volume-wrap:focus-within .vpc-volume-popover {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
}

.vpc-volume {
  width: 5.6rem;
  height: 0.18rem;
  accent-color: var(--a-color-paper);
  writing-mode: vertical-lr;
  direction: rtl;
}

@media (max-width: 720px) {
  .vpc-time,
  .vpc-volume-wrap,
  [data-control="quality"],
  [data-control="subtitle"],
  [data-control="settings"],
  .vpc-text-control:nth-last-child(2) {
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
