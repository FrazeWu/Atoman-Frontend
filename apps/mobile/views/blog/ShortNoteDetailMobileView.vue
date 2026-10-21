<template>
  <div class="short-note-detail-mobile">
    <!-- Topbar -->
    <header class="short-note-detail-topbar">
      <button
        type="button"
        class="topbar-back-btn"
        data-testid="note-detail-back-btn"
        aria-label="返回"
        @click="handleBack"
      >
        <MIcon name="chevron-left" size="md" />
      </button>

      <span class="topbar-title">短笺详情</span>

      <button
        type="button"
        class="topbar-action-btn"
        aria-label="分享"
        @click="handleShare"
      >
        <MIcon name="share" size="sm" />
      </button>
    </header>

    <!-- Main Content -->
    <main class="short-note-detail-content">
      <article v-if="note" class="detail-note-card">
        <!-- Author Row -->
        <div class="detail-author-row">
          <MAvatar
            :src="note.author?.avatar"
            :name="note.author?.name || '匿名'"
            :size="36"
          />
          <div class="detail-author-info">
            <span class="detail-author-name">{{ note.author?.name || '匿名' }}</span>
            <span class="detail-author-time">{{ formatTime(note.created_at) }}</span>
          </div>
        </div>

        <!-- Note Text Body -->
        <p class="detail-note-text">{{ note.content }}</p>

        <!-- Image Gallery if present -->
        <div v-if="note.image || (note.images && note.images.length > 0)" class="detail-note-images">
          <img
            :src="note.image || note.images?.[0]"
            alt="短笺配图"
            class="detail-full-img"
          />
        </div>

        <!-- Stats & Actions Row -->
        <div class="detail-actions-row">
          <button
            type="button"
            class="detail-action-btn"
            :class="{ 'is-liked': note.liked }"
            @click="toggleLike"
          >
            <MIcon name="heart" size="sm" />
            <span>{{ note.likes_count ?? 0 }} 赞</span>
          </button>

          <button
            type="button"
            class="detail-action-btn"
            :class="{ 'is-saved': note.bookmarked }"
            @click="toggleBookmark"
          >
            <MIcon name="bookmark" size="sm" />
            <span>{{ note.bookmarked ? '已收藏' : '收藏' }}</span>
          </button>
        </div>
      </article>

      <!-- Comments Section -->
      <section class="detail-comments-section">
        <h3 class="comments-section-title">回复 ({{ comments.length }})</h3>

        <div v-if="comments.length === 0" class="comments-empty">
          <p class="comments-empty-text">暂无回复，写下第一条观点吧。</p>
        </div>

        <div v-else class="comments-list">
          <div
            v-for="c in comments"
            :key="c.id"
            class="comment-item"
          >
            <MAvatar :src="c.author.avatar" :name="c.author.name" :size="24" />
            <div class="comment-body">
              <div class="comment-header">
                <span class="comment-author">{{ c.author.name }}</span>
                <span class="comment-time">{{ formatTime(c.created_at) }}</span>
              </div>
              <p class="comment-text">{{ c.text }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Bottom Quick Reply Bar -->
    <footer class="detail-reply-bar">
      <input
        v-model="replyText"
        type="text"
        class="reply-input"
        placeholder="写下你的回复..."
        @keyup.enter="handleSendReply"
      />
      <MButton
        variant="primary"
        size="sm"
        :disabled="!replyText.trim()"
        @click="handleSendReply"
      >
        发送
      </MButton>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MButton from '@mobile/components/ui/MButton.vue'
import MAvatar from '@mobile/components/ui/MAvatar.vue'

export interface ShortNoteDetailItem {
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
    initialNote?: ShortNoteDetailItem
  }>(),
  {
    initialNote: undefined,
  }
)

const route = useRoute()
const router = useRouter()

const replyText = ref('')

const note = ref<ShortNoteDetailItem>(
  props.initialNote || {
    id: (route.params.id as string) || 'n-1',
    content: '今天阅读了阿兰·德波顿的《工作颂歌》，对于现代劳动的异化有了新的领悟。在自动化加速的今天，保留纯粹的手艺感知格外珍贵。',
    author: { name: '思绪记录者', avatar: '' },
    created_at: new Date(Date.now() - 3600000).toISOString(),
    likes_count: 12,
    comments_count: 2,
    liked: false,
    bookmarked: false,
  }
)

