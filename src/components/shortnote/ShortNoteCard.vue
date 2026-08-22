<template>
  <article :id="`note-${note.id}`" class="short-note-card">
    <header class="short-note-card__header">
      <PAvatar :src="note.user?.avatar_url" :name="author" size="sm" />
      <div class="short-note-card__meta">
        <span class="short-note-card__author">{{ author }}</span>
        <span class="short-note-card__time">
          {{ formatDate(note.created_at) }}
          <span v-if="note.edited" class="short-note-card__edited">· 已编辑</span>
        </span>
      </div>
      <div v-if="isOwner" class="short-note-card__owner-actions">
        <RouterLink
          :to="`/posts/notes/${note.id}/edit`"
          class="short-note-card__action-btn"
          aria-label="编辑短话"
          title="编辑短话"
        >
          <Pencil :size="15" />
        </RouterLink>
        <button
          type="button"
          class="short-note-card__action-btn is-danger"
          aria-label="删除短话"
          title="删除短话"
          @click="$emit('delete', note)"
        >
          <Trash2 :size="15" />
        </button>
      </div>
    </header>

    <div class="short-note-card__body" @click="toggleComments">
      <p class="short-note-card__content">{{ note.content }}</p>

      <div
        v-if="note.media.length"
        class="short-note-card__media"
        :class="`count-${Math.min(note.media.length, 9)}`"
      >
        <div
          v-for="(item, idx) in note.media"
          :key="item.id"
          class="short-note-card__media-item"
          @click.stop.prevent="openLightbox(idx)"
        >
          <img :src="resolveMediaURL(item.url)" alt="短话图片" loading="lazy" />
        </div>
      </div>
    </div>

    <footer class="short-note-card__footer" @click.stop>
      <InteractionBar
        :liked="interactions.liked.value"
        :like-count="interactions.likeCount.value"
        :comment-count="interactions.commentCount.value"
        :disabled="!authStore.isAuthenticated"
        @like="handleLike"
        @unlike="handleUnlike"
        @comment="toggleComments"
      />
    </footer>

    <!-- 行内评论区，替代弹出页 -->
    <div v-if="showComments" class="short-note-card__inline-comments" @click.stop>
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
import { Pencil, Trash2 } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import CommentSection from '@/components/comment/CommentSection.vue'
import InteractionBar from '@/components/shared/InteractionBar.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PImageLightbox from '@/components/ui/PImageLightbox.vue'
import { useShortNoteSync } from '@/composables/blog/useShortNoteSync'
import { useAuthStore } from '@/stores/auth'
import { useInteractions } from '@/composables/useInteractions'
import { resolveMediaURL } from '@/utils/mediaUrl'
import type { ShortNote } from '@/types'

const props = defineProps<{ note: ShortNote }>()
defineEmits<{ delete: [note: ShortNote] }>()
const authStore = useAuthStore()
const { getNoteState, updateNoteState } = useShortNoteSync()
const interactions = useInteractions('blog', 'short_note', props.note.id)
const author = computed(() => props.note.user?.display_name || props.note.user?.username || '匿名用户')
const isOwner = computed(() => authStore.user?.uuid === props.note.user_id)

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

function handleLike() {
  void interactions.like().then(() => {
    updateNoteState(props.note.id, { liked: interactions.liked.value, likeCount: interactions.likeCount.value })
  })
}

function handleUnlike() {
  void interactions.unlike().then(() => {
    updateNoteState(props.note.id, { liked: interactions.liked.value, likeCount: interactions.likeCount.value })
  })
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
.short-note-card {
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  background: var(--a-color-bg);
  padding: 0.9rem 1rem;
  margin-bottom: 0.55rem;
  transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.short-note-card:hover,
.short-note-card:focus-within {
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
  box-shadow: inset 4px 0 0 var(--a-color-text), var(--a-shadow-sm);
}

.short-note-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.short-note-card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.short-note-card__author {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--a-color-fg);
}

.short-note-card__time {
  font-size: 0.75rem;
  color: var(--a-color-muted);
}

.short-note-card__owner-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.short-note-card__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  color: var(--a-color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: all 0.15s ease;
}

.short-note-card__action-btn:hover {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
}

.short-note-card__action-btn.is-danger:hover {
  background: rgba(225, 29, 72, 0.1);
  color: var(--a-color-danger);
}

.short-note-card__body {
  cursor: pointer;
  margin-bottom: 0.85rem;
}

.short-note-card__content {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--a-color-fg);
  white-space: pre-wrap;
  word-break: break-word;
}

.short-note-card__media {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
  border-radius: var(--a-radius-card);
  overflow: hidden;
}

.short-note-card__media.count-1 {
  grid-template-columns: minmax(0, 1fr);
  max-width: 24rem;
}

.short-note-card__media.count-2,
.short-note-card__media.count-4 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 28rem;
}

.short-note-card__media.count-3,
.short-note-card__media.count-5,
.short-note-card__media.count-6,
.short-note-card__media.count-7,
.short-note-card__media.count-8,
.short-note-card__media.count-9 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.short-note-card__media-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--a-radius-control);
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
}

.short-note-card__media-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.short-note-card__media-item:hover img {
  transform: scale(1.04);
}

.short-note-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 行内评论区样式 */
.short-note-card__inline-comments {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--a-color-surface);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
}
</style>
