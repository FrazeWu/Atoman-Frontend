<template>
  <aside class="p-sidebar" :class="{ 'is-collapsed': sidebarCollapsed }">
    <nav class="p-sidebar-nav" :aria-label="ariaLabel">
      <slot />
    </nav>
    <div v-if="$slots.bottom" class="p-sidebar-bottom">
      <slot name="bottom" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useSidebar } from '@/composables/useSidebar'

defineProps<{
  ariaLabel?: string
}>()

const { sidebarCollapsed } = useSidebar()
</script>

<style scoped>
.p-sidebar {
  transition: width 0.2s ease;
}

.p-sidebar.is-collapsed {
  width: var(--a-sidebar-collapsed-width, 4.5rem);
}

.p-sidebar-nav {
  display: flex;
  flex-direction: column;
  padding-top: 0.5rem;
}

.p-sidebar-bottom {
  margin-top: 2.75rem;
}

.p-sidebar.is-collapsed .p-sidebar-bottom {
  display: none;
}

:deep(.p-sidebar-item) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  min-height: 3.75rem;
  padding: 0 1.35rem;
  transition: padding 0.2s;
}

:deep(.p-sidebar-item-icon) {
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  flex-shrink: 0;
  font-family: var(--a-font-sans);
  text-align: center;
}

:deep(.p-sidebar-item-icon.is-char-icon) {
  display: none;
}

:deep(.p-sidebar-item-icon.is-component-icon) {
  display: inline-flex;
}

.p-sidebar.is-collapsed :deep(.p-sidebar-item-icon) {
  display: inline-flex;
}

.p-sidebar.is-collapsed :deep(.p-sidebar-item-label) {
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

:deep(.p-sidebar-item-svg) {
  width: 1.375rem;
  height: 1.375rem;
}

.p-sidebar.is-collapsed :deep(.p-sidebar-item) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-height: 3.5rem;
  padding: 0;
}

.p-sidebar.is-collapsed .p-sidebar-nav {
  padding-top: 1.25rem;
}

@media (max-width: 768px) {
  .p-sidebar.is-collapsed {
    width: var(--a-sidebar-collapsed-width, 4.5rem);
  }
}
</style>
