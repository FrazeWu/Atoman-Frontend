<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import ABtn from '@/components/ui/ABtn.vue'
import AConfirm from '@/components/ui/AConfirm.vue'
import ATextarea from '@/components/ui/ATextarea.vue'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import { extractTimestampFromComment, formatTimestampLabel, serializeTimestampComment } from '@/composables/useVideoTimestamp'
import type { Comment } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const props = defineProps<{
  videoId: string
  videoOwnerId?: string
}>()

const emit = defineEmits<{
  seekToTimestamp: [number]
}>()

const authStore = useAuthStore()
const comments = ref<Comment[]>([])
const loading = ref(true)
const newComment = ref('')
const submitting = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref<string | null>(null)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN')
}

function canDelete(c: Comment) {
  if (!authStore.user) return false
  return (
    authStore.user.uuid === c.user_id ||
    authStore.user.uuid === props.videoOwnerId ||
    isAdminRole(authStore.user.role)
  )
}

async function fetchComments() {
  loading.value = true
  try {
    const res = await fetch(`${API_URL}/videos/${props.videoId}/comments`)
    if (res.ok) {
      const d = await res.json()
      comments.value = d.data || []
    }
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

async function submitComment() {
  if (!newComment.value.trim()) return
  submitting.value = true
  try {
    const body = {
      content: newComment.value,
      ...serializeTimestampComment(extractTimestampFromComment(newComment.value)),
    }
    const res = await fetch(`${API_URL}/videos/${props.videoId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      newComment.value = ''
      await fetchComments()
    }
  } catch {
    // ignore
  } finally {
    submitting.value = false
  }
}

async function deleteComment(id: string) {
  try {
    const res = await fetch(`${API_URL}/videos/comments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.ok) await fetchComments()
  } catch {
    // ignore
  }
}

function requestDelete(id: string) {
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  pendingDeleteId.value = null
}

async function confirmDelete() {
  const id = pendingDeleteId.value
  cancelDelete()
  if (id) await deleteComment(id)
}

onMounted(fetchComments)
watch(() => props.videoId, fetchComments)
</script>

<template>
  <div class="vcs-section">
    <h3 class="vcs-title">
      评论 <span class="vcs-count">({{ comments.length }})</span>
    </h3>

    <div v-if="authStore.isAuthenticated" class="vcs-form">
      <ATextarea
        v-model="newComment"
        placeholder="写下你的评论... 可输入 12:34 或 01:12:34 标记时间点"
        :rows="3"
      />
      <ABtn
        variant="primary"
        size="sm"
        :disabled="!newComment.trim() || submitting"
        class="vcs-submit"
        @click="submitComment"
      >
        {{ submitting ? '发送中...' : '发表评论' }}
      </ABtn>
    </div>
    <div v-else class="vcs-login-prompt">
      <RouterLink to="/login" class="vcs-login-link">登录</RouterLink> 后发表评论
    </div>

    <div v-if="loading" class="vcs-loading">
      <div v-for="i in 3" :key="i" class="vcs-loading-item" />
    </div>

    <div v-else class="vcs-list">
      <div v-for="comment in comments" :key="comment.id" class="vcs-item">
        <div class="vcs-header">
          <div class="vcs-avatar">
            {{ (comment.user?.display_name || comment.user?.username || '?').charAt(0).toUpperCase() }}
          </div>
          <span class="vcs-author">{{ comment.user?.display_name || comment.user?.username }}</span>
          <span class="vcs-time">{{ formatDate(comment.created_at) }}</span>
          <ABtn
            v-if="canDelete(comment)"
            variant="danger"
            size="sm"
            class="vcs-delete"
            @click="requestDelete(comment.id)"
          >
            删除
          </ABtn>
        </div>
        <p class="vcs-content">
          <button
            v-if="comment.timestamp_sec != null"
            class="vcs-ts-label"
            @click="emit('seekToTimestamp', comment.timestamp_sec!)"
          >
            {{ formatTimestampLabel(comment.timestamp_sec!) }}
          </button>
          {{ comment.content }}
        </p>
      </div>

      <div v-if="!comments.length" class="vcs-empty">
        还没有评论，来发表第一条吧
      </div>
    </div>

    <AConfirm
      :show="showDeleteConfirm"
      title="删除评论"
      message="确定删除这条评论吗？"
      confirm-text="删除"
      cancel-text="取消"
      danger
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<style scoped>
.vcs-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--a-color-border, #e5e7eb);
}

.vcs-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 1rem;
  color: var(--a-color-fg);
}

.vcs-count {
  color: var(--a-color-muted, #6b7280);
  font-weight: 500;
  font-size: 0.9rem;
}

.vcs-form {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.vcs-submit {
  align-self: flex-end;
}

.vcs-login-prompt {
  font-size: 0.875rem;
  color: var(--a-color-muted, #6b7280);
  margin-bottom: 1.5rem;
}

.vcs-login-link {
  color: var(--a-color-primary, #3b82f6);
  text-decoration: none;
  font-weight: 600;
}

.vcs-loading {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.vcs-loading-item {
  height: 3.5rem;
  background: var(--a-color-surface, #f3f4f6);
  border-radius: 0.5rem;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.vcs-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.vcs-item {
  padding: 0.75rem;
  background: var(--a-color-surface, #f9fafb);
  border-radius: 0.5rem;
}

.vcs-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.vcs-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--a-color-primary, #3b82f6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.vcs-author {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

.vcs-time {
  font-size: 0.75rem;
  color: var(--a-color-muted, #6b7280);
  margin-left: auto;
}

.vcs-delete {
  margin-left: 0.25rem;
}

.vcs-content {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--a-color-fg);
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.vcs-ts-label {
  background: none;
  border: 1px solid var(--a-color-primary, #3b82f6);
  color: var(--a-color-primary, #3b82f6);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}

.vcs-ts-label:hover {
  background: var(--a-color-primary, #3b82f6);
  color: #fff;
}

.vcs-empty {
  font-size: 0.875rem;
  color: var(--a-color-muted, #6b7280);
  text-align: center;
  padding: 2rem 0;
}
</style>
