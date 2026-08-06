<template>
  <button
    type="button"
    class="p-like-button"
    :class="[
      `is-size-${size}`,
      `is-variant-${variant}`,
      {
        'is-active': liked,
        'is-pop': isAnimating,
      },
    ]"
    :disabled="disabled"
    :aria-label="liked ? '取消点赞' : '点赞'"
    :title="liked ? '取消点赞' : '点赞'"
    @click="handleClick"
  >
    <component :is="iconComponent" :size="iconSize" class="p-like-button__icon" :class="{ 'is-filled': liked }" />
    <span v-if="showCount && count !== undefined" class="p-like-button__count">{{ count.toLocaleString() }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Heart, ThumbsUp } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  liked?: boolean
  count?: number
  showCount?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'bordered' | 'subtle'
  disabled?: boolean
  iconType?: 'thumbs-up' | 'heart'
}>(), {
  liked: false,
  showCount: true,
  size: 'md',
  variant: 'ghost',
  disabled: false,
  iconType: 'thumbs-up',
})

const emit = defineEmits<{
  click: [liked: boolean]
  like: []
  unlike: []
}>()

const isAnimating = ref(false)

const iconComponent = computed(() => (props.iconType === 'heart' ? Heart : ThumbsUp))

const iconSize = computed(() => {
  if (props.size === 'sm') return 14
  if (props.size === 'lg') return 18
  return 15
})

function handleClick() {
  if (props.disabled) return
  isAnimating.value = true
  setTimeout(() => {
    isAnimating.value = false
  }, 200)

  const nextState = !props.liked
  emit('click', nextState)
  if (nextState) {
    emit('like')
  } else {
    emit('unlike')
  }
}
</script>

<style scoped>
.p-like-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--a-radius-control);
  color: var(--a-color-text-secondary, #475569);
  font-weight: 500;
  cursor: pointer;
  line-height: 1;
  background: transparent;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  user-select: none;
}

.p-like-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Variants */
.p-like-button.is-variant-bordered {
  background: var(--a-color-bg);
  border-color: var(--a-color-border-soft);
}

.p-like-button.is-variant-subtle {
  background: var(--a-color-surface-muted);
  border-color: transparent;
}

.p-like-button:hover:not(:disabled) {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.p-like-button.is-variant-bordered:hover:not(:disabled) {
  border-color: var(--a-color-border);
}

/* Sizes */
.p-like-button.is-size-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.p-like-button.is-size-md {
  padding: 0.35rem 0.7rem;
  font-size: 0.8125rem;
}

.p-like-button.is-size-lg {
  padding: 0.45rem 0.85rem;
  font-size: 0.875rem;
}

/* 点赞激活态 - 克莱因蓝 / 主题蓝 */
.p-like-button.is-active {
  color: var(--a-color-primary, #2563eb);
  background: rgba(37, 99, 235, 0.07);
}

.p-like-button.is-variant-bordered.is-active {
  border-color: rgba(37, 99, 235, 0.25);
}

.p-like-button.is-active:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.12);
  color: var(--a-color-primary-hover, #1d4ed8);
}

.p-like-button__icon {
  transition: transform 0.15s ease, fill 0.15s ease;
}

.p-like-button__icon.is-filled {
  fill: currentColor;
}

.p-like-button:hover:not(:disabled) .p-like-button__icon {
  transform: scale(1.08);
}

.p-like-button.is-pop .p-like-button__icon {
  animation: like-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes like-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.22); }
  100% { transform: scale(1); }
}

.p-like-button__count {
  font-variant-numeric: tabular-nums;
}
</style>
