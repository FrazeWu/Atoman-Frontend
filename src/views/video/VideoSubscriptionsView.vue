<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import PEmpty from '@/components/ui/PEmpty.vue'
import PButton from '@/components/ui/PButton.vue'
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
const page = ref(0)
const hasMore = ref(false)
const limit = 20
let requestSequence = 0

async function loadSubscribedVideos(append = false) {
  if (!authStore.token || loading.value) return

  const sequence = ++requestSequence
  const targetPage = append ? page.value + 1 : 1
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${api.url}/videos?subscribed=true&sort=latest&page=${targetPage}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (sequence !== requestSequence) return
    if (!res.ok) throw new Error(`Failed to load subscribed videos (${res.status})`)

    const rows: unknown = await res.json()
    if (sequence !== requestSequence) return
    if (!Array.isArray(rows)) throw new Error('Invalid videos response')

    if (append) {
      const existingIDs = new Set(videos.value.map(video => video.id))
      videos.value = [...videos.value, ...rows.filter((video: Video) => !existingIDs.has(video.id))]
    } else {
      videos.value = rows
    }
    page.value = targetPage
    hasMore.value = rows.length === limit
  } catch {
    if (sequence !== requestSequence) return
    if (!append) videos.value = []
    error.value = append ? '加载失败，请重试' : '订阅内容加载失败'
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function loadMore() {
  void loadSubscribedVideos(true)
}

onMounted(() => void loadSubscribedVideos())
onUnmounted(() => {
  requestSequence++
  loading.value = false
  error.value = ''
})
</script>

<template>
  <div class="video-subscriptions-view">
    <PPageHeader title="订阅" accent mb="1.5rem" />

    <div v-if="loading && videos.length === 0" class="video-subscriptions-grid">
      <div v-for="index in 8" :key="index" class="video-subscriptions-skeleton a-skeleton" />
    </div>

    <PEmpty v-else-if="error && videos.length === 0" :text="error" />

    <PEmpty v-else-if="videos.length === 0" text="暂无订阅更新" />

    <div v-else>
      <div class="video-subscriptions-grid">
        <PVideoCard v-for="video in videos" :key="video.id" :video="video" />
      </div>

      <p v-if="error" class="video-subscriptions-status a-error" role="alert">{{ error }}</p>
      <div v-if="hasMore || loading" class="video-subscriptions-actions">
        <PButton label="加载更多" outline :loading="loading" loading-text="加载中..." @click="loadMore" />
      </div>
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

.video-subscriptions-actions,
.video-subscriptions-status {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}
</style>
