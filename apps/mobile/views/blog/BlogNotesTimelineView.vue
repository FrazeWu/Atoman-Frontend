<template>
  <div class="blog-notes-timeline">
    <!-- Header -->
    <header class="blog-notes-header">
      <div class="blog-notes-header__left">
        <h1 class="blog-notes-header__title">短笺</h1>
        <span class="blog-notes-header__sub">即刻碎片与当下灵感</span>
      </div>

      <MButton
        variant="primary"
        size="sm"
        data-testid="compose-note-btn"
        @click="showComposer = true"
      >
        <MIcon name="plus" size="sm" />
        <span>写短笺</span>
      </MButton>
    </header>

    <!-- Content Stream -->
    <p v-if="publishError" class="blog-notes-publish-error" role="alert">{{ publishError }}</p>
    <main class="blog-notes-content">
      <!-- Loading Skeleton -->
      <div v-if="loading" class="blog-notes-loading">
        <div v-for="n in 3" :key="n" class="note-card-skeleton" />
      </div>

      <!-- Error State -->
      <div v-else-if="loadError" class="blog-notes-empty" role="alert">
        <p class="blog-notes-empty__title">{{ loadError }}</p>
        <button type="button" class="blog-notes-empty__retry" @click="loadData">重新加载</button>
      </div>

      <!-- Empty State -->
      <div v-else-if="notes.length === 0" class="blog-notes-empty" data-testid="notes-empty-state">
        <p class="blog-notes-empty__title">还没有短笺</p>
        <p class="blog-notes-empty__desc">点击右上角，记下你的第一条思考碎片吧。</p>
        <MButton
          variant="secondary"
          size="sm"
          @click="showComposer = true"
        >
          写下第一条
        </MButton>
      </div>

      <!-- Notes Feed -->
      <div v-else class="blog-notes-feed">
        <article
          v-for="note in notes"
          :key="note.id"
          class="short-note-card"
          data-testid="short-note-card"
        >
          <!-- Author Header -->
          <div class="short-note-card__header">
            <MAvatar
              :src="note.author?.avatar"
              :name="note.author?.name || '匿名'"
              :size="32"
            />
            <div class="short-note-card__author-meta">
              <span class="short-note-card__name">{{ note.author?.name || '匿名' }}</span>
              <span class="short-note-card__time">{{ formatTime(note.created_at) }}</span>
            </div>
          </div>

          <!-- Body Text -->
          <RouterLink
            class="short-note-card__body"
            :to="'/posts/notes/' + note.id"
            :aria-label="'阅读短笺：' + note.content.slice(0, 60)"
          >
            <p class="short-note-card__text">{{ note.content }}</p>

            <!-- Image preview if attached -->
            <div
              v-if="note.image || (note.images && note.images.length > 0)"
              class="short-note-card__image-wrap"
            >
              <img
                :src="note.image || note.images?.[0]"
                alt="配图"
                class="short-note-card__img"
                loading="lazy"
              />
            </div>
          </RouterLink>

          <!-- Interaction Footer -->
          <div class="short-note-card__footer">
            <button
              type="button"
              class="note-action-btn"
              :class="{ 'is-liked': note.liked }"
              :data-testid="`note-like-btn-${note.id}`"
              aria-label="赞"
              @click.stop="toggleLike(note)"
            >
              <MIcon name="heart" size="sm" />
              <span>{{ note.likes_count }}</span>
            </button>

            <button
              type="button"
              class="note-action-btn"
              :data-testid="`note-comment-btn-${note.id}`"
              aria-label="回复"
              @click.stop="openNoteDetail(note.id)"
            >
              <MIcon name="notes" size="sm" />
              <span>{{ note.comments_count }}</span>
            </button>

            <button
              type="button"
              class="note-action-btn"
              :class="{ 'is-saved': note.bookmarked }"
              aria-label="收藏"
              @click.stop="toggleBookmark(note)"
            >
              <MIcon name="bookmark" size="sm" />
            </button>
          </div>
        </article>
      </div>
    </main>

    <!-- Composer Sheet -->
    <ShortNoteComposerSheet
      v-model="showComposer"
      @submit="handlePublishNote"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'
import { apiRequestEnvelope } from '@/api/client'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MAvatar from '@mobile/components/ui/MAvatar.vue'
import ShortNoteComposerSheet from './ShortNoteComposerSheet.vue'

export interface ShortNoteFeedItem {
  id: string
  content: string
  author?: {
    name: string
    avatar?: string
  }
  created_at?: string
  likes_count: number
  comments_count: number
  liked?: boolean
  bookmarked?: boolean
  image?: string
  images?: string[]
}

const props = withDefaults(
  defineProps<{
    initialNotes?: ShortNoteFeedItem[]
  }>(),
  {
    initialNotes: undefined,
  }
)

const router = useRouter()
const api = useApi()
const authStore = getActivePinia() ? useAuthStore() : null

const showComposer = ref(false)
const loading = ref(props.initialNotes === undefined)
const loadError = ref('')
const publishError = ref('')

const notes = ref<ShortNoteFeedItem[]>(props.initialNotes ? [...props.initialNotes] : [])

