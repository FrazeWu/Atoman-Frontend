<script setup lang="ts">
import { computed } from 'vue'
import PButton from '@/components/ui/PButton.vue'
import PModal from '@/components/ui/PModal.vue'
import {
  formatMusicLyricTime,
  type MusicLyricDraftIssue,
  type MusicLyricDraftRow,
} from '@/utils/musicLyricsDraft'

const props = withDefaults(defineProps<{
  show: boolean
  originalFileName: string
  translationFileName?: string
  rows: MusicLyricDraftRow[]
  issues: MusicLyricDraftIssue[]
}>(), {
  translationFileName: '',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const cannotConfirm = computed(() => (
  props.rows.length === 0
  || props.issues.some((issue) => issue.severity === 'error')
))
</script>

<template>
  <PModal
    :show="show"
    title="导入预览"
    size="lg"
    above-player
    @close="emit('cancel')"
  >
    <div class="lyrics-import-preview">
      <dl class="file-summary">
        <div class="file-summary-item">
          <dt>原文</dt>
          <dd :title="originalFileName">{{ originalFileName }}</dd>
        </div>
        <div class="file-summary-item">
          <dt>翻译</dt>
          <dd :title="translationFileName || '未选择'">
            {{ translationFileName || '未选择' }}
          </dd>
        </div>
      </dl>

      <ul v-if="issues.length" class="issue-list" aria-label="导入问题">
        <li
          v-for="(issue, index) in issues"
          :key="`${issue.code}-${issue.sourceLine ?? issue.rowIndex ?? index}-${issue.message}`"
          class="issue-item"
          :class="`issue-item--${issue.severity}`"
          :data-severity="issue.severity"
        >
          {{ issue.message }}
        </li>
      </ul>

      <div class="preview-table-wrap">
        <table class="preview-table">
          <thead>
            <tr>
              <th scope="col">时间</th>
              <th scope="col">原文</th>
              <th scope="col">翻译</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="time-cell" data-label="时间">
                {{ row.timeMs === null ? '--:--.--' : formatMusicLyricTime(row.timeMs) }}
              </td>
              <td data-label="原文">{{ row.original }}</td>
              <td data-label="翻译">{{ row.translation }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="rows.length === 0" class="empty-state">没有可导入的歌词</p>
      </div>
    </div>

    <template #footer>
      <PButton variant="secondary" @click="emit('cancel')">取消</PButton>
      <PButton
        data-testid="lyrics-import-confirm"
        :disabled="cannotConfirm"
        @click="emit('confirm')"
      >
        替换草稿
      </PButton>
    </template>
  </PModal>
</template>

<style scoped>
.lyrics-import-preview {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.file-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.file-summary-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--a-color-border);
  border-radius: 6px;
  background: var(--a-color-surface-muted);
}

.file-summary dt {
  color: var(--a-color-text-secondary);
  font-size: 12px;
}

.file-summary dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--a-color-text);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issue-list {
  display: grid;
  gap: 4px;
  max-height: 112px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.issue-item {
  padding: 6px 8px;
  border-left: 3px solid var(--a-color-warning);
  border-radius: 4px;
  background: color-mix(in srgb, var(--a-color-warning) 8%, var(--a-color-bg));
  color: var(--a-color-text);
  font-size: 12px;
  line-height: 1.45;
}

.issue-item--error {
  border-left-color: var(--a-color-danger);
  background: var(--a-color-danger-bg);
  color: var(--a-color-danger);
}

.preview-table-wrap {
  min-width: 0;
  max-height: min(48vh, 440px);
  overflow: auto;
  border: 1px solid var(--a-color-border);
  border-radius: 6px;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--a-color-text);
  font-size: 13px;
}

.preview-table th,
.preview-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--a-color-border);
  text-align: left;
  overflow-wrap: anywhere;
  vertical-align: top;
}

.preview-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--a-color-surface-muted);
  color: var(--a-color-text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.preview-table th:first-child,
.time-cell {
  width: 92px;
  white-space: nowrap;
}

.preview-table tbody tr:last-child td {
  border-bottom: 0;
}

.empty-state {
  margin: 0;
  padding: 24px 12px;
  color: var(--a-color-text-secondary);
  font-size: 13px;
  text-align: center;
}

@media (max-width: 640px) {
  .file-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview-table-wrap {
    border: 0;
    border-radius: 0;
  }

  .preview-table,
  .preview-table tbody,
  .preview-table tr,
  .preview-table td {
    display: block;
    width: 100%;
  }

  .preview-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .preview-table tr {
    margin-bottom: 8px;
    border: 1px solid var(--a-color-border);
    border-radius: 6px;
    background: var(--a-color-bg);
  }

  .preview-table td {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
    padding: 7px 9px;
  }

  .preview-table td::before {
    content: attr(data-label);
    color: var(--a-color-text-secondary);
    font-size: 11px;
  }

  .preview-table tbody tr:last-child td:not(:last-child) {
    border-bottom: 1px solid var(--a-color-border);
  }
}
</style>
