<template>
  <button
    class="p-tab"
    :class="{ 'p-tab--active': active }"
    type="button"
    :disabled="disabled"
    :aria-pressed="active"
    @click="onClick"
  >
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  active?: boolean
  disabled?: boolean
}>(), {
  label: '',
  active: false,
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
.p-tab {
  position: relative;
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border: none;
  border-bottom: 2px solid transparent; /* Only bottom border line */
  background: transparent;
  color: var(--a-color-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: all 0.12s ease;
}

.p-tab:not(:disabled) {
  cursor: pointer;
}

.p-tab:hover {
  color: var(--a-color-text);
}

.p-tab--active {
  border-bottom-color: var(--a-color-text); /* Black bottom highlight */
  background: transparent;
  color: var(--a-color-text);
}

/* Remove old active before block */
.p-tab--active::before {
  display: none;
}

.p-tab:focus-visible {
  outline: 2px solid var(--a-color-text);
  outline-offset: 2px;
}

.p-tab:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
