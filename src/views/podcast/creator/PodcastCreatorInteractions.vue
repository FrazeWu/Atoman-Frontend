<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Comment } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'

const api = useApi()
const authStore = useAuthStore()
const router = useRouter()
const comments = ref<Comment[]>([])
const timestamped = ref(false)

function fmt(seconds?: number | null) {
  if (seconds === undefined || seconds === null) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function loadComments() {
  const res = await fetch(`${api.podcast.creatorComments}${timestamped.value ? '?timestamped=true' : ''}`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (res.ok) {
    const body = await res.json()
    comments.value = body.data || []
  }
}

function openComment(comment: Comment) {
  if (!comment.target_id) return
  void router.push({
    path: `/podcasts/episode/${comment.target_id}`,
    query: comment.timestamp_sec !== undefined && comment.timestamp_sec !== null
      ? { t: String(comment.timestamp_sec) }
      : {},
  })
}

onMounted(loadComments)
</script>

<template>
  <div class="pci">
    <div class="pci-tabs">
      <button type="button" :class="{ active: !timestamped }" @click="timestamped = false; loadComments()">全部评论</button>
      <button type="button" :class="{ active: timestamped }" @click="timestamped = true; loadComments()">时间点评论</button>
    </div>
    <article v-for="comment in comments" :key="comment.id" class="pci-row" @click="openComment(comment)">
      <button v-if="comment.timestamp_sec !== undefined && comment.timestamp_sec !== null" type="button" class="pci-time">
        {{ fmt(comment.timestamp_sec) }}
      </button>
      <div>
        <div class="pci-author">{{ comment.user?.display_name || comment.user?.username || '听众' }}</div>
        <p>{{ comment.content }}</p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.pci { display: grid; gap: 0.75rem; }
.pci-tabs { display: flex; gap: 0.5rem; }
.pci-tabs button, .pci-time { border: 1px solid #111827; border-radius: 6px; background: #fff; padding: 0.3rem 0.55rem; font-size: 0.75rem; cursor: pointer; }
.pci-tabs button.active { color: #fff; background: #111827; }
.pci-row { display: flex; gap: 0.75rem; border-bottom: 1px solid #e5e7eb; padding: 0.875rem 0; cursor: pointer; }
.pci-author { color: #6b7280; font-size: 0.75rem; }
.pci-row p { margin: 0.125rem 0 0; }
</style>
