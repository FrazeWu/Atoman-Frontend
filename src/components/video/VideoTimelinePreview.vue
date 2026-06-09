<script setup lang="ts">
import { computed, ref } from 'vue'
import type { VideoPreviewThumbnail } from '@/types'
import { formatTimestampLabel } from '@/composables/useVideoTimestamp'

const props = defineProps<{
  durationSec: number
  thumbnails?: VideoPreviewThumbnail[]
}>()

const hoverX = ref(0)
const hoverTime = ref<number | null>(null)

const activeThumbnail = computed(() => {
  if (hoverTime.value === null || !props.thumbnails?.length) return null
  const sorted = [...props.thumbnails].sort((a, b) => a.time_sec - b.time_sec)
  return [...sorted].reverse().find((item) => item.time_sec <= hoverTime.value!) ?? sorted[0]
})

function updateHover(event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  hoverX.value = ratio * 100
  hoverTime.value = Math.floor(ratio * props.durationSec)
}
</script>

<template>
  <div class="vtp-track" @mousemove="updateHover" @mouseleave="hoverTime = null">
    <div v-if="hoverTime !== null" class="vtp-popover" :style="{ left: `${hoverX}%` }">
      <img v-if="activeThumbnail" :src="activeThumbnail.url" alt="" class="vtp-image" />
      <span class="vtp-time">{{ formatTimestampLabel(hoverTime) }}</span>
    </div>
  </div>
</template>

<style scoped>
.vtp-track {
  position: absolute;
  right: 0;
  left: 0;
  bottom: 48px;
  height: 18px;
  z-index: 1;
  cursor: crosshair;
}

.vtp-track::before {
  position: absolute;
  right: 1rem;
  bottom: 7px;
  left: 1rem;
  height: 4px;
  content: '';
  background: rgba(255, 255, 255, 0.54);
  border-radius: 999px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.vtp-popover {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  transform: translateX(-50%);
  min-width: 4.5rem;
  padding: 0.35rem;
  background: rgba(0, 0, 0, 0.82);
  color: #fff;
  border-radius: 4px;
  pointer-events: none;
  text-align: center;
}

.vtp-image {
  display: block;
  width: 160px;
  height: 90px;
  object-fit: cover;
  margin-bottom: 0.25rem;
}

.vtp-time {
  font-size: 0.75rem;
  font-weight: 800;
}
</style>
