<template>
  <div class="p-directory-shell">
    <aside
      class="p-directory-panel"
      :class="{ 'is-collapsed': collapsed }"
      :aria-label="ariaLabel"
    >
      <header class="p-directory-header">
        <strong v-if="!collapsed">{{ title }}</strong>
        <button
          type="button"
          class="p-directory-toggle"
          :aria-label="collapsed ? '展开目录' : '收起目录'"
          :title="collapsed ? '展开目录' : '收起目录'"
          @click="$emit('update:collapsed', !collapsed)"
        >
          <PanelRightOpen v-if="collapsed" :size="18" aria-hidden="true" />
          <PanelRightClose v-else :size="18" aria-hidden="true" />
        </button>
        <span v-if="collapsed" class="p-directory-collapsed-label">{{
          title
        }}</span>
      </header>

      <nav v-if="!collapsed" class="p-directory-list" :aria-label="ariaLabel">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="p-directory-item"
          :class="{ 'is-active': item.id === activeId }"
          :aria-current="item.id === activeId ? 'location' : undefined"
          :title="item.label"
          @click="selectItem(item.id, false)"
        >
          {{ item.label }}
        </button>
      </nav>
    </aside>
  </div>

  <PSheet
      :show="mobileOpen"
      side="bottom"
      :title="title"
      close-type="header"
      panel-class="p-directory-sheet"
      height="min(70dvh, 36rem)"
      @close="$emit('close-mobile')"
    >
      <nav
        class="p-directory-list p-directory-list--mobile"
        :aria-label="ariaLabel"
      >
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="p-directory-item"
          :class="{ 'is-active': item.id === activeId }"
          :aria-current="item.id === activeId ? 'location' : undefined"
          @click="selectItem(item.id, true)"
        >
          {{ item.label }}
        </button>
      </nav>
  </PSheet>
</template>

<script setup lang="ts">
import { IconLayoutSidebarRightCollapse as PanelRightClose, IconLayoutSidebarRightExpand as PanelRightOpen } from '@tabler/icons-vue';
import PSheet from "@/components/ui/PSheet.vue";

type DirectoryItem = { id: string; label: string };

withDefaults(
  defineProps<{
    items: DirectoryItem[];
    activeId?: string | null;
    collapsed?: boolean;
    mobileOpen?: boolean;
    title?: string;
    ariaLabel?: string;
  }>(),
  {
    activeId: null,
    collapsed: false,
    mobileOpen: false,
    title: "目录",
    ariaLabel: "页面目录",
  },
);

const emit = defineEmits<{
  select: [id: string];
  "update:collapsed": [collapsed: boolean];
  "close-mobile": [];
}>();

function selectItem(id: string, mobile: boolean) {
  emit("select", id);
  if (mobile) emit("close-mobile");
}
</script>

<style scoped>
.p-directory-shell {
  position: sticky;
  top: calc(var(--a-topbar-height) + 1rem);
  z-index: var(--a-z-popover);
  align-self: start;
  width: 13.75rem;
  min-width: 0;
  transition: width 0.2s ease;
}
.p-directory-shell:has(.is-collapsed) {
  width: 3rem;
}
.p-directory-panel {
  width: 13.75rem;
  max-height: calc(100dvh - var(--a-topbar-height) - 2rem);
  overflow: hidden;
  border: 1px solid var(--a-color-border);
  border-radius: 8px;
  background: var(--a-color-surface);
  box-shadow: 0 12px 28px
    color-mix(in srgb, var(--a-color-text) 12%, transparent);
  transition: width 0.2s ease;
}
.p-directory-panel.is-collapsed {
  width: 3rem;
}
.p-directory-header {
  display: flex;
  min-height: 3.375rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.5rem 0 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}
.p-directory-header strong {
  font-size: var(--a-text-sm);
  font-weight: var(--a-font-weight-strong);
}
.p-directory-toggle {
  display: grid;
  width: 2.375rem;
  height: 2.375rem;
  flex: 0 0 2.375rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-text-secondary);
  cursor: pointer;
}
.p-directory-toggle:hover,
.p-directory-toggle:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}
.p-directory-toggle:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: 1px;
}
.is-collapsed .p-directory-header {
  min-height: 3rem;
  flex-direction: column;
  justify-content: flex-start;
  gap: 0.625rem;
  padding: 0.25rem;
  border-bottom: 0;
}
.p-directory-collapsed-label {
  padding-bottom: 0.75rem;
  color: var(--a-color-text-secondary);
  font-size: var(--a-text-xs);
  writing-mode: vertical-rl;
}
.p-directory-list {
  display: grid;
  max-height: calc(100dvh - var(--a-topbar-height) - 6.375rem);
  overflow-y: auto;
  padding: 0.5rem;
}
.p-directory-item {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  padding: 0.5rem 0.625rem 0.5rem 0.875rem;
  border: 0;
  border-radius: var(--a-radius-control);
  background: transparent;
  color: var(--a-color-text-secondary);
  font-size: var(--a-text-sm);
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.p-directory-item:hover,
.p-directory-item:focus-visible {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
}
.p-directory-item:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
}
.p-directory-item.is-active {
  background: var(--a-color-surface-muted);
  color: var(--a-color-text);
  font-weight: var(--a-font-weight-strong);
}
.p-directory-item.is-active::before {
  position: absolute;
  left: 0.3125rem;
  width: 2px;
  height: 1.125rem;
  border-radius: 2px;
  background: var(--a-color-primary);
  content: "";
}
.p-directory-list--mobile {
  max-height: none;
  padding: 0.5rem 0.75rem 1rem;
}
@media (max-width: 1023px) {
  .p-directory-shell {
    display: none;
  }
}
</style>

<style>
.p-directory-sheet.p-sheet-mobile-page {
  position: fixed;
  right: 0;
  bottom: var(--a-content-bottom-offset);
  left: 0;
  z-index: var(--a-z-sheet);
  max-height: min(70dvh, 36rem);
  overflow-y: auto;
  padding: 1rem 0.75rem 2rem;
  border-top: 1px solid var(--a-color-border);
  box-shadow: 0 -12px 28px color-mix(in srgb, var(--a-color-text) 12%, transparent);
}

.p-directory-sheet.p-sheet-mobile-page .p-sheet-mobile-page__header {
  margin: 0 0 1rem;
}

.p-directory-sheet.p-sheet-mobile-page .p-directory-list--mobile {
  padding: 0;
}

.p-directory-sheet.p-sheet-panel.is-bottom {
  right: 0.75rem !important;
  bottom: calc(var(--a-content-bottom-offset) + 0.75rem) !important;
  left: 0.75rem !important;
  width: calc(100% - 1.5rem) !important;
  max-width: calc(100% - 1.5rem) !important;
  overflow: hidden;
  border: 1px solid var(--a-color-border) !important;
  border-radius: 8px;
  background: var(--a-color-surface) !important;
}
.p-directory-sheet .sheet-content,
.p-directory-sheet .sheet-content-header-inline {
  background: transparent;
}
</style>
