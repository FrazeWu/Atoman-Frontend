<script setup lang="ts">
import { reactive, watch } from 'vue'
import { ArrowDown, ArrowUp, Minus, Play, Plus, Trash2 } from 'lucide-vue-next'
import type { MusicLyricsEditTarget, MusicLyricsFormat } from '@/api/musicV1'
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
  selectedRowId?: string
  editTarget?: MusicLyricsEditTarget | 'all'
}>(), {
  issues: () => [],
  disabled: false,
  selectedRowId: '',
  editTarget: 'all',
})

const emit = defineEmits<{
  'update:rows': [rows: MusicLyricDraftRow[]]
  'select-row': [rowId: string]
  'select-target': [target: 'original' | 'translation']
  seek: [timeSeconds: number]
  'advance-row': [rowId: string]
  'adjust-time': [rowId: string, offsetMs: number]
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

function selectRow(rowId: string) {
  if (props.disabled) return
  emit('select-row', rowId)
}

function seekToRow(row: MusicLyricDraftRow) {
  if (props.disabled || row.timeMs === null) return
  emit('select-row', row.id)
  emit('seek', row.timeMs / 1000)
}

function issuesForRow(rowIndex: number) {
  return props.issues.filter((issue) => issue.rowIndex === rowIndex)
}

type LyricInputField = 'time' | 'original' | 'translation'

function issueId(rowId: string, issueIndex: number) {
  return `lyric-issue-${rowId}-${issueIndex}`
}

function issueTargetsField(issue: MusicLyricDraftIssue, field: LyricInputField) {
  if (issue.source) return issue.source === field
  if (issue.code.includes('time')) return field === 'time'
  if (issue.code.includes('original')) return field === 'original'
  if (issue.code.includes('translation')) return field === 'translation'
  return true
}

function describedByForField(
  rowId: string,
  rowIndex: number,
  field: LyricInputField,
) {
  const ids = issuesForRow(rowIndex)
    .map((issue, issueIndex) => issueTargetsField(issue, field) ? issueId(rowId, issueIndex) : null)
    .filter((id): id is string => id !== null)

  if (field === 'time' && isInvalidTime(rowId)) ids.push(`lyric-time-error-${rowId}`)
  return ids.length > 0 ? ids.join(' ') : undefined
}
</script>

<template>
  <div
    class="lyric-editor"
    :class="{ 'is-lrc': format === 'lrc', 'is-disabled': disabled }"
    data-testid="lyric-editor-grid"
  >
    <div
      v-if="$slots.tools && editTarget !== 'translation'"
      class="lyric-grid-line lyric-editor-tools"
      :class="{ 'is-lrc': format === 'lrc' }"
      data-testid="lyric-editor-tools"
    >
      <div class="lyric-editor-tools__content">
        <slot name="tools" />
      </div>
    </div>

    <div
      class="lyric-grid-line lyric-grid-header"
      :class="{ 'is-lrc': format === 'lrc', 'is-translation-mode': editTarget === 'translation' }"
      aria-hidden="true"
    >
      <span>序号</span>
      <span v-if="format === 'lrc'">时间</span>
      <span>{{ editTarget === 'translation' ? '歌词' : '原文' }}</span>
      <span v-if="editTarget !== 'translation'">操作</span>
    </div>

    <div
      v-for="(row, index) in rows"
      :key="row.id"
      class="lyric-row lyric-grid-line"
      :class="{ 'is-lrc': format === 'lrc', 'is-selected': selectedRowId === row.id, 'is-translation-mode': editTarget === 'translation' }"
      :aria-current="selectedRowId === row.id ? 'true' : undefined"
      :data-testid="`lyric-row-${row.id}`"
    >
      <span class="lyric-index" :aria-label="`第 ${index + 1} 行`">{{ index + 1 }}</span>

      <div v-if="format === 'lrc' && editTarget !== 'translation'" class="lyric-field lyric-time-field">
        <span class="mobile-label">时间</span>
        <div class="lyric-time-controls">
          <input
            :value="rawTimes[row.id] ?? ''"
            :data-testid="`lyric-time-${row.id}`"
            class="lyric-input lyric-time-input"
            type="text"
            inputmode="decimal"
            placeholder="00:00.00"
            :aria-label="`时间，第 ${index + 1} 行`"
            :aria-invalid="isInvalidTime(row.id)"
            :aria-describedby="describedByForField(row.id, index, 'time')"
            :disabled="disabled"
            @focus="selectRow(row.id)"
            @input="updateTime(index, $event)"
          />
          <button
            :data-testid="`lyric-seek-${row.id}`"
            class="lyric-action"
            type="button"
            title="跳转"
            :aria-label="`跳转到第 ${index + 1} 行时间`"
            :disabled="disabled || row.timeMs === null"
            @click="seekToRow(row)"
          >
            <Play :size="16" aria-hidden="true" />
          </button>
          <div class="lyric-time-adjust-group" aria-label="调整单行时间">
            <button
              :data-testid="`lyric-adjust-down-${row.id}`"
              class="lyric-action lyric-time-adjust"
              type="button"
              title="提前 0.1 秒"
              :aria-label="`第 ${index + 1} 行提前 0.1 秒`"
              :disabled="disabled || row.timeMs === null"
              @click="emit('adjust-time', row.id, -100)"
            >
              <Minus :size="14" aria-hidden="true" />
            </button>
            <button
              :data-testid="`lyric-adjust-up-${row.id}`"
              class="lyric-action lyric-time-adjust"
              type="button"
              title="延后 0.1 秒"
              :aria-label="`第 ${index + 1} 行延后 0.1 秒`"
              :disabled="disabled || row.timeMs === null"
              @click="emit('adjust-time', row.id, 100)"
            >
              <Plus :size="14" aria-hidden="true" />
            </button>
          </div>
        </div>
        <span
          v-if="isInvalidTime(row.id)"
          :id="`lyric-time-error-${row.id}`"
          class="lyric-time-error"
          role="alert"
        >
          时间格式无效
        </span>
      </div>

      <button
        v-else-if="format === 'lrc'"
        type="button"
        class="lyric-time-display"
        :disabled="disabled || row.timeMs === null"
        :aria-label="`跳转到第 ${index + 1} 行时间`"
        @click="seekToRow(row)"
      >
        {{ row.timeMs === null ? '--:--.--' : formatMusicLyricTime(row.timeMs) }}
      </button>

      <div v-if="editTarget === 'translation'" class="lyric-translation-fields">
        <label class="lyric-field">
          <span class="mobile-label">原文</span>
          <input
            :value="row.original"
            :data-testid="`lyric-original-${row.id}`"
            class="lyric-input lyric-input--original-reference"
            type="text"
            :aria-label="`原文，第 ${index + 1} 行`"
            readonly
            @focus="selectRow(row.id)"
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
            :aria-label="`翻译，第 ${index + 1} 行`"
            :aria-describedby="describedByForField(row.id, index, 'translation')"
            :disabled="disabled"
            @focus="selectRow(row.id)"
            @input="emitRowUpdate(index, { translation: ($event.target as HTMLInputElement).value })"
          />
        </label>
      </div>

      <label v-else class="lyric-field">
        <span class="mobile-label">原文</span>
        <input
          :value="row.original"
          :data-testid="`lyric-original-${row.id}`"
          class="lyric-input"
          type="text"
          placeholder="原文"
          :aria-label="`原文，第 ${index + 1} 行`"
          :aria-describedby="describedByForField(row.id, index, 'original')"
          :disabled="disabled"
          @focus="selectRow(row.id)"
          @keydown.enter.prevent="emit('advance-row', row.id)"
          @input="emitRowUpdate(index, { original: ($event.target as HTMLInputElement).value })"
        />
      </label>

      <div v-if="editTarget !== 'translation'" class="lyric-actions" aria-label="行操作">
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
          v-for="(issue, issueIndex) in issuesForRow(index)"
          :id="issueId(row.id, issueIndex)"
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
  grid-template-columns: 3rem minmax(0, 1fr) 9.25rem;
  gap: 0.75rem;
  align-items: center;
}

