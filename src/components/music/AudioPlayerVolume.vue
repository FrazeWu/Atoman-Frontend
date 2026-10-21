<template>
  <div class="volume-container" @wheel.prevent="handleWheel">
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
      <div class="vol-slider-wrapper">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="volume"
          :style="{ '--vol-percent': `${volume * 100}%` }"
          class="vol-slider"
          aria-label="音量"
          @input="$emit('change', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
      <span class="vol-percentage" aria-live="off">{{ Math.round(volume * 100) }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import PIcon from '@/components/ui/PIcon.vue'

const props = defineProps<{
  volume: number
}>()

const emit = defineEmits<{
  'change': [volume: number]
  'toggle-mute': []
}>()

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
  height: 20px;
}

.vol-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 999px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    var(--a-color-primary) 0%,
    var(--a-color-primary) var(--vol-percent, 50%),
    var(--a-color-surface-muted) var(--vol-percent, 50%),
    var(--a-color-surface-muted) 100%
  );
  transition:
    height 0.15s ease,
    background 0.08s linear;
}

:root.dark .vol-slider {
  background: linear-gradient(
    to right,
    var(--a-color-primary) 0%,
    var(--a-color-primary) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.16) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.16) 100%
  );
}

.volume-container:hover .vol-slider,
.vol-slider:focus-visible,
.vol-slider:active {
  height: 6px;
}

.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ffffff;
  border: 1.5px solid var(--a-color-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity 0.15s ease,
    transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.volume-container:hover .vol-slider::-webkit-slider-thumb,
.vol-slider:focus-visible::-webkit-slider-thumb,
.vol-slider:active::-webkit-slider-thumb {
  opacity: 1;
  transform: scale(1);
}

.vol-slider::-moz-range-thumb {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ffffff;
  border: 1.5px solid var(--a-color-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity 0.15s ease,
    transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.volume-container:hover .vol-slider::-moz-range-thumb,
.vol-slider:focus-visible::-moz-range-thumb,
.vol-slider:active::-moz-range-thumb {
  opacity: 1;
  transform: scale(1);
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
