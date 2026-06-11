<template>
  <aside class="a-sidebar" :class="{ 'is-collapsed': collapsed }">
    <div v-if="collapsible" class="a-sidebar-head">
      <button
        class="a-sidebar-collapse-btn"
        type="button"
        @click="$emit('update:collapsed', !collapsed)"
      >
        <NIcon size="24" aria-hidden="true"><MenuOutline /></NIcon>
      </button>
    </div>
    <nav class="paper-sidebar-nav" :aria-label="ariaLabel">
      <slot />
    </nav>
    <div v-if="$slots.bottom" class="paper-sidebar-bottom">
      <slot name="bottom" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { MenuOutline } from '@vicons/ionicons5'

defineProps<{
  ariaLabel?: string
  collapsible?: boolean
  collapsed?: boolean
}>()

defineEmits<{
  (e: 'update:collapsed', value: boolean): void
}>()
</script>

<style scoped>
.a-sidebar {
  transition: width 0.2s ease;
}

.a-sidebar.is-collapsed {
  width: var(--a-sidebar-collapsed-width, 4.5rem);
}

.a-sidebar-head {
  display: grid;
  gap: 0.75rem;
  align-items: start;
  min-height: 4rem;
  position: relative;
}

.a-sidebar.is-collapsed .a-sidebar-head {
  justify-items: center;
}

.a-sidebar.is-collapsed .a-sidebar-label,
.a-sidebar.is-collapsed .a-sidebar-helper {
  display: none;
}

.a-sidebar-collapse-btn {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  border-radius: 0.875rem;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  z-index: 10;
}

.a-sidebar-collapse-btn:hover {
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}

.paper-sidebar-nav {
  display: flex;
  flex-direction: column;
  padding-top: 1rem;
}

.paper-sidebar-bottom {
  margin-top: 2.75rem;
}

.a-sidebar.is-collapsed .paper-sidebar-bottom {
  display: none;
}

:deep(.a-sidebar-item) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  min-height: 3.75rem;
  padding: 0 1.35rem;
  border-radius: 0.75rem;
  transition: padding 0.2s;
}

:deep(.paper-sidebar-item-icon) {
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  flex-shrink: 0;
  font-family: var(--a-font-meta);
  text-align: center;
}

:deep(.paper-sidebar-item-icon.is-char-icon) {
  display: none;
}

:deep(.paper-sidebar-item-icon.is-component-icon) {
  display: inline-flex;
}

.a-sidebar.is-collapsed :deep(.paper-sidebar-item-icon) {
  display: inline-flex;
}

.a-sidebar.is-collapsed :deep(.a-sidebar-item-num) {
  display: none;
}

.a-sidebar.is-collapsed :deep(.paper-sidebar-item-label) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:deep(.paper-sidebar-item-svg) {
  width: 1.375rem;
  height: 1.375rem;
}

.a-sidebar.is-collapsed :deep(.a-sidebar-item) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-height: 3.5rem;
  padding: 0;
}

.a-sidebar.is-collapsed .paper-sidebar-nav {
  padding-top: 1.25rem;
}

@media (max-width: 768px) {
  .a-sidebar.is-collapsed {
    width: var(--a-sidebar-collapsed-width, 4.5rem);
  }
}
</style>
