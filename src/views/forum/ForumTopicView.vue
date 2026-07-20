<template>
  <div class="a-page-xl topic-page">
    <div v-if="forumStore.loading" class="topic-loading">
      加载中...
    </div>

    <template v-else-if="forumStore.currentTopic">
      <!-- Breadcrumb -->
      <div class="topic-breadcrumb">
        <RouterLink to="/forum" class="back-link-muted">论坛</RouterLink>
        <span class="topic-divider">/</span>
        <span
          v-if="forumStore.currentTopic.category"
          class="a-badge category-pill"
          :style="{ borderColor: forumStore.currentTopic.category.color, color: forumStore.currentTopic.category.color }"
          @click="router.push(`/forum?category_id=${forumStore.currentTopic.category_id}`)"
        >{{ forumStore.currentTopic.category.name }}</span>
      </div>

      <!-- Topic header -->
      <div class="topic-header">
        <h1 class="topic-title">
          {{ forumStore.currentTopic.title }}
        </h1>

        <div class="topic-status-row">
          <span v-if="forumStore.currentTopic.pinned" class="topic-status-badge">置顶</span>
          <span v-if="forumStore.currentTopic.featured" class="topic-status-badge">精华</span>
          <span v-if="forumStore.currentTopic.closed" class="topic-status-badge topic-status-muted">已关闭</span>
          <span v-if="forumStore.currentTopic.is_solved" class="topic-status-badge topic-status-solved">已解决</span>
        </div>

        <!-- Tags -->
        <div v-if="(forumStore.currentTopic.tags || []).length > 0" class="topic-tag-row">
          <span
            v-for="tag in forumStore.currentTopic.tags"
            :key="tag"
            class="a-badge tag-pill"
          >{{ tag }}</span>
        </div>

        <!-- Meta bar -->
        <div class="topic-meta">
          <div class="topic-meta-text">
            <span>{{ forumStore.currentTopic.user?.display_name || forumStore.currentTopic.user?.username || '匿名' }}</span>
            <span
              v-if="forumStore.currentTopic.user?.forum_trust_level != null"
              class="a-badge"
              data-testid="forum-topic-trust-level"
            >等级 {{ forumStore.currentTopic.user.forum_trust_level }}</span>
            <span>{{ formatTime(forumStore.currentTopic.created_at) }}</span>
            <span>{{ forumStore.currentTopic.view_count }} 浏览</span>
          </div>
          <InteractionBar
            :liked="interactions.liked.value"
            :like-count="interactions.likeCount.value"
            :comment-count="interactions.commentCount.value"
            :disabled="!authStore.isAuthenticated"
            @like="interactions.like"
            @unlike="interactions.unlike"
          />

          <!-- Bookmark button -->
          <PButton
            v-if="authStore.isAuthenticated"
            @click="forumStore.toggleTopicBookmark(forumStore.currentTopic!.id)"
            outline
            size="sm"
            :class="{ 'topic-action-btn-active': forumStore.currentTopic.is_bookmarked }"
          >{{ forumStore.currentTopic.is_bookmarked ? '已收藏' : '收藏' }}</PButton>

          <!-- Report button (non-owner, authenticated) -->
          <PButton
            v-if="authStore.isAuthenticated && authStore.user?.uuid !== forumStore.currentTopic.user_id"
            @click="openReportModal('topic', forumStore.currentTopic!.id)"
            outline
            size="sm"
          >举报</PButton>

          <!-- Admin: feature/unfeature -->
          <PButton
            v-if="isAdminRole(authStore.user?.role)"
            @click="toggleFeatured"
            outline
            size="sm"
            :class="{ 'topic-action-btn-active': forumStore.currentTopic.featured }"
          >{{ forumStore.currentTopic.featured ? '取消精华' : '设为精华' }}</PButton>
        </div>
      </div>

      <div class="topic-main">
          <!-- Topic content (Markdown rendered) -->
          <div
            class="markdown-body topic-content-card"
            v-html="renderMarkdown(forumStore.currentTopic.content, { references: forumStore.currentTopic.references })"
          />

          <div class="reply-form-root">
            <div v-if="commentNotice" class="reply-login-notice">
              <p class="reply-login-text">{{ commentNotice }}</p>
              <PButton v-if="!authStore.isAuthenticated && !forumStore.currentTopic.closed" to="/login">登录</PButton>
            </div>
            <CommentThread
              :items="interactions.comments.value"
              :loading="interactions.loadingComments.value"
              :submitting="interactions.submittingComment.value"
              :can-comment="canComment"
              :can-delete="canDeleteComment"
              :submit-action="submitComment"
              @delete="interactions.deleteComment"
            />
          </div>
      </div>
    </template>

    <div v-else-if="!forumStore.loading" class="topic-not-found">
      话题不存在
    </div>

    <!-- Back to top button -->
    <PButton
      v-if="showBackTop"
      outline
      size="sm"
      class="back-to-top"
      @click="scrollToTop"
    >顶部</PButton>
  </div>

  <!-- Report Modal -->
  <PModal v-if="reportModal.show" @close="reportModal.show = false" size="sm">
    <h3 class="a-subtitle" style="margin-bottom:1.25rem">举报内容</h3>
    <div style="display:flex;flex-direction:column;gap:1rem">
      <div class="a-field">
        <label class="a-field-label">举报类型</label>
        <p class="a-muted" style="margin:0;font-size:.85rem;font-weight: 500">{{ reportModal.targetType === 'topic' ? '帖子' : '回复' }}</p>
      </div>
      <div class="a-field">
        <label class="a-field-label">举报原因 *</label>
        <PSelect
          v-model="reportForm.reason"
          :options="reportReasonOptions"
          placeholder="请选择原因"
        />
      </div>
      <PTextarea v-model="reportForm.note" label="补充说明" :rows="3" placeholder="可选：详细说明" />
    </div>
    <div v-if="reportFeedback" class="report-feedback">{{ reportFeedback }}</div>
    <div style="display:flex;gap:.5rem;justify-content:flex-end;margin-top:1.5rem">
      <PButton outline @click="reportModal.show = false">取消</PButton>
      <PButton @click="submitReport">提交举报</PButton>
    </div>
  </PModal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useForumStore } from '@/stores/forum'
