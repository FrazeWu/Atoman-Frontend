<template>
  <div class="interaction-bar">
    <!-- 点赞按钮 -->
    <PLikeButton
      :liked="liked"
      :count="likeCount"
      :disabled="disabled"
      :icon-type="iconType"
      size="md"
      variant="bordered"
      @like="emit('like')"
      @unlike="emit('unlike')"
    />

    <!-- 收藏按钮 (可选) -->
    <PBookmarkButton
      v-if="showBookmark"
      :bookmarked="bookmarked"
      :count="bookmarkCount"
      :disabled="disabled"
      size="md"
      variant="bordered"
      @bookmark="emit('bookmark')"
      @unbookmark="emit('unbookmark')"
    />

    <!-- 评论按钮 (可选) -->
    <component
      :is="commentHref ? RouterLink : 'button'"
      v-if="commentCount !== undefined"
      :to="commentHref"
      type="button"
      class="interaction-bar__item interaction-bar__comment-item"
      :class="{ 'is-link': Boolean(commentHref) }"
      :aria-label="commentHref ? `查看 ${commentCount} 条评论` : `${commentCount} 条评论`"
      :title="commentHref ? '查看评论' : '评论'"
      @click="emit('comment', $event)"
    >
      <MessageSquare :size="15" class="interaction-bar__icon" aria-hidden="true" />
      <span class="interaction-bar__count">{{ commentCount }}</span>
    </component>
  </div>
</template>

<script setup lang="ts">
import { IconMessage as MessageSquare } from '@tabler/icons-vue'
import { RouterLink } from 'vue-router'
import PBookmarkButton from '@/components/ui/PBookmarkButton.vue'
import PLikeButton from '@/components/ui/PLikeButton.vue'

const props = withDefaults(defineProps<{
  liked: boolean
  likeCount: number
  commentCount?: number
  commentHref?: string
  disabled?: boolean
  showBookmark?: boolean
  bookmarked?: boolean
  bookmarkCount?: number
  iconType?: 'thumbs-up' | 'heart'
}>(), {
  disabled: false,
  showBookmark: false,
  bookmarked: false,
  iconType: 'heart',
})

const emit = defineEmits<{
  like: []
  unlike: []
  bookmark: []
  unbookmark: []
  comment: [event: MouseEvent]
}>()
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
