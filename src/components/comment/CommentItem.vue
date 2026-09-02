<template>
  <PInteractionCard
    :id="`comment-${comment.id}`"
    class="comment-item"
    :class="{ 'comment-item--child': depth === 1 }"
    variant="flat"
    :data-comment-depth="depth"
    tabindex="-1"
  >
    <header class="comment-item__header">
      <UserSummaryCard
        :user="comment.author"
        :compact="depth === 1"
        :avatar-size="depth ? 'xs' : 'sm'"
        link
      />
      <time class="comment-item__time" :datetime="comment.created_at" :title="comment.created_at">{{ formatDate(comment.created_at) }}</time>
      <span v-if="comment.reply_to_author" class="comment-item__reply-to">
        回复 @{{ comment.reply_to_author.username }}
      </span>
      <span v-if="showMarked" class="comment-item__marked" data-test="marked-label">
        <BadgeCheck :size="14" aria-hidden="true" />{{ markLabel }}
      </span>
      <span v-if="depth === 0 && comment.floor_number" class="comment-item__floor">#{{ comment.floor_number }}</span>
    </header>

    <div v-if="isFolded && !revealed" class="comment-item__folded">
      <Flag :size="16" aria-hidden="true" />
      <span>因多次举报已折叠</span>
      <button type="button" data-test="reveal-comment" @click="revealed = true">查看</button>
    </div>

    <template v-else>
      <CommentContent :html="renderedContent" />
      <div v-if="comment.attachments.length" class="comment-item__images">
        <a
          v-for="attachment in comment.attachments"
          :key="attachment.id"
          :href="attachment.url"
          target="_blank"
          rel="noreferrer"
        >
          <img :src="attachment.url" alt="评论图片" loading="lazy" />
        </a>
      </div>
      <div v-if="comment.time_anchors.length" class="comment-item__anchors" aria-label="时间点">
        <button
          v-for="anchor in comment.time_anchors"
          :key="`${anchor.start}:${anchor.end}`"
          type="button"
          data-test="time-anchor"
          @click="$emit('seek', anchor.seconds)"
        >
          <Play :size="13" fill="currentColor" aria-hidden="true" />
          {{ anchorText(anchor.start, anchor.end) }}
        </button>
      </div>
    </template>

    <footer v-if="comment.edited_at || authenticated" class="comment-item__footer">
      <time
        v-if="comment.edited_at"
        data-test="edited-at"
        :datetime="comment.edited_at"
        :title="comment.edited_at"
      >已编辑 {{ formatDate(comment.edited_at) }}</time>
      <div v-if="authenticated" class="comment-item__actions">
        <button type="button" :aria-pressed="comment.liked" :aria-label="comment.liked ? '取消点赞' : '点赞'" :disabled="likePending || actionPending" title="点赞" @click="$emit('like')">
          <Heart :size="15" :fill="comment.liked ? 'currentColor' : 'none'" />
          <span>{{ comment.like_count || '' }}</span>
        </button>
        <button v-if="canReply && !isFolded" type="button" data-test="reply-comment" title="回复" aria-label="回复" :disabled="actionPending" @click="$emit('reply')"><Reply :size="15" /></button>
        <button v-if="isOwner" type="button" title="编辑" aria-label="编辑" :disabled="actionPending" @click="$emit('edit')"><Pencil :size="15" /></button>
        <button v-if="isOwner || canDelete" type="button" title="删除" aria-label="删除" data-test="delete-comment" :disabled="actionPending" @click="$emit('delete')"><Trash2 :size="15" /></button>
        <button v-if="!isOwner" type="button" title="举报" aria-label="举报" :disabled="actionPending" @click="$emit('report')"><Flag :size="15" /></button>
        <button v-if="canMark && depth === 0 && !showMarked && !isFolded" type="button" :title="markLabel" :aria-label="markLabel" :disabled="actionPending" @click="$emit('mark')"><Pin :size="15" /></button>
        <button v-if="canMark && depth === 0 && showMarked" type="button" :title="`取消${markLabel}`" :aria-label="`取消${markLabel}`" :disabled="actionPending" @click="$emit('unmark')"><PinOff :size="15" /></button>
      </div>
    </footer>
  </PInteractionCard>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, type VNodeChild } from 'vue'
