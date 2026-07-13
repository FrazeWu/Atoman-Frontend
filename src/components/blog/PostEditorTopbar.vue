<template>
  <div class="editor-meta-row">
    <div class="meta-chip-group">
      <span class="meta-chip">{{ isEdit ? '编辑文章' : '新建文章' }}</span>
    </div>

    <div class="editor-meta-actions">
      <span class="word-count-chip">{{ charCount.toLocaleString() }} 字</span>
      <span class="draft-status" :class="`is-${draftStatus.tone}`">{{ draftStatus.text }}</span>

      <div v-if="contentSource !== 'manual'" class="import-actions">
        <PButton v-if="contentSource === 'empty'" tag="label" variant="secondary" size="sm">
          <input type="file" accept=".md,.markdown,.txt" @change="$emit('import-file', $event)" class="hidden-file-input" />
          导入 Markdown
        </PButton>
        <template v-else-if="contentSource === 'imported'">
          <PButton type="button" variant="secondary" size="sm" @click="$emit('trigger-reimport')">
            <input ref="fileInput" type="file" accept=".md,.markdown,.txt" @change="$emit('import-file', $event)" class="hidden-file-input" />
            重新导入
          </PButton>
        </template>
        <span v-if="uploading" class="a-muted">读取中…</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PButton from '@/components/ui/PButton.vue'

const props = defineProps<{
  isEdit: boolean
  charCount: number
  draftStatus: { text: string; tone: 'ok' | 'warn' | 'muted' }
  contentSource: 'empty' | 'imported' | 'manual'
  uploading: boolean
}>()

defineEmits<{
  (e: 'import-file', event: Event): void
  (e: 'trigger-reimport'): void
}>()
</script>

<style scoped>
.import-actions,
.meta-chip-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.word-count-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.2rem 0.75rem;
  border: var(--a-border);
  background: var(--a-color-bg-soft);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.draft-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.2rem 0.75rem;
  border: var(--a-border);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.draft-status.is-ok {
  background: var(--a-color-success-bg);
  color: var(--a-color-success);
}

.draft-status.is-warn {
  background: var(--a-color-danger-bg);
  color: var(--a-color-danger);
}

.draft-status.is-muted {
  background: var(--a-color-bg-soft);
  color: var(--a-color-muted);
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.2rem 0.75rem;
  border: var(--a-border);
  background: var(--a-color-bg-soft);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: uppercase;
}

.hidden-file-input {
  display: none;
}
</style>
