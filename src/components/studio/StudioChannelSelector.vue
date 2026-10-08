<template>
  <div class="studio-channel-selector" data-testid="studio-channel-selector">
    <label :for="selectId" class="studio-channel-selector__label">频道</label>
    <div class="studio-channel-selector__wrapper">
      <select
        :id="selectId"
        :value="studio.currentChannel?.id || ''"
        :disabled="studio.loading || studio.channels.length === 0"
        aria-label="选择频道"
        @change="selectChannel"
      >
        <option v-if="studio.channels.length === 0" value="">暂无频道</option>
        <option v-for="channel in studio.channels" :key="channel.id" :value="channel.id">
          {{ channel.name }}
        </option>
      </select>
      <span class="studio-channel-selector__arrow" aria-hidden="true">▾</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getCurrentInstance } from 'vue'
import { useStudioStore } from '@/stores/studio'

let idCounter = 0
function useId() {
  return `studio-channel-select-${getCurrentInstance()?.uid ?? ++idCounter}`
}

const studio = useStudioStore()
const selectId = useId()

function selectChannel(event: Event) {
  const channelID = (event.target as HTMLSelectElement).value
  if (channelID) void studio.selectChannel(channelID)
}
</script>

<style scoped>
.studio-channel-selector {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  font-size: 0.8125rem;
  color: var(--a-color-muted);
}

.studio-channel-selector__label {
  font-size: 0.75rem;
  color: var(--a-color-muted);
  white-space: nowrap;
}

.studio-channel-selector__wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.studio-channel-selector select {
  appearance: none;
  width: clamp(7.5rem, 16vw, 12rem);
  height: 2.25rem;
  line-height: 2.25rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  padding: 0 1.75rem 0 0.625rem;
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color var(--a-motion-micro, 140ms) ease;
}

.studio-channel-selector select:hover {
  border-color: var(--a-color-border);
}

.studio-channel-selector select:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}

.studio-channel-selector select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.studio-channel-selector__arrow {
  position: absolute;
  right: 0.625rem;
  pointer-events: none;
  font-size: 0.7rem;
  color: var(--a-color-muted);
}

@media (max-width: 640px) {
  .studio-channel-selector {
    width: 100%;
  }
  .studio-channel-selector__wrapper {
    flex: 1;
  }
  .studio-channel-selector select {
    width: 100%;
  }
}
</style>
