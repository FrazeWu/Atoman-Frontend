<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-vue-next'
import type { MusicLyricsFormat } from '@/api/musicV1'
import {
  formatMusicLyricTime,
  parseMusicLyricTime,
  type MusicLyricDraftIssue,
  type MusicLyricDraftRow,
} from '@/utils/musicLyricsDraft'

const props = withDefaults(defineProps<{
  rows: MusicLyricDraftRow[]
  format: MusicLyricsFormat
  issues?: MusicLyricDraftIssue[]
  disabled?: boolean
}>(), {
  issues: () => [],
  disabled: false,
})

const emit = defineEmits<{
  'update:rows': [rows: MusicLyricDraftRow[]]
}>()

const rawTimes = reactive<Record<string, string>>({})
const pendingInvalidTimes = new Map<string, string>()

function syncRawTimes(formatChanged = false) {
  if (formatChanged) pendingInvalidTimes.clear()

  const rowIds = new Set(props.rows.map((row) => row.id))
  for (const id of Object.keys(rawTimes)) {
    if (!rowIds.has(id)) delete rawTimes[id]
  }

  for (const row of props.rows) {
    const pendingRaw = pendingInvalidTimes.get(row.id)
    if (pendingRaw !== undefined && row.timeMs === null) {
      rawTimes[row.id] = pendingRaw
      continue
    }

    pendingInvalidTimes.delete(row.id)
    rawTimes[row.id] = row.timeMs === null ? '' : formatMusicLyricTime(row.timeMs)
  }
}

watch(
  [() => props.format, () => props.rows],
  ([format], [previousFormat]) => syncRawTimes(format !== previousFormat),
  { immediate: true, deep: true },
)

function emitRowUpdate(index: number, patch: Partial<MusicLyricDraftRow>) {
  emit('update:rows', props.rows.map((row, rowIndex) => (
    rowIndex === index ? { ...row, ...patch } : row
  )))
}

function updateTime(index: number, event: Event) {
  const value = (event.target as HTMLInputElement).value
  const row = props.rows[index]
  rawTimes[row.id] = value

  const timeMs = value.trim() === '' ? null : parseMusicLyricTime(value)
  if (value.trim() !== '' && timeMs === null) pendingInvalidTimes.set(row.id, value)
  else pendingInvalidTimes.delete(row.id)
  emitRowUpdate(index, { timeMs })
}

function isInvalidTime(rowId: string) {
  const value = rawTimes[rowId] ?? ''
  return value.trim() !== '' && parseMusicLyricTime(value) === null
}

function moveRow(index: number, offset: -1 | 1) {
  const targetIndex = index + offset
  if (props.disabled || targetIndex < 0 || targetIndex >= props.rows.length) return

  const nextRows = [...props.rows]
  ;[nextRows[index], nextRows[targetIndex]] = [nextRows[targetIndex], nextRows[index]]
  emit('update:rows', nextRows)
}

function deleteRow(index: number) {
  if (props.disabled) return
  emit('update:rows', props.rows.filter((_, rowIndex) => rowIndex !== index))
}

function issuesForRow(rowIndex: number) {
  return props.issues.filter((issue) => issue.rowIndex === rowIndex)
}
</script>

