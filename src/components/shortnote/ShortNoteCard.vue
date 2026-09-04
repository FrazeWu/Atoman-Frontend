<template>
  <PInteractionCard
    :id="`note-${note.id}`"
    class="sticky-memo-card"
    :class="{ 'is-read': isRead }"
    variant="flat"
    :ref="setCardAnchor"
    @mouseenter="handleMouseEnter"
  >
    <!-- 1. 紧凑单行头部：作者头像 + 作者 + 相对时间 + 短笺标签 + 作者微操作 -->
    <header class="sticky-memo-head">
      <div class="sticky-memo-head__main">
        <PAvatar
          :src="note.user?.avatar_url"
          :name="author"
          :alt="`${author} 的头像`"
          size="xs"
        />
        <span class="sticky-author">{{ author }}</span>
        <span v-if="note.user?.username" class="sticky-handle">@{{ note.user.username }}</span>
        <span
          class="sticky-stat"
          :aria-label="`点赞率 ${likeRate}，赞踩总数 ${voteTotal}`"
          title="点赞率（赞踩总数）"
        >
          <Heart :size="11" aria-hidden="true" />{{ likeRate }}({{ voteTotal }})
        </span>
        <span class="sticky-time">{{ formatDate(note.created_at) }}</span>
        <span class="sticky-badge">短笺</span>
        <span v-if="note.edited" class="sticky-edited">已编辑</span>
      </div>

      <div v-if="isOwner" class="sticky-owner-actions">
        <RouterLink
          :to="`/posts/notes/${note.id}/edit`"
          class="sticky-action-btn"
          aria-label="编辑短笺"
          title="编辑短笺"
        >
          <Pencil :size="13" />
        </RouterLink>
        <button
          type="button"
          class="sticky-action-btn is-danger"
          aria-label="删除短笺"
          title="删除短笺"
          @click="$emit('delete', note)"
        >
          <Trash2 :size="13" />
        </button>
      </div>
    </header>

    <!-- 2. 正文与灵感文字 -->
    <div
      class="sticky-memo-body"
      role="button"
      tabindex="0"
      :aria-expanded="showComments"
      @click="toggleComments"
      @keydown.enter="toggleComments"
      @keydown.space="toggleComments"
    >
      <p class="sticky-content">{{ note.content }}</p>

      <!-- 媒体多图缩略平铺 -->
      <div
        v-if="note.media && note.media.length"
        class="sticky-media-grid"
        :class="`count-${Math.min(note.media.length, 9)}`"
      >
        <div
          v-for="(item, idx) in note.media"
          :key="item.id"
          class="sticky-media-thumb"
          @click.stop.prevent="openLightbox(idx)"
        >
          <img :src="resolveMediaURL(item.url)" alt="短笺图片" loading="lazy" />
        </div>
      </div>
    </div>

    <!-- 3. 极轻量互动操作栏 -->
    <footer class="sticky-memo-footer" @click.stop>
      <PInteractionActions
        :liked="viewerVote === 'up'"
        :like-count="interactions.likeCount.value"
        :disliked="viewerVote === 'down'"
        :dislike-count="dislikeCount"
        :disabled="votePending || !authStore.isAuthenticated"
        :show-ratio-bar="false"
        size="sm"
        @like-change="handleLikeVote"
        @dislike-change="handleDislikeVote"
      />

      <button
        type="button"
        class="sticky-pill-btn"
        :class="{ 'is-active': showComments }"
        @click="toggleComments"
      >
        <MessageSquare :size="13" />
        <span>{{ interactions.commentCount.value ? `${interactions.commentCount.value} 条讨论` : '讨论' }}</span>
      </button>
    </footer>

    <PImageLightbox
      v-model:show="showLightbox"
      :images="mediaUrls"
      :index="lightboxIndex"
    />
  </PInteractionCard>

  <CommentSideSheet
    :show="showComments"
    :title="`短笺讨论-${note.id}`"
    :partial-anchor="cardAnchor"
    :target="{ kind: 'short_note', resourceId: note.id }"
    noun="讨论"
    @close="showComments = false"
    @count-change="interactions.commentCount.value = $event"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { IconHeart as Heart, IconMessage as MessageSquare, IconPencil as Pencil, IconTrash as Trash2 } from '@tabler/icons-vue'
