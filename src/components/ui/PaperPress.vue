<template>
  <button
    class="paper-press"
    :class="{ 'paper-press--secondary': variant === 'secondary' }"
    type="button"
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
}>(), {
  label: '',
  variant: 'primary',
  disabled: false,
  loading: false,
  loadingText: '处理中...',
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
.paper-press {
  position: relative;
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0 22px;
  border: 2px solid var(--a-color-ink);
  background: var(--a-color-ink);
  color: var(--a-color-paper);
  font-family: var(--a-font-meta);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  transition: transform 0.14s ease;
}

.paper-press::after {
  position: absolute;
  right: 7px;
  bottom: -7px;
  left: 7px;
  height: 7px;
  background: rgba(0, 0, 0, 0.16);
  content: '';
  filter: blur(0.4px);
}

.paper-press--secondary {
  background: var(--a-color-paper);
  color: var(--a-color-ink);
}

.paper-press:not(:disabled) {
  cursor: pointer;
}

.paper-press:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: 2px;
}

.paper-press:not(:disabled):active {
  transform: translateY(3px);
}

.paper-press:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
