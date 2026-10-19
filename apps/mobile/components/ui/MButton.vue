<template>
  <button
    type="button"
    class="m-button"
    :class="[
      `m-button--${variant}`,
      `m-button--${size}`,
      {
        'm-button--block': block,
        'is-disabled': disabled,
        'is-loading': loading,
      },
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="m-button__spinner" aria-hidden="true" />
    <span class="m-button__content">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    block: false,
    disabled: false,
    loading: false,
  }
)

const emit = defineEmits<{
  click: [MouseEvent]
}>()

function handleClick(e: MouseEvent) {
  if (props.disabled || props.loading) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
  emit('click', e)
}
</script>

<style scoped>
.m-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: var(--a-radius-control, 4px);
  font-weight: 500;
  font-family: inherit;
  line-height: 1.25;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.1s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  box-sizing: border-box;
}

.m-button:active:not(.is-disabled):not(.is-loading) {
  transform: scale(0.98);
}

/* Sizes */
.m-button--sm {
  min-height: 32px;
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
}

.m-button--md {
  min-height: 40px;
  padding: 0.375rem 0.875rem;
  font-size: 0.875rem;
}

.m-button--lg {
  min-height: 48px;
  padding: 0.5rem 1.25rem;
  font-size: 1rem;
}

/* Variants */
.m-button--primary {
  background-color: var(--a-color-text, #0f172a);
  color: #ffffff;
  border-color: var(--a-color-text, #0f172a);
}

.m-button--primary:hover:not(.is-disabled):not(.is-loading) {
  opacity: 0.92;
}

.m-button--secondary {
  background-color: #ffffff;
  color: var(--a-color-text, #0f172a);
  border-color: var(--a-color-border-soft, #e2e8f0);
}

.m-button--secondary:hover:not(.is-disabled):not(.is-loading) {
  background-color: var(--a-color-surface-muted, #f8fafc);
  border-color: var(--a-color-border, #cbd5e1);
}

.m-button--ghost {
  background-color: transparent;
  color: var(--a-color-text, #0f172a);
  border-color: transparent;
}

.m-button--ghost:hover:not(.is-disabled):not(.is-loading) {
  background-color: var(--a-color-surface-muted, #f8fafc);
}

.m-button--danger {
  background-color: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

.m-button--danger:hover:not(.is-disabled):not(.is-loading) {
  opacity: 0.92;
}

/* Block */
.m-button--block {
  display: flex;
  width: 100%;
}

/* Disabled & Loading */
.m-button.is-disabled,
.m-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

.m-button.is-loading {
  opacity: 0.7;
  cursor: wait;
  pointer-events: none;
}

.m-button__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: m-button-spin 0.6s linear infinite;
}

@keyframes m-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
