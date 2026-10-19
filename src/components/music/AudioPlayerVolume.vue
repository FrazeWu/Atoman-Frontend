<template>
  <div class="volume-container">
    <div class="volume-control">
      <span class="vol-percentage">{{ Math.round(volume * 100) }}%</span>
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
    </div>
    <div class="vol-trigger" data-hint="静音 / 解除静音 (M)">
      <button
        type="button"
        class="vol-icon"
        :aria-label="volume > 0 ? '静音' : '解除静音'"
        :title="volume > 0 ? '静音' : '解除静音'"
        @click="$emit('toggle-mute')"
      >
        <Volume2 v-if="volume > 0.6" :size="20" />
        <Volume1 v-else-if="volume > 0.2" :size="20" />
        <Volume v-else-if="volume > 0" :size="20" />
        <VolumeX v-else :size="20" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Volume2, Volume1, Volume, VolumeX } from 'lucide-vue-next'

defineProps<{
  volume: number
}>()

defineEmits<{
  'change': [volume: number]
  'toggle-mute': []
}>()
</script>

<style scoped>
.volume-container {
  display: flex;
  align-items: center;
  position: relative;
}

.volume-control {
  position: absolute;
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%) translateY(6px);
  width: 48px;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  padding: 12px 0 14px 0;
  z-index: 100;
  box-shadow: none;
  border-radius: var(--a-radius-card, 4px);
}

:root.dark .volume-control {
  background: var(--a-color-bg);
  border-color: var(--a-color-border);
}

.volume-control::before {
  content: "";
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 16px;
}

.volume-control::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--a-color-bg);
}

.volume-container:hover .volume-control,
.volume-container:focus-within .volume-control {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.vol-percentage {
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  color: var(--a-color-muted);
  user-select: none;
  line-height: 1;
}

.vol-slider-wrapper {
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  transition: color 0.2s;
  flex-shrink: 0;
}

.vol-icon:hover {
  color: var(--a-color-text);
}

.vol-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 96px;
  width: 6px;
  outline: none;
  border-radius: 3px;
  cursor: pointer;
  writing-mode: vertical-lr;
  direction: rtl;
  background: linear-gradient(
    to top,
    var(--a-color-primary) 0%,
    var(--a-color-primary) var(--vol-percent, 50%),
    var(--a-color-surface-muted) var(--vol-percent, 50%),
    var(--a-color-surface-muted) 100%
  );
  transition: background 0.1s linear;
}

:root.dark .vol-slider {
  background: linear-gradient(
    to top,
    var(--a-color-primary) 0%,
    var(--a-color-primary) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.12) var(--vol-percent, 50%),
    rgba(255, 255, 255, 0.12) 100%
  );
}

.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--a-color-bg);
  border: 2px solid var(--a-color-primary);
  box-shadow: none;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.vol-slider:hover::-webkit-slider-thumb,
.vol-slider:active::-webkit-slider-thumb {
  transform: scale(1.25);
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
  box-shadow: none;
}

.vol-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--a-color-bg);
  border: 2px solid var(--a-color-primary);
  box-shadow: none;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.vol-slider:hover::-moz-range-thumb,
.vol-slider:active::-moz-range-thumb {
  transform: scale(1.25);
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
  box-shadow: none;
}

@media (max-width: 900px) {
  .volume-container {
    display: none;
  }
}
</style>
