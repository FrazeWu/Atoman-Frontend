<template>
  <section class="comment-thread">
    <CommentItem
      :comment="root"
      :authenticated="authenticated"
      :current-user-id="currentUserId"
      :can-mark="canMark"
      :can-delete="canDelete"
      :can-reply="canReply"
      :marked-comment-id="markedCommentId"
      :mark-label="markLabel"
      :like-pending="likePending(root.id)"
      :action-pending="actionPending(root.id) || mutationPending"
      @seek="$emit('seek', $event)"
      @like="$emit('like', root.id)"
      @reply="replyingTo = root"
      @edit="editing = root"
      @delete="$emit('delete', root.id)"
      @report="$emit('report', root.id)"
      @mark="$emit('mark', root.id)"
      @unmark="$emit('unmark')"
    />

    <div v-if="visibleReplies.length" class="comment-thread__replies">
      <CommentItem
        v-for="reply in visibleReplies"
        :key="reply.id"
        :comment="reply"
        :depth="1"
        :authenticated="authenticated"
        :current-user-id="currentUserId"
        :can-delete="canDelete"
        :can-reply="canReply"
        :marked-comment-id="markedCommentId"
        :mark-label="markLabel"
        :like-pending="likePending(reply.id)"
        :action-pending="actionPending(reply.id) || mutationPending"
        @seek="$emit('seek', $event)"
        @like="$emit('like', reply.id)"
        @reply="replyingTo = reply"
        @edit="editing = reply"
        @delete="$emit('delete', reply.id)"
        @report="$emit('report', reply.id)"
      />
    </div>

    <button
      v-if="showExpand"
      type="button"
      class="comment-thread__expand"
      data-test="expand-replies"
      :disabled="loadingReplies"
      @click="$emit('expand', root.id)"
    >
      <MessagesSquare :size="15" aria-hidden="true" />
      {{ loadingReplies ? '加载中...' : `展开全部 ${root.reply_count} 条回复` }}
    </button>
    <button
      v-else-if="expanded && hasMoreReplies"
      type="button"
      class="comment-thread__expand"
      :disabled="loadingReplies"
      @click="$emit('more-replies', root.id)"
    >继续加载回复</button>

    <CommentComposer
      v-if="replyingTo"
      :key="`reply-${replyingTo.id}`"
      class="comment-thread__composer"
      dense
      :reply-to-name="replyingTo.author.display_name || replyingTo.author.username"
      :current-time="currentTime"
      :initial-content="replyDraftContent"
      submit-label="回复"
      :submitting="mutationPending"
      @cancel="replyingTo = null"
      @content-change="scheduleReplyDraft"
      @submit="submitReply"
    />
    <CommentComposer
      v-if="editing"
      :key="`edit-${editing.id}`"
      class="comment-thread__composer"
      dense
      :initial-content="editing.content"
      :initial-attachment-ids="editing.attachments.map(({ id }) => id)"
      :initial-mentions="editing.mentions"
      submit-label="保存"
      :submitting="mutationPending"
      @cancel="editing = null"
      @submit="submitEdit"
    />
    <p v-if="mutationError" class="comment-thread__error" role="alert">{{ mutationError }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MessagesSquare } from 'lucide-vue-next'

import type { CommentDTO, CreateCommentInput } from '@/api/comments'
import CommentComposer from './CommentComposer.vue'
import CommentItem from './CommentItem.vue'
import { referencePublishErrorMessage } from '@/composables/useReferenceAutocomplete'
import { useCommentDraft } from '@/composables/useCommentDraft'

defineOptions({ name: 'CommentThread' })

const props = withDefaults(defineProps<{
  root: CommentDTO
  replies?: CommentDTO[]
  expanded?: boolean
  loadingReplies?: boolean
  hasMoreReplies?: boolean
  authenticated?: boolean
  currentUserId?: string
  canMark?: boolean
  canDelete?: boolean
  canReply?: boolean
  markedCommentId?: string | null
  markLabel?: '置顶' | '最佳回答'
  currentTime?: () => number | null
  likePending?: (id: string) => boolean
  actionPending?: (id: string) => boolean
  draftKeyFor?: (commentId: string) => string
  onReply?: (comment: CommentDTO, input: CreateCommentInput) => Promise<unknown>
  onEdit?: (comment: CommentDTO, input: CreateCommentInput) => Promise<unknown>
}>(), {
  replies: undefined,
  expanded: false,
  loadingReplies: false,
  hasMoreReplies: false,
  authenticated: false,
  currentUserId: '',
  canMark: false,
  canDelete: false,
  canReply: true,
  markedCommentId: null,
  markLabel: '置顶',
  currentTime: undefined,
  likePending: () => false,
  actionPending: () => false,
  draftKeyFor: undefined,
  onReply: undefined,
  onEdit: undefined,
})