.lyric-grid-line.is-lrc {
  grid-template-columns: 3rem 20rem minmax(0, 1fr) 9.25rem;
}

.lyric-grid-line.is-translation-mode {
  grid-template-columns: 3rem minmax(0, 1fr);
}

.lyric-grid-line.is-lrc.is-translation-mode {
  grid-template-columns: 3rem 8rem minmax(0, 1fr);
}

.lyric-grid-header {
  padding: 0 0.75rem 0.5rem;
  color: var(--a-color-muted, #60646c);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.lyric-row {
  padding: 0.75rem;
  border-top: 1px solid var(--a-color-border-soft, #e4e4e7);
  border-radius: 8px;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.lyric-row.is-selected {
  background: color-mix(in srgb, var(--a-color-primary, #2563eb) 5%, var(--a-color-surface, var(--a-color-bg)));
  box-shadow: inset 3px 0 0 var(--a-color-primary, #2563eb), 0 2px 10px -2px rgba(0, 0, 0, 0.04);
}

.lyric-editor-tools {
  min-height: 44px;
  padding: 0.25rem 0.75rem 0.5rem;
}

.lyric-editor-tools__content {
  grid-column: 1 / -1;
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.lyric-editor-tools__content :deep(.music-lyric-editor-drawer__tools-primary) {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.lyric-index {
  color: var(--a-color-muted, #60646c);
  font-variant-numeric: tabular-nums;
  font-family: var(--a-font-mono, monospace);
  font-size: 0.82rem;
  font-weight: 600;
  text-align: center;
}

.lyric-field {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.mobile-label {
  display: none;
  color: var(--a-color-muted, #60646c);
  font-size: 0.8125rem;
  font-weight: 600;
}

.lyric-input {
  width: 100%;
  min-width: 0;
  height: 44px;
  box-sizing: border-box;
  padding: 0 0.85rem;
  border: 1px solid var(--a-color-border, #d4d4d8);
  border-radius: 8px;
  background: var(--a-color-bg, #ffffff);
  color: var(--a-color-text, #18181b);
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.lyric-input:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--a-color-primary, #2563eb) 40%, var(--a-color-border));
}

.lyric-input:focus-visible,
.lyric-action:focus-visible {
  outline: none;
  border-color: var(--a-color-primary, #2563eb);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--a-color-primary, #2563eb) 20%, transparent);
}

.lyric-time-input {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: 0.02em;
}

.lyric-time-display {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--a-color-muted, #60646c);
  font: inherit;
  font-variant-numeric: tabular-nums;
  font-family: var(--a-font-mono, monospace);
  text-align: left;
  cursor: pointer;
  transition: color 0.2s ease;
}

.lyric-time-display:hover:not(:disabled) {
  color: var(--a-color-primary, #2563eb);
}

.lyric-time-display:disabled {
  cursor: default;
}

.lyric-translation-fields {
  display: grid;
  min-width: 0;
  gap: 0.5rem;
}

.lyric-input--original-reference {
  border-color: transparent;
  background: var(--a-color-surface-muted, #f4f4f5);
  color: var(--a-color-muted, #60646c);
}

.lyric-time-controls {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) repeat(3, 36px);
  gap: 8px;
}

.lyric-time-adjust-group {
  display: contents;
}

.lyric-time-error,
.lyric-issue--error {
  color: var(--a-color-danger, #b42318);
}

.lyric-time-error,
.lyric-issue {
  font-size: 0.8125rem;
}

.lyric-actions {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  gap: 8px;
}

.lyric-action {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--a-color-muted, #52525b);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease, transform 0.15s ease;
}

.lyric-action:hover:not(:disabled) {
  border-color: var(--a-color-border-soft, #e4e4e7);
  background: var(--a-color-surface-muted, #f4f4f5);
  color: var(--a-color-text, #18181b);
}

.lyric-action--danger:hover:not(:disabled) {
  border-color: var(--a-color-danger, #b42318);
  background: color-mix(in srgb, var(--a-color-danger, #b42318) 8%, var(--a-color-bg));
  color: var(--a-color-danger, #b42318);
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
  color: var(--a-color-warning, #8a4b08);
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
    grid-template-columns: repeat(3, 36px);
  }

  .lyric-time-controls {
    width: 100%;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) repeat(3, 36px);
  }

  .lyric-editor-tools {
    padding-inline: 0;
  }

  .lyric-editor-tools__content {
    grid-column: 1;
  }

  .lyric-issues {
    grid-column: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lyric-row,
  .lyric-input,
  .lyric-action {
    transition: none;
  }
}
</style>
