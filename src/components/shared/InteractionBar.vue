<template>
  <div class="interaction-bar">
    <!-- 点赞按钮 -->
    <button
      type="button"
      class="interaction-bar__item interaction-bar__like-btn"
      :class="{
        'is-active': liked,
        'is-pop': isLikeAnimating,
      }"
      :disabled="disabled"
      :aria-label="liked ? '取消喜欢' : '喜欢'"
      :title="liked ? '取消喜欢' : '喜欢'"
      @click="handleLike"
    >
      <Heart :size="15" class="interaction-bar__icon" :class="{ 'is-filled': liked }" />
      <span class="interaction-bar__count">{{ likeCount }}</span>
    </button>

    <!-- 收藏按钮 (可选) -->
    <button
      v-if="showBookmark"
      type="button"
      class="interaction-bar__item interaction-bar__bookmark-btn"
      :class="{
        'is-active': bookmarked,
        'is-pop': isBookmarkAnimating,
      }"
      :disabled="disabled"
      :aria-label="bookmarked ? '取消收藏' : '收藏'"
      :title="bookmarked ? '取消收藏' : '收藏'"
      @click="handleBookmark"
    >
      <Bookmark :size="15" class="interaction-bar__icon" :class="{ 'is-filled': bookmarked }" />
      <span v-if="bookmarkCount !== undefined" class="interaction-bar__count">{{ bookmarkCount }}</span>
      <span v-else class="interaction-bar__label">{{ bookmarked ? '已收藏' : '收藏' }}</span>
    </button>

    <!-- 评论按钮 (可选) -->
    <component
      :is="commentHref ? RouterLink : 'span'"
      v-if="commentCount !== undefined"
      :to="commentHref"
      class="interaction-bar__item interaction-bar__comment-item"
      :class="{ 'is-link': Boolean(commentHref) }"
      :aria-label="commentHref ? `查看 ${commentCount} 条评论` : `${commentCount} 条评论`"
      :title="commentHref ? '查看评论' : undefined"
    >
      <MessageSquare :size="15" class="interaction-bar__icon" aria-hidden="true" />
      <span class="interaction-bar__count">{{ commentCount }}</span>
    </component>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Bookmark, Heart, MessageSquare } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

const props = withDefaults(defineProps<{
  liked: boolean
  likeCount: number
  commentCount?: number
  commentHref?: string
  disabled?: boolean
  showBookmark?: boolean
  bookmarked?: boolean
  bookmarkCount?: number
}>(), {
  disabled: false,
  showBookmark: false,
  bookmarked: false,
})

const emit = defineEmits<{
  like: []
  unlike: []
  bookmark: []
  unbookmark: []
}>()

const isLikeAnimating = ref(false)
const isBookmarkAnimating = ref(false)

function handleLike() {
  if (props.disabled) return
  isLikeAnimating.value = true
  setTimeout(() => {
    isLikeAnimating.value = false
  }, 200)

  if (props.liked) {
    emit('unlike')
  } else {
    emit('like')
  }
}

function handleBookmark() {
  if (props.disabled) return
  isBookmarkAnimating.value = true
  setTimeout(() => {
    isBookmarkAnimating.value = false
  }, 200)

  if (props.bookmarked) {
    emit('unbookmark')
  } else {
    emit('bookmark')
  }
}
</script>

<style scoped>
.interaction-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--a-color-muted);
}

.interaction-bar__item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  background: var(--a-color-bg);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-control);
  color: var(--a-color-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  line-height: 1;
  text-decoration: none;
  transition: all 0.15s ease;
  user-select: none;
}

.interaction-bar__item:hover:not(:disabled) {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.interaction-bar__item:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* 点赞按钮激活态 */
.interaction-bar__like-btn.is-active {
  color: #e11d48;
  border-color: rgba(225, 29, 72, 0.25);
  background: rgba(225, 29, 72, 0.05);
}

.interaction-bar__like-btn.is-active:hover:not(:disabled) {
  border-color: rgba(225, 29, 72, 0.4);
  background: rgba(225, 29, 72, 0.08);
}

/* 收藏按钮激活态 */
.interaction-bar__bookmark-btn.is-active {
  color: #d97706;
  border-color: rgba(217, 119, 6, 0.25);
  background: rgba(217, 119, 6, 0.05);
}

.interaction-bar__bookmark-btn.is-active:hover:not(:disabled) {
  border-color: rgba(217, 119, 6, 0.4);
  background: rgba(217, 119, 6, 0.08);
}

.interaction-bar__icon {
  transition: transform 0.15s ease, fill 0.15s ease;
}

.interaction-bar__icon.is-filled {
  fill: currentColor;
}

.interaction-bar__item:hover .interaction-bar__icon {
  transform: scale(1.08);
}

.interaction-bar__item.is-pop .interaction-bar__icon {
  animation: item-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes item-pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.22);
  }
  100% {
    transform: scale(1);
  }
}

.interaction-bar__comment-item.is-link:hover {
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  background: var(--a-color-surface-muted);
}

.interaction-bar__count,
.interaction-bar__label {
  font-variant-numeric: tabular-nums;
}
</style>
