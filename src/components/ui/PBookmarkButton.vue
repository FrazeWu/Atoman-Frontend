<template>
  <button
    type="button"
    class="p-bookmark-button"
    :class="[
      `is-size-${size}`,
      `is-variant-${variant}`,
      {
        'is-active': bookmarked,
        'is-pop': isAnimating,
      },
    ]"
    :disabled="disabled"
    :aria-label="bookmarked ? '取消收藏' : '收藏'"
    :title="bookmarked ? '取消收藏' : '收藏'"
    @click="handleClick"
  >
    <Bookmark :size="iconSize" class="p-bookmark-button__icon" :class="{ 'is-filled': bookmarked }" />
    <span v-if="showCount && count !== undefined" class="p-bookmark-button__count">{{ count.toLocaleString() }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bookmark } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  bookmarked?: boolean
  count?: number
  showCount?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'bordered' | 'subtle'
  disabled?: boolean
}>(), {
  bookmarked: false,
  showCount: true,
  size: 'md',
  variant: 'ghost',
  disabled: false,
})

const emit = defineEmits<{
  click: [bookmarked: boolean]
  bookmark: []
  unbookmark: []
}>()

const isAnimating = ref(false)

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

  const nextState = !props.bookmarked
  emit('click', nextState)
  if (nextState) {
    emit('bookmark')
  } else {
    emit('unbookmark')
  }
}
</script>

<style scoped>
.p-bookmark-button {
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

.p-bookmark-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Variants */
.p-bookmark-button.is-variant-bordered {
  background: var(--a-color-bg);
  border-color: var(--a-color-border-soft);
}

.p-bookmark-button.is-variant-subtle {
  background: var(--a-color-surface-muted);
  border-color: transparent;
}

.p-bookmark-button:hover:not(:disabled) {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.p-bookmark-button.is-variant-bordered:hover:not(:disabled) {
  border-color: var(--a-color-border);
}

/* Sizes */
.p-bookmark-button.is-size-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.p-bookmark-button.is-size-md {
  padding: 0.35rem 0.7rem;
  font-size: 0.8125rem;
}

.p-bookmark-button.is-size-lg {
  padding: 0.45rem 0.85rem;
  font-size: 0.875rem;
}

/* 收藏激活态 - 极简暖金 */
.p-bookmark-button.is-active {
  color: #d97706;
  background: rgba(217, 119, 6, 0.07);
}

.p-bookmark-button.is-variant-bordered.is-active {
  border-color: rgba(217, 119, 6, 0.25);
}

.p-bookmark-button.is-active:hover:not(:disabled) {
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
}

.p-bookmark-button__icon {
  transition: transform 0.15s ease, fill 0.15s ease;
}

.p-bookmark-button__icon.is-filled {
  fill: currentColor;
}

.p-bookmark-button:hover:not(:disabled) .p-bookmark-button__icon {
  transform: scale(1.08);
}

.p-bookmark-button.is-pop .p-bookmark-button__icon {
  animation: bookmark-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes bookmark-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.22); }
  100% { transform: scale(1); }
}

.p-bookmark-button__count {
  font-variant-numeric: tabular-nums;
}
</style>
