<template>
  <header class="editor-topbar">
    <div class="editor-topbar__main">
      <div class="editor-topbar__identity">
        <PButton type="button" variant="ghost" size="sm" aria-label="返回" title="返回" @click="$emit('go-back')">
          <ArrowLeft :size="17" aria-hidden="true" />
        </PButton>
        <span class="editor-topbar__title">{{ isEdit ? '编辑文章' : '新建文章' }}</span>
        <span class="editor-topbar__status" :class="`is-${draftStatus.tone}`">
          <span class="editor-topbar__status-dot" aria-hidden="true" />
          {{ draftStatus.text }}
        </span>
      </div>

      <div class="editor-topbar__center">
        <PButton
          v-if="contentMode !== 'visual'"
          type="button"
          variant="ghost"
          size="sm"
          class="editor-topbar__preview-button"
          :aria-label="previewOpen ? '关闭实时预览' : '实时预览'"
          :title="previewOpen ? '关闭实时预览' : '实时预览'"
          :aria-pressed="previewOpen"
          @click="$emit('toggle-preview')"
        >
          <EyeOff v-if="previewOpen" :size="16" aria-hidden="true" />
          <Eye v-else :size="16" aria-hidden="true" />
          <span class="editor-topbar__btn-text">{{ previewOpen ? '关闭实时预览' : '实时预览' }}</span>
        </PButton>
      </div>

      <div class="editor-topbar__actions">
        <PSegmentedControl
          :model-value="contentMode"
          :options="contentModeOptions"
          @update:model-value="value => $emit('update:content-mode', value as 'markdown' | 'visual')"
        />

        <PButton
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="contentSource === 'imported' ? '重新导入 Markdown' : '导入 Markdown'"
          :title="contentSource === 'imported' ? '重新导入 Markdown' : '导入 Markdown'"
          @click="handleImport"
        >
          <FileInput :size="16" aria-hidden="true" />
          <span class="editor-topbar__btn-text">{{ contentSource === 'imported' ? '重新导入' : '导入 Markdown' }}</span>
        </PButton>

        <PButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label="草稿管理"
          title="草稿管理"
          @click="$emit('open-draft-manager')"
        >
          <FileText :size="16" aria-hidden="true" />
          <span class="editor-topbar__btn-text">草稿管理</span>
        </PButton>

        <PDropdown v-if="isEdit" position="right" label="更多操作">
          <template #trigger>
            <PButton type="button" variant="ghost" size="sm" aria-label="更多操作" title="更多操作">
              <Ellipsis :size="17" aria-hidden="true" />
            </PButton>
          </template>
          <template #default="{ close }">
            <div class="editor-topbar__menu">
              <button v-if="isEdit" type="button" class="editor-topbar__menu-item" :disabled="exporting" @click="$emit('export-markdown'); close()">
                <Download :size="15" aria-hidden="true" />
                导出 Markdown
              </button>
              <button v-if="isEdit" type="button" class="editor-topbar__menu-item" @click="$emit('open-version-history'); close()">
                <History :size="15" aria-hidden="true" />
                版本历史
              </button>
            </div>
          </template>
        </PDropdown>

        <span class="editor-topbar__divider" aria-hidden="true" />

        <PButton
          type="button"
          variant="secondary"
          size="sm"
          :loading="saving === 'draft'"
          :disabled="Boolean(saving)"
          loading-text="保存中…"
          @click="$emit('save-draft')"
        >
          存草稿
        </PButton>

        <PButton
          type="button"
          variant="primary"
          size="sm"
          :loading="saving === 'published' || (publicationOpen && publicationBusy)"
          :disabled="Boolean(saving) || (publicationOpen && !publicationCanConfirm)"
          :loading-text="publicationOpen ? '处理中…' : '发布中…'"
          data-testid="editor-publish-action"
          @click="$emit('save-published')"
        >
          {{ publicationOpen ? (publicationIntent === 'schedule' ? '确认定时发布' : '确认发布') : '发布' }}
        </PButton>

        <input ref="fileInput" type="file" accept=".md,.markdown,.txt" class="hidden-file-input" @change="$emit('import-file', $event)" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, Download, Ellipsis, Eye, EyeOff, FileInput, FileText, History } from 'lucide-vue-next'
