<template>
  <button class="sheet-tab" aria-label="Close sheet" @click="$emit('click')">
    <span class="close-icon">✕</span>
    <span class="tab-label">{{ title }}</span>
  </button>
</template>

<script setup lang="ts">
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
  border: 1px solid var(--a-color-line-soft);
  border-radius: 0;
  border-right: none;
  transition: background-color 0.2s, border-color 0.2s;
  outline: none;
  font-family: inherit;
  white-space: nowrap;
}

.close-icon {
  font-size: 0.9rem;
  font-weight: 900;
  color: var(--a-color-fg);
  line-height: 1;
}

.tab-label {
  font-size: 0.8rem;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.sheet-tab:hover {
  background-color: var(--a-color-disabled-bg);
  border-color: var(--a-color-line);
}
</style>
