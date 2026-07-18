<template>
  <button
    class="p-press"
    :class="{ 'p-press--secondary': variant === 'secondary' }"
    :type="type"
    :disabled="disabled || loading"
    @click="onClick"
  >
    <slot>{{ loading ? loadingText : label }}</slot>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  type?: 'button' | 'submit' | 'reset'
}>(), {
  label: '',
  variant: 'primary',
  disabled: false,
  loading: false,
  loadingText: '处理中...',
  type: 'button',
})

const emit = defineEmits<{
  click: [MouseEvent]
}>()

const onClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<style scoped>
.p-press {
  position: relative;
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0 22px;
  border: 1px solid var(--a-color-text);
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-family: var(--a-font-sans);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  transition: transform 0.14s ease, opacity 0.14s ease, background-color 0.14s ease;
}

.p-press--secondary {
  background: var(--a-color-bg);
  color: var(--a-color-text);
}

.p-press:not(:disabled) {
  cursor: pointer;
}

.p-press:not(:disabled):hover {
  opacity: 0.9;
}

.p-press--secondary:not(:disabled):hover {
  background-color: var(--a-color-surface);
  opacity: 1;
}

.p-press:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

.p-press:not(:disabled):active {
  transform: translateY(1px);
}

.p-press:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 767px) {
  .p-press {
    min-height: 44px;
  }
}
</style>
