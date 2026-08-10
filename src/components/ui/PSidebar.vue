<template>
  <aside
    class="p-sidebar sidebar-variant-2"
    :class="{ 'is-collapsed': sidebarCollapsed }"
  >
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
  gap: 0.35rem;
}

.p-sidebar-bottom {
  margin-top: 2.25rem;
}

.p-sidebar.is-collapsed .p-sidebar-bottom {
  display: none;
}

:deep(.p-sidebar-item) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.6rem;
  min-height: 2.6rem;
  padding: 0 0.85rem;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  border-radius: 0 var(--a-radius-card) var(--a-radius-card) 0;
  border-left: 3.5px solid transparent;
  border-top: 1px solid transparent;
  border-right: 1px solid transparent;
  border-bottom: 1px solid transparent;
}

:deep(.p-sidebar-item:hover) {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
}

:deep(.p-sidebar-item:focus-visible) {
  outline: 2px solid var(--a-color-text);
  outline-offset: -2px;
}

:deep(.p-sidebar-item.active) {
  background: rgba(0, 0, 0, 0.04);
  color: var(--a-color-fg);
  border-left-color: var(--a-color-fg);
  font-weight: 650;
}

:deep(.p-sidebar-item-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  min-inline-size: 1.5rem;
  min-block-size: 1.5rem;
  max-inline-size: 1.5rem;
  max-block-size: 1.5rem;
  flex: 0 0 1.5rem;
  font-family: var(--a-font-sans);
  text-align: center;
}

:deep(.p-sidebar-item-icon.is-char-icon) {
  display: none;
}

:deep(.p-sidebar-item-icon.is-component-icon) {
  display: inline-flex;
}

:deep(.p-sidebar-item-label) {
  white-space: nowrap;
}

.p-sidebar.is-collapsed :deep(.p-sidebar-item-icon) {
  display: inline-flex;
}

.p-sidebar.is-collapsed :deep(.p-sidebar-item-svg) {
  inline-size: 1.125rem;
  block-size: 1.125rem;
  min-inline-size: 1.125rem;
  min-block-size: 1.125rem;
  max-inline-size: 1.125rem;
  max-block-size: 1.125rem;
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
  inline-size: 1.375rem;
  block-size: 1.375rem;
  min-inline-size: 1.375rem;
  min-block-size: 1.375rem;
  max-inline-size: 1.375rem;
  max-block-size: 1.375rem;
  flex: none;
}

.p-sidebar.is-collapsed :deep(.p-sidebar-item) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-height: 2.6rem;
  padding: 0;
  border-radius: var(--a-radius-card);
  border-left-color: transparent;
}

.p-sidebar.is-collapsed :deep(.p-sidebar-item.active) {
  border-left-color: transparent;
  background: var(--a-color-surface-muted);
}

@media (max-width: 1023px) {
  .p-sidebar {
    width: var(--a-sidebar-collapsed-width, 4.5rem);
  }

  .p-sidebar-bottom {
    display: none;
  }

  .p-sidebar :deep(.p-sidebar-item-label) {
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

  .p-sidebar :deep(.p-sidebar-item) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 0;
  }

  .p-sidebar :deep(.p-sidebar-item-svg) {
    inline-size: 1.125rem;
    block-size: 1.125rem;
    min-inline-size: 1.125rem;
    min-block-size: 1.125rem;
    max-inline-size: 1.125rem;
    max-block-size: 1.125rem;
  }

}
</style>
