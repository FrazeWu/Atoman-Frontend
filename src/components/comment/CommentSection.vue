<template>
  <section ref="sectionElement" class="comment-section" :aria-label="noun">
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
      v-if="authStore.isAuthenticated && !readonly"
      ref="rootComposer"
      :placeholder="`写下${noun}`"
      :current-time="currentTime"
      :submitting="creating"
      @submit="createRoot"
    />
    <div v-else-if="readonly" class="comment-section__login">该话题已锁定</div>
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
        :can-delete="Boolean(comments.target.value?.can_mark)"
        :can-reply="!readonly"
        :marked-comment-id="comments.target.value?.marked_comment_id"
        :mark-label="effectiveMarkLabel"
        :current-time="currentTime"
        :like-pending="(id) => comments.isLikePending(id).value"
        :on-reply="createReply"
        :on-edit="editComment"
        @seek="$emit('seek', $event)"
        @like="comments.toggleLike"
        @delete="removeComment"
        @report="openReport"
        @mark="markComment"
        @unmark="unmarkComment"
        @expand="expandReplies"
        @more-replies="loadMoreReplies"
      />
    </div>

    <PButton v-if="comments.hasMore.value" block outline :loading="comments.loading.value" @click="comments.loadMore">
      加载更多
    </PButton>

    <p v-if="mutationError" class="comment-section__error" role="alert">{{ mutationError }}</p>
    <CommentReportDialog v-model="reportVisible" :on-submit="submitReport" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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
  readonly?: boolean
  focusCommentId?: string
  focusRootId?: string
}>(), {
  noun: '评论',
  markLabel: undefined,
  currentTime: undefined,
  readonly: false,
  focusCommentId: '',
  focusRootId: '',
})

const emit = defineEmits<{
  seek: [seconds: number]
  'marked-change': [marked: boolean]
  'count-change': [count: number]
}>()

const authStore = useAuthStore()
const comments = useComments(() => props.target)
const creating = ref(false)
const mutationError = ref('')
const rootComposer = ref<{ reset: () => void } | null>(null)
const reportVisible = ref(false)
const reportingCommentId = ref('')
const sectionElement = ref<HTMLElement | null>(null)
const currentUserId = computed(() => authStore.user?.uuid ?? '')
const loginTarget = computed(() => `/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`)
const effectiveMarkLabel = computed(() => props.markLabel
  ?? (comments.target.value?.mark_label === '最佳回答' ? '最佳回答' : comments.target.value?.mark_label === '置顶' ? '置顶' : '置顶'))
const sortOptions = [
  { label: '最早', value: 'oldest' as const },
  { label: '最新', value: 'newest' as const },
  { label: '热门', value: 'hot' as const },
]

let focusRequest = 0
let focusQueue = Promise.resolve()

watch(() => [
  `${props.target.kind}:${props.target.resourceId}`,
  props.focusCommentId,
  props.focusRootId,
] as const, ([targetKey], previous) => {
  const request = ++focusRequest
  const shouldLoad = !previous || previous[0] !== targetKey || comments.page.value === 0
  focusQueue = focusQueue.catch(() => undefined).then(async () => {
    if (request !== focusRequest) return
    try {
      if (shouldLoad) await comments.load()
      if (request !== focusRequest) return
      await focusRequestedComment(request)
    } catch {
      // Existing section error state handles root load failures.
    }
  })
}, { immediate: true })

async function focusRequestedComment(request: number) {
  const commentId = props.focusCommentId
  const rootId = props.focusRootId || commentId
  if (!commentId || !rootId) return

  let root = comments.roots.value.find(({ id }) => id === rootId)
  while (!root && comments.hasMore.value && request === focusRequest) {
    const previousPage = comments.page.value
    const previousCount = comments.roots.value.length
    await comments.loadMore()
    if (request !== focusRequest) return
    root = comments.roots.value.find(({ id }) => id === rootId)
    if (!root && previousPage === comments.page.value && previousCount === comments.roots.value.length) break
  }
  if (!root || request !== focusRequest) return

  while (commentId !== root.id) {
    const state = comments.replyState(root.id)
    const found = root.replies.some(({ id }) => id === commentId)
    if (found && state.expanded) break
    if (state.expanded && !state.hasMore) break
    const nextPage = state.expanded ? state.page + 1 : 1
    const previousPage = state.page
    const previousCount = root.replies.length
    const previousExpanded = state.expanded
    try {
      await comments.expandReplies(root.id, nextPage, state.pageSize)
    } catch {
      break
    }
    if (request !== focusRequest) return
    const nextState = comments.replyState(root.id)
    if (previousPage === nextState.page
      && previousCount === root.replies.length
      && previousExpanded === nextState.expanded) break
  }

  await nextTick()
  if (request !== focusRequest) return
  const element = sectionElement.value?.querySelector<HTMLElement>(`#comment-${CSS.escape(commentId)}`)
    ?? sectionElement.value?.querySelector<HTMLElement>(`#comment-${CSS.escape(root.id)}`)
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  element?.focus({ preventScroll: true })
}

async function createRoot(input: CreateCommentInput) {
  creating.value = true
  mutationError.value = ''
  try {
    await comments.create(input)
    rootComposer.value?.reset()
    emitCount()
  } catch {
    mutationError.value = '发布失败，请重试'
  } finally {
    creating.value = false
  }
}

async function createReply(comment: CommentDTO, input: CreateCommentInput) {
  await comments.create({ ...input, reply_to_id: comment.id })
  emitCount()
}

async function editComment(comment: CommentDTO, input: CreateCommentInput) {
  await comments.edit(comment.id, input)
}

async function removeComment(commentId: string) {
  try {
    await comments.remove(commentId)
    emitCount()
  } catch {
    mutationError.value = '删除失败，请重试'
  }
}

function emitCount() {
  if (comments.target.value) emit('count-change', comments.target.value.comment_count)
}

async function markComment(commentId: string) {
  try {
    await comments.mark(commentId)
    emit('marked-change', true)
  } catch {
    mutationError.value = '设置失败，请重试'
  }
}

async function unmarkComment() {
  try {
    await comments.unmark()
    emit('marked-change', false)
  } catch {
    mutationError.value = '取消失败，请重试'
  }
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
