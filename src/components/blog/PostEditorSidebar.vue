<template>
  <aside class="editor-sidebar editor-sidebar-left a-card-sm" :class="{ 'is-open': mobileOpen, 'is-expanded': desktopOpen }" aria-label="文章设置与目录">
    <div class="editor-sidebar__mobile-header">
      <strong>文章设置与目录</strong>
      <button type="button" aria-label="关闭文章设置与目录" title="关闭" @click="$emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>
    <section class="left-section">
      <span class="a-label">所属合集</span>
      <div v-if="defaultCollection" class="collection-selection">
        <div class="default-collection-row" aria-label="默认合集：全部文章">
          <Check :size="16" aria-hidden="true" />
          <span>全部文章</span>
          <span class="badge-default">默认</span>
        </div>
        <PSelect
          :model-value="selectedCollectionId || ''"
          :options="ordinaryCollectionOptions"
          label="普通合集"
          @update:model-value="$emit('select-collection', String($event))"
        />
      </div>
      <span v-else class="col-empty">暂无可用合集</span>
    </section>

    <section class="left-section settings-section">
      <PostMetaSettingsPanel
        :summary="summary"
        :visibility="visibility"
        @update:summary="$emit('update:summary', $event)"
        @update:visibility="$emit('update:visibility', $event)"
      />

      <details class="settings-details">
        <summary class="settings-summary">
          <span class="a-label">封面图</span>
        </summary>
        <div class="settings-body">
          <input
            ref="coverInput"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden-file-input"
            @change="$emit('cover-upload', $event)"
          />
          <PostCoverField
            :cover-url="coverUrl"
            :uploading="coverUploading"
            :error="coverUploadError"
            @trigger-upload="triggerCoverUpload"
            @remove-cover="$emit('remove-cover')"
          />
        </div>
      </details>
    </section>

    <section class="left-section toc-panel">
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
import { computed, ref } from 'vue'
import { IconCheck as Check, IconX as X } from '@tabler/icons-vue'

import PostCoverField from '@/components/blog/PostCoverField.vue'
import PostMetaSettingsPanel from '@/components/blog/PostMetaSettingsPanel.vue'
import PSelect from '@/components/ui/PSelect.vue'

type FlattenedOutlineNode = {
  id: string
  level: number
  text: string
  line: number
  parentId: string | null
  depth: number
  hasChildren: boolean
  isExpanded: boolean
  isActiveBranch: boolean
}

type BlogVisibility = 'public' | 'followers' | 'private'
type SidebarCollection = {
  id: string
  name: string
  is_default?: boolean
}

const props = defineProps<{
  mobileOpen: boolean
  desktopOpen: boolean
  channelCollections: SidebarCollection[]
  selectedCollectionId?: string
  summary: string
  visibility: BlogVisibility
  coverUrl: string
  coverUploading: boolean
  coverUploadError: string
  outlineCount: number
  flattenedOutline: FlattenedOutlineNode[]
  activeHeadingLine: number | null
}>()

defineEmits<{
  (e: 'select-collection', id: string): void
  (e: 'update:summary', value: string): void
  (e: 'update:visibility', value: BlogVisibility): void
  (e: 'cover-upload', event: Event): void
  (e: 'remove-cover'): void
  (e: 'jump-to-heading', line: number): void
  (e: 'close'): void
}>()

const defaultCollection = computed(() => props.channelCollections.find(collection => collection.is_default))
const ordinaryCollectionOptions = computed(() => [
  { label: '仅全部文章', value: '' },
  ...props.channelCollections
    .filter(collection => !collection.is_default)
    .map(collection => ({ label: collection.name, value: collection.id })),
])

const coverInput = ref<HTMLInputElement | null>(null)

const triggerCoverUpload = () => {
  coverInput.value?.click()
}
</script>

<style scoped>
.editor-sidebar {
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

.editor-sidebar.is-expanded {
  overflow-y: auto;
  border-left: var(--a-border);
  opacity: 1;
  transform: translateX(0);
  visibility: visible;
}

.editor-sidebar-left {
  max-height: none;
}

.editor-sidebar__mobile-header {
  display: none;
}

.left-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  border-bottom: none;
}

.left-section:last-child {
  border-bottom: none;
}

.collection-selection {
  display: grid;
  gap: 1rem;
}

.default-collection-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--a-color-border-soft);
  font-weight: 500;
}

.default-collection-row .badge-default {
  margin-left: auto;
}

.settings-section {
  padding: 0;
  gap: 0;
}

.settings-details {
  border-bottom: none;
}

.settings-details:last-child {
  border-bottom: none;
}

.settings-summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.85rem 1.25rem;
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.settings-summary::-webkit-details-marker {
  display: none;
}

.settings-summary::before {
  content: '›';
  font-size: 0.9rem;
  color: var(--a-color-muted);
  transition: transform 0.15s;
  display: inline-block;
  width: 0.75rem;
  flex-shrink: 0;
}

details[open] > .settings-summary::before {
  transform: rotate(90deg);
}

.settings-body {
  padding: 0 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toc-panel {
  flex: 1;
  min-height: 12rem;
}

.outline-tree {
  display: flex;
  overflow-y: auto;
  flex-direction: column;
}

.outline-node {
  --depth: 0;
  display: grid;
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
  width: 100%;
}

.outline-node:hover {
  color: var(--a-color-fg);
  border-left-color: var(--a-color-border);
  background: var(--a-color-surface);
}

.outline-node.is-active {
  color: var(--a-color-fg);
  border-left-color: var(--a-color-fg);
  background: var(--a-color-surface);
  font-weight: 500;
}

.outline-node.has-children {
  border-left-color: #bbb;
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

.hidden-file-input {
  display: none;
}

.badge-default {
  padding: 0.2rem 0.4rem;
  border: 1.5px solid var(--a-color-border);
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
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
    opacity: 1;
    transform: translateX(0);
    visibility: visible;
  }
}
</style>