import { IconRosetteDiscountCheck as BadgeCheck, IconFlag as Flag, IconHeart as Heart, IconPencil as Pencil, IconPin as Pin, IconPinnedOff as PinOff, IconPlayerPlay as Play, IconArrowBackUp as Reply, IconTrash as Trash2 } from '@tabler/icons-vue'

import type { CommentDTO } from '@/api/comments'
import PInteractionCard from '@/components/ui/PInteractionCard.vue'
import { renderCommentMarkdown } from '@/composables/useCommentMarkdown'
import { applyResolvedReferences } from '@/composables/useReferenceRendering'
import UserSummaryCard from '@/components/user/UserSummaryCard.vue'

defineOptions({ name: 'CommentItem' })

const allowedCommentTags = new Set(['p', 'br', 'strong', 'em', 'code', 'a', 'blockquote'])

function toCommentVNodes(html: string): VNodeChild[] {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(document.body.childNodes).map(toCommentVNode)
}

function toCommentVNode(node: Node): VNodeChild {
  if (node.nodeType === 3) return node.textContent ?? ''
  if (node.nodeType !== 1) return null

  const element = node as Element
  const tag = element.tagName.toLowerCase()
  const children = Array.from(element.childNodes).map(toCommentVNode)
  if (!allowedCommentTags.has(tag)) return children
  if (tag === 'a') {
    return h('a', {
      href: element.getAttribute('href') ?? '',
      rel: element.getAttribute('rel') ?? undefined,
    }, children)
  }
  return h(tag, children)
}

const CommentContent = defineComponent({
  name: 'CommentContent',
  props: {
    html: { type: String, required: true },
  },
  setup(props) {
    return () => h('div', {
      class: 'comment-item__content',
      'data-test': 'comment-content',
    }, toCommentVNodes(props.html))
  },
})

const props = withDefaults(defineProps<{
  comment: CommentDTO
  depth?: 0 | 1
  authenticated?: boolean
  currentUserId?: string
  canMark?: boolean
  canDelete?: boolean
  canReply?: boolean
  markedCommentId?: string | null
  markLabel?: '置顶' | '最佳回答'
  likePending?: boolean
  actionPending?: boolean
}>(), {
  depth: 0,
  authenticated: false,
  currentUserId: '',
  canMark: false,
  canDelete: false,
  canReply: true,
  markedCommentId: null,
  markLabel: '置顶',
  likePending: false,
  actionPending: false,
})

defineEmits<{
  seek: [seconds: number]
  like: []
  reply: []
  edit: []
  delete: []
  report: []
  mark: []
  unmark: []
}>()

const revealed = ref(false)
const isFolded = computed(() => props.comment.status === 'auto_folded')
const isOwner = computed(() => Boolean(props.currentUserId && props.currentUserId === props.comment.author_id))
const showMarked = computed(() => props.depth === 0 && (props.markedCommentId
  ? props.markedCommentId === props.comment.id
  : props.comment.marked))
