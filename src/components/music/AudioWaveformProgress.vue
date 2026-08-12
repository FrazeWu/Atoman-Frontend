<template>
  <div
    ref="rootRef"
    class="waveform-progress"
    :class="{ 'waveform-progress--fallback': !peaks.length }"
    @pointerdown="startSeek"
    @pointermove="movePointer"
    @pointerup="stopSeek"
    @pointercancel="stopSeek"
    @pointerleave="leavePointer"
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
        class="waveform-shape__played"
        :d="waveformPath"
        :style="{ clipPath: `inset(0 ${100 - progressRatio * 100}% 0 0)` }"
      />
    </svg>
    <div v-else class="waveform-fallback-line" aria-hidden="true">
      <span :style="{ width: `${progressRatio * 100}%` }" />
    </div>
    <div class="waveform-mobile-line" aria-hidden="true">
      <span :style="{ width: `${progressRatio * 100}%` }" />
    </div>

    <span
      class="waveform-playhead"
      aria-hidden="true"
      :style="{ left: `${progressRatio * 100}%` }"
    />
    <template v-if="hoverRatio !== null">
      <span class="waveform-hover-line" aria-hidden="true" :style="{ left: `${hoverRatio * 100}%` }" />
      <span
        class="waveform-time waveform-time--hover"
        :class="timePositionClass(hoverRatio)"
        :style="{ left: `${hoverRatio * 100}%` }"
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { generateWaveformPlaceholder } from '@/utils/audioWaveform'

const props = withDefaults(defineProps<{
  songId: string
  audioUrl: string
  waveformPeaks?: number[]
  currentTime: number
  duration: number
  generateWaveform?: boolean
}>(), {
  generateWaveform: true,
})

const emit = defineEmits<{
  seek: [seconds: number]
}>()

const rootRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const hoverRatio = ref<number | null>(null)
const waveformPeakCount = 280

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

const waveformPath = computed(() => {
  if (!peaks.value.length) return ''

  const width = 1000
  const center = 50
  const amplitude = 42
  const lastIndex = Math.max(1, peaks.value.length - 1)
  return peaks.value.map((peak, index) => {
    const x = (index / lastIndex) * width
    const safePeak = Number.isFinite(peak) ? Math.min(1, Math.max(0.08, peak)) : 0.08
    const top = center - safePeak * amplitude
    const bottom = center + safePeak * amplitude
    return `M ${x.toFixed(2)} ${top.toFixed(2)} L ${x.toFixed(2)} ${bottom.toFixed(2)}`
  }).join(' ')
})

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = Math.floor(safeSeconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function timePositionClass(ratio: number) {
  if (ratio < 0.08) return 'waveform-time--start'
  if (ratio > 0.92) return 'waveform-time--end'
  return ''
}

function pointerRatio(event: PointerEvent) {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect?.width) return 0
  return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
}

function seekFromPointer(event: PointerEvent) {
  if (!props.duration) return
  const ratio = pointerRatio(event)
  hoverRatio.value = ratio
  emit('seek', ratio * props.duration)
}

function startSeek(event: PointerEvent) {
  if (!props.duration) return
  dragging.value = true
  rootRef.value?.setPointerCapture?.(event.pointerId)
  seekFromPointer(event)
}

function movePointer(event: PointerEvent) {
  hoverRatio.value = pointerRatio(event)
  if (dragging.value) seekFromPointer(event)
}

function stopSeek(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  if (rootRef.value?.hasPointerCapture?.(event.pointerId)) rootRef.value.releasePointerCapture?.(event.pointerId)
}

function leavePointer() {
  if (!dragging.value) hoverRatio.value = null
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
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}

.waveform-shape {
  display: block;
  width: 100%;
  height: 20px;
  overflow: hidden;
}

.waveform-shape__unplayed,
.waveform-shape__played {
  fill: none;
  stroke-linecap: round;
  stroke-width: 1.4px;
  vector-effect: non-scaling-stroke;
}

.waveform-shape__unplayed {
  stroke: color-mix(in srgb, var(--a-color-muted) 28%, transparent);
}

.waveform-shape__played {
  stroke: color-mix(in srgb, var(--a-color-primary) 82%, transparent);
  transition: clip-path 80ms linear;
}

.waveform-fallback-line {
  width: 100%;
  height: 2px;
  background: var(--a-color-border-soft);
}

.waveform-fallback-line span {
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
}

.waveform-hover-line {
  background: var(--a-color-muted);
  opacity: 0.55;
}

.waveform-time {
  position: absolute;
  z-index: 2;
  top: 50%;
  min-width: 38px;
  padding: 1px 4px;
  transform: translate(-50%, -50%);
  background: var(--a-color-primary);
  color: var(--a-color-primary-contrast);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 16px;
  text-align: center;
  pointer-events: none;
  white-space: nowrap;
}

.waveform-time--hover {
  background: var(--a-color-text);
  color: var(--a-color-bg);
}

.waveform-time--start {
  transform: translate(0, -50%);
}

.waveform-time--end {
  transform: translate(-100%, -50%);
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

  .waveform-time {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .waveform-shape__played {
    transition: none;
  }
}
</style>
