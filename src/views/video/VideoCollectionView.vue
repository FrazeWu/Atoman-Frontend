<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getVideoResource } from '@/api/video'
import type { Video } from '@/types'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PEmpty from '@/components/ui/PEmpty.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'

const route = useRoute()
const videos = ref<Video[]>([])
const loading = ref(false)
const error = ref('')

async function load() {
  const id = String(route.params.id || '')
  if (!id) return
  loading.value = true
  error.value = ''
  try {
    videos.value = await getVideoResource<Video[]>(`/videos?collection_id=${encodeURIComponent(id)}`)
  } catch {
    error.value = '合集加载失败，请重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
watch(() => route.params.id, () => void load())
</script>

<template>
  <div class="a-page-xl video-collection-view">
    <PPageHeader title="视频合集" mb="1.25rem" />
    <p v-if="error" class="video-collection-state video-collection-state--error">{{ error }}</p>
    <p v-else-if="loading" class="video-collection-state">加载中...</p>
    <PEmpty v-else-if="!videos.length" title="暂无视频" description="这个合集还没有已发布的视频。" />
    <div v-else class="video-collection-grid">
      <PVideoCard v-for="video in videos" :key="video.id" :video="video" />
    </div>
  </div>
</template>

<style scoped>
.video-collection-view { min-height: 100%; }
.video-collection-state { color: var(--a-color-muted); }
.video-collection-state--error { color: var(--a-color-danger); }
.video-collection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 1.5rem; }
</style>