import { useAuthStore } from '@/stores/auth'
import { isAdminRole, isModeratorRole } from '@/utils/roles'
import { useMarkdownRenderer } from '@/composables/useMarkdownRenderer'
import PButton from '@/components/ui/PButton.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PModal from '@/components/ui/PModal.vue'
import InteractionBar from '@/components/shared/InteractionBar.vue'
import CommentThread from '@/components/shared/CommentThread.vue'
import { useApi } from '@/composables/useApi'
import { useInteractions } from '@/composables/useInteractions'
import type { InteractionComment } from '@/types'

const route = useRoute()
const router = useRouter()
const forumStore = useForumStore()
const authStore = useAuthStore()
const { renderMarkdown } = useMarkdownRenderer()
const topicId = computed(() => String(route.params.id || ''))
const interactions = useInteractions('forum', 'forum_topic', topicId)
const showBackTop = ref(false)
const canComment = computed(() => Boolean(forumStore.currentTopic && !forumStore.currentTopic.closed && authStore.isAuthenticated))
const commentNotice = computed(() => {
  if (forumStore.currentTopic?.closed) return '该话题已关闭'
  if (!authStore.isAuthenticated) return '登录后即可参与讨论'
  return ''
})
const canDeleteComment = (comment: InteractionComment) => {
  if (!authStore.user) return false
  const authIDs = new Set([
    authStore.user.uuid,
    authStore.user.id === undefined ? undefined : String(authStore.user.id),
  ].filter((id): id is string => Boolean(id)))
  const commentIDs = [
    comment.user_id ?? undefined,
    comment.user?.uuid,
    comment.user?.id === undefined ? undefined : String(comment.user.id),
  ].filter((id): id is string => Boolean(id))
  return (
    commentIDs.some((id) => authIDs.has(id)) ||
    authStore.user.uuid === forumStore.currentTopic?.user_id ||
    isModeratorRole(authStore.user.role)
  )
}

