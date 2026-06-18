<template>
  <aside class="p-sidebar" :class="{ 'is-collapsed': isCollapsed }">
    <div v-if="collapsible" class="p-sidebar-head">
      <button
        class="p-sidebar-collapse-btn"
        type="button"
        @click="isCollapsed = !isCollapsed"
      >
        <Menu :size="24" aria-hidden="true" />
      </button>
    </div>
    <nav class="p-sidebar-nav" :aria-label="ariaLabel">
      <slot />
    </nav>
    <div v-if="$slots.bottom" class="p-sidebar-bottom">
      <slot name="bottom" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Menu } from 'lucide-vue-next'

const props = defineProps<{
  ariaLabel?: string
  collapsible?: boolean
  collapsed?: boolean
  storageKey?: string
}>()

const emit = defineEmits<{
  (e: 'update:collapsed', value: boolean): void
}>()

const localCollapsed = ref(false)

const isCollapsed = computed({
  get: () => props.storageKey ? localCollapsed.value : (props.collapsed ?? false),
  set: (val) => {
    if (props.storageKey) {
      localCollapsed.value = val
      localStorage.setItem(props.storageKey, String(val))
    }
    emit('update:collapsed', val)
  }
})

onMounted(() => {
  if (props.storageKey) {
    const cached = localStorage.getItem(props.storageKey)
    localCollapsed.value = cached === 'true'
    emit('update:collapsed', localCollapsed.value)
  }
})
</script>

<style scoped>
.p-sidebar {
  transition: width 0.2s ease;
}

.p-sidebar.is-collapsed {
  width: var(--a-sidebar-collapsed-width, 4.5rem);
}

.p-sidebar-head {
  display: grid;
  gap: 0.75rem;
  align-items: start;
  min-height: 4rem;
  position: relative;
}

.p-sidebar.is-collapsed .p-sidebar-head {
  justify-items: center;
}

.p-sidebar.is-collapsed :deep(.p-sidebar-label),
.p-sidebar.is-collapsed :deep(.p-sidebar-helper) {
  display: none;
}

.p-sidebar-collapse-btn {
  /* Redesign: borderless collapse button */
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

.p-sidebar-collapse-btn:hover {
  background: var(--a-color-paper-wash);
  box-shadow: var(--a-shadow-paper-sm);
}

.p-sidebar-nav {
  display: flex;
  flex-direction: column;
  padding-top: 1rem;
}

.p-sidebar-bottom {
  margin-top: 2.75rem;
}

.p-sidebar.is-collapsed .p-sidebar-bottom {
  display: none;
}

:deep(.p-sidebar-item) {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
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
  font-family: var(--a-font-meta);
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

.p-sidebar.is-collapsed :deep(.p-sidebar-item-num) {
  display: none;
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
