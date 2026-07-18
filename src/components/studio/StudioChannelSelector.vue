<template>
  <label class="studio-channel-selector" data-testid="studio-channel-selector">
    <span>频道</span>
    <select
      :value="studio.currentChannel?.id || ''"
      :disabled="studio.loading || studio.channels.length === 0"
      @change="selectChannel"
    >
      <option v-if="studio.channels.length === 0" value="">暂无频道</option>
      <option v-for="channel in studio.channels" :key="channel.id" :value="channel.id">
        {{ channel.name }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { useStudioStore } from '@/stores/studio'

const studio = useStudioStore()

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

.studio-channel-selector select {
  width: clamp(8rem, 18vw, 14rem);
  min-height: 2.75rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-none);
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  padding: 0 2rem 0 0.75rem;
  font: inherit;
}

.studio-channel-selector select:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .studio-channel-selector > span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
}
</style>