const renderedContent = computed(() => {
  const rendered = renderCommentMarkdown(applyResolvedReferences(props.comment.content, props.comment.references))
  return rendered.ok ? rendered.html : props.comment.rendered_html
})

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (elapsedSeconds < 60) return '刚刚'
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)} 分钟前`
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)} 小时前`
  if (elapsedSeconds < 604800) return `${Math.floor(elapsedSeconds / 86400)} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function anchorText(start: number, end: number) {
  return Array.from(props.comment.content).slice(start, end).join('')
}
</script>

<style scoped>
.comment-item {
  min-width: 0;
  padding: 0.75rem 0 0.65rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}

.comment-item--child {
  padding: 0.55rem 0;
  border-bottom: 0;
}

.comment-item__header { display: flex; align-items: center; gap: 0.45rem; min-height: 2rem; min-width: 0; }
.comment-item__header :deep(.user-summary-card__metrics), .comment-item__header :deep(.user-summary-card__handle) { display: none; }
.comment-item__time, .comment-item__reply-to, .comment-item__floor { color: var(--a-color-muted); font-size: var(--a-text-xs); }
.comment-item__time { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.comment-item__reply-to { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.comment-item__floor { margin-left: auto; font-variant-numeric: tabular-nums; white-space: nowrap; }
.comment-item__marked { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.45rem; border: 1px solid color-mix(in srgb, var(--a-color-primary) 35%, var(--a-color-border-soft)); border-radius: var(--a-radius-control); background: color-mix(in srgb, var(--a-color-primary) 8%, var(--a-color-bg)); color: var(--a-color-primary); font-size: var(--a-text-xs); font-weight: var(--a-font-weight-strong); white-space: nowrap; }
.comment-item__content { padding: 0.4rem 0; overflow-wrap: anywhere; color: var(--a-color-text); line-height: 1.55; }
.comment-item__content :deep(p) { margin: 0 0 0.4rem; }
.comment-item__content :deep(p:last-child) { margin-bottom: 0; }
.comment-item__content :deep(blockquote) { margin: 0.65rem 0; padding: 0.2rem 0 0.2rem 0.8rem; border-left: 3px solid var(--a-color-border); color: var(--a-color-text-secondary); }
.comment-item__content :deep(a) { color: var(--a-color-primary); }
.comment-item__images { display: grid; grid-template-columns: repeat(2, minmax(0, 240px)); gap: 0.5rem; margin-bottom: 0.9rem; }
.comment-item__images a { display: block; overflow: hidden; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); }
.comment-item__images img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; transition: transform 0.2s ease; }
.comment-item__images a:hover img { transform: scale(1.02); }
.comment-item__anchors { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.85rem; }
.comment-item__anchors button { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 44px; padding: 0 0.65rem; border: 1px solid var(--a-color-border-soft); border-radius: var(--a-radius-control); background: var(--a-color-surface); color: var(--a-color-text-secondary); cursor: pointer; font: inherit; font-size: var(--a-text-sm); }
.comment-item__anchors button:hover { border-color: var(--a-color-primary); color: var(--a-color-primary); }
.comment-item__anchors button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.comment-item__folded { display: flex; align-items: center; gap: 0.5rem; min-height: 52px; margin: 0.75rem 0; padding: 0.75rem; border-left: 3px solid var(--a-color-border); background: var(--a-color-surface); color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.comment-item__folded button { margin-left: auto; min-width: 44px; min-height: 44px; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-primary); cursor: pointer; font: inherit; }
.comment-item__folded button:hover { background: var(--a-color-surface-muted); }
.comment-item__folded button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.comment-item__footer { display: flex; align-items: center; gap: 0.35rem; min-height: 2rem; color: var(--a-color-muted); font-size: var(--a-text-xs); }
.comment-item__footer time { white-space: nowrap; }
.comment-item__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.1rem; margin-left: auto; }
.comment-item__actions button { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem; min-width: 2rem; min-height: 2rem; padding: 0 0.4rem; border: 0; border-radius: var(--a-radius-control); background: transparent; color: var(--a-color-muted); cursor: pointer; font: inherit; }
.comment-item__actions button:hover:not(:disabled), .comment-item__actions button:focus-visible { background: var(--a-color-surface-muted); color: var(--a-color-text); }
.comment-item__actions button[aria-pressed="true"] { color: var(--a-color-primary); }
.comment-item__actions button:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }
.comment-item__actions button:disabled { cursor: not-allowed; opacity: 0.5; }
@media (max-width: 600px) { .comment-item { padding: 0.75rem 0; } .comment-item__header { flex-wrap: wrap; } .comment-item__reply-to { width: 100%; padding-left: 1.8rem; } .comment-item__footer { align-items: flex-start; flex-wrap: wrap; } .comment-item__footer time { min-height: 32px; display: inline-flex; align-items: center; } .comment-item__actions { width: 100%; margin-left: 0; } .comment-item__actions button { min-width: 2.75rem; min-height: 2.75rem; } .comment-item__images { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
