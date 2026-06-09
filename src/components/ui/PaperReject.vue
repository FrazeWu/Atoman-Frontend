<template>
  <button class="paper-reject" type="button" :disabled="disabled" @click="onClick">
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
.paper-reject {
  position: relative;
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 9px 13px;
  border: 1px solid var(--a-color-danger-line);
  background: var(--a-color-paper);
  box-shadow: 0 8px 18px rgba(127, 29, 29, 0.08);
  color: var(--a-color-danger-ink);
  font-family: var(--a-font-meta);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transform: rotate(-2deg);
}

.paper-reject::before {
  position: absolute;
  top: -7px;
  right: 8px;
  left: 8px;
  height: 10px;
  background: var(--a-color-tape);
  content: '';
  transform: rotate(-4deg);
}

.paper-reject::after {
  position: absolute;
  top: 50%;
  right: 9px;
  left: 9px;
  height: 2px;
  background: var(--a-color-danger-line);
  content: '';
  opacity: 0.72;
  transform: rotate(-8deg);
}

.paper-reject:not(:disabled) {
  cursor: pointer;
}

.paper-reject:focus-visible {
  outline: 2px solid var(--a-color-danger-line);
  outline-offset: 2px;
}

.paper-reject:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
