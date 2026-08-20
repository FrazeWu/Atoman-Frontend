<template>
  <aside class="editor-outline" :class="{ 'is-open': mobileOpen, 'is-expanded': desktopOpen }" aria-label="文档目录">
    <div class="editor-outline__heading">
      <span class="a-label">文档目录</span>
      <span class="a-muted">{{ outlineCount }} 个标题</span>
    </div>
    <p v-if="outlineCount === 0" class="editor-outline__empty">加入 Markdown 标题后显示</p>
    <nav v-else class="editor-outline__tree">
      <button
        v-for="item in flattenedOutline"
        :key="item.id"
        type="button"
        class="editor-outline__node"
        :class="{
          'is-active': item.line === activeHeadingLine,
          'is-active-branch': item.isActiveBranch,
          'has-children': item.hasChildren,
        }"
        :style="{ '--depth': String(item.depth) }"
        :title="item.text"
        @click="$emit('jump-to-heading', item.line)"
      >
        <span class="editor-outline__caret" aria-hidden="true">{{ item.hasChildren ? (item.isExpanded ? '⌄' : '›') : '' }}</span>
        <span class="editor-outline__label">{{ item.text }}</span>
      </button>
    </nav>
  </aside>
</template>

<script setup lang="ts">
type FlattenedOutlineNode = {
  id: string
  text: string
  line: number
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
  (e: 'jump-to-heading', line: number): void
}>()
</script>

<style scoped>
.editor-outline {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  background: var(--a-color-bg);
  opacity: 0;
  transform: translateX(1rem);
  transition: opacity 160ms ease, transform 160ms ease, visibility 160ms ease;
  visibility: hidden;
}

.editor-outline.is-expanded {
  overflow-y: auto;
  border-left: var(--a-border);
  opacity: 1;
  transform: translateX(0);
  visibility: visible;
}

.editor-outline__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.15rem 1rem;
  border-bottom: var(--a-border);
}

.editor-outline__heading .a-muted {
  font-size: 0.72rem;
}

.editor-outline__tree {
  display: flex;
  flex-direction: column;
  padding: 0.6rem 0;
}

.editor-outline__node {
  --depth: 0;
  display: grid;
  width: 100%;
  grid-template-columns: 1rem minmax(0, 1fr);
  align-items: start;
  gap: 0.3rem;
  padding: 0.45rem 0.75rem;
  padding-left: calc(0.75rem + var(--depth, 0) * 0.65rem);
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--a-color-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.45;
  text-align: left;
}

.editor-outline__node:hover {
  background: var(--a-color-surface);
  color: var(--a-color-fg);
}

.editor-outline__node:focus-visible {
  outline: 2px solid var(--a-color-fg);
  outline-offset: -2px;
}

.editor-outline__node.is-active {
  border-left-color: var(--a-color-fg);
  background: var(--a-color-surface);
  color: var(--a-color-fg);
  font-weight: 650;
}

.editor-outline__node.has-children,
.editor-outline__node.is-active-branch:not(.is-active) {
  color: var(--a-color-fg);
}

.editor-outline__caret {
  color: var(--a-color-muted);
  font-size: 0.75rem;
  line-height: 1.45;
  user-select: none;
}

.editor-outline__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-outline__empty {
  margin: 0;
  padding: 1rem;
  color: var(--a-color-muted);
  font-size: 0.82rem;
  line-height: 1.55;
}

@media (max-width: 960px) {
  .editor-outline {
    position: absolute;
    z-index: 3;
    inset: 0;
    display: none;
    border: 0;
  }

  .editor-outline.is-open {
    display: flex;
    overflow-y: auto;
    opacity: 1;
    transform: translateX(0);
    visibility: visible;
  }
}
</style>