import { RouterLink } from 'vue-router'
import { apiRequestEnvelope } from '@/api/client'
import CommentSideSheet from '@/components/comment/CommentSideSheet.vue'
import PInteractionActions from '@/components/ui/PInteractionActions.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PInteractionCard from '@/components/ui/PInteractionCard.vue'
import PImageLightbox from '@/components/ui/PImageLightbox.vue'
import { useApi } from '@/composables/useApi'
import { useShortNoteSync } from '@/composables/blog/useShortNoteSync'
import { useAuthStore } from '@/stores/auth'
import { useInteractions } from '@/composables/useInteractions'
import { resolveMediaURL } from '@/utils/mediaUrl'
import type { ShortNote } from '@/types'

const props = defineProps<{ note: ShortNote }>()
defineEmits<{ delete: [note: ShortNote] }>()

const api = useApi()
const authStore = useAuthStore()
const { getNoteState, updateNoteState, isNoteRead, markNoteAsRead } = useShortNoteSync()
const interactions = useInteractions('blog', 'short_note', props.note.id)
const dislikeCount = ref(0)
const viewerVote = ref<'up' | 'down' | 'none'>('none')
const votePending = ref(false)
const author = computed(() => props.note.user?.display_name || props.note.user?.username || '匿名用户')
const voteTotal = computed(() => (interactions.likeCount.value || 0) + dislikeCount.value)
const likeRate = computed(() => (
  voteTotal.value === 0 ? '0.0' : (((interactions.likeCount.value || 0) / voteTotal.value) * 100).toFixed(1)
))
const isOwner = computed(() => authStore.user?.uuid === props.note.user_id)
const isRead = computed(() => isNoteRead(props.note.id))

function handleMouseEnter() {
  if (!isRead.value) {
    markNoteAsRead(props.note.id)
  }
}

const showLightbox = ref(false)
const lightboxIndex = ref(0)
const showComments = ref(false)
const cardAnchor = ref<HTMLElement | null>(null)
const mediaUrls = computed(() => props.note.media.map(m => resolveMediaURL(m.url)))

function setCardAnchor(value: unknown) {
  const element = value instanceof HTMLElement
    ? value
    : (value as { $el?: unknown } | null)?.$el
  cardAnchor.value = element instanceof HTMLElement ? element : null
}

function openLightbox(idx: number) {
  lightboxIndex.value = idx
  showLightbox.value = true
}

function toggleComments(event?: Event) {
  if (event) {
    event.stopPropagation()
    event.preventDefault()
  }
  showComments.value = !showComments.value
}

watchEffect(() => {
  const synced = getNoteState(props.note.id)
  const nextViewerVote = synced?.viewerVote ?? props.note.viewer_vote ?? (props.note.liked ? 'up' : 'none')
  viewerVote.value = nextViewerVote
  interactions.liked.value = nextViewerVote === 'up'
  interactions.likeCount.value = synced?.likeCount ?? props.note.likes_count
  dislikeCount.value = synced?.dislikeCount ?? props.note.dislikes_count ?? 0
  interactions.commentCount.value = synced?.commentCount ?? props.note.comments_count
})

watch(() => [interactions.liked.value, interactions.likeCount.value, dislikeCount.value, viewerVote.value, interactions.commentCount.value], () => {
  updateNoteState(props.note.id, {
    liked: interactions.liked.value,
    likeCount: interactions.likeCount.value,
    dislikeCount: dislikeCount.value,
    viewerVote: viewerVote.value,
    commentCount: interactions.commentCount.value,
  })
})

async function setVote(direction: 'up' | 'down' | 'none') {
  if (votePending.value || !authStore.isAuthenticated) return
  votePending.value = true
  try {
    const response = await apiRequestEnvelope<ShortNote>(api.blog.shortNoteVote(props.note.id), {
      method: direction === 'none' ? 'DELETE' : 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      ...(direction === 'none' ? {} : { body: JSON.stringify({ direction }) }),
    })
    const note = response.data
    viewerVote.value = note.viewer_vote ?? 'none'
    interactions.liked.value = viewerVote.value === 'up'
    interactions.likeCount.value = note.likes_count
    dislikeCount.value = note.dislikes_count ?? 0
  } finally {
    votePending.value = false
  }
}

function handleLikeVote(nextLiked: boolean) {
  void setVote(nextLiked ? 'up' : 'none')
}

