<template>
  <button class="p-reject" type="button" :disabled="disabled" @click="onClick">
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  disabled?: boolean
}>(), {
  label: '',
  disabled: false,
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
.p-reject {
  position: relative;
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 9px 13px;
  border: 1px solid var(--a-color-danger-border);
  background: var(--a-color-bg);
  color: var(--a-color-danger);
  font-family: inherit;
  font-size: 10px;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: opacity 0.12s ease, background-color 0.12s ease;
}

.p-reject::after {
  position: absolute;
  top: 50%;
  right: 9px;
  left: 9px;
  height: 1px;
  background: var(--a-color-danger-border);
  content: '';
  opacity: 0.72;
  transform: translateY(-50%);
}

.p-reject:not(:disabled) {
  cursor: pointer;
}

.p-reject:focus-visible {
  outline: 2px solid var(--a-color-danger-border);
  outline-offset: 2px;
}

.p-reject:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
