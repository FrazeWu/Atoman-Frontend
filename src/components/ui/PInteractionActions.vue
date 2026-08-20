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
        :show-count="showDislikeCount && showCount"
        :size="size"
        :variant="variant"
        :disabled="disabled"
        @click="$emit('dislike-change', $event)"
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
          class="p-interaction-actions__ratio-fill"
          :style="{ width: `${likePercentage}%` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PDislikeButton from './PDislikeButton.vue'
import PLikeButton from './PLikeButton.vue'

const props = withDefaults(defineProps<{
  liked?: boolean
  likeCount?: number
  disliked?: boolean
  dislikeCount?: number
  showCount?: boolean
  showDislikeCount?: boolean
  showDislike?: boolean
  showRatioBar?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'bordered' | 'subtle'
  disabled?: boolean
}>(), {
  liked: false,
  likeCount: 0,
  disliked: false,
  dislikeCount: 0,
  showCount: true,
  showDislikeCount: true,
  showDislike: true,
  showRatioBar: true,
  size: 'md',
  variant: 'ghost',
  disabled: false,
})

defineEmits<{
  'like-change': [liked: boolean]
  'dislike-change': [disliked: boolean]
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
  align-items: stretch;
  max-width: 100%;
  gap: 0.35rem;
}

.p-interaction-actions.is-size-sm {
  gap: 0.2rem;
}

.p-interaction-actions.is-size-sm .p-interaction-actions__group {
  gap: 0.15rem;
}

.p-interaction-actions.is-size-sm :deep(.p-like-button.is-size-sm),
.p-interaction-actions.is-size-sm :deep(.p-dislike-button.is-size-sm) {
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.6875rem;
}

.p-interaction-actions.is-size-sm .p-interaction-actions__ratio-track {
  height: 3px;
}

.p-interaction-actions__group {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 0.25rem;
}

.p-interaction-actions__ratio {
  align-self: stretch;
}

.p-interaction-actions__ratio-track {
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--a-color-border-soft, #e2e8f0);
}

.p-interaction-actions__ratio-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--a-color-primary, #2563eb);
  transition: width 0.3s ease;
}
</style>
