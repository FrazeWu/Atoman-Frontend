<script setup lang="ts">
import { onMounted, ref } from 'vue'

import PEmpty from '@/components/ui/PEmpty.vue'
import PPageHeader from '@/components/ui/PPageHeader.vue'
import PVideoCard from '@/components/shared/PVideoCard.vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import type { Video } from '@/types'

const api = useApi()
const authStore = useAuthStore()
const videos = ref<Video[]>([])
const loading = ref(false)
const error = ref('')

async function loadSubscribedVideos() {
  if (!authStore.token) return
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${api.url}/videos?subscribed=true&sort=latest`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (!res.ok) throw new Error(`Failed to load subscribed videos (${res.status})`)
    videos.value = await res.json()
  } catch {
    videos.value = []
    error.value = '订阅内容加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadSubscribedVideos)
</script>

<template>
  <div class="video-subscriptions-view">
    <PPageHeader title="订阅" accent mb="1.5rem" />

    <div v-if="loading" class="video-subscriptions-grid">
      <div v-for="index in 8" :key="index" class="video-subscriptions-skeleton a-skeleton" />
    </div>

    <PEmpty v-else-if="error" :text="error" />

    <PEmpty v-else-if="videos.length === 0" text="暂无订阅更新" />

    <div v-else class="video-subscriptions-grid">
      <PVideoCard v-for="video in videos" :key="video.id" :video="video" />
    </div>
  </div>
</template>

<style scoped>
.video-subscriptions-view {
  max-width: 90rem;
  min-height: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 6rem;
}

.video-subscriptions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: 2rem 1rem;
}

.video-subscriptions-skeleton {
  min-height: 15rem;
}
</style>
