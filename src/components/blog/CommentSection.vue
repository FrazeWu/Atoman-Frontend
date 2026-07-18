<template>
  <div class="comment-section">
    <h3 class="section-title">
      评论 <span class="comment-count">({{ comments.length }})</span>
    </h3>

    <div v-if="isCommentsClosed" class="closed-notice">
      评论已关闭
    </div>

    <template v-else>
      <div v-if="authStore.isAuthenticated || commentMode === 'all'" class="comment-form">
        <div v-if="!authStore.isAuthenticated" class="form-field">
          <PInput
            id="guest-name"
            v-model="guestName"
            type="text"
            maxlength="80"
            label="名字"
          />
        </div>
        <div class="form-field">
          <PTextarea
            id="comment-content"
            v-model="newComment"
            :placeholder="authStore.isAuthenticated ? '写下你的评论...' : '以匿名身份写下你的评论...'"
            :rows="3"
            label="评论"
          />
        </div>
        <button
          @click="submitComment"
          :disabled="!canSubmit || submitting"
          class="submit-btn"
        >
          {{ submitting ? '发送中...' : '发表评论' }}
        </button>
      </div>
      <div v-else class="login-prompt">
        <RouterLink to="/login" class="login-link">登录</RouterLink> 后发表评论
      </div>

      <div v-if="loading" class="loading-list">
        <div v-for="i in 3" :key="i" class="loading-item" />
      </div>

      <div v-else class="comment-list">
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <div class="comment-header">
            <div class="comment-avatar">
              {{ commentInitial(comment) }}
            </div>
            <span class="comment-author">{{ commentAuthor(comment) }}</span>
            <span class="comment-time">{{ formatDate(comment.created_at) }}</span>
            <button
              v-if="canDelete(comment)"
              @click="requestDeleteComment(comment.id)"
              class="delete-btn"
            >
              删除
            </button>
          </div>
          <p class="comment-content">{{ comment.content }}</p>
        </div>

        <div v-if="!comments.length" class="empty-comments">
          还没有评论，来发表第一条吧
        </div>
      </div>
    </template>

    <PConfirm
      :show="showDeleteConfirm"
      title="删除评论"
      message="确定删除这条评论吗？"
      confirm-text="删除"
      cancel-text="取消"
      danger
      @confirm="confirmDeleteComment"
      @cancel="cancelDeleteComment"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PConfirm from '@/components/ui/PConfirm.vue'
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole } from '@/utils/roles'
import { useApi } from '@/composables/useApi'
import type { Comment } from '@/types'

const props = defineProps<{
  postId: string
  allowComments: boolean
  commentMode: 'all' | 'authenticated' | 'disabled'
  postOwnerId?: string
}>()

const authStore = useAuthStore()
const api = useApi()

const comments = ref<Comment[]>([])
const loading = ref(true)
const newComment = ref('')
const guestName = ref('')
const submitting = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteCommentId = ref<string | null>(null)

const isCommentsClosed = computed(() => !props.allowComments || props.commentMode === 'disabled')
const canSubmit = computed(() => {
  if (!newComment.value.trim()) return false
  if (authStore.isAuthenticated) return true
  return props.commentMode === 'all' && !!guestName.value.trim()
})

const formatDate = (d: string) => new Date(d).toLocaleDateString('zh-CN')

const commentAuthor = (comment: Comment) => comment.user?.display_name || comment.user?.username || comment.guest_name || '匿名'
const commentInitial = (comment: Comment) => commentAuthor(comment).charAt(0).toUpperCase()

const canDelete = (comment: Comment) => {
  if (!authStore.user) return false
  return authStore.user.uuid === comment.user_id || authStore.user.uuid === props.postOwnerId || isAdminRole(authStore.user.role)
}

const fetchComments = async () => {
  loading.value = true
  try {
    const res = await fetch(api.blog.postComments(props.postId))
    if (res.ok) {
      const d = await res.json()
      comments.value = d.data || []
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const submitComment = async () => {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`
    }

    const body: Record<string, string> = { content: newComment.value.trim() }
    if (!authStore.isAuthenticated) {
      body.guest_name = guestName.value.trim()
    }

    const res = await fetch(api.blog.postComments(props.postId), {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (res.ok) {
      newComment.value = ''
      if (!authStore.isAuthenticated) {
        guestName.value = ''
      }
      await fetchComments()
    }
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

const deleteComment = async (id: string) => {
  try {
    const res = await fetch(`${api.blog.comments}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (res.ok) await fetchComments()
  } catch (e) {
    console.error(e)
  }
}

const requestDeleteComment = (id: string) => {
  pendingDeleteCommentId.value = id
  showDeleteConfirm.value = true
}

const cancelDeleteComment = () => {
  showDeleteConfirm.value = false
  pendingDeleteCommentId.value = null
}

const confirmDeleteComment = async () => {
  const id = pendingDeleteCommentId.value
  cancelDeleteComment()
  if (id !== null) {
    await deleteComment(id)
  }
}

onMounted(fetchComments)
</script>

<style scoped>
.comment-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--a-color-border-soft);
}
.section-title {
  font-size: 1.5rem;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0;
  margin: 0 0 1.5rem;
}
.comment-count { color: var(--a-color-muted); font-weight: 500; font-size: 1.125rem; }
.closed-notice {
  border: 1px solid var(--a-color-border-soft);
  padding: 2rem;
  text-align: center;
  color: var(--a-color-muted);
  font-weight: 500;
}
.comment-form { margin-bottom: 2rem; }
.form-field { margin-bottom: 1rem; }
.field-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0;
  text-transform: uppercase;
}
.text-input,
.comment-input {
  width: 100%;
  border: 1px solid var(--a-color-border);
  padding: 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
  font-family: inherit;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}
.comment-input { resize: none; }
.text-input:focus,
.comment-input:focus { border-color: var(--a-color-fg); }
.submit-btn {
  margin-top: 0.5rem;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  padding: 0.5rem 1.5rem;
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  text-transform: uppercase;
  letter-spacing: 0;
  border: 1px solid var(--a-color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}
.submit-btn:hover:not(:disabled) { background: var(--a-color-bg); color: var(--a-color-text); }
.submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.login-prompt {
  margin-bottom: 2rem;
  border: 1px solid var(--a-color-border-soft);
  padding: 1.5rem;
  text-align: center;
  color: var(--a-color-muted);
  font-weight: 500;
}
.login-link { font-weight: var(--a-font-weight-strong, 700); text-decoration: underline; color: var(--a-color-fg); }
.login-link:hover { opacity: 0.7; }
.loading-list { display: flex; flex-direction: column; gap: 1rem; }
.loading-item {
  height: 80px;
  background: var(--a-color-disabled-bg);
  border: 1px solid var(--a-color-border-soft);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.comment-list { display: flex; flex-direction: column; gap: 1rem; }
.comment-item {
  border-left: 2px solid var(--a-color-border);
  padding: 0.75rem 0 0.75rem 1.5rem;
}
.comment-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.comment-avatar {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-size: 0.75rem;
  font-weight: var(--a-font-weight-strong, 700);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.comment-author { font-size: 0.875rem; font-weight: var(--a-font-weight-strong, 700); }
.comment-time { font-size: 0.75rem; color: var(--a-color-muted); font-weight: 500; }
.delete-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  color: #ef4444;
  font-weight: 500;
}
.delete-btn:hover { color: #b91c1c; }
.comment-content {
  font-size: 0.875rem;
  color: #1f2937;
  font-weight: 500;
  white-space: pre-wrap;
  margin: 0;
  line-height: 1.6;
}
.empty-comments {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-weight: 500;
}
</style>
