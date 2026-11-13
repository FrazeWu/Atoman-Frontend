<template>
  <div class="volume-container" :class="{ 'is-dragging': isDragging }" @wheel.prevent="handleWheel">
    <div class="vol-trigger" data-hint="静音 / 解除静音 (M)">
      <button
        type="button"
        class="vol-icon"
        :aria-label="volume > 0 ? '静音' : '解除静音'"
        :title="volume > 0 ? '静音' : '解除静音'"
        @click="$emit('toggle-mute')"
      >
        <PIcon v-if="volume > 0.6" name="volume-high" size="lg" />
        <PIcon v-else-if="volume > 0.2" name="volume-medium" size="lg" />
        <PIcon v-else-if="volume > 0" name="volume-low" size="lg" />
        <PIcon v-else name="volume-mute" size="lg" />
      </button>
    </div>
    <div class="volume-control">
      <div
        ref="sliderWrapperRef"
        class="vol-slider-wrapper"
        @pointerdown="handlePointerDown"
      >
        <input
          ref="sliderInputRef"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volume"
          :style="{ '--vol-percent': `${volume * 100}%` }"
          class="vol-slider"
          aria-label="音量"
          @input="handleInput"
          @change="handleInput"
          @keydown="handleKeydown"
        />
      </div>
      <span class="vol-percentage" aria-live="off">{{ Math.round(volume * 100) }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PIcon from '@/components/ui/PIcon.vue'

const props = defineProps<{
  volume: number
}>()

const emit = defineEmits<{
  'change': [volume: number]
  'toggle-mute': []
}>()

const sliderWrapperRef = ref<HTMLElement | null>(null)
const sliderInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  const val = parseFloat(target.value)
  if (!Number.isNaN(val)) {
    emit('change', val)
  }
}

const updateFromPointer = (e: PointerEvent) => {
  if (!sliderWrapperRef.value) return
  const rect = sliderWrapperRef.value.getBoundingClientRect()
  if (rect.width <= 0) return
  const rawRatio = (e.clientX - rect.left) / rect.width
  const nextVolume = Math.min(1, Math.max(0, Math.round(rawRatio * 100) / 100))
  emit('change', nextVolume)
}

const handlePointerDown = (e: PointerEvent) => {
  if (e.button !== 0) return
  isDragging.value = true
  updateFromPointer(e)

  const onPointerMove = (moveEvent: PointerEvent) => {
    if (!isDragging.value) return
    updateFromPointer(moveEvent)
  }

  const onPointerUp = () => {
    isDragging.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

const handleKeydown = (e: KeyboardEvent) => {
  let nextVol = props.volume
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
    nextVol = Math.min(1, Math.round((props.volume + 0.05) * 100) / 100)
    e.preventDefault()
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
    nextVol = Math.max(0, Math.round((props.volume - 0.05) * 100) / 100)
    e.preventDefault()
  } else if (e.key === 'Home') {
    nextVol = 0
    e.preventDefault()
  } else if (e.key === 'End') {
    nextVol = 1
    e.preventDefault()
  }
  if (nextVol !== props.volume) {
    emit('change', nextVol)
  }
}

const handleWheel = (e: WheelEvent) => {
  const delta = e.deltaY < 0 ? 0.05 : -0.05
  const nextVolume = Math.min(1, Math.max(0, Math.round((props.volume + delta) * 100) / 100))
  if (nextVolume !== props.volume) {
    emit('change', nextVolume)
  }
}
</script>

<style scoped>
.volume-container {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  position: relative;
  user-select: none;
}

.vol-trigger {
  display: flex;
  align-items: center;
}

.vol-icon {
  cursor: pointer;
  border: 0;
  background: transparent;
  padding: 4px;
  color: var(--a-color-muted);
  border-radius: var(--a-radius-control, 4px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    color var(--a-motion-state, 0.15s) ease,
    background-color var(--a-motion-state, 0.15s) ease;
  flex-shrink: 0;
}

.vol-icon:hover,
.vol-icon:focus-visible {
  color: var(--a-color-text);
  background: var(--a-color-surface-muted);
  outline: none;
}

.volume-control {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.vol-slider-wrapper {
  display: flex;
  align-items: center;
  width: 76px;
  height: 24px;
  cursor: pointer;
  touch-action: none;
  position: relative;
}

.vol-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 24px;
  margin: 0;
  padding: 0;
  background: transparent;
  outline: none;
  cursor: pointer;
}

/* Track styles */
.vol-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--a-color-primary) 0%,
    var(--a-color-primary) var(--vol-percent, 50%),
    var(--a-color-surface-muted) var(--vol-percent, 50%),
    var(--a-color-surface-muted) 100%
  );
  transition: background 0.08s linear;
}

:root.dark .vol-slider::-webkit-slider-runnable-track {
  background: linear-gradient(
    to right,
    var(--a-color-primary) 0%,
    var(--a-color-primary) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.16) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.16) 100%
  );
}

.vol-slider::-moz-range-track {
  width: 100%;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--a-color-primary) 0%,
    var(--a-color-primary) var(--vol-percent, 50%),
    var(--a-color-surface-muted) var(--vol-percent, 50%),
    var(--a-color-surface-muted) 100%
  );
}

:root.dark .vol-slider::-moz-range-track {
  background: linear-gradient(
    to right,
    var(--a-color-primary) 0%,
    var(--a-color-primary) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.16) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.16) 100%
  );
}

/* Thumb styles */
.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--a-color-surface);
  border: 1.5px solid var(--a-color-primary);
  box-shadow: none;
  cursor: pointer;
  margin-top: -4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.volume-container:hover .vol-slider::-webkit-slider-thumb,
.vol-slider:focus-visible::-webkit-slider-thumb,
.vol-slider:active::-webkit-slider-thumb,
.is-dragging .vol-slider::-webkit-slider-thumb {
  opacity: 1;
}

.vol-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--a-color-surface);
  border: 1.5px solid var(--a-color-primary);
  box-shadow: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.volume-container:hover .vol-slider::-moz-range-thumb,
.vol-slider:focus-visible::-moz-range-thumb,
.vol-slider:active::-moz-range-thumb,
.is-dragging .vol-slider::-moz-range-thumb {
  opacity: 1;
}

.vol-percentage {
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: var(--a-color-muted);
  user-select: none;
  line-height: 1;
  min-width: 28px;
  text-align: right;
  transition: color 0.15s ease;
}

.volume-container:hover .vol-percentage {
  color: var(--a-color-text);
}

@media (max-width: 900px) {
  .volume-container {
    display: none;
  }
}
</style>
