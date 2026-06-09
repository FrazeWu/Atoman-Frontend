<template>
  <button
    class="paper-tab"
    :class="{ 'paper-tab--active': active }"
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
.paper-tab {
  position: relative;
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transform: rotate(-1deg);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease, transform 0.16s ease;
}

.paper-tab:not(:disabled) {
  cursor: pointer;
}

.paper-tab--active {
  border-color: var(--a-color-ink);
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.05);
  transform: translateY(-4px) rotate(0.6deg);
}

.paper-tab--active::before {
  position: absolute;
  right: 12px;
  bottom: -5px;
  left: 12px;
  height: 2px;
  background: var(--a-color-ink);
  content: '';
}

.paper-tab:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: 2px;
}

.paper-tab:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
