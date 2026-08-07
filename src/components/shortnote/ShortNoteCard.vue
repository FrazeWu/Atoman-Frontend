<template>
  <article class="short-note-card">
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

    <RouterLink :to="`/posts/notes/${note.id}`" class="short-note-card__body">
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
    </RouterLink>

    <footer class="short-note-card__footer">
      <InteractionBar
        :liked="interactions.liked.value"
        :like-count="interactions.likeCount.value"
        :comment-count="interactions.commentCount.value"
        :disabled="!authStore.isAuthenticated"
        @like="handleLike"
        @unlike="handleUnlike"
        @comment="openShortNoteSheet"
      />
    </footer>

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
import InteractionBar from '@/components/shared/InteractionBar.vue'
import PAvatar from '@/components/ui/PAvatar.vue'
import PImageLightbox from '@/components/ui/PImageLightbox.vue'
import { useBlogSheets } from '@/composables/useBlogSheets'
import { useShortNoteSync } from '@/composables/blog/useShortNoteSync'
import { useAuthStore } from '@/stores/auth'
import { useInteractions } from '@/composables/useInteractions'
import { resolveMediaURL } from '@/utils/mediaUrl'
import type { ShortNote } from '@/types'

const props = defineProps<{ note: ShortNote }>()
defineEmits<{ delete: [note: ShortNote] }>()
const authStore = useAuthStore()
const blogSheets = useBlogSheets()
const { getNoteState, updateNoteState } = useShortNoteSync()
const interactions = useInteractions('blog', 'short_note', props.note.id)
const author = computed(() => props.note.user?.display_name || props.note.user?.username || '匿名用户')
const isOwner = computed(() => authStore.user?.uuid === props.note.user_id)

const showLightbox = ref(false)
const lightboxIndex = ref(0)
const mediaUrls = computed(() => props.note.media.map(m => resolveMediaURL(m.url)))

function openLightbox(idx: number) {
  lightboxIndex.value = idx
  showLightbox.value = true
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

function openShortNoteSheet() {
  const title = props.note.content
    ? (props.note.content.length > 20 ? `${props.note.content.slice(0, 20)}...` : props.note.content)
    : '短话'
  blogSheets.openShortNote(props.note.id, title)
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
  padding: 1.25rem;
  margin-bottom: 1rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.short-note-card:hover {
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
}

.short-note-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
}

.short-note-card__meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.short-note-card__author {
  font-size: 0.9rem;
  font-weight: 650;
  color: var(--a-color-fg);
  line-height: 1.2;
}

.short-note-card__time {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  line-height: 1.2;
}

.short-note-card__edited {
  color: var(--a-color-muted-soft);
  margin-left: 0.2rem;
}

.short-note-card__owner-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-left: auto;
}

.short-note-card__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--a-color-muted);
  text-decoration: none;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
}

.short-note-card__action-btn:hover {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft);
}

.short-note-card__action-btn.is-danger:hover {
  background: #fef2f2;
  color: var(--a-color-danger);
  border-color: var(--a-color-danger-border);
}

.short-note-card__body {
  display: block;
  color: inherit;
  text-decoration: none;
  margin-bottom: 1rem;
}

.short-note-card__content {
  margin: 0 0 0.85rem;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--a-color-fg);
}

/* 智能媒体图格 Grid 布局 */
.short-note-card__media {
  display: grid;
  gap: 0.4rem;
  border-radius: var(--a-radius-control);
  overflow: hidden;
  max-width: 100%;
}

.short-note-card__media.count-1 {
  grid-template-columns: 1fr;
  max-width: 26rem;
}

.short-note-card__media.count-1 .short-note-card__media-item {
  max-height: 22rem;
  aspect-ratio: auto;
}

.short-note-card__media.count-2 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 30rem;
}

.short-note-card__media.count-3 {
  grid-template-columns: repeat(3, 1fr);
}

.short-note-card__media.count-4 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 28rem;
}

.short-note-card__media.count-5,
.short-note-card__media.count-6,
.short-note-card__media.count-7,
.short-note-card__media.count-8,
.short-note-card__media.count-9 {
  grid-template-columns: repeat(3, 1fr);
}

.short-note-card__media-item {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--a-color-surface-muted);
  border-radius: var(--a-radius-base);
}

.short-note-card__media-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.short-note-card:hover .short-note-card__media-item img {
  transform: scale(1.02);
}

.short-note-card__footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--a-color-border-soft);
}
</style>
