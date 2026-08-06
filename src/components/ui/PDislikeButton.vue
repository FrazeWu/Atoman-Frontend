<template>
  <button
    type="button"
    class="p-dislike-button"
    :class="[
      `is-size-${size}`,
      `is-variant-${variant}`,
      {
        'is-active': disliked,
        'is-pop': isAnimating,
      },
    ]"
    :disabled="disabled"
    :aria-label="disliked ? '取消踩' : '踩'"
    :title="disliked ? '取消踩' : '踩'"
    @click="handleClick"
  >
    <ThumbsDown :size="iconSize" class="p-dislike-button__icon" :class="{ 'is-filled': disliked }" />
    <span v-if="showCount && count !== undefined" class="p-dislike-button__count">{{ count.toLocaleString() }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ThumbsDown } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  disliked?: boolean
  count?: number
  showCount?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'bordered' | 'subtle'
  disabled?: boolean
}>(), {
  disliked: false,
  showCount: true,
  size: 'md',
  variant: 'ghost',
  disabled: false,
})

const emit = defineEmits<{
  click: [disliked: boolean]
  dislike: []
  undislike: []
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

  const nextState = !props.disliked
  emit('click', nextState)
  if (nextState) {
    emit('dislike')
  } else {
    emit('undislike')
  }
}
</script>

<style scoped>
.p-dislike-button {
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

.p-dislike-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Variants */
.p-dislike-button.is-variant-bordered {
  background: var(--a-color-bg);
  border-color: var(--a-color-border-soft);
}

.p-dislike-button.is-variant-subtle {
  background: var(--a-color-surface-muted);
  border-color: transparent;
}

.p-dislike-button:hover:not(:disabled) {
  color: var(--a-color-fg);
  background: var(--a-color-surface-muted);
}

.p-dislike-button.is-variant-bordered:hover:not(:disabled) {
  border-color: var(--a-color-border);
}

/* Sizes */
.p-dislike-button.is-size-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.p-dislike-button.is-size-md {
  padding: 0.35rem 0.7rem;
  font-size: 0.8125rem;
}

.p-dislike-button.is-size-lg {
  padding: 0.45rem 0.85rem;
  font-size: 0.875rem;
}

/* 点踩激活态 - 板岩石板灰 */
.p-dislike-button.is-active {
  color: #334155;
  background: rgba(51, 65, 85, 0.08);
}

.p-dislike-button.is-variant-bordered.is-active {
  border-color: rgba(51, 65, 85, 0.25);
}

.p-dislike-button.is-active:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.14);
  color: #0f172a;
}

.p-dislike-button__icon {
  transition: transform 0.15s ease, fill 0.15s ease;
}

.p-dislike-button__icon.is-filled {
  fill: currentColor;
}

.p-dislike-button:hover:not(:disabled) .p-dislike-button__icon {
  transform: scale(1.08);
}

.p-dislike-button.is-pop .p-dislike-button__icon {
  animation: dislike-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes dislike-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.22); }
  100% { transform: scale(1); }
}

.p-dislike-button__count {
  font-variant-numeric: tabular-nums;
}
</style>
