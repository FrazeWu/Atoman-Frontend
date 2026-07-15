<template>
  <section class="comment-section" :aria-label="noun">
    <header class="comment-section__header">
      <div>
        <span class="comment-section__kicker">DISCUSSION</span>
        <h2>{{ noun }}</h2>
        <small v-if="comments.target.value">{{ comments.target.value.comment_count }} 条</small>
      </div>
      <PSegmentedControl
        :model-value="comments.sort.value"
        :options="sortOptions"
        :disabled="comments.loading.value"
        @update:model-value="comments.setSort"
      />
    </header>

    <CommentComposer
      v-if="authStore.isAuthenticated"
      :placeholder="`写下${noun}`"
      :current-time="currentTime"
      :submitting="creating"
      @submit="createRoot"
    />
    <div v-else class="comment-section__login">
      <MessageSquare :size="18" aria-hidden="true" />
      <span>登录后{{ noun }}</span>
      <PButton size="sm" :href="loginTarget">登录</PButton>
    </div>

    <p v-if="comments.error.value" class="comment-section__error" role="alert">加载失败，请重试</p>
    <div v-if="comments.loading.value && !comments.roots.value.length" class="comment-section__state">加载中...</div>
    <div v-else-if="!comments.roots.value.length" class="comment-section__state">还没有{{ noun }}</div>
    <div v-else class="comment-section__threads">
      <CommentThread
        v-for="root in comments.roots.value"
        :key="root.id"
        :root="root"
        :replies="root.replies"
        :expanded="comments.replyState(root.id).expanded"
        :loading-replies="comments.replyState(root.id).loading"
        :has-more-replies="comments.replyState(root.id).hasMore"
        :authenticated="authStore.isAuthenticated"
        :current-user-id="currentUserId"
        :can-mark="Boolean(comments.target.value?.can_mark)"
        :marked-comment-id="comments.target.value?.marked_comment_id"
        :mark-label="effectiveMarkLabel"
        :current-time="currentTime"
        :like-pending="(id) => comments.isLikePending(id).value"
        @seek="$emit('seek', $event)"
        @like="comments.toggleLike"
        @delete="comments.remove"
        @report="openReport"
        @mark="comments.mark"
        @unmark="comments.unmark"
        @expand="expandReplies"
        @more-replies="loadMoreReplies"
        @reply="createReply"
        @edit="editComment"
      />
    </div>

    <PButton v-if="comments.hasMore.value" block outline :loading="comments.loading.value" @click="comments.loadMore">
      加载更多
    </PButton>

    <CommentReportDialog v-model="reportVisible" @submit="submitReport" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessageSquare } from 'lucide-vue-next'

import type { CommentDTO, CommentTargetRef, CreateCommentInput, ReportCommentInput } from '@/api/comments'
import PButton from '@/components/ui/PButton.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useComments } from '@/composables/useComments'
import { useAuthStore } from '@/stores/auth'
import CommentComposer from './CommentComposer.vue'
import CommentReportDialog from './CommentReportDialog.vue'
import CommentThread from './CommentThread.vue'

defineOptions({ name: 'CommentSection' })

const props = withDefaults(defineProps<{
  target: CommentTargetRef
  noun?: '评论' | '讨论' | '回复' | '修订提案'
  markLabel?: '置顶' | '最佳回答'
  currentTime?: () => number | null
}>(), {
  noun: '评论',
  markLabel: '置顶',
  currentTime: undefined,
})

defineEmits<{ seek: [seconds: number] }>()

const authStore = useAuthStore()
const comments = useComments(() => props.target)
const creating = ref(false)
const reportVisible = ref(false)
const reportingCommentId = ref('')
const currentUserId = computed(() => authStore.user?.uuid ?? '')
const loginTarget = computed(() => `/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`)
const effectiveMarkLabel = computed(() => props.markLabel || (comments.target.value?.mark_label === '最佳回答' ? '最佳回答' : '置顶'))
const sortOptions = [
  { label: '最早', value: 'oldest' as const },
  { label: '最新', value: 'newest' as const },
  { label: '热门', value: 'hot' as const },
]

watch(() => `${props.target.kind}:${props.target.resourceId}`, () => {
  Promise.resolve(comments.load()).catch(() => undefined)
}, { immediate: true })

async function createRoot(input: CreateCommentInput) {
  creating.value = true
  try { await comments.create(input) } finally { creating.value = false }
}

async function createReply(comment: CommentDTO, input: CreateCommentInput) {
  await comments.create({ ...input, reply_to_id: comment.id })
}

async function editComment(comment: CommentDTO, input: CreateCommentInput) {
  await comments.edit(comment.id, input)
}

function expandReplies(rootId: string) {
  return comments.expandReplies(rootId, 1, 20)
}

function loadMoreReplies(rootId: string) {
  const state = comments.replyState(rootId)
  return comments.expandReplies(rootId, state.page + 1, state.pageSize)
}

function openReport(commentId: string) {
  reportingCommentId.value = commentId
  reportVisible.value = true
}

async function submitReport(input: ReportCommentInput) {
  if (!reportingCommentId.value) return
  await comments.report(reportingCommentId.value, input)
  reportingCommentId.value = ''
}
</script>

<style scoped>
.comment-section { display: grid; gap: 1rem; min-width: 0; }
.comment-section__header { display: flex; align-items: end; justify-content: space-between; gap: 1rem; padding-bottom: 0.75rem; border-bottom: 2px solid var(--a-color-ink); }
.comment-section__header h2 { display: inline; margin: 0; font-size: 1.35rem; letter-spacing: 0; }
.comment-section__header small { margin-left: 0.55rem; color: var(--a-color-ink-muted); }
.comment-section__kicker { display: block; margin-bottom: 0.25rem; color: var(--a-color-ink-muted); font-family: var(--a-font-meta); font-size: 0.68rem; font-weight: 900; letter-spacing: 0.12em; }
.comment-section__login, .comment-section__state { display: flex; align-items: center; justify-content: center; gap: 0.65rem; min-height: 84px; border: 1px solid var(--a-color-line-soft); background: var(--a-color-paper-soft); color: var(--a-color-ink-muted); }
.comment-section__login :deep(.p-button) { margin-left: 0.5rem; }
.comment-section__threads { display: grid; gap: 0.9rem; }
.comment-section__error { margin: 0; padding: 0.75rem; border-left: 3px solid var(--a-color-accent-destructive); color: var(--a-color-accent-destructive); }
@media (max-width: 640px) { .comment-section__header { align-items: stretch; flex-direction: column; } .comment-section__header :deep(.p-segmented-control) { display: grid; grid-template-columns: repeat(3, 1fr); } }
</style>
