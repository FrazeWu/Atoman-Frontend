<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'
import type { Video } from '@/types'

defineProps<{
  video: Video
  currentTime?: number
  theaterMode?: boolean
  showTimelinePreview?: boolean
}>()

const emit = defineEmits<{
  copyLink: []
  toggleTheater: []
}>()
</script>

<template>
  <section class="vps-shell">
    <div class="vps-player">
      <slot name="player" />
      <slot name="timeline-preview" />
    </div>
    <div class="vps-actions">
      <PButton variant="secondary" size="sm" @click="emit('copyLink')">复制链接</PButton>
    </div>
  </section>
</template>

<style scoped>
.vps-shell {
  margin-bottom: 1rem;
}
.vps-player {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 4px;
  overflow: hidden;
}
.vps-player:hover :deep(.vpc),
.vps-player:focus-within :deep(.vpc) {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.vps-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}
</style>
