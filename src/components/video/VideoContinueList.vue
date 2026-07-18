<script setup lang="ts">
import type { Video } from '@/types'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import PButton from '@/components/ui/PButton.vue'

defineProps<{
  videos: Video[]
  showNextPrompt?: boolean
}>()

const emit = defineEmits<{
  playNext: []
}>()
</script>

<template>
  <aside class="vcl">
    <div class="vcl-header">
      <h2 class="vcl-title">同频道继续看</h2>
      <PButton v-if="showNextPrompt && videos.length" size="sm" @click="emit('playNext')">播放下一条</PButton>
    </div>
    <div v-if="videos.length" class="vcl-list">
      <PVideoCard v-for="video in videos" :key="video.id" :video="video" />
    </div>
    <p v-else class="vcl-empty">暂无同频道视频</p>
  </aside>
</template>

<style scoped>
.vcl {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.vcl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.vcl-title {
  margin: 0;
  font-family: var(--a-font-sans);
  font-size: 1rem;
  font-weight: 900;
}

.vcl-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.vcl-empty {
  color: var(--a-color-muted);
  font-size: 0.875rem;
}
</style>