<template>
  <div
    class="lyric-editor"
    :class="{ 'is-lrc': format === 'lrc', 'is-disabled': disabled }"
    data-testid="lyric-editor-grid"
  >
    <div
      class="lyric-grid-line lyric-grid-header"
      :class="{ 'is-lrc': format === 'lrc' }"
      aria-hidden="true"
    >
      <span>序号</span>
      <span v-if="format === 'lrc'">时间</span>
      <span>原文</span>
      <span>翻译</span>
      <span>操作</span>
    </div>

    <div
      v-for="(row, index) in rows"
      :key="row.id"
      class="lyric-row lyric-grid-line"
      :class="{ 'is-lrc': format === 'lrc' }"
      :data-testid="`lyric-row-${row.id}`"
    >
      <span class="lyric-index" :aria-label="`第 ${index + 1} 行`">{{ index + 1 }}</span>

      <label v-if="format === 'lrc'" class="lyric-field lyric-time-field">
        <span class="mobile-label">时间</span>
        <input
          :value="rawTimes[row.id] ?? ''"
          :data-testid="`lyric-time-${row.id}`"
          class="lyric-input lyric-time-input"
          type="text"
          inputmode="decimal"
          placeholder="00:00.00"
          :aria-invalid="isInvalidTime(row.id)"
          :disabled="disabled"
          @input="updateTime(index, $event)"
        />
        <span v-if="isInvalidTime(row.id)" class="lyric-time-error" role="alert">
          时间格式无效
        </span>
      </label>

      <label class="lyric-field">
        <span class="mobile-label">原文</span>
        <input
          :value="row.original"
          :data-testid="`lyric-original-${row.id}`"
          class="lyric-input"
          type="text"
          placeholder="原文"
          :disabled="disabled"
          @input="emitRowUpdate(index, { original: ($event.target as HTMLInputElement).value })"
        />
      </label>

      <label class="lyric-field">
        <span class="mobile-label">翻译</span>
        <input
          :value="row.translation"
          :data-testid="`lyric-translation-${row.id}`"
          class="lyric-input"
          type="text"
          placeholder="翻译"
          :disabled="disabled"
          @input="emitRowUpdate(index, { translation: ($event.target as HTMLInputElement).value })"
        />
      </label>

      <div class="lyric-actions" aria-label="行操作">
        <button
          :data-testid="`lyric-move-up-${row.id}`"
          class="lyric-action"
          type="button"
          title="上移"
          :aria-label="`上移第 ${index + 1} 行`"
          :disabled="disabled || index === 0"
          @click="moveRow(index, -1)"
        >
          <ArrowUp :size="18" aria-hidden="true" />
        </button>
        <button
          :data-testid="`lyric-move-down-${row.id}`"
          class="lyric-action"
          type="button"
          title="下移"
          :aria-label="`下移第 ${index + 1} 行`"
          :disabled="disabled || index === rows.length - 1"
          @click="moveRow(index, 1)"
        >
          <ArrowDown :size="18" aria-hidden="true" />
        </button>
        <button
          :data-testid="`lyric-delete-${row.id}`"
          class="lyric-action lyric-action--danger"
          type="button"
          title="删除"
          :aria-label="`删除第 ${index + 1} 行`"
          :disabled="disabled"
          @click="deleteRow(index)"
        >
          <Trash2 :size="18" aria-hidden="true" />
        </button>
      </div>

      <ul v-if="issuesForRow(index).length" class="lyric-issues">
        <li
          v-for="issue in issuesForRow(index)"
          :key="`${issue.code}-${issue.message}`"
          class="lyric-issue"
          :class="`lyric-issue--${issue.severity}`"
          :data-severity="issue.severity"
        >
          {{ issue.message }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.lyric-editor {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.lyric-grid-line {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) minmax(0, 1fr) 8.75rem;
  gap: 0.75rem;
  align-items: start;
}

.lyric-grid-line.is-lrc {
  grid-template-columns: 3rem 8rem minmax(0, 1fr) minmax(0, 1fr) 8.75rem;
}

.lyric-grid-header {
  padding: 0 0.75rem 0.5rem;
  color: var(--color-text-secondary, #60646c);
  font-size: 0.8125rem;
  font-weight: 600;
}

.lyric-row {
  padding: 0.75rem;
  border-top: 1px solid var(--color-border, #e4e4e7);
}

.lyric-index {
  padding-top: 0.75rem;
  color: var(--color-text-secondary, #60646c);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.lyric-field {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.mobile-label {
  display: none;
  color: var(--color-text-secondary, #60646c);
  font-size: 0.8125rem;
  font-weight: 600;
}

.lyric-input {
  width: 100%;
  min-width: 0;
  height: 44px;
  box-sizing: border-box;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border, #d4d4d8);
  border-radius: 6px;
  background: var(--color-surface, #fff);
  color: var(--color-text, #18181b);
  font: inherit;
}

.lyric-input:focus-visible,
.lyric-action:focus-visible {
  outline: 2px solid var(--color-primary, #2563eb);
  outline-offset: 2px;
}

.lyric-time-input {
  font-variant-numeric: tabular-nums;
}

.lyric-time-error,
.lyric-issue--error {
  color: var(--color-danger, #b42318);
}

.lyric-time-error,
.lyric-issue {
  font-size: 0.8125rem;
}

.lyric-actions {
  display: grid;
  grid-template-columns: repeat(3, 44px);
  gap: 4px;
}

.lyric-action {
  display: inline-grid;
  width: 44px;
  height: 44px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--color-border, #d4d4d8);
  border-radius: 6px;
  background: var(--color-surface, #fff);
  color: var(--color-text-secondary, #52525b);
  cursor: pointer;
}

.lyric-action--danger {
  color: var(--color-danger, #b42318);
}

.lyric-action:disabled,
.lyric-input:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.lyric-issues {
  grid-column: 2 / -1;
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lyric-issue--warning {
  color: var(--color-warning-text, #8a4b08);
}

@media (max-width: 767px) {
  .lyric-grid-header {
    display: none;
  }

  .lyric-grid-line,
  .lyric-grid-line.is-lrc {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }

  .lyric-index {
    padding-top: 0;
    text-align: left;
  }

  .mobile-label {
    display: block;
  }

  .lyric-actions {
    grid-template-columns: repeat(3, 44px);
  }

  .lyric-issues {
    grid-column: 1;
  }
}
</style>