// ─── Actions ─────────────────────────────────────────────────────────────────

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

const submitComment = async (payload: { content: string; parentCommentId?: string }) => {
  await interactions.createComment(payload.content, payload.parentCommentId)
}

const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

const onScroll = () => {
  showBackTop.value = window.scrollY > 300
}

const loadTopic = async () => {
  await forumStore.fetchTopic(topicId.value)
  if (forumStore.currentTopic) {
    interactions.liked.value = forumStore.currentTopic.is_liked
    interactions.likeCount.value = forumStore.currentTopic.like_count
    interactions.commentCount.value = forumStore.currentTopic.reply_count
    await interactions.fetchComments()
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

watch(topicId, () => {
  void loadTopic()
})

onMounted(async () => {
  await loadTopic()
  window.addEventListener('scroll', onScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

// Report & Featured
const api = useApi()
const reportModal = ref<{ show: boolean; targetType: 'topic' | 'reply'; targetId: string }>(
  { show: false, targetType: 'topic', targetId: '' },
)
const reportForm = ref({ reason: '', note: '' })
const reportFeedback = ref('')
const reportReasonOptions = [
  { label: '垃圾内容', value: 'spam' },
  { label: '与主题无关', value: 'off-topic' },
  { label: '骚扰或攻击', value: 'harassment' },
  { label: '其他', value: 'other' },
]

const openReportModal = (targetType: 'topic' | 'reply', targetId: string) => {
  reportModal.value = { show: true, targetType, targetId }
  reportForm.value = { reason: '', note: '' }
  reportFeedback.value = ''
}

const submitReport = async () => {
  if (!reportForm.value.reason.trim()) { alert('请选择举报原因'); return }
  const res = await fetch(`${api.url}/forum/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    body: JSON.stringify({
      target_type: reportModal.value.targetType,
      target_id: reportModal.value.targetId,
      reason: reportForm.value.reason,
      note: reportForm.value.note,
    }),
  })
  if (res.ok) {
    reportFeedback.value = '举报已提交'
    setTimeout(() => { reportModal.value.show = false; reportFeedback.value = '' }, 1200)
  } else if (res.status === 409) {
    reportFeedback.value = '您已举报过此内容'
  } else {
    const d = await res.json().catch(() => ({}))
    reportFeedback.value = `举报失败: ${(d as { error?: string }).error || '未知错误'}`
  }
}

const toggleFeatured = async () => {
  const topic = forumStore.currentTopic!
  const method = topic.featured ? 'DELETE' : 'POST'
  const res = await fetch(`${api.url}/forum/topics/${topic.id}/feature`, {
    method,
    headers: { Authorization: `Bearer ${authStore.token}` },
  })
  if (res.ok) {
    topic.featured = !topic.featured
  }
}
</script>

<style scoped>
/* ── Topic header ─────────────────────────────────────────────────────────── */
.topic-page {
  padding-bottom: 8rem;
}

.topic-loading {
  padding: 4rem 0;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0;
  text-align: center;
  text-transform: uppercase;
}

.topic-header {
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--a-color-border-soft);
  padding-bottom: 1.5rem;
}

.topic-title {
  font-size: 2rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.15;
  margin: 0 0 0.75rem;
}

.topic-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.topic-status-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  font-weight: var(--a-font-weight-black);
  text-transform: uppercase;
  letter-spacing: 0;
  padding: 0.15rem 0.4rem;
  border: var(--a-border);
  border-color: var(--a-color-muted);
  color: var(--a-color-fg);
}

.topic-status-muted {
  border-color: var(--a-color-disabled-border);
  color: var(--a-color-muted-soft);
}

.topic-status-solved {
  border-color: var(--a-color-success);
  background: var(--a-color-success);
  color: var(--a-color-bg);
}

.topic-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--a-color-muted);
  flex-wrap: wrap;
}

.topic-meta-text {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.topic-action-btn-active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
  box-shadow: none;
}

.topic-action-btn-active:hover {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.topic-main {
  min-width: 0;
}

/* ── Reply form ───────────────────────────────────────────────────────────── */
.reply-closed-notice {
  border: var(--a-border);
  border-color: var(--a-color-disabled-border);
  padding: 1.25rem 1.5rem;
  text-align: center;
  font-weight: var(--a-font-weight-black);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted);
}

.reply-login-notice {
  border: var(--a-border);
  padding: 1.25rem 1.5rem;
  text-align: center;
}

.reply-form-wrap {
  border: none;
  padding: 1.5rem;
}

.reply-login-text {
  font-weight: 500;
  font-size: 0.9rem;
  margin: 0 0 1rem;
}

.reply-form-title {
  font-weight: 500;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0;
  margin: 0 0 1rem;
}

.reply-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.75rem;
  gap: 0.75rem;
}

.topic-not-found {
  padding: 4rem 0;
  text-align: center;
  font-weight: 500;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--a-color-muted-soft);
}

.topic-divider {
  color: var(--a-color-disabled-border);
}

.topic-content-card {
  border: none;
  padding: 2rem;
  margin-bottom: 2.5rem;
  background: var(--a-color-bg);
}

.reply-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.reply-count-title {
  font-weight: 500;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0;
  margin: 0;
  padding-bottom: 0.75rem;
  border-bottom: none;
  flex: 1;
}

.reply-sort-tabs {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
}

.reply-sort-tab {
  box-shadow: none;
}

.reply-sort-tab-active {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
  border-color: var(--a-color-fg);
}

.quote-box {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1rem;
  background: var(--a-color-disabled-bg);
  border-left: 3px solid var(--a-color-fg);
  margin-bottom: 1rem;
  font-size: 0.8rem;
  font-weight: 500;
}

.quote-preview {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--a-color-muted);
  line-height: 1.6;
}

.draft-restored {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  background: var(--a-color-surface);
  border: var(--a-border);
  margin-bottom: 1rem;
  font-size: 0.8rem;
  font-weight: var(--a-font-weight-strong);
}

.topic-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.topic-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.reply-form-root {
  margin-top: 2.5rem;
}

.back-link-muted {
  font-weight: 500;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0;
  text-decoration: none;
  color: var(--a-color-muted);
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.back-link-muted:hover {
  border-bottom-color: var(--a-color-muted);
}

.category-pill {
  cursor: pointer;
}

.tag-pill {
  font-weight: var(--a-font-weight-strong);
  border-color: var(--a-color-disabled-border);
  color: var(--a-color-muted);
}

.sub-reply-wrap {
  margin-left: 2rem;
  margin-top: -0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.expand-replies-btn {
  box-shadow: none;
  align-self: flex-start;
}

.reply-sort-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.reply-scroll-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 50;
  box-shadow: none;
}

.report-feedback {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  font-weight: var(--a-font-weight-strong);
  color: var(--a-color-muted);
}

.markdown-body :deep(pre) {
  background: var(--a-color-disabled-bg);
  border: var(--a-border);
  padding: 1rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--a-color-fg);
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--a-color-muted);
}

.markdown-body :deep(a) {
  color: var(--a-color-fg);
  text-decoration: underline;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: var(--a-border);
  padding: 0.5rem 0.75rem;
}

.markdown-body :deep(th) {
  font-weight: 500;
  background: var(--a-color-disabled-bg);
}

.markdown-body :deep(img) {
  max-width: 100%;
  filter: grayscale(100%);
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
}

.markdown-body :deep(pre code) {
  font-size: 0.875em;
}

.markdown-body :deep(code) {
  font-family: monospace;
  font-size: 0.875em;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-weight: 500;
  letter-spacing: 0;
  margin: 1.5em 0 0.75em;
  scroll-margin-top: 5rem;
}

.markdown-body :deep(p) {
  line-height: 1.75;
  margin: 0.75em 0;
}

.reply-editor-wrap {
  height: 300px;
  display: flex;
  flex-direction: column;
}
</style>
