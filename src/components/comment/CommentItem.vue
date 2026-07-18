<template>
  <article
    :id="`comment-${comment.id}`"
    class="comment-item"
    :class="{ 'comment-item--child': depth === 1 }"
    :data-comment-depth="depth"
    tabindex="-1"
  >
    <header class="comment-item__header">
      <PAvatar :src="comment.author.avatar_url" :name="authorName" :size="depth ? 'xs' : 'sm'" />
      <div class="comment-item__identity">
        <strong>{{ authorName }}</strong>
        <span>@{{ comment.author.username }}</span>
      </div>
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
      <div class="comment-item__content" data-test="comment-content" v-html="comment.rendered_html" />
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

    <footer class="comment-item__footer">
      <time :datetime="comment.created_at">{{ formatDate(comment.created_at) }}</time>
      <time
        v-if="comment.edited_at"
        data-test="edited-at"
        :datetime="comment.edited_at"
        :title="comment.edited_at"
      >已编辑 {{ formatDate(comment.edited_at) }}</time>
      <div v-if="authenticated" class="comment-item__actions">
        <button type="button" :aria-pressed="comment.liked" :disabled="likePending" title="点赞" @click="$emit('like')">
          <Heart :size="15" :fill="comment.liked ? 'currentColor' : 'none'" />
          <span>{{ comment.like_count || '' }}</span>
        </button>
        <button v-if="canReply" type="button" data-test="reply-comment" title="回复" @click="$emit('reply')"><Reply :size="15" /></button>
        <button v-if="isOwner" type="button" title="编辑" @click="$emit('edit')"><Pencil :size="15" /></button>
        <button v-if="isOwner || canDelete" type="button" title="删除" data-test="delete-comment" @click="$emit('delete')"><Trash2 :size="15" /></button>
        <button type="button" title="举报" @click="$emit('report')"><Flag :size="15" /></button>
        <button v-if="canMark && depth === 0 && !showMarked" type="button" :title="markLabel" @click="$emit('mark')"><Pin :size="15" /></button>
        <button v-if="canMark && depth === 0 && showMarked" type="button" :title="`取消${markLabel}`" @click="$emit('unmark')"><PinOff :size="15" /></button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BadgeCheck, Flag, Heart, Pencil, Pin, PinOff, Play, Reply, Trash2 } from 'lucide-vue-next'

import type { CommentDTO } from '@/api/comments'
import PAvatar from '@/components/ui/PAvatar.vue'

defineOptions({ name: 'CommentItem' })

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
const authorName = computed(() => props.comment.author.display_name || props.comment.author.username)
const isFolded = computed(() => props.comment.status === 'auto_folded')
const isOwner = computed(() => Boolean(props.currentUserId && props.currentUserId === props.comment.author_id))
const showMarked = computed(() => props.depth === 0 && (props.markedCommentId
  ? props.markedCommentId === props.comment.id
  : props.comment.marked))

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function anchorText(start: number, end: number) {
  return Array.from(props.comment.content).slice(start, end).join('')
}
</script>

<style scoped>
.comment-item { min-width: 0; padding: 1rem; border: 1px solid var(--a-color-border-soft); background: var(--a-color-bg); }
.comment-item--child { border: 0; border-top: 1px solid var(--a-color-border-soft); background: var(--a-color-surface); }
.comment-item__header { display: flex; align-items: center; gap: 0.6rem; min-height: 32px; }
.comment-item__identity { display: flex; min-width: 0; align-items: baseline; gap: 0.4rem; }
.comment-item__identity strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.comment-item__identity span, .comment-item__reply-to, .comment-item__floor { color: var(--a-color-text-secondary); font-size: 0.75rem; }
.comment-item__reply-to { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.comment-item__floor { margin-left: auto; font-family: var(--a-font-sans); }
.comment-item__marked { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.4rem; border: 1px solid var(--a-color-text); font-size: 0.7rem; font-weight: 800; }
.comment-item__content { padding: 0.85rem 0; overflow-wrap: anywhere; line-height: 1.7; }
.comment-item__content :deep(p) { margin: 0 0 0.55rem; }
.comment-item__content :deep(p:last-child) { margin-bottom: 0; }
.comment-item__content :deep(blockquote) { margin: 0.5rem 0; padding-left: 0.8rem; border-left: 3px solid var(--a-color-border); color: var(--a-color-text-secondary); }
.comment-item__content :deep(a) { color: var(--a-color-accent-link, #2457a6); }
.comment-item__images { display: grid; grid-template-columns: repeat(2, minmax(0, 240px)); gap: 0.5rem; margin-bottom: 0.8rem; }
.comment-item__images img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border: 1px solid var(--a-color-border-soft); }
.comment-item__anchors { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
.comment-item__anchors button { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 32px; padding: 0 0.55rem; border: 1px solid var(--a-color-border-soft); background: transparent; color: var(--a-color-text); cursor: pointer; }
.comment-item__folded { display: flex; align-items: center; gap: 0.5rem; min-height: 48px; margin: 0.75rem 0; padding: 0 0.75rem; border-left: 3px solid var(--a-color-text-secondary); background: var(--a-color-surface-muted); color: var(--a-color-text-secondary); font-size: var(--a-text-sm); }
.comment-item__folded button { margin-left: auto; min-width: 44px; min-height: 32px; border: 0; background: transparent; color: var(--a-color-text); text-decoration: underline; cursor: pointer; }
.comment-item__footer { display: flex; align-items: center; gap: 0.65rem; min-height: 32px; color: var(--a-color-text-secondary); font-size: 0.72rem; }
.comment-item__actions { display: flex; align-items: center; gap: 0.15rem; margin-left: auto; }
.comment-item__actions button { display: inline-flex; align-items: center; justify-content: center; gap: 0.2rem; min-width: 36px; height: 36px; border: 0; background: transparent; color: var(--a-color-text-secondary); cursor: pointer; }
.comment-item__actions button:hover, .comment-item__actions button:focus-visible { color: var(--a-color-text); background: var(--a-color-surface-muted); }
@media (max-width: 600px) { .comment-item { padding: 0.75rem; } .comment-item__header { flex-wrap: wrap; } .comment-item__reply-to { width: 100%; padding-left: 1.8rem; } .comment-item__footer { flex-wrap: wrap; } .comment-item__actions { width: 100%; margin-left: 0; } }
</style>
