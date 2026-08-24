<template>
  <article
    :id="`note-${note.id}`"
    class="sticky-memo-card"
    :class="{ 'is-read': isRead }"
    @mouseenter="handleMouseEnter"
  >
    <!-- 1. 紧凑单行头部：作者头像 + 作者 + 相对时间 + 短笺标签 + 作者微操作 -->
    <header class="sticky-memo-head">
      <div class="sticky-memo-head__main">
        <div class="sticky-author-avatar" aria-hidden="true">
          {{ author.charAt(0).toUpperCase() }}
        </div>
        <span class="sticky-author">{{ author }}</span>
        <span class="sticky-dot" aria-hidden="true">·</span>
        <span class="sticky-time">{{ formatDate(note.created_at) }}</span>
        <span v-if="note.edited" class="sticky-edited">· 已编辑</span>
        <span class="sticky-badge">短笺</span>
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
    <div class="sticky-memo-body" @click="toggleComments">
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
      <button
        type="button"
        class="sticky-pill-btn"
        :class="{ 'is-liked': interactions.liked.value }"
        :disabled="!authStore.isAuthenticated"
        @click="handleToggleLike"
      >
        <Heart :size="13" :fill="interactions.liked.value ? 'currentColor' : 'none'" />
        <span>{{ interactions.likeCount.value || 0 }}</span>
      </button>

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

    <!-- 4. 行内平滑展开评论区 -->
    <div v-if="showComments" class="sticky-inline-comments" @click.stop>
      <CommentSection :target="{ kind: 'short_note', resourceId: note.id }" />
    </div>

    <PImageLightbox
      v-model:show="showLightbox"
      :images="mediaUrls"
      :index="lightboxIndex"
    />
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { Heart, MessageSquare, Pencil, Trash2 } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import CommentSection from '@/components/comment/CommentSection.vue'
import PImageLightbox from '@/components/ui/PImageLightbox.vue'
import { useShortNoteSync } from '@/composables/blog/useShortNoteSync'
import { useAuthStore } from '@/stores/auth'
import { useInteractions } from '@/composables/useInteractions'
import { resolveMediaURL } from '@/utils/mediaUrl'
import type { ShortNote } from '@/types'

const props = defineProps<{ note: ShortNote }>()
defineEmits<{ delete: [note: ShortNote] }>()

const authStore = useAuthStore()
const { getNoteState, updateNoteState, isNoteRead, markNoteAsRead } = useShortNoteSync()
const interactions = useInteractions('blog', 'short_note', props.note.id)
const author = computed(() => props.note.user?.display_name || props.note.user?.username || '匿名用户')
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
const mediaUrls = computed(() => props.note.media.map(m => resolveMediaURL(m.url)))

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
  interactions.liked.value = synced?.liked ?? props.note.liked
  interactions.likeCount.value = synced?.likeCount ?? props.note.likes_count
  interactions.commentCount.value = synced?.commentCount ?? props.note.comments_count
})

watch(() => [interactions.liked.value, interactions.likeCount.value, interactions.commentCount.value], () => {
  updateNoteState(props.note.id, {
    liked: interactions.liked.value,
    likeCount: interactions.likeCount.value,
    commentCount: interactions.commentCount.value,
  })
})

function handleToggleLike() {
  if (interactions.liked.value) {
    void interactions.unlike().then(() => {
      updateNoteState(props.note.id, { liked: interactions.liked.value, likeCount: interactions.likeCount.value })
    })
  } else {
    void interactions.like().then(() => {
      updateNoteState(props.note.id, { liked: interactions.liked.value, likeCount: interactions.likeCount.value })
    })
  }
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
  padding: 0.95rem 1.15rem;
  margin-bottom: 0.65rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  background: var(--a-color-bg);
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  overflow: hidden;
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
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

/* 已读状态隐藏绿色短线 */
.sticky-memo-card.is-read::before {
  opacity: 0;
  background-color: transparent;
}

.sticky-memo-card:hover,
.sticky-memo-card:focus-within {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: var(--a-shadow-sm);
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
  transition: all 0.15s ease;
}

.sticky-action-btn:hover {
  background: var(--a-color-bg);
  color: var(--a-color-fg);
}

.sticky-action-btn.is-danger:hover {
  color: var(--a-color-danger);
}

/* 正文 */
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
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
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

/* 行内评论区 */
.sticky-inline-comments {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-control);
}
</style>
