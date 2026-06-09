<template>
  <button 
    class="paper-clip" 
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
.paper-clip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 8px 12px;
  border: 1px solid var(--a-color-line);
  background: var(--a-color-paper);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  color: var(--a-color-ink);
  font-family: var(--a-font-meta);
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transform: rotate(2deg);
  transition: box-shadow 0.16s ease, transform 0.16s ease;
}

.paper-clip::before {
  position: absolute;
  top: -7px;
  right: 8px;
  left: 8px;
  height: 10px;
  background: var(--a-color-tape);
  content: '';
  transform: rotate(-4deg);
}

.paper-clip:not(:disabled) {
  cursor: pointer;
}

.paper-clip:not(:disabled):hover,
.paper-clip:not(:disabled):focus-visible,
.paper-clip.is-active:not(:disabled) {
  box-shadow: 0 11px 22px rgba(15, 23, 42, 0.12);
  outline: none;
  transform: translateY(-2px) rotate(1deg);
  background: var(--a-color-ink);
  color: var(--a-color-paper);
}

.paper-clip.is-active:not(:disabled):hover {
  transform: translateY(-3px) rotate(2deg);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.16);
}

.paper-clip:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
</style>
