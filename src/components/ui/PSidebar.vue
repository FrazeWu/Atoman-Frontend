<template>
  <aside
    class="p-sidebar"
    :class="[
      `sidebar-${variant}`,
      { 'is-collapsed': sidebarCollapsed }
    ]"
  >
    <!-- 侧边栏风格实时选择按钮区 -->
    <div v-if="!sidebarCollapsed" class="p-sidebar-style-switcher" aria-label="侧栏风格选择">
      <span class="p-sidebar-style-title">侧栏风格:</span>
      <div class="p-sidebar-style-group">
        <button
          type="button"
          class="p-sidebar-style-btn"
          :class="{ active: variant === 'variant-1' }"
          title="方案 1：浮雕精制双色块 (Pill Accent Card)"
          @click="setVariant('variant-1')"
        >
          方案1
        </button>
        <button
          type="button"
          class="p-sidebar-style-btn"
          :class="{ active: variant === 'variant-2' }"
          title="方案 2：极简深色指示条 (Minimal Left Line)"
          @click="setVariant('variant-2')"
        >
          方案2
        </button>
        <button
          type="button"
          class="p-sidebar-style-btn"
          :class="{ active: variant === 'variant-3' }"
          title="方案 3：胶囊悬浮水晶块 (Floating Pill Glass)"
          @click="setVariant('variant-3')"
        >
          方案3
        </button>
      </div>
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
import { useSidebar } from '@/composables/useSidebar'
import { useSidebarStyle } from '@/composables/useSidebarStyle'

defineProps<{
  ariaLabel?: string
}>()

const { sidebarCollapsed } = useSidebar()
const { variant, setVariant } = useSidebarStyle()
</script>

<style scoped>
.p-sidebar {
  transition: width 0.2s ease;
}

.p-sidebar.is-collapsed {
  width: var(--a-sidebar-collapsed-width, 4.5rem);
}

.p-sidebar-style-switcher {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.65rem 0.85rem;
  margin-bottom: 0.5rem;
  background: var(--a-color-surface-muted);
  border: 1px solid var(--a-color-border-soft);
  border-radius: var(--a-radius-card);
}

.p-sidebar-style-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--a-color-muted);
  letter-spacing: 0.02em;
}

.p-sidebar-style-group {
  display: flex;
  gap: 0.35rem;
}

.p-sidebar-style-btn {
  flex: 1;
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
  color: var(--a-color-text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
  padding: 0.25rem 0;
  border-radius: var(--a-radius-control);
  cursor: pointer;
  transition: all 0.15s ease;
}

.p-sidebar-style-btn:hover {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
}

.p-sidebar-style-btn.active {
  background: var(--a-color-text);
  color: var(--a-color-bg);
  border-color: var(--a-color-text);
  font-weight: 650;
}

.p-sidebar-nav {
  display: flex;
  flex-direction: column;
  padding-top: 0.25rem;
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
  min-height: 3.5rem;
  padding: 0 1.25rem;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

/* ─────────────────────────────────────────────────────────────
   方案 1：浮雕精制双色块 (Variant 1: Solid Floating Block Card)
   ───────────────────────────────────────────────────────────── */
.p-sidebar.sidebar-variant-1 :deep(.p-sidebar-item) {
  border-radius: var(--a-radius-card);
  border: 1px solid transparent;
}
.p-sidebar.sidebar-variant-1 :deep(.p-sidebar-item:hover) {
  background: var(--a-color-surface);
  border-color: var(--a-color-border-soft);
}
.p-sidebar.sidebar-variant-1 :deep(.p-sidebar-item.active) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border);
  box-shadow: var(--a-shadow-sm);
  font-weight: 650;
}
.p-sidebar.sidebar-variant-1 :deep(.p-sidebar-item.active::before) {
  content: '';
  position: absolute;
  left: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
  width: 3.5px;
  height: 18px;
  border-radius: 99px;
  background: var(--a-color-fg);
}

/* ─────────────────────────────────────────────────────────────
   方案 2：极简深色指示条 (Variant 2: Minimalist Left Accent Pill)
   ───────────────────────────────────────────────────────────── */
.p-sidebar.sidebar-variant-2 :deep(.p-sidebar-item) {
  border-radius: 0 var(--a-radius-card) var(--a-radius-card) 0;
  border-left: 3px solid transparent;
  border-top: 1px solid transparent;
  border-right: 1px solid transparent;
  border-bottom: 1px solid transparent;
}
.p-sidebar.sidebar-variant-2 :deep(.p-sidebar-item:hover) {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
}
.p-sidebar.sidebar-variant-2 :deep(.p-sidebar-item.active) {
  background: rgba(0, 0, 0, 0.04);
  color: var(--a-color-fg);
  border-left-color: var(--a-color-fg);
  font-weight: 650;
}

/* ─────────────────────────────────────────────────────────────
   方案 3：胶囊悬浮水晶块 (Variant 3: Floating Pill Glass)
   ───────────────────────────────────────────────────────────── */
.p-sidebar.sidebar-variant-3 :deep(.p-sidebar-item) {
  border-radius: 9999px;
  border: 1px solid transparent;
}
.p-sidebar.sidebar-variant-3 :deep(.p-sidebar-item:hover) {
  background: var(--a-color-surface);
  transform: translateX(2px);
}
.p-sidebar.sidebar-variant-3 :deep(.p-sidebar-item.active) {
  background: var(--a-color-surface-muted);
  color: var(--a-color-fg);
  border-color: var(--a-color-border-soft);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  font-weight: 650;
  transform: translateX(4px);
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

:deep(.p-sidebar-item-label) {
  white-space: nowrap;
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

@media (max-width: 1023px) {
  .p-sidebar {
    width: var(--a-sidebar-collapsed-width, 4.5rem);
  }

  .p-sidebar-bottom,
  .p-sidebar-style-switcher {
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
    min-height: 3.5rem;
    padding: 0;
  }

  .p-sidebar-nav {
    padding-top: 1.25rem;
  }
}
</style>
