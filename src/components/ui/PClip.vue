<template>
  <button
    class="p-clip"
    :class="{ 'is-active': active }"
    type="button"
    :disabled="disabled"
    @click="onClick"
  >
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  disabled?: boolean
  active?: boolean
}>(), {
  label: '',
  disabled: false,
  active: false
})

const emit = defineEmits<{
  click: [MouseEvent]
}>()

const onClick = (event: MouseEvent) => {
  if (props.disabled) return
  emit('click', event)
}
</script>

<style scoped>
.p-clip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 8px 12px;
  border: 1px solid var(--a-color-border);
  border-radius: var(--a-radius-none, 4px);
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font-family: inherit;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.p-clip:not(:disabled) {
  cursor: pointer;
}

.p-clip:not(:disabled):hover,
.p-clip:not(:disabled):focus-visible {
  outline: none;
  background: var(--a-color-surface);
  color: var(--a-color-text);
}

.p-clip.is-active:not(:disabled) {
  outline: none;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
}

.p-clip:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