const comments = ref([
  {
    id: 'c-1',
    author: { name: '文字客', avatar: '' },
    text: '手艺人的专注感是抵抗虚无的最佳方式。',
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
])

function handleBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back()
  } else {
    void router.push('/posts/notes')
  }
}

function handleShare() {
  if (navigator.share) {
    void navigator.share({
      title: '短笺分享',
      text: note.value.content,
      url: window.location.href,
    })
  }
}

function toggleLike() {
  if (note.value.liked) {
    note.value.liked = false
    note.value.likes_count = Math.max(0, note.value.likes_count - 1)
  } else {
    note.value.liked = true
    note.value.likes_count += 1
  }
}

function toggleBookmark() {
  note.value.bookmarked = !note.value.bookmarked
}

function handleSendReply() {
  if (!replyText.value.trim()) return
  comments.value.push({
    id: `local-c-${Date.now()}`,
    author: { name: '我', avatar: '' },
    text: replyText.value.trim(),
    created_at: new Date().toISOString(),
  })
  replyText.value = ''
  note.value.comments_count += 1
}

function formatTime(isoString?: string): string {
  if (!isoString) return '刚刚'
  try {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
    if (diffSec < 60) return '刚刚'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
    const d = new Date(isoString)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  } catch {
    return '刚刚'
  }
}
</script>

<style scoped>
.short-note-detail-mobile {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--a-color-bg, #ffffff);
  padding-bottom: 70px;
}

.short-note-detail-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--a-color-bg, #ffffff);
  border-bottom: 1px solid var(--a-color-border-soft, #f0f0f0);
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar-back-btn,
.topbar-action-btn {
  background: transparent;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--a-color-text, #18181b);
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.short-note-detail-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-note-card {
  background: var(--a-color-bg, #ffffff);
  border: 1px solid var(--a-color-border-soft, #ebebeb);
  border-radius: var(--a-radius-card, 4px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-author-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.detail-author-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-author-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.detail-author-time {
  font-size: 11px;
  color: var(--a-color-text-secondary, #71717a);
}

.detail-note-text {
  font-size: 15px;
  line-height: 1.65;
  color: var(--a-color-text, #27272a);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-note-images {
  border-radius: var(--a-radius-card, 4px);
  overflow: hidden;
  border: 1px solid var(--a-color-border-soft, #ebebeb);
}

.detail-full-img {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  display: block;
}

.detail-actions-row {
  display: flex;
  align-items: center;
  gap: 24px;
  padding-top: 10px;
  border-top: 1px solid var(--a-color-border-soft, #f4f4f5);
}

.detail-action-btn {
  background: transparent;
  border: none;
  padding: 4px 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--a-color-text-secondary, #71717a);
  cursor: pointer;
}

.detail-action-btn.is-liked {
  color: #ef4444;
}

.detail-action-btn.is-saved {
  color: var(--a-color-primary, #10b981);
}

/* Comments */
.detail-comments-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comments-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
  margin: 0;
}

.comments-empty {
  padding: 24px 0;
  text-align: center;
}
.comments-empty-text {
  font-size: 13px;
  color: var(--a-color-text-secondary, #a1a1aa);
  margin: 0;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment-item {
  display: flex;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--a-color-border-soft, #f4f4f5);
}

.comment-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.comment-author {
  font-size: 12px;
  font-weight: 600;
  color: var(--a-color-text, #18181b);
}

.comment-time {
  font-size: 11px;
  color: var(--a-color-text-secondary, #a1a1aa);
}

.comment-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--a-color-text, #27272a);
  margin: 0;
}

/* Bottom Reply Bar */
.detail-reply-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--a-color-bg, #ffffff);
  border-top: 1px solid var(--a-color-border-soft, #ebebeb);
  padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 20;
}

.reply-input {
  flex: 1;
  border: 1px solid var(--a-color-border-soft, #e4e4e7);
  border-radius: var(--a-radius-card, 4px);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--a-color-text, #18181b);
  background: var(--a-color-bg, #ffffff);
  outline: none;
}

.reply-input:focus {
  border-color: var(--a-color-primary, #10b981);
}
</style>
