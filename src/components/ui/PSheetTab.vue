<template>
  <button class="sheet-tab" type="button" :aria-label="`返回${title}`" :title="`返回${title}`" @click="$emit('click')">
    <X class="close-icon" :size="16" aria-hidden="true" />
    <span class="tab-label">{{ title }}</span>
  </button>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{
  title: string
}>()

defineEmits(['click'])
</script>

<style scoped>
.sheet-tab {
  background-color: white;
  color: var(--a-color-fg);
  padding-left: 12px;
  padding-right: 18px;
  padding-top: 8px;
  padding-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  cursor: pointer;
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-none, 4px) 0 0 var(--a-radius-none, 4px);
  border-right: none;
  transition: background-color 0.2s, border-color 0.2s;
  outline: none;
  font-family: inherit;
  white-space: nowrap;
}

.close-icon {
  font-size: 0.9rem;
  font-weight: 500;
  color: currentColor;
  line-height: 1;
}

.tab-label {
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.sheet-tab:hover {
  background-color: var(--a-color-surface);
  color: var(--a-color-text);
  border-color: var(--a-color-border);
}
</style>