const emit = defineEmits<{
  seek: [seconds: number]
  like: [commentId: string]
  delete: [commentId: string]
  report: [commentId: string]
  mark: [commentId: string]
  unmark: []
  expand: [rootId: string]
  'more-replies': [rootId: string]
}>()

const replyingTo = ref<CommentDTO | null>(null)
const editing = ref<CommentDTO | null>(null)
const mutationPending = ref(false)
const mutationError = ref('')
const replyDraftContent = ref('')
const commentDraft = useCommentDraft()
const allReplies = computed(() => props.replies ?? props.root.replies)
const visibleReplies = computed(() => props.expanded ? allReplies.value : allReplies.value.slice(0, 3))
const showExpand = computed(() => !props.expanded && props.root.reply_count > visibleReplies.value.length)

watch(replyingTo, (comment) => {
  replyDraftContent.value = comment && props.draftKeyFor ? commentDraft.read(props.draftKeyFor(comment.id)) : ''
})

function actionPending(commentId: string) {
  return props.actionPending?.(commentId) ?? false
}

function scheduleReplyDraft(content: string) {
  replyDraftContent.value = content
  if (replyingTo.value && props.draftKeyFor) {
    commentDraft.schedule(props.draftKeyFor(replyingTo.value.id), content)
  }
}

async function submitReply(input: CreateCommentInput) {
  if (!replyingTo.value) return
  const submitted = replyingTo.value
  mutationPending.value = true
  mutationError.value = ''
  try {
    await props.onReply?.(submitted, input)
    if (props.draftKeyFor) commentDraft.clear(props.draftKeyFor(submitted.id))
    replyDraftContent.value = ''
    if (replyingTo.value?.id === submitted.id) replyingTo.value = null
  } catch (error) {
    if (replyingTo.value?.id === submitted.id) {
      mutationError.value = referencePublishErrorMessage(error, '回复失败，请重试')
    }
  } finally {
    mutationPending.value = false
  }
}

async function submitEdit(input: CreateCommentInput) {
  if (!editing.value) return
  const submitted = editing.value
  mutationPending.value = true
  mutationError.value = ''
  try {
    await props.onEdit?.(submitted, input)
    if (editing.value?.id === submitted.id) editing.value = null
  } catch (error) {
    if (editing.value?.id === submitted.id) {
      mutationError.value = referencePublishErrorMessage(error, '保存失败，请重试')
    }
  } finally {
    mutationPending.value = false
  }
}
</script>

<style scoped>
.comment-thread { display: grid; min-width: 0; gap: 0.4rem; }
.comment-thread__replies { display: grid; gap: 0; margin-left: clamp(0.5rem, 2vw, 1rem); padding-left: 0.65rem; border-left: 2px solid var(--a-color-border-soft); }
.comment-thread__expand { display: inline-flex; align-items: center; justify-content: flex-start; gap: 0.4rem; width: fit-content; min-height: 2.25rem; padding: 0 0.55rem; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-primary); cursor: pointer; font: inherit; font-size: var(--a-text-sm); }
.comment-thread__expand:hover:not(:disabled) { background: var(--a-color-surface-muted); }
.comment-thread__expand:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.comment-thread__expand:disabled { cursor: not-allowed; opacity: 0.6; }
.comment-thread__composer { margin-left: clamp(0.5rem, 2vw, 1rem); }
.comment-thread__error { margin: 0; padding-left: clamp(0.5rem, 2vw, 1rem); color: var(--a-color-accent-destructive); font-size: var(--a-text-sm); }
@media (max-width: 560px) { .comment-thread { gap: 0.4rem; } .comment-thread__replies { margin-left: 0.4rem; padding-left: 0.55rem; } .comment-thread__composer { margin-left: 0.4rem; } .comment-thread__error { padding-left: 0.4rem; } }
</style>