async function toggleLike(note: ShortNoteFeedItem) {
  const prevLiked = note.liked
  const prevCount = note.likes_count
  note.liked = !prevLiked
  note.likes_count = prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1

  try {
    await apiRequestEnvelope(api.blog.shortNoteLike(note.id), {
      method: note.liked ? 'POST' : 'DELETE',
    })
  } catch {
    note.liked = prevLiked
    note.likes_count = prevCount
  }
}

function toggleBookmark(note: ShortNoteFeedItem) {
  note.bookmarked = !note.bookmarked
}

function openNoteDetail(id: string) {
  if (router) {
    void router.push(`/posts/notes/${id}`)
  }
}

async function handlePublishNote(payload: { content: string; image?: string }) {
  const user = authStore?.user
  const optimisticNote: ShortNoteFeedItem = {
    id: `local-note-${Date.now()}`,
    content: payload.content,
    author: {
      name: user?.display_name || user?.username || '我',
      avatar: user?.avatar_url || '',
    },
    created_at: new Date().toISOString(),
    likes_count: 0,
    comments_count: 0,
    liked: false,
    image: payload.image,
  }
  notes.value.unshift(optimisticNote)
  publishError.value = ''

  try {
    const res = await apiRequestEnvelope<any>(api.blog.shortNotes, {
      method: 'POST',
      body: JSON.stringify({
        content: payload.content,
        media_urls: payload.image ? [payload.image] : [],
      }),
    })
    if (res?.data) {
      const saved = res.data
      optimisticNote.id = String(saved.id)
      if (saved.created_at) optimisticNote.created_at = saved.created_at
    }
  } catch {
    notes.value = notes.value.filter((note) => note !== optimisticNote)
    publishError.value = '短笺发布失败，请重试。'
  }
}

function formatTime(isoString?: string): string {
  if (!isoString) return '刚刚'
  try {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
    if (diffSec < 60) return '刚刚'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`
    const d = new Date(isoString)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return '刚刚'
  }
}

async function loadData() {
  if (props.initialNotes) return
  loading.value = true
  loadError.value = ''
  try {
    const res = await apiRequestEnvelope<any[], { has_more?: boolean }>(`${api.blog.shortNotes}?page=1&page_size=20`)
    if (Array.isArray(res?.data)) {
      notes.value = res.data.map((item: any) => ({
        id: String(item.id),
        content: item.content || '',
        author: {
          name: item.user?.display_name || item.user?.username || '用户',
          avatar: item.user?.avatar_url || '',
        },
        created_at: item.created_at,
        likes_count: item.likes_count ?? 0,
        comments_count: item.comments_count ?? 0,
        liked: Boolean(item.liked),
        images: item.images || (item.image_url ? [item.image_url] : []),
      }))
    } else {
      throw new Error('Invalid notes response')
    }
  } catch {
    loadError.value = '短笺加载失败，请检查网络后重试。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!props.initialNotes) {
    void loadData()
  }
})
</script>

<style scoped>
.blog-notes-publish-error {
  margin: 12px 16px 0;
  padding: 12px 16px;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  color: var(--a-color-text);
  font-size: 13px;
}
.blog-notes-timeline {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--a-color-bg, #ffffff);
  padding-bottom: 48px;
  position: relative;
}

.blog-notes-header {
  padding: 12px 16px;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.blog-notes-header__left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.blog-notes-header__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.blog-notes-header :deep([data-testid="compose-note-btn"]) {
  min-height: 44px;
}

.blog-notes-header__sub {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

.blog-notes-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.blog-notes-feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.short-note-card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #ebebeb);
  border-radius: var(--a-radius-card, 4px);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.short-note-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.short-note-card__author-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.short-note-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.short-note-card__time {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

.short-note-card__body {
  min-height: 44px;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.short-note-card__body:focus-visible { outline: 2px solid var(--a-color-primary); outline-offset: 2px; }

.short-note-card__text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--a-color-text, #27272a);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.short-note-card__image-wrap {
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
  max-width: 240px;
  border: 1px solid var(--a-color-border-soft, #ebebeb);
}

.short-note-card__img {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  display: block;
}

.short-note-card__footer {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-top: 4px;
  border-top: 1px solid var(--a-color-border-soft, #f4f4f5);
}

.note-action-btn {
  background: transparent;
  border: none;
  padding: 6px;
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 12px;
  color: var(--a-color-text-secondary, #71717a);
  cursor: pointer;
}

.note-action-btn.is-liked {
  color: #ef4444;
}

.note-action-btn.is-saved {
  color: var(--a-color-primary, #10b981);
}

/* Empty State */
.blog-notes-empty {
  text-align: center;
  padding: 48px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.blog-notes-empty__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.blog-notes-empty__desc {
  font-size: 13px;
  color: var(--a-color-text-secondary, #71717a);
  margin: 0 0 8px;
}

/* Skeleton */
.note-card-skeleton {
  height: 120px;
  background: var(--a-color-surface-hover, #f4f4f5);
  border-radius: var(--a-radius-card, 4px);
}
</style>