import PButton from '@/components/ui/PButton.vue'
import PDropdown from '@/components/ui/PDropdown.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'

type SaveTarget = 'draft' | 'published'

defineProps<{
  isEdit: boolean
  draftStatus: { text: string; tone: 'ok' | 'warn' | 'muted' }
  contentSource: 'empty' | 'imported' | 'manual'
  saving: SaveTarget | null
  exporting: boolean
  contentMode: 'markdown' | 'visual'
  previewOpen?: boolean
  publicationOpen?: boolean
  publicationCanConfirm?: boolean
  publicationBusy?: boolean
  publicationIntent?: 'publish' | 'schedule'
}>()

defineEmits<{
  (event: 'go-back'): void
  (event: 'toggle-preview'): void
  (event: 'update:content-mode', value: 'markdown' | 'visual'): void
  (event: 'import-file', eventValue: Event): void
  (event: 'open-draft-manager'): void
  (event: 'export-markdown'): void
  (event: 'open-version-history'): void
  (event: 'save-draft'): void
  (event: 'save-published'): void
}>()

const contentModeOptions: Array<{ label: string; value: 'markdown' | 'visual' }> = [
  { label: 'Markdown', value: 'markdown' },
  { label: 'Visual', value: 'visual' },
]

const fileInput = ref<HTMLInputElement | null>(null)
const handleImport = () => fileInput.value?.click()
</script>

<style scoped>
.editor-topbar {
  display: flex;
  min-height: 3.25rem;
  height: 3.25rem;
  align-items: center;
  border-bottom: 1px solid var(--a-color-border-soft);
  background: var(--a-color-bg);
}

.editor-topbar__main {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  gap: 0.75rem;
}

.editor-topbar__identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1 1 auto;
}

.editor-topbar__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--a-color-text);
  white-space: nowrap;
}

.editor-topbar__status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--a-color-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0.15rem 0.5rem;
  border-radius: var(--a-radius-pill, 9999px);
  background: var(--a-color-surface-muted);
}

.editor-topbar__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--a-color-muted);
  flex-shrink: 0;
}

.editor-topbar__status.is-ok {
  color: var(--a-color-success, #34c759);
}
.editor-topbar__status.is-ok .editor-topbar__status-dot {
  background: var(--a-color-success, #34c759);
}

.editor-topbar__status.is-warn {
  color: var(--a-color-danger, #ff3b30);
}
.editor-topbar__status.is-warn .editor-topbar__status-dot {
  background: var(--a-color-danger, #ff3b30);
}

.editor-topbar__center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.editor-topbar__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 1 1 auto;
  justify-content: flex-end;
}

.editor-topbar__divider {
  width: 1px;
  height: 1.25rem;
  background: var(--a-color-border-soft);
  margin-inline: 0.25rem;
  flex-shrink: 0;
}

.editor-topbar__menu {
  display: grid;
  min-width: 11rem;
  padding: 0.25rem;
}

.editor-topbar__menu-item {
  display: flex;
  min-height: 2.25rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.65rem;
  border: 0;
  border-radius: var(--a-radius-control, 4px);
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  text-align: left;
  transition: background-color 0.12s ease;
}

.editor-topbar__menu-item:hover,
.editor-topbar__menu-item:focus-visible {
  background: var(--a-color-surface-muted);
  outline: none;
}

.hidden-file-input {
  display: none;
}

@media (max-width: 900px) {
  .editor-topbar__btn-text {
    display: none;
  }
}

@media (max-width: 640px) {
  .editor-topbar {
    min-height: 3rem;
    height: 3rem;
  }
  .editor-topbar__main {
    padding-inline: 0.5rem;
    gap: 0.35rem;
  }
  .editor-topbar__status {
    display: none;
  }
  .editor-topbar :deep(.p-segmented-control-item) {
    padding-inline: 0.5rem;
    font-size: 0.72rem;
  }
}
</style>
