<script setup lang="ts">
import type { Video } from '@/types'
import VideoCard from '@/components/shared/VideoCard.vue'
import ABtn from '@/components/ui/ABtn.vue'

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
      <ABtn v-if="showNextPrompt && videos.length" size="sm" @click="emit('playNext')">播放下一条</ABtn>
    </div>
    <div v-if="videos.length" class="vcl-list">
      <VideoCard v-for="video in videos" :key="video.id" :video="video" />
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
  font-family: var(--a-font-serif);
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
