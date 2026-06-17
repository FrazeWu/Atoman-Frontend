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
  border: 1px solid var(--a-color-line);
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  font-family: inherit;
  font-size: 10px;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: transform 0.12s ease, background-color 0.12s ease, color 0.12s ease;
}

.p-clip:not(:disabled) {
  cursor: pointer;
}

.p-clip:not(:disabled):hover,
.p-clip:not(:disabled):focus-visible,
.p-clip.is-active:not(:disabled) {
  outline: none;
  transform: translateY(-1px);
  background: var(--a-color-ink);
  color: var(--a-color-paper);
}

.p-clip:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
