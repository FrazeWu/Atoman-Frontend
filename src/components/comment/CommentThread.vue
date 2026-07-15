<template>
  <section class="comment-thread">
    <CommentItem
      :comment="root"
      :authenticated="authenticated"
      :current-user-id="currentUserId"
      :can-mark="canMark"
      :marked-comment-id="markedCommentId"
      :mark-label="markLabel"
      :like-pending="likePending(root.id)"
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
        :marked-comment-id="markedCommentId"
        :mark-label="markLabel"
        :like-pending="likePending(reply.id)"
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
      class="comment-thread__composer"
      :reply-to-name="replyingTo.author.display_name || replyingTo.author.username"
      :current-time="currentTime"
      submit-label="回复"
      @cancel="replyingTo = null"
      @submit="submitReply"
    />
    <CommentComposer
      v-if="editing"
      class="comment-thread__composer"
      :initial-content="editing.content"
      :initial-attachment-ids="editing.attachments.map(({ id }) => id)"
      submit-label="保存"
      @cancel="editing = null"
      @submit="submitEdit"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessagesSquare } from 'lucide-vue-next'

import type { CommentDTO, CreateCommentInput } from '@/api/comments'
import CommentComposer from './CommentComposer.vue'
import CommentItem from './CommentItem.vue'

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
  markedCommentId?: string | null
  markLabel?: '置顶' | '最佳回答'
  currentTime?: () => number | null
  likePending?: (id: string) => boolean
}>(), {
  replies: undefined,
  expanded: false,
  loadingReplies: false,
  hasMoreReplies: false,
  authenticated: false,
  currentUserId: '',
  canMark: false,
  markedCommentId: null,
  markLabel: '置顶',
  currentTime: undefined,
  likePending: () => false,
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
  reply: [comment: CommentDTO, input: CreateCommentInput]
  edit: [comment: CommentDTO, input: CreateCommentInput]
}>()

const replyingTo = ref<CommentDTO | null>(null)
const editing = ref<CommentDTO | null>(null)
const allReplies = computed(() => props.replies ?? props.root.replies)
const visibleReplies = computed(() => props.expanded ? allReplies.value : allReplies.value.slice(0, 3))
const showExpand = computed(() => !props.expanded && props.root.reply_count > visibleReplies.value.length)

function submitReply(input: CreateCommentInput) {
  if (!replyingTo.value) return
  emit('reply', replyingTo.value, input)
  replyingTo.value = null
}

function submitEdit(input: CreateCommentInput) {
  if (!editing.value) return
  emit('edit', editing.value, input)
  editing.value = null
}
</script>

<style scoped>
.comment-thread { min-width: 0; border: 1px solid var(--a-color-ink); box-shadow: var(--a-shadow-paper-sm); }
.comment-thread > :deep(.comment-item:first-child) { border: 0; }
.comment-thread__replies { margin-left: clamp(0.75rem, 4vw, 3rem); border-left: 2px solid var(--a-color-line); }
.comment-thread__expand { display: flex; align-items: center; justify-content: center; gap: 0.4rem; width: 100%; min-height: 42px; border: 0; border-top: 1px solid var(--a-color-line-soft); background: var(--a-color-paper-soft); color: var(--a-color-ink); cursor: pointer; }
.comment-thread__composer { margin: 0.75rem; }
@media (max-width: 560px) { .comment-thread__replies { margin-left: 0.5rem; } }
</style>