function handleDislikeVote(nextDisliked: boolean) {
  void setVote(nextDisliked ? 'down' : 'none')
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.sticky-memo-card {
  position: relative;
  display: grid;
  gap: 0.65rem;
  padding: 0.95rem 1rem;
  margin-bottom: 0;
  border: 0;
  border-top: 1px solid var(--a-color-border-soft);
  border-radius: 0;
  background: transparent;
  transition: background-color 0.18s ease;
  overflow: visible;
}

.sticky-memo-card:not(:has(~ .sticky-memo-card)) {
  border-bottom: 1px solid var(--a-color-border-soft);
}

/* 绿色未读指示短竖线 */
.sticky-memo-card::before {
  content: '';
  position: absolute;
  left: 2.5px;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 14px;
  border-radius: 999px;
  background-color: #10b981;
  opacity: 1;
  transition: color 0.18s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

/* 已读状态隐藏绿色短线 */
.sticky-memo-card.is-read::before {
  opacity: 0;
  background-color: transparent;
}

.sticky-memo-card:hover,
.sticky-memo-card:focus-within {
  background: var(--a-color-surface-muted);
}

/* Hover 状态：显示完整贯穿黑线 */
.sticky-memo-card:hover::before,
.sticky-memo-card:focus-within::before {
  top: 0;
  bottom: 0;
  left: 0;
  width: 2.5px;
  height: 100%;
  transform: none;
  border-radius: 0;
  background-color: var(--a-color-text);
  opacity: 1;
}

/* 头部 */
.sticky-memo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.76rem;
}

.sticky-memo-head__main {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  flex-wrap: wrap;
  color: var(--a-color-muted);
}

.sticky-author-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}

.sticky-author {
  font-weight: 650;
  color: var(--a-color-fg);
}

.sticky-handle,
.sticky-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
  color: var(--a-color-muted-soft);
  font-size: 0.72rem;
}

.sticky-handle {
  white-space: nowrap;
}

.sticky-dot {
  color: var(--a-color-muted-soft);
}

.sticky-time {
  color: var(--a-color-muted-soft);
  font-size: 0.72rem;
}

.sticky-edited {
  color: var(--a-color-muted-soft);
  font-size: 0.7rem;
}

.sticky-badge {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 0.1em 0.45em;
  border-radius: var(--a-radius-pill, 999px);
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  color: #d97706;
}

.sticky-owner-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.sticky-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border: none;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-muted-soft);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.sticky-action-btn:hover {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.sticky-action-btn.is-danger:hover {
  color: var(--a-color-danger);
}

/* 正文 */
.sticky-memo-body,
.sticky-memo-footer {
  margin-left: 2.5rem;
}

.sticky-memo-body {
  display: grid;
  gap: 0.55rem;
  cursor: pointer;
}

.sticky-content {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--a-color-fg);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 媒体平铺 */
.sticky-media-grid {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.2rem;
}

.sticky-media-grid.count-1 { grid-template-columns: minmax(0, 240px); }
.sticky-media-grid.count-2 { grid-template-columns: repeat(2, minmax(0, 160px)); }
.sticky-media-grid.count-3,
.sticky-media-grid.count-4 { grid-template-columns: repeat(2, minmax(0, 140px)); }
.sticky-media-grid.count-5,
.sticky-media-grid.count-6,
.sticky-media-grid.count-7,
.sticky-media-grid.count-8,
.sticky-media-grid.count-9 { grid-template-columns: repeat(3, minmax(0, 120px)); }

.sticky-media-thumb {
  aspect-ratio: 1;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
}

.sticky-media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.sticky-media-thumb:hover img {
  transform: scale(1.04);
}

/* 底部操作栏 */
.sticky-memo-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.35rem;
}

.sticky-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.65rem;
  border-radius: var(--a-radius-pill, 999px);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--a-color-muted);
  cursor: pointer;
  transition: color 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.sticky-pill-btn:hover {
  border-color: var(--a-color-border);
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
  transform: translateY(-1px);
}

.sticky-pill-btn.is-liked {
  border-color: #ef4444;
  color: #ef4444;
  background: color-mix(in srgb, #ef4444 8%, transparent);
}

.sticky-pill-btn.is-active {
  border-color: var(--a-color-text);
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

</style>
