<template>
  <div class="p-interaction-actions" :class="[`is-size-${size}`]">
    <!-- 按钮组 -->
    <div class="p-interaction-actions__group">
      <PLikeButton
        :liked="liked"
        :count="likeCount"
        :show-count="showCount"
        :size="size"
        :variant="variant"
        :disabled="disabled"
        @click="$emit('like-change', $event)"
      />

      <PDislikeButton
        v-if="showDislike"
        :disliked="disliked"
        :count="dislikeCount"
        :show-count="showCount"
        :size="size"
        :variant="variant"
        :disabled="disabled"
        @click="$emit('dislike-change', $event)"
      />

      <PBookmarkButton
        v-if="showBookmark"
        :bookmarked="bookmarked"
        :count="bookmarkCount"
        :show-count="showCount"
        :size="size"
        :variant="variant"
        :disabled="disabled"
        @click="$emit('bookmark-change', $event)"
      />
    </div>

    <!-- 点赞/点踩 百分比进度横条 -->
    <div
      v-if="showRatioBar && showDislike && totalVotes > 0"
      class="p-interaction-actions__ratio"
      :title="`赞 ${likePercentage}% · 踩 ${dislikePercentage}% (${totalVotes.toLocaleString()} 次评价)`"
    >
      <div class="p-interaction-actions__ratio-track">
        <div
          class="p-interaction-actions__ratio-fill is-like"
          :style="{ width: `${likePercentage}%` }"
        />
        <div
          class="p-interaction-actions__ratio-fill is-dislike"
          :style="{ width: `${dislikePercentage}%` }"
        />
      </div>
      <div class="p-interaction-actions__ratio-meta">
        <span class="p-interaction-actions__ratio-text">{{ likePercentage }}% 好评</span>
        <span class="p-interaction-actions__ratio-votes">({{ totalVotes.toLocaleString() }} 次评价)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PBookmarkButton from './PBookmarkButton.vue'
import PDislikeButton from './PDislikeButton.vue'
import PLikeButton from './PLikeButton.vue'

const props = withDefaults(defineProps<{
  liked?: boolean
  likeCount?: number
  disliked?: boolean
  dislikeCount?: number
  bookmarked?: boolean
  bookmarkCount?: number
  showCount?: boolean
  showDislike?: boolean
  showBookmark?: boolean
  showRatioBar?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'bordered' | 'subtle'
  disabled?: boolean
}>(), {
  liked: false,
  likeCount: 0,
  disliked: false,
  dislikeCount: 0,
  bookmarked: false,
  showCount: true,
  showDislike: true,
  showBookmark: true,
  showRatioBar: true,
  size: 'md',
  variant: 'ghost',
  disabled: false,
})

defineEmits<{
  'like-change': [liked: boolean]
  'dislike-change': [disliked: boolean]
  'bookmark-change': [bookmarked: boolean]
}>()

const totalVotes = computed(() => (props.likeCount || 0) + (props.dislikeCount || 0))

const likePercentage = computed(() => {
  if (totalVotes.value === 0) return 0
  return Math.round(((props.likeCount || 0) / totalVotes.value) * 100)
})

const dislikePercentage = computed(() => {
  if (totalVotes.value === 0) return 0
  return 100 - likePercentage.value
})
</script>

<style scoped>
.p-interaction-actions {
  display: inline-flex;
  flex-direction: column;
  gap: 0.35rem;
}

.p-interaction-actions__group {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.p-interaction-actions__ratio {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-left: 0.15rem;
  padding-right: 0.15rem;
}

.p-interaction-actions__ratio-track {
  display: flex;
  height: 3px;
  width: 100%;
  border-radius: 2px;
  overflow: hidden;
  background: var(--a-color-border-soft, #e2e8f0);
}

.p-interaction-actions__ratio-fill.is-like {
  background: var(--a-color-primary, #2563eb);
  transition: width 0.3s ease;
}

.p-interaction-actions__ratio-fill.is-dislike {
  background: #cbd5e1;
  transition: width 0.3s ease;
}

.p-interaction-actions__ratio-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.725rem;
  line-height: 1;
  color: var(--a-color-muted, #64748b);
}

.p-interaction-actions__ratio-text {
  font-weight: 550;
  color: var(--a-color-fg, #0f172a);
}

.p-interaction-actions__ratio-votes {
  font-size: 0.7rem;
  color: var(--a-color-muted, #64748b);
}
</style>
