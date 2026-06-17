<template>
  <div class="paper-bookmark-tab" :class="{ 'paper-bookmark-tab--active': active }">
    <button class="paper-bookmark-tab__close" type="button" :aria-label="`关闭 ${label}`" @click.stop="emit('close')">
      ×
    </button>
    <button class="paper-bookmark-tab__label" type="button" :aria-current="active ? 'page' : undefined" @click="emit('select')">
      <slot>{{ label }}</slot>
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  active?: boolean
}>(), {
  active: false,
})

const emit = defineEmits<{
  close: []
  select: []
}>()
</script>

<style scoped>
.paper-bookmark-tab {
  position: relative;
  display: inline-grid;
  min-width: 154px;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 9px 14px 9px 10px;
  border: 1px solid var(--a-color-line);
  background: var(--a-color-paper);
  color: var(--a-color-ink);
  font-family: inherit;
  font-size: 11px;
  font-weight: var(--a-font-weight-strong, 700);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: border-color 0.12s ease;
}

.paper-bookmark-tab--active {
  border-color: var(--a-color-ink);
}

.paper-bookmark-tab__close,
.paper-bookmark-tab__label {
  position: relative;
  z-index: 1;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

.paper-bookmark-tab__close {
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}

.paper-bookmark-tab__label {
  cursor: pointer;
  text-align: left;
}

.paper-bookmark-tab__close:focus-visible,
.paper-bookmark-tab__label:focus-visible {
  outline: 2px solid var(--a-color-ink);
  outline-offset: 2px;
}
</style>
