<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const api = useApi()
const authStore = useAuthStore()
const data = ref<Record<string, number>>({})

const labels: Record<string, string> = {
  episodes: '单集',
  comments: '评论',
  bookmarks: '收藏',
  listen_later: '稍后听',
  completed_progress: '听完',
}

onMounted(async () => {
  const res = await fetch(api.podcast.creatorAnalytics, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (res.ok) {
    const body = await res.json()
    data.value = body.data || {}
  }
})
</script>

<template>
  <div class="pca-grid">
    <div v-for="(value, key) in data" :key="key" class="pca-card">
      <strong>{{ value }}</strong>
      <span>{{ labels[key] || key }}</span>
    </div>
  </div>
</template>

<style scoped>
.pca-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 0.75rem; }
.pca-card { display: grid; gap: 0.25rem; border: 1px solid #e5e7eb; border-radius: 4px; padding: 1rem; }
.pca-card strong { font-size: 1.5rem; }
.pca-card span { color: #6b7280; font-size: 0.875rem; }
</style>
