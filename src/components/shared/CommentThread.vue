<template>
  <section class="comment-thread">
    <form v-if="canComment" class="comment-thread__form" @submit.prevent="submitComment()">
      <textarea
        v-model="draft"
        class="comment-thread__input"
        rows="3"
        :placeholder="replyingTo ? `回复 ${replyingToName}` : '写下评论'"
        :disabled="submitting"
      />
      <div class="comment-thread__actions">
        <button v-if="replyingTo" type="button" class="comment-thread__ghost" @click="cancelReply">
          取消
        </button>
        <button type="submit" class="comment-thread__submit" :disabled="!draft.trim() || submitting">
          {{ submitting ? '发送中' : '发送' }}
        </button>
      </div>
    </form>

    <div v-if="loading" class="comment-thread__state">加载中</div>
    <div v-else-if="!items.length" class="comment-thread__state">还没有评论</div>

    <div v-else class="comment-thread__list">
      <article v-for="comment in items" :key="comment.id" class="comment-thread__item">
        <CommentNode
          :comment="comment"
          :can-comment="canComment"
          :can-delete="canDelete"
          @reply="startReply"
          @delete="$emit('delete', $event)"
        />

        <div v-if="comment.replies?.length" class="comment-thread__replies">
          <CommentNode
            v-for="reply in comment.replies"
            :key="reply.id"
            :comment="reply"
            :can-comment="canComment"
            :can-delete="canDelete"
            is-reply
            @reply="startReply"
            @delete="$emit('delete', $event)"
          />
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import type { InteractionComment } from '@/types'

type SubmitPayload = { content: string; parentCommentId?: string }

const props = defineProps<{
  items: InteractionComment[]
  loading?: boolean
  submitting?: boolean
  canComment?: boolean
  canDelete?: boolean
  submitAction?: (payload: SubmitPayload) => void | Promise<void>
}>()

const emit = defineEmits<{
  submit: [payload: SubmitPayload]
  delete: [commentId: string]
}>()

const draft = ref('')
const replyingTo = ref<InteractionComment | null>(null)
const replyingToName = computed(() => displayName(replyingTo.value))

function displayName(comment: InteractionComment | null) {
  return comment?.user?.display_name || comment?.user?.username || '匿名'
}

function contentWithReplyTo(comment: InteractionComment) {
  const username = comment.reply_to_user?.username
  if (!username) return comment.content
  const mention = `@${username}`
  return comment.content.includes(mention) ? comment.content : `${mention} ${comment.content}`
}

function startReply(comment: InteractionComment) {
  replyingTo.value = comment
}

function cancelReply() {
  replyingTo.value = null
}

async function submitComment() {
  const content = draft.value.trim()
  if (!content) return

  const payload = {
    content,
    ...(replyingTo.value ? { parentCommentId: replyingTo.value.id } : {}),
  }
  if (props.submitAction) {
    await props.submitAction(payload)
    draft.value = ''
    replyingTo.value = null
    return
  }
  emit('submit', payload)
}

const CommentNode = defineComponent({
  props: {
    comment: { type: Object as () => InteractionComment, required: true },
    canComment: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    isReply: { type: Boolean, default: false },
  },
  emits: ['reply', 'delete'],
  setup(props, { emit }) {
    return () => h('div', {
      class: ['comment-thread__node', props.isReply ? 'comment-thread__node--reply' : ''],
    }, [
      h('div', { class: 'comment-thread__meta' }, [
        h('span', { class: 'comment-thread__author' }, displayName(props.comment)),
        h('time', { class: 'comment-thread__time', datetime: props.comment.created_at }, new Date(props.comment.created_at).toLocaleDateString('zh-CN')),
      ]),
      h('p', { class: 'comment-thread__content' }, contentWithReplyTo(props.comment)),
      h('div', { class: 'comment-thread__node-actions' }, [
        props.canComment
          ? h('button', {
              type: 'button',
              class: 'comment-thread__reply',
              onClick: () => emit('reply', props.comment),
            }, '回复')
          : null,
        props.canDelete
          ? h('button', {
              type: 'button',
              class: 'comment-thread__delete',
              onClick: () => emit('delete', props.comment.id),
            }, '删除')
          : null,
      ]),
    ])
  },
})
</script>

<style scoped>
.comment-thread {
  display: grid;
  gap: 1rem;
}

.comment-thread__form {
  display: grid;
  gap: 0.75rem;
}

.comment-thread__input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--a-color-line-soft);
  border-radius: 0.75rem;
  padding: 0.875rem;
  background: var(--a-color-bg);
  color: var(--a-color-fg);
  font: inherit;
  resize: vertical;
}

.comment-thread__actions,
.comment-thread__node-actions,
.comment-thread__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.comment-thread__actions {
  justify-content: flex-end;
}

.comment-thread__submit,
.comment-thread__ghost,
.comment-thread__reply,
.comment-thread__delete {
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  padding: 0;
}

.comment-thread__submit {
  border: 1px solid var(--a-color-fg);
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
}

.comment-thread__submit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.comment-thread__ghost,
.comment-thread__reply,
.comment-thread__delete,
.comment-thread__time,
.comment-thread__state {
  color: var(--a-color-muted);
  font-size: 0.875rem;
}

.comment-thread__list {
  display: grid;
  gap: 1rem;
}

.comment-thread__item,
.comment-thread__node {
  display: grid;
  gap: 0.5rem;
}

.comment-thread__replies {
  display: grid;
  gap: 0.75rem;
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 1px solid var(--a-color-line-soft);
}

.comment-thread__author {
  font-weight: var(--a-font-weight-strong, 700);
}

.comment-thread__content {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
}
</style>
