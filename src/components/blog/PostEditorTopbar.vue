<template>
  <header class="editor-topbar">
    <div class="editor-topbar__header-row">
      <div class="editor-topbar__identity">
        <PButton type="button" variant="ghost" size="sm" aria-label="返回" title="返回" @click="$emit('go-back')">
          <ArrowLeft :size="17" aria-hidden="true" />
        </PButton>
        <span class="editor-topbar__title">{{ isEdit ? '编辑文章' : '新建文章' }}</span>
        <span class="editor-topbar__status" :class="`is-${draftStatus.tone}`">{{ draftStatus.text }}</span>
      </div>

      <div class="editor-topbar__tools">
        <PSegmentedControl
          :model-value="contentMode"
          :options="contentModeOptions"
          @update:model-value="value => $emit('update:content-mode', value as 'markdown' | 'visual')"
        />
        <PButton
          type="button"
          variant="ghost"
          size="sm"
          :aria-label="previewOpen ? '关闭预览' : '打开预览'"
          :title="previewOpen ? '关闭预览' : '打开预览'"
          :aria-pressed="previewOpen"
          @click="$emit('toggle-preview')"
        >
          <EyeOff v-if="previewOpen" :size="17" aria-hidden="true" />
          <Eye v-else :size="17" aria-hidden="true" />
        </PButton>
        <PButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label="文档目录"
          title="文档目录"
          :aria-pressed="sidebarOpen"
          @click="$emit('toggle-sidebar')"
        >
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
              <button type="button" class="editor-topbar__menu-item" @click="$emit('open-draft-manager'); close()">
                草稿管理
              </button>
              <button v-if="isEdit" type="button" class="editor-topbar__menu-item" :disabled="exporting" @click="$emit('export-markdown'); close()">
                <Download :size="16" aria-hidden="true" />
                导出 Markdown
              </button>
              <button v-if="isEdit" type="button" class="editor-topbar__menu-item" @click="$emit('open-version-history'); close()">
                <History :size="16" aria-hidden="true" />
                版本历史
              </button>
            </div>
          </template>
        </PDropdown>
        <input ref="fileInput" type="file" accept=".md,.markdown,.txt" class="hidden-file-input" @change="$emit('import-file', $event)" />
      </div>
    </div>

    <div class="editor-topbar__publish-row">
      <PButton type="button" variant="secondary" size="sm" :loading="saving === 'draft'" :disabled="Boolean(saving)" loading-text="保存中…" @click="$emit('save-draft')">
        存草稿
      </PButton>
      <PButton type="button" variant="secondary" size="sm" :disabled="Boolean(saving)" @click="$emit('schedule-publish')">
        <CalendarClock :size="16" aria-hidden="true" />
        定时发布
      </PButton>
      <PButton type="button" variant="primary" size="sm" :loading="saving === 'published'" :disabled="Boolean(saving)" loading-text="发布中…" @click="$emit('save-published')">
        发布
      </PButton>
      <span class="editor-topbar__publish-status" :class="`is-${draftStatus.tone}`">{{ draftStatus.text }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IconArrowLeft as ArrowLeft, IconCalendarClock as CalendarClock, IconDownload as Download, IconDots as Ellipsis, IconEye as Eye, IconEyeOff as EyeOff, IconHistory as History, IconLayoutSidebarRight as PanelRight, IconUpload as Upload } from '@tabler/icons-vue'
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
  sidebarOpen?: boolean
}>()

defineEmits<{
  (event: 'go-back'): void
  (event: 'toggle-sidebar'): void
  (event: 'toggle-preview'): void
  (event: 'update:content-mode', value: 'markdown' | 'visual'): void
  (event: 'import-file', eventValue: Event): void
  (event: 'open-draft-manager'): void
  (event: 'export-markdown'): void
  (event: 'open-version-history'): void
  (event: 'save-draft'): void
  (event: 'save-published'): void
  (event: 'schedule-publish'): void
}>()

const contentModeOptions: Array<{ label: string; value: 'markdown' | 'visual' }> = [
  { label: 'Markdown', value: 'markdown' },
  { label: '所见即所得', value: 'visual' },
]

const fileInput = ref<HTMLInputElement | null>(null)
const handleImport = () => fileInput.value?.click()
</script>

<style scoped>
.editor-topbar {
  display: grid;
  min-height: 7rem;
  gap: 0;
  border-bottom: var(--a-border);
  background: var(--a-color-bg);
}

.editor-topbar__header-row,
.editor-topbar__publish-row,
.editor-topbar__identity,
.editor-topbar__tools {
  display: flex;
  min-width: 0;
  align-items: center;
}

.editor-topbar__header-row {
  justify-content: space-between;
  gap: 1rem;
  min-height: 3.5rem;
  padding: 0.5rem 1rem;
}

.editor-topbar__identity,
.editor-topbar__tools,
.editor-topbar__publish-row {
  gap: 0.4rem;
}

.editor-topbar__identity {
  flex: 1;
}

.editor-topbar__tools {
  flex-shrink: 0;
}

.editor-topbar__title {
  font-size: 0.86rem;
  font-weight: 650;
  white-space: nowrap;
}

.editor-topbar__status,
.editor-topbar__publish-status {
  color: var(--a-color-muted);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-topbar__status {
  min-width: 0;
}

.editor-topbar__status.is-ok,
.editor-topbar__publish-status.is-ok {
  color: var(--a-color-success);
}

.editor-topbar__status.is-warn,
.editor-topbar__publish-status.is-warn {
  color: var(--a-color-danger);
}

.editor-topbar__publish-row {
  min-height: 3.25rem;
  padding: 0.4rem 1rem;
  border-top: var(--a-border);
}

.editor-topbar__publish-status {
  margin-left: 0.2rem;
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

@media (max-width: 640px) {
  .editor-topbar {
    min-height: 8.5rem;
  }

  .editor-topbar__header-row {
    min-height: 3.25rem;
    padding-inline: 0.5rem;
  }

  .editor-topbar__tools {
    gap: 0.15rem;
  }

  .editor-topbar__status {
    display: none;
  }

  .editor-topbar__publish-row {
    flex-wrap: wrap;
    padding-inline: 0.5rem;
  }

  .editor-topbar__publish-status {
    flex: 1 1 100%;
    margin: 0;
  }

  .editor-topbar :deep(.p-segmented-control-item) {
    padding-inline: 0.5rem;
    font-size: 0.7rem;
  }
}
</style>
