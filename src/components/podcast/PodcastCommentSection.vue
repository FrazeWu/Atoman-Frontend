<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Comment } from '@/types'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{
  episodeId: string
}>()

const api = useApi()
const authStore = useAuthStore()
const player = usePlayerStore()

const comments = ref<Comment[]>([])
const content = ref('')
const loading = ref(false)
const submitting = ref(false)
const error = ref('')

const canUseCurrentTimestamp = computed(() =>
  player.currentSong?.source_type === 'podcast_episode'
  && player.currentSong.source_id === props.episodeId
)

function authHeaders() {
  return authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
}

function formatTime(seconds?: number | null) {
  if (seconds === undefined || seconds === null) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function loadComments() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(api.podcast.comments(props.episodeId), {
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('load failed')
    const data = await res.json()
    comments.value = Array.isArray(data?.data) ? data.data : []
  } catch {
    error.value = '评论加载失败'
  } finally {
    loading.value = false
  }
}

async function submitComment(withTimestamp: boolean) {
  const text = content.value.trim()
  if (!text || submitting.value) return
  if (!authStore.token) {
    error.value = '请先登录'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    const body: { content: string; timestamp_sec?: number } = { content: text }
    if (withTimestamp) body.timestamp_sec = Math.floor(player.currentTime)

    const res = await fetch(api.podcast.comments(props.episodeId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('submit failed')
    content.value = ''
    await loadComments()
  } catch {
    error.value = '发送失败'
  } finally {
    submitting.value = false
  }
}

onMounted(loadComments)
</script>

<template>
  <section class="podcast-comments">
    <div class="comment-composer">
      <textarea
        v-model="content"
        class="comment-input"
        rows="3"
        placeholder="写下你的想法"
      />
      <div class="comment-actions">
        <button
          type="button"
          class="comment-button"
          :disabled="!content.trim() || submitting"
          @click="submitComment(false)"
        >
          发送
        </button>
        <button
          type="button"
          class="comment-button comment-button--ghost"
          :disabled="!content.trim() || submitting || !canUseCurrentTimestamp"
          @click="submitComment(true)"
        >
          带时间点
        </button>
      </div>
      <p v-if="error" class="comment-error">{{ error }}</p>
    </div>

    <div v-if="loading" class="comment-state">加载中...</div>
    <div v-else-if="comments.length" class="comment-list">
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="comment-item"
      >
        <button
          v-if="comment.timestamp_sec !== undefined && comment.timestamp_sec !== null"
          type="button"
          class="comment-time"
          @click="player.seek(comment.timestamp_sec || 0)"
        >
          {{ formatTime(comment.timestamp_sec) }}
        </button>
        <div class="comment-body">
          <div class="comment-author">{{ comment.user?.display_name || comment.user?.username || '听众' }}</div>
          <p class="comment-content">{{ comment.content }}</p>
        </div>
      </article>
    </div>
    <div v-else class="comment-state">暂无评论</div>
  </section>
</template>

<style scoped>
.podcast-comments {
  display: grid;
  gap: 1rem;
}

.comment-composer,
.comment-list {
  display: grid;
  gap: 0.75rem;
}

.comment-input {
  width: 100%;
  resize: vertical;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 0.75rem;
  color: #111827;
  background: #ffffff;
  font-size: 0.875rem;
  line-height: 1.6;
}

.comment-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.comment-button {
  border: 1px solid #111827;
  border-radius: 6px;
  padding: 0.375rem 0.75rem;
  color: #ffffff;
  background: #111827;
  font-size: 0.8125rem;
  cursor: pointer;
}

.comment-button--ghost {
  color: #111827;
  background: #ffffff;
}

.comment-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 0.75rem;
}

.comment-time {
  flex: 0 0 auto;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.125rem 0.375rem;
  color: #111827;
  background: #ffffff;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.comment-body {
  min-width: 0;
}

.comment-author {
  color: #6b7280;
  font-size: 0.75rem;
}

.comment-content {
  margin: 0.125rem 0 0;
  color: #111827;
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-state,
.comment-error {
  color: #6b7280;
  font-size: 0.8125rem;
}

.comment-error {
  color: #dc2626;
}
</style>
