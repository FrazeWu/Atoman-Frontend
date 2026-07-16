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
defineProps<{
  mobileOpen: boolean
  saving: SaveTarget | null
  hasDraftManagerAccess: boolean
  channelCollections: SidebarCollection[]
  selectedCollectionId?: string
  defaultCollectionId?: string
  summary: string
  visibility: BlogVisibility
  coverUrl: string
  coverUploading: boolean
  coverUploadError: string
}>()

defineEmits<{
  (e: 'save-draft'): void
  (e: 'save-published'): void
  (e: 'open-draft-manager'): void
  (e: 'select-collection', id: string): void
  (e: 'update:summary', value: string): void
  (e: 'update:visibility', value: BlogVisibility): void
  (e: 'cover-upload', event: Event): void
  (e: 'remove-cover'): void
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

@media (max-width: 1023px) {
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
