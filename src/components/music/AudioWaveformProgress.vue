<template>
  <div
    ref="rootRef"
    class="waveform-progress"
    :class="{
      'waveform-progress--fallback': !peaks.length,
      'is-hovering': isHovering,
      'is-dragging': dragging,
    }"
    @pointerdown="startSeek"
    @pointermove="movePointer"
    @pointerup="stopSeek"
    @pointercancel="stopSeek"
    @pointerenter="isHovering = true"
    @pointerleave="leavePointer"
  >
    <div
      ref="trackRef"
      class="waveform-track"
      :style="{ '--waveform-time-pad': `${hoverClampPadding}px` }"
    >
      <svg
        v-if="peaks.length"
        class="waveform-shape"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path class="waveform-shape__unplayed" :d="waveformPath" />
        <path
          v-if="bufferedRatio > 0"
          class="waveform-shape__buffered"
          :d="waveformPath"
          :style="{ clipPath: `inset(0 ${100 - bufferedRatio * 100}% 0 0)` }"
        />
        <path
          class="waveform-shape__played"
          :d="waveformPath"
          :style="{ clipPath: `inset(0 ${100 - displayRatio * 100}% 0 0)` }"
        />
      </svg>
      <div v-else class="waveform-fallback-line" aria-hidden="true">
        <span v-if="bufferedRatio > 0" class="waveform-fallback-buffer" :style="{ width: `${bufferedRatio * 100}%` }" />
        <span :style="{ width: `${displayRatio * 100}%` }" />
      </div>
      <div class="waveform-mobile-line" aria-hidden="true">
        <span :style="{ width: `${displayRatio * 100}%` }" />
      </div>

      <span
        class="waveform-playhead"
        aria-hidden="true"
        :style="{ left: `${displayRatio * 100}%` }"
      />
      <template v-if="hoverRatio !== null">
        <span
          class="waveform-hover-line"
          aria-hidden="true"
          :style="{ left: `${hoverRatio * 100}%` }"
        />
        <span
          class="waveform-time waveform-time--hover"
          :class="timePositionClass(hoverRatio)"
          :data-hover-ratio="hoverRatio"
          :style="hoverTooltipStyle"
        >
          {{ formatTime(hoverRatio * duration) }}
        </span>
      </template>

      <input
        class="waveform-range"
        type="range"
        min="0"
        :max="duration || 0"
        step="0.1"
        :value="currentTime"
        :disabled="!duration"
        aria-label="播放进度"
        :aria-valuetext="`${formatTime(currentTime)} / ${formatTime(duration)}`"
        @input="handleRangeInput"
      />
    </div>
    <output class="waveform-duration" data-testid="waveform-duration" aria-label="播放时间">
      {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
    </output>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { generateWaveformPlaceholder } from '@/utils/audioWaveform'

const props = withDefaults(defineProps<{
  songId: string
  audioUrl: string
  waveformPeaks?: number[]
  currentTime: number
  bufferedTime?: number
  duration: number
  generateWaveform?: boolean
}>(), {
  bufferedTime: 0,
  generateWaveform: true,
})

const emit = defineEmits<{
  seek: [seconds: number]
}>()

const rootRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const isHovering = ref(false)
const dragging = ref(false)
const hoverRatio = ref<number | null>(null)
const lastCommittedRatio = ref<number | null>(null)
const pendingSeekRatio = ref<number | null>(null)
let pendingSeekTimeout: ReturnType<typeof setTimeout> | null = null
const waveformPeakCount = 280

function clearPendingSeekTimeout() {
  if (pendingSeekTimeout !== null) {
    clearTimeout(pendingSeekTimeout)
    pendingSeekTimeout = null
  }
}

function clearPendingSeekAfterTimeout() {
  clearPendingSeekTimeout()
  pendingSeekTimeout = setTimeout(() => {
    pendingSeekRatio.value = null
    pendingSeekTimeout = null
  }, 400)
}

onBeforeUnmount(() => {
  clearPendingSeekTimeout()
})

watch(() => props.currentTime, (time) => {
  if (pendingSeekRatio.value !== null && props.duration > 0) {
    const currentRatio = time / props.duration
    if (Math.abs(currentRatio - pendingSeekRatio.value) < 0.02) {
      pendingSeekRatio.value = null
      clearPendingSeekTimeout()
    }
  }
})

const peaks = computed(() => {
  if (!props.generateWaveform) return []
  const stored = props.waveformPeaks
    ?.filter((peak) => Number.isFinite(peak))
    .map((peak) => Math.max(0.08, Math.min(1, peak / 100)))
  return stored?.length === waveformPeakCount
    ? stored
    : generateWaveformPlaceholder(props.songId, waveformPeakCount)
})

const progressRatio = computed(() => {
  if (!props.duration) return 0
  return Math.min(1, Math.max(0, props.currentTime / props.duration))
})

const bufferedRatio = computed(() => {
  if (!props.duration || !props.bufferedTime) return 0
  return Math.min(1, Math.max(0, props.bufferedTime / props.duration))
})

const displayRatio = computed(() => {
  if (dragging.value && hoverRatio.value !== null) {
    return hoverRatio.value
  }
  if (pendingSeekRatio.value !== null) {
    return pendingSeekRatio.value
  }
  return progressRatio.value
})

const waveformPathCache = new Map<string, string>()
const MAX_CACHE_SIZE = 50

function getCachedWaveformPath(songId: string, peakList: number[]): string {
  if (!peakList.length) return ''
  const cacheKey = `${songId}_${peakList.length}_${peakList[0]?.toFixed(2)}_${peakList[peakList.length - 1]?.toFixed(2)}`
  const cached = waveformPathCache.get(cacheKey)
  if (cached) return cached

  const width = 1000
  const center = 50
  const amplitude = 42
  const lastIndex = Math.max(1, peakList.length - 1)
  const pathParts: string[] = []
  for (let i = 0; i < peakList.length; i++) {
    const peak = peakList[i]
    const x = Math.round((i / lastIndex) * width * 100) / 100
    const safePeak = Number.isFinite(peak) ? Math.min(1, Math.max(0.08, peak)) : 0.08
    const top = Math.round((center - safePeak * amplitude) * 100) / 100
    const bottom = Math.round((center + safePeak * amplitude) * 100) / 100
    pathParts.push(`M ${x} ${top} L ${x} ${bottom}`)
  }
  const result = pathParts.join(' ')

  if (waveformPathCache.size >= MAX_CACHE_SIZE) {
    const firstKey = waveformPathCache.keys().next().value
    if (firstKey) waveformPathCache.delete(firstKey)
  }
  waveformPathCache.set(cacheKey, result)
  return result
}

const waveformPath = computed(() => {
  return getCachedWaveformPath(props.songId, peaks.value)
})

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const totalSeconds = Math.floor(safeSeconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainder = totalSeconds % 60
  const tail = remainder.toString().padStart(2, '0')
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${tail}`
    : `${minutes}:${tail}`
}

const hoverClampPadding = computed(() => (props.duration >= 3600 ? 32 : 24))

const hoverTooltipStyle = computed(() => {
  if (hoverRatio.value === null) return {}
  const pad = hoverClampPadding.value
  return {
    left: `clamp(${pad}px, ${(hoverRatio.value * 100).toFixed(2)}%, calc(100% - ${pad}px))`,
  }
})

function timePositionClass(ratio: number) {
  if (ratio < 0.08) return 'waveform-time--start'
  if (ratio > 0.92) return 'waveform-time--end'
  return ''
}

function pointerRatio(event: PointerEvent) {
  const trackRect = trackRef.value?.getBoundingClientRect()
  const rect = trackRect?.width ? trackRect : rootRef.value?.getBoundingClientRect()
  if (!rect?.width) return 0
  return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
}

function seekFromPointer(event: PointerEvent) {
  if (!props.duration) return
  const ratio = pointerRatio(event)
  hoverRatio.value = ratio
  lastCommittedRatio.value = ratio
  pendingSeekRatio.value = ratio
  clearPendingSeekAfterTimeout()
  emit('seek', ratio * props.duration)
}

function startSeek(event: PointerEvent) {
  if (!props.duration) return
  dragging.value = true
  isHovering.value = true
  rootRef.value?.setPointerCapture?.(event.pointerId)
  seekFromPointer(event)
}

function movePointer(event: PointerEvent) {
  isHovering.value = true
  hoverRatio.value = pointerRatio(event)
}

function stopSeek(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  if (rootRef.value?.hasPointerCapture?.(event.pointerId)) rootRef.value.releasePointerCapture?.(event.pointerId)
  if (props.duration && hoverRatio.value !== null) {
    const targetRatio = hoverRatio.value
    if (lastCommittedRatio.value === null || Math.abs(targetRatio - lastCommittedRatio.value) >= 0.005) {
      lastCommittedRatio.value = targetRatio
      pendingSeekRatio.value = targetRatio
      clearPendingSeekAfterTimeout()
      emit('seek', targetRatio * props.duration)
    } else {
      pendingSeekRatio.value = lastCommittedRatio.value
      clearPendingSeekAfterTimeout()
    }
  }
}

function leavePointer() {
  if (!dragging.value) {
    isHovering.value = false
    hoverRatio.value = null
  }
}

function handleRangeInput(event: Event) {
  emit('seek', Number((event.target as HTMLInputElement).value))
}

</script>

<style scoped>
.waveform-progress {
  position: relative;
  width: 100%;
  height: 34px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.waveform-track {
  position: relative;
  min-width: 0;
  height: 34px;
  display: flex;
  align-items: center;
}

.waveform-shape {
  display: block;
  width: 100%;
  height: 20px;
  overflow: hidden;
  transition: height 240ms cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: center center;
}

.waveform-progress:hover .waveform-shape,
.waveform-progress.is-hovering .waveform-shape,
.waveform-progress.is-dragging .waveform-shape {
  height: 26px;
}

.waveform-shape__unplayed,
.waveform-shape__buffered,
.waveform-shape__played {
  fill: none;
  stroke-linecap: round;
  stroke-width: 1.4px;
  vector-effect: non-scaling-stroke;
  transition: stroke 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.waveform-shape__unplayed {
  stroke: color-mix(in srgb, var(--a-color-muted) 28%, transparent);
}

.waveform-progress:hover .waveform-shape__unplayed,
.waveform-progress.is-hovering .waveform-shape__unplayed {
  stroke: color-mix(in srgb, var(--a-color-muted) 38%, transparent);
}

.waveform-shape__buffered {
  stroke: color-mix(in srgb, var(--a-color-muted) 55%, transparent);
  transition: clip-path 120ms ease-out, stroke 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.waveform-progress:hover .waveform-shape__buffered,
.waveform-progress.is-hovering .waveform-shape__buffered {
  stroke: color-mix(in srgb, var(--a-color-muted) 65%, transparent);
}

.waveform-shape__played {
  stroke: color-mix(in srgb, var(--a-color-primary) 82%, transparent);
  transition: clip-path 80ms linear, stroke 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.waveform-progress:hover .waveform-shape__played,
.waveform-progress.is-hovering .waveform-shape__played {
  stroke: var(--a-color-primary);
}

.waveform-fallback-line {
  position: relative;
  width: 100%;
  height: 2px;
  background: var(--a-color-border-soft);
  border-radius: 1px;
  transition: height 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.waveform-progress:hover .waveform-fallback-line,
.waveform-progress.is-hovering .waveform-fallback-line,
.waveform-progress.is-dragging .waveform-fallback-line {
  height: 4px;
}

.waveform-fallback-buffer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  height: 100%;
  background: color-mix(in srgb, var(--a-color-muted) 45%, transparent);
  pointer-events: none;
  transition: width 120ms ease-out;
}

.waveform-fallback-line span {
  position: relative;
  display: block;
  height: 100%;
  background: var(--a-color-primary);
}

.waveform-mobile-line {
  display: none;
}

.waveform-playhead,
.waveform-hover-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-0.5px);
  pointer-events: none;
}

.waveform-playhead {
  background: var(--a-color-primary);
  z-index: 1;
}

.waveform-playhead::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--a-color-primary);
  content: '';
  transform: translate(-50%, -50%);
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.waveform-progress:hover .waveform-playhead::after,
.waveform-progress.is-hovering .waveform-playhead::after {
  transform: translate(-50%, -50%) scale(1.25);
}

.waveform-progress.is-dragging .waveform-playhead::after {
  transform: translate(-50%, -50%) scale(1.4);
}

.waveform-hover-line {
  background: var(--a-color-fg);
  opacity: 0.55;
  z-index: 2;
  animation: waveform-line-in 140ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.waveform-progress.is-dragging .waveform-hover-line {
  opacity: 0;
}

@keyframes waveform-line-in {
  from { opacity: 0; }
  to { opacity: 0.55; }
}

.waveform-time {
  position: absolute;
  z-index: 3;
  min-width: 38px;
  padding: 2px 6px;
  transform: translateX(-50%);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 14px;
  text-align: center;
  pointer-events: none;
  white-space: nowrap;
  user-select: none;
}

.waveform-time--hover {
  bottom: calc(100% + 4px);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control, 4px);
  box-shadow: none !important;
  animation: waveform-tooltip-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.waveform-time--start,
.waveform-time--end {
  transform: translateX(-50%);
}

@keyframes waveform-tooltip-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

.waveform-range {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.waveform-duration {
  min-width: 74px;
  color: var(--a-color-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 16px;
  text-align: right;
  white-space: nowrap;
  pointer-events: none;
}

.waveform-range:focus-visible + * {
  outline: none;
}

.waveform-progress:has(.waveform-range:focus-visible) {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .waveform-progress {
    height: 24px;
    gap: 8px;
  }

  .waveform-track {
    height: 24px;
  }

  .waveform-shape,
  .waveform-fallback-line {
    display: none;
  }

  .waveform-mobile-line {
    display: block;
    width: 100%;
    height: 2px;
    overflow: hidden;
    background: var(--a-color-border-soft);
  }

  .waveform-mobile-line span {
    display: block;
    height: 100%;
    background: var(--a-color-primary);
  }

  .waveform-time { display: none; }

  .waveform-duration {
    min-width: 68px;
    font-size: 9px;
  }
}

</style>
