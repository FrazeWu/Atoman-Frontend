<template>
  <aside class="editor-sidebar editor-sidebar-left a-card-sm" :class="{ 'is-open': mobileOpen }">
    <section class="left-section publish-section">
      <span class="a-label">发布</span>
      <div class="publish-actions">
        <PButton
          variant="secondary"
          block
          :loading="saving === 'draft'"
          :disabled="!!saving"
          loading-text="保存中…"
          @click="$emit('save-draft')"
        >
          存草稿
        </PButton>
        <PButton
          variant="primary"
          block
          :loading="saving === 'published'"
          :disabled="!!saving"
          loading-text="发布中…"
          @click="$emit('save-published')"
        >
          发布文章
        </PButton>
      </div>
      <PButton v-if="hasDraftManagerAccess" type="button" variant="ghost" size="sm" block @click="$emit('open-draft-manager')">草稿管理</PButton>
    </section>

    <section class="left-section">
      <span class="a-label">所属合集</span>
      <div v-if="channelCollections.length > 0" class="collection-list">
        <label
          v-for="col in channelCollections"
          :key="col.id"
          class="collection-item"
          :class="{ selected: selectedCollectionId === col.id }"
        >
          <input
            type="radio"
            name="post-collection"
            :checked="selectedCollectionId === col.id"
            @change="$emit('select-collection', col.id)"
          />
          <span class="collection-name">{{ col.name }}</span>
          <span v-if="col.id === defaultCollectionId" class="badge-default">默认</span>
        </label>
      </div>
      <span v-else class="col-empty">暂无可用合集</span>
    </section>

    <section class="left-section settings-section">
      <PostMetaSettingsPanel
        :summary="summary"
        :visibility="visibility"
        :allow-comments="allowComments"
        @update:summary="$emit('update:summary', $event)"
        @update:visibility="$emit('update:visibility', $event)"
        @update:allowComments="$emit('update:allowComments', $event)"
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
      <nav v-else class="outline-tree">
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
          <span class="outline-caret" aria-hidden="true">{{ item.hasChildren ? (item.isExpanded ? '⌄' : '›') : '' }}</span>
          <span class="outline-label">{{ item.text }}</span>
        </button>
      </nav>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import PostCoverField from '@/components/blog/PostCoverField.vue'
import PostMetaSettingsPanel from '@/components/blog/PostMetaSettingsPanel.vue'
import PButton from '@/components/ui/PButton.vue'

type BlogVisibility = 'public' | 'followers' | 'private'
type SaveTarget = 'draft' | 'published'
type SidebarCollection = {
  id: string
  name: string
}
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
  saving: SaveTarget | null
  hasDraftManagerAccess: boolean
  channelCollections: SidebarCollection[]
  selectedCollectionId?: string
  defaultCollectionId?: string
  summary: string
  visibility: BlogVisibility
  allowComments: boolean
  coverUrl: string
  coverUploading: boolean
  coverUploadError: string
  outlineCount: number
  flattenedOutline: FlattenedOutlineNode[]
  activeHeadingLine: number | null
}>()

defineEmits<{
  (e: 'save-draft'): void
  (e: 'save-published'): void
  (e: 'open-draft-manager'): void
  (e: 'select-collection', id: string): void
  (e: 'update:summary', value: string): void
  (e: 'update:visibility', value: BlogVisibility): void
  (e: 'update:allowComments', value: boolean): void
  (e: 'cover-upload', event: Event): void
  (e: 'remove-cover'): void
  (e: 'jump-to-heading', line: number): void
}>()

const coverInput = ref<HTMLInputElement | null>(null)

const triggerCoverUpload = () => {
  coverInput.value?.click()
}
</script>

<style scoped>
.editor-sidebar {
  background: var(--a-color-bg);
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.editor-sidebar-left {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 64px - 2rem);
  overflow-y: auto;
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

.publish-section {
  gap: 0.75rem;
}

.publish-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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

.outline-tree {
  display: flex;
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
  font-weight: 700;
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
  font-weight: 900;
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

.collection-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.collection-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: var(--a-border);
  background: var(--a-color-bg);
  cursor: pointer;
  transition: background 120ms;
}

.collection-item.selected {
  background: var(--a-color-fg);
  color: var(--a-color-bg);
}

.collection-item.selected .badge-default {
  border-color: var(--a-color-bg);
  color: var(--a-color-bg);
}

.collection-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.86rem;
  font-weight: 800;
}

.badge-default {
  padding: 0.2rem 0.4rem;
  border: 1.5px solid var(--a-color-border);
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.col-empty {
  color: var(--a-color-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

@media (max-width: 960px) {
  .editor-sidebar-left {
    position: static;
    max-height: none;
    display: none;
  }

  .editor-sidebar-left.is-open {
    display: flex;
  }
}

@media (max-width: 640px) {
  .publish-actions :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }
}
</style>
