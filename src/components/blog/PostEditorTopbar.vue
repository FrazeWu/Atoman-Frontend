<template>
  <header class="editor-topbar">
    <div class="editor-topbar__identity">
      <PButton type="button" variant="ghost" size="sm" aria-label="返回" title="返回" @click="$emit('go-back')">
        <ArrowLeft :size="17" aria-hidden="true" />
      </PButton>
      <span class="editor-topbar__title">{{ isEdit ? '编辑文章' : '新建文章' }}</span>
      <span class="editor-topbar__status" :class="`is-${draftStatus.tone}`">{{ draftStatus.text }}</span>
    </div>

    <div class="editor-topbar__actions">
      <PButton type="button" variant="ghost" size="sm" aria-label="文章设置" title="文章设置" @click="$emit('toggle-settings')">
        <PanelLeft :size="17" aria-hidden="true" />
      </PButton>
      <PButton type="button" variant="ghost" size="sm" aria-label="文档目录" title="文档目录" @click="$emit('toggle-outline')">
        <PanelRight :size="17" aria-hidden="true" />
      </PButton>
      <PDropdown position="right" label="更多操作">
        <template #trigger>
          <PButton type="button" variant="ghost" size="sm" aria-label="更多操作" title="更多操作">
            <Ellipsis :size="18" aria-hidden="true" />
          </PButton>
        </template>
        <template #default="{ close }">
          <div class="editor-topbar__menu">
            <button type="button" class="editor-topbar__menu-item" @click="handleImport(); close()">
              <Upload :size="16" aria-hidden="true" />
              {{ contentSource === 'imported' ? '重新导入 Markdown' : '导入 Markdown' }}
            </button>
            <button v-if="isEdit" type="button" class="editor-topbar__menu-item" @click="$emit('open-version-history'); close()">
              <History :size="16" aria-hidden="true" />
              版本历史
            </button>
            <slot name="schedule" />
          </div>
        </template>
      </PDropdown>
      <input ref="fileInput" type="file" accept=".md,.markdown,.txt" class="hidden-file-input" @change="$emit('import-file', $event)" />
      <PButton type="button" variant="secondary" size="sm" class="editor-topbar__save" :loading="saving === 'draft'" :disabled="Boolean(saving)" loading-text="保存中…" @click="$emit('save-draft')">
        存草稿
      </PButton>
      <PButton type="button" variant="primary" size="sm" class="editor-topbar__publish" :loading="saving === 'published'" :disabled="Boolean(saving)" loading-text="发布中…" @click="$emit('save-published')">
        发布
      </PButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, Ellipsis, History, PanelLeft, PanelRight, Upload } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'

type SaveTarget = 'draft' | 'published'

const props = defineProps<{
  isEdit: boolean
  draftStatus: { text: string; tone: 'ok' | 'warn' | 'muted' }
  contentSource: 'empty' | 'imported' | 'manual'
  saving: SaveTarget | null
}>()

const emit = defineEmits<{
  (e: 'go-back'): void
  (e: 'toggle-settings'): void
  (e: 'toggle-outline'): void
  (e: 'import-file', event: Event): void
  (e: 'trigger-reimport'): void
  (e: 'open-version-history'): void
  (e: 'save-draft'): void
  (e: 'save-published'): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)

const handleImport = () => {
  if (props.contentSource === 'imported') {
    emit('trigger-reimport')
    return
  }
  fileInput.value?.click()
}
</script>

<style scoped>
.editor-topbar {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 1rem;
  border-bottom: var(--a-border);
  background: var(--a-color-bg);
}

.editor-topbar__identity,
.editor-topbar__actions {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.4rem;
}

.editor-topbar__title {
  font-size: 0.86rem;
  font-weight: 650;
  white-space: nowrap;
}

.editor-topbar__status {
  color: var(--a-color-muted);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.editor-topbar__status.is-ok {
  color: var(--a-color-success);
}

.editor-topbar__status.is-warn {
  color: var(--a-color-danger);
}

.editor-topbar__menu {
  display: grid;
  min-width: 12rem;
  padding: 0.25rem;
}

.editor-topbar__menu-item {
  display: flex;
  min-height: 2.25rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.65rem;
  border: 0;
  background: transparent;
  color: var(--a-color-fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
}

.editor-topbar__menu-item:hover,
.editor-topbar__menu-item:focus-visible {
  background: var(--a-color-surface);
  outline: none;
}

.hidden-file-input {
  display: none;
}

@media (max-width: 960px) {
  .editor-topbar {
    min-height: 3.25rem;
    padding: 0.4rem 0.75rem;
  }

  .editor-topbar__title,
  .editor-topbar__save,
  .editor-topbar__publish {
    display: none;
  }

  .editor-topbar__actions {
    margin-left: auto;
  }
}
</style>
