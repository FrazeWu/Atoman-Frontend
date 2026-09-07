<template>
  <aside
    class="editor-sidebar editor-sidebar-left"
    :class="{ 'is-open': mobileOpen, 'is-expanded': desktopOpen }"
    aria-label="文档目录"
  >
    <div class="editor-sidebar__mobile-header">
      <strong>文档目录</strong>
      <button type="button" aria-label="关闭文档目录" title="关闭" @click="$emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>

    <section class="toc-panel">
      <div class="section-heading-row">
        <span class="a-label">文档目录</span>
        <span class="a-muted">{{ outlineCount }} 个标题</span>
      </div>
      <div v-if="outlineCount === 0" class="col-empty">加入 Markdown 标题后显示</div>
      <nav v-else class="outline-tree" aria-label="文档目录">
        <button
          v-for="item in flattenedOutline"
          :key="item.id"
          type="button"
          class="outline-node"
          :class="{
            'is-active': item.line === activeHeadingLine,
            'is-active-branch': item.isActiveBranch,
            'has-children': item.hasChildren,
          }"
          :style="{ '--depth': String(item.depth) }"
          :title="item.text"
          @click="$emit('jump-to-heading', item.line)"
        >
          <span class="outline-caret" aria-hidden="true">{{ item.hasChildren ? (item.isExpanded ? 'v' : '>') : '' }}</span>
          <span class="outline-label">{{ item.text }}</span>
        </button>
      </nav>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { IconX as X } from '@tabler/icons-vue'

type FlattenedOutlineNode = {
  id: string
  line: number
  text: string
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  isActiveBranch: boolean
}

defineProps<{
  mobileOpen: boolean
  desktopOpen: boolean
  outlineCount: number
  flattenedOutline: FlattenedOutlineNode[]
  activeHeadingLine: number | null
}>()

defineEmits<{
  (event: 'jump-to-heading', line: number): void
  (event: 'close'): void
}>()
</script>

<style scoped>
.editor-sidebar {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-left: var(--a-border);
  background: var(--a-color-bg);
  opacity: 1;
  transform: translateX(0);
  visibility: visible;
}

.editor-sidebar:not(.is-expanded) {
  display: none;
}

.editor-sidebar-left {
  max-height: none;
}

.editor-sidebar__mobile-header {
  display: none;
}

.toc-panel {
  display: flex;
  min-height: 12rem;
  flex: 1;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.25rem;
}

.outline-tree {
  display: flex;
  overflow-y: auto;
  flex-direction: column;
}

.outline-node {
  --depth: 0;
  display: grid;
  width: 100%;
  grid-template-columns: 1rem minmax(0, 1fr);
  align-items: start;
  gap: 0.3rem;
  padding: 0.4rem 0.5rem;
  padding-left: calc(0.5rem + var(--depth, 0) * 0.6rem);
  border: none;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--a-color-muted);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.outline-node:hover,
.outline-node:focus-visible {
  color: var(--a-color-fg);
  border-left-color: var(--a-color-border);
  background: var(--a-color-surface);
}

.outline-node:focus-visible {
  outline: 2px solid var(--a-color-primary);
  outline-offset: -2px;
}

.outline-node.is-active {
  color: var(--a-color-fg);
  border-left-color: var(--a-color-fg);
  background: var(--a-color-surface);
  font-weight: 600;
}

.outline-node.has-children {
  border-left-color: var(--a-color-border);
}

.outline-node.is-active-branch:not(.is-active) {
  color: var(--a-color-fg);
  opacity: 0.8;
}

.outline-caret {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  line-height: 1.4;
  user-select: none;
}

.outline-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-empty {
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 500;
}

.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

@media (max-width: 960px) {
  .editor-sidebar-left {
    position: absolute;
    z-index: 6;
    inset: 0;
    display: none;
    max-height: none;
    border-left: 0;
  }

  .editor-sidebar__mobile-header {
    display: flex;
    min-height: 3.5rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    border-bottom: var(--a-border);
  }

  .editor-sidebar__mobile-header strong {
    font-size: 0.86rem;
  }

  .editor-sidebar__mobile-header button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--a-color-fg);
    cursor: pointer;
  }

  .editor-sidebar__mobile-header button:focus-visible {
    outline: 2px solid var(--a-color-fg);
    outline-offset: -2px;
  }

  .editor-sidebar-left.is-open {
    display: flex;
    overflow-y: auto;
  }
}
</style>
