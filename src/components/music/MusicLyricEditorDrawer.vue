<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowDownUp, Clock3, Download, FileSearch, Plus, SkipForward } from 'lucide-vue-next'
import type { MusicLyricsFormat } from '@/api/musicV1'
import MusicLyricsImportPreview from '@/components/music/MusicLyricsImportPreview.vue'
import MusicLyricsRowEditor from '@/components/music/MusicLyricsRowEditor.vue'
import PButton from '@/components/ui/PButton.vue'
import PInput from '@/components/ui/PInput.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PSheet from '@/components/ui/PSheet.vue'
import {
  createMusicLyricDraftRow,
  formatMusicLyricTime,
  parseBilingualLrcDraft,
  parseMusicLyricDraft,
  serializeMusicLyricDraft,
  sortMusicLyricDraftRows,
  validateMusicLyricDraft,
  type MusicLyricDraftParseResult,
  type MusicLyricDraftRow,
} from '@/utils/musicLyricsDraft'
import { downloadTextFile } from '@/utils/textDownload'

const props = withDefaults(defineProps<{
  show: boolean
  content?: string
  translation?: string
  format?: MusicLyricsFormat
  saving?: boolean
  songTitle?: string
  currentTimeSeconds?: number
}>(), {
  content: '',
  translation: '',
  format: 'plain',
  saving: false,
  songTitle: '',
  currentTimeSeconds: 0,
})

const emit = defineEmits<{
  close: []
  seek: [timeSeconds: number]
  save: [payload: {
    content: string
    translation: string
    format: MusicLyricsFormat
    editSummary: string
  }]
}>()

const formatOptions = [
  { label: '纯文本', value: 'plain', testid: 'mode-plain' },
  { label: 'LRC', value: 'lrc', testid: 'mode-lrc' },
] satisfies Array<{ label: string, value: MusicLyricsFormat, testid: string }>

const rows = ref<MusicLyricDraftRow[]>([])
const selectedRowId = ref('')
const draftFormat = ref<MusicLyricsFormat>('plain')
const draftEditSummary = ref('')
const originalImportFile = ref<File | null>(null)
const translationImportFile = ref<File | null>(null)
const importPreview = ref<MusicLyricDraftParseResult | null>(null)
const importError = ref('')
const exportError = ref('')
const originalInput = ref<HTMLInputElement | null>(null)
const translationInput = ref<HTMLInputElement | null>(null)
const rowEditorRoot = ref<HTMLElement | null>(null)
let importGeneration = 0

const validationIssues = computed(() => validateMusicLyricDraft(rows.value, draftFormat.value))
const blockingIssues = computed(() => validationIssues.value.filter(issue => issue.severity === 'error'))
const hasBlockingIssues = computed(() => blockingIssues.value.length > 0)
const canSave = computed(() => (
  rows.value.length > 0
  && !hasBlockingIssues.value
  && draftEditSummary.value.trim().length > 0
  && !props.saving
))
const exportBaseName = computed(() => props.songTitle.trim() || 'lyrics')
const currentTimeMs = computed(() => Math.round(props.currentTimeSeconds * 100) * 10)
const hasSelectedRow = computed(() => rows.value.some(row => row.id === selectedRowId.value))

watch(
  () => [props.show, props.content, props.translation, props.format] as const,
  ([show, content, translation, format]) => {
    importGeneration += 1
    if (!show) {
      selectedRowId.value = ''
      importPreview.value = null
      importError.value = ''
      return
    }

    draftFormat.value = format ?? 'plain'
    rows.value = parseMusicLyricDraft(content ?? '', translation ?? '', draftFormat.value)
    selectedRowId.value = rows.value.find(row => row.timeMs === null)?.id ?? rows.value[0]?.id ?? ''
    draftEditSummary.value = ''
    originalImportFile.value = null
    translationImportFile.value = null
    importPreview.value = null
    importError.value = ''
    exportError.value = ''
    if (originalInput.value) originalInput.value.value = ''
    if (translationInput.value) translationInput.value.value = ''
  },
  { immediate: true },
)

function addRow() {
  if (props.saving) return
  const row = createMusicLyricDraftRow()
  rows.value = [...rows.value, row]
  selectedRowId.value = row.id
}

function sortRows() {
  if (props.saving || draftFormat.value !== 'lrc') return
  rows.value = sortMusicLyricDraftRows(rows.value)
}

function handleRowsUpdate(nextRows: MusicLyricDraftRow[]) {
  const oldIndex = rows.value.findIndex(row => row.id === selectedRowId.value)
  rows.value = nextRows

  if (nextRows.some(row => row.id === selectedRowId.value)) return
  if (nextRows.length === 0) {
    selectedRowId.value = ''
    return
  }

  const fallbackIndex = oldIndex < 0 ? 0 : Math.min(oldIndex, nextRows.length - 1)
  selectedRowId.value = nextRows[fallbackIndex]!.id
}

function writeCurrentTime() {
  if (draftFormat.value !== 'lrc' || props.saving || !hasSelectedRow.value) return
  rows.value = rows.value.map(row => (
    row.id === selectedRowId.value ? { ...row, timeMs: currentTimeMs.value } : row
  ))
}

async function writeCurrentTimeAndSelectNext() {
  if (draftFormat.value !== 'lrc' || props.saving || !hasSelectedRow.value) return
  const selectedIndex = rows.value.findIndex(row => row.id === selectedRowId.value)
  writeCurrentTime()

  const nextRow = rows.value[selectedIndex + 1]
  if (!nextRow) return

  selectedRowId.value = nextRow.id
  await nextTick()
  rowEditorRoot.value
    ?.querySelector<HTMLInputElement>(`[data-testid="lyric-original-${nextRow.id}"]`)
    ?.focus()
}

function selectImportFile(kind: 'original' | 'translation', event: Event) {
  if (props.saving) return
  importGeneration += 1
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (kind === 'original') originalImportFile.value = file
  else translationImportFile.value = file
  importPreview.value = null
  importError.value = ''
}

async function previewImport() {
  if (props.saving || !originalImportFile.value) return

  importGeneration += 1
  const generation = importGeneration
  const originalFile = originalImportFile.value
  const translationFile = translationImportFile.value
  const isStale = () => generation !== importGeneration || !props.show
  let original: string
  try {
    original = await originalFile.text()
  } catch {
    if (isStale()) return
    importPreview.value = null
    importError.value = `读取 LRC 文件失败：${originalFile.name}`
    return
  }
  if (isStale()) return

  let translation = ''
  if (translationFile) {
    try {
      translation = await translationFile.text()
    } catch {
      if (isStale()) return
      importPreview.value = null
      importError.value = `读取 LRC 文件失败：${translationFile.name}`
      return
    }
    if (isStale()) return
  }

  try {
    const parsed = parseBilingualLrcDraft(original, translation)
    const locatedParseIssues = parsed.issues.map((issue) => {
      const fileName = issue.source === 'translation'
        ? (translationFile?.name ?? '翻译 LRC')
        : originalFile.name
      const location = issue.sourceLine === undefined
        ? fileName
        : `${fileName} 第 ${issue.sourceLine} 行`
      return { ...issue, message: `${location}：${issue.message}` }
    })
    if (isStale()) return
    importPreview.value = {
      rows: parsed.rows,
      issues: [
        ...locatedParseIssues,
        ...validateMusicLyricDraft(parsed.rows, 'lrc'),
      ],
    }
    importError.value = ''
  } catch {
    if (isStale()) return
    importPreview.value = null
    importError.value = `解析 LRC 文件失败：${originalFile.name}`
  }
}

function cancelImport() {
  importPreview.value = null
}

function confirmImport() {
  if (
    props.saving
    || !importPreview.value
    || importPreview.value.rows.length === 0
    || importPreview.value.issues.some(issue => issue.severity === 'error')
  ) return

  rows.value = importPreview.value.rows
  selectedRowId.value = rows.value[0]?.id ?? ''
  draftFormat.value = 'lrc'
  importPreview.value = null
}

function exportLyrics(kind: 'original' | 'translation') {
  if (draftFormat.value !== 'lrc' || hasBlockingIssues.value || props.saving) return
  const serialized = serializeMusicLyricDraft(rows.value, 'lrc')
  try {
    if (kind === 'original') {
      downloadTextFile(exportBaseName.value, serialized.content, '.lrc')
    } else {
      downloadTextFile(exportBaseName.value, serialized.translation, '-translation.lrc')
    }
    exportError.value = ''
  } catch {
    exportError.value = '导出歌词失败，请重试'
  }
}

function handleSave() {
  const editSummary = draftEditSummary.value.trim()
  if (!canSave.value || !editSummary) return

  const serialized = serializeMusicLyricDraft(rows.value, draftFormat.value)
  emit('save', {
    ...serialized,
    format: draftFormat.value,
    editSummary,
  })
}
</script>

<template>
  <PSheet
    :show="show"
    title="编辑歌词"
    width="min(1080px, calc(100vw - var(--a-sidebar-width) - 16px))"
    max-width="calc(100vw - var(--a-sidebar-width) - 16px)"
    close-type="header"
    above-player
    @close="emit('close')"
    panel-class="lyric-editor-drawer"
  >
    <template #header>
      <div class="music-lyric-editor-drawer__header">
        <h2>编辑歌词</h2>
      </div>
    </template>

    <div class="music-lyric-editor-drawer__body">
      <div class="music-lyric-editor-drawer__toolbar">
        <PSegmentedControl
          v-model="draftFormat"
          :options="formatOptions"
          :disabled="saving"
          aria-label="歌词格式"
        />

        <div class="music-lyric-editor-drawer__toolbar-actions">
          <PButton type="button" variant="secondary" :disabled="saving" @click="addRow">
            <Plus :size="17" aria-hidden="true" />
            增加行
          </PButton>
          <PButton
            v-if="draftFormat === 'lrc'"
            type="button"
            variant="secondary"
            :disabled="saving"
            @click="sortRows"
          >
            <ArrowDownUp :size="17" aria-hidden="true" />
            按时间排序
          </PButton>
        </div>
      </div>

      <div v-if="draftFormat === 'lrc'" class="music-lyric-editor-drawer__timing">
        <div class="music-lyric-editor-drawer__current-time">
          <span>当前时间</span>
          <output data-testid="lyrics-current-time" aria-label="当前播放时间">
            {{ formatMusicLyricTime(currentTimeMs) }}
          </output>
        </div>
        <div class="music-lyric-editor-drawer__timing-actions">
          <PButton
            data-testid="lyrics-write-current-time"
            type="button"
            variant="secondary"
            aria-label="写入当前播放时间"
            :disabled="saving || !hasSelectedRow"
            @click="writeCurrentTime"
          >
            <Clock3 :size="17" aria-hidden="true" />
            写入时间
          </PButton>
          <PButton
            data-testid="lyrics-write-current-time-next"
            type="button"
            variant="secondary"
            aria-label="写入当前播放时间并选择下一行"
            :disabled="saving || !hasSelectedRow"
            @click="writeCurrentTimeAndSelectNext"
          >
            <SkipForward :size="17" aria-hidden="true" />
            写入并下一行
          </PButton>
        </div>
      </div>

      <div ref="rowEditorRoot" class="music-lyric-editor-drawer__row-editor">
        <MusicLyricsRowEditor
          :rows="rows"
          :format="draftFormat"
          :issues="validationIssues"
          :disabled="saving"
          :selected-row-id="selectedRowId"
          @update:rows="handleRowsUpdate"
          @select-row="selectedRowId = $event"
          @seek="emit('seek', $event)"
        />
      </div>

      <section class="music-lyric-editor-drawer__import" aria-label="导入 LRC">
        <div class="music-lyric-editor-drawer__file-grid">
          <label class="music-lyric-editor-drawer__file-field">
            <span>原文 LRC</span>
            <input
              ref="originalInput"
              type="file"
              accept=".lrc,text/plain"
              aria-label="原文 LRC"
              :disabled="saving"
              @change="selectImportFile('original', $event)"
            />
          </label>
          <label class="music-lyric-editor-drawer__file-field">
            <span>翻译 LRC</span>
            <input
              ref="translationInput"
              type="file"
              accept=".lrc,text/plain"
              aria-label="翻译 LRC"
              :disabled="saving"
              @change="selectImportFile('translation', $event)"
            />
          </label>
        </div>

        <div class="music-lyric-editor-drawer__import-actions">
          <PButton
            type="button"
            variant="secondary"
            :disabled="saving || !originalImportFile"
            @click="previewImport"
          >
            <FileSearch :size="17" aria-hidden="true" />
            预览导入
          </PButton>
          <template v-if="draftFormat === 'lrc'">
            <PButton
              type="button"
              variant="secondary"
              :disabled="saving || hasBlockingIssues"
              @click="exportLyrics('original')"
            >
              <Download :size="17" aria-hidden="true" />
              导出原文
            </PButton>
            <PButton
              type="button"
              variant="secondary"
              :disabled="saving || hasBlockingIssues"
              @click="exportLyrics('translation')"
            >
              <Download :size="17" aria-hidden="true" />
              导出翻译
            </PButton>
          </template>
        </div>
        <p v-if="importError" class="music-lyric-editor-drawer__read-error" role="alert">
          {{ importError }}
        </p>
        <p v-if="exportError" class="music-lyric-editor-drawer__read-error" role="alert">
          {{ exportError }}
        </p>
      </section>

      <PInput
        v-model="draftEditSummary"
        data-testid="lyrics-edit-summary"
        label="摘要"
        placeholder="写本次修改"
        :disabled="saving"
      />

      <div class="music-lyric-editor-drawer__actions">
        <PButton type="button" variant="secondary" :disabled="saving" @click="emit('close')">
          取消
        </PButton>
        <PButton
          data-testid="lyrics-save"
          type="button"
          :disabled="!canSave"
          :loading="saving"
          loading-text="保存中..."
          @click="handleSave"
        >
          保存
        </PButton>
      </div>
    </div>

    <MusicLyricsImportPreview
      :show="Boolean(importPreview) && !saving"
      :original-file-name="originalImportFile?.name ?? ''"
      :translation-file-name="translationImportFile?.name ?? ''"
      :rows="importPreview?.rows ?? []"
      :issues="importPreview?.issues ?? []"
      @confirm="confirmImport"
      @cancel="cancelImport"
    />
  </PSheet>
</template>

<style scoped>
.music-lyric-editor-drawer__header h2 {
  margin: 0;
  color: var(--a-color-text);
  font-size: 1rem;
  font-weight: 900;
}

.music-lyric-editor-drawer__body {
  display: grid;
  min-width: 0;
  gap: 1rem;
  padding: 1rem;
}

.music-lyric-editor-drawer__toolbar,
.music-lyric-editor-drawer__toolbar-actions,
.music-lyric-editor-drawer__import-actions,
.music-lyric-editor-drawer__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.music-lyric-editor-drawer__toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
}

.music-lyric-editor-drawer__timing {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
}

.music-lyric-editor-drawer__row-editor {
  min-width: 0;
}

.music-lyric-editor-drawer__current-time {
  display: grid;
  gap: 0.25rem;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.music-lyric-editor-drawer__current-time output {
  color: var(--a-color-text);
  font-size: 1rem;
}

.music-lyric-editor-drawer__timing-actions {
  display: flex;
  min-width: 0;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.music-lyric-editor-drawer__timing-actions :deep(.p-button) {
  min-height: 44px;
}

.music-lyric-editor-drawer__import {
  display: grid;
  min-width: 0;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--a-color-border-soft);
}

.music-lyric-editor-drawer__file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.music-lyric-editor-drawer__file-field {
  display: grid;
  min-width: 0;
  gap: 0.5rem;
  color: var(--a-color-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.music-lyric-editor-drawer__file-field input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  box-sizing: border-box;
  padding: 0.5rem;
  border: 1px solid var(--a-color-border-soft);
  border-radius: 4px;
  background: var(--a-color-bg);
  color: var(--a-color-text);
  font: inherit;
}

.music-lyric-editor-drawer__read-error {
  margin: 0;
  color: var(--a-color-danger);
  font-size: 0.8rem;
}

.music-lyric-editor-drawer__actions {
  justify-content: flex-end;
}

@media (max-width: 767px) {
  .music-lyric-editor-drawer__body {
    padding: 0.75rem;
  }

  .music-lyric-editor-drawer__toolbar,
  .music-lyric-editor-drawer__toolbar-actions,
  .music-lyric-editor-drawer__import-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .music-lyric-editor-drawer__toolbar :deep(.p-segmented-control),
  .music-lyric-editor-drawer__toolbar-actions :deep(.p-button),
  .music-lyric-editor-drawer__import-actions :deep(.p-button) {
    width: 100%;
  }

  .music-lyric-editor-drawer__file-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .music-lyric-editor-drawer__timing {
    grid-template-columns: minmax(0, 1fr);
  }

  .music-lyric-editor-drawer__timing-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .music-lyric-editor-drawer__timing-actions :deep(.p-button) {
    width: 100%;
  }
}

:global(.lyric-editor-drawer) {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(20px) !important;
  -webkit-backdrop-filter: blur(20px) !important;
  border-left: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}

@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme="light"]) .lyric-editor-drawer) {
    background: rgba(15, 23, 42, 0.88) !important;
    border-left: 1px solid var(--a-color-border-dark, #334155) !important;
  }
}
:root[data-theme='dark'] :global(.lyric-editor-drawer) {
  background: rgba(15, 23, 42, 0.88) !important;
  border-left: 1px solid var(--a-color-border-dark, #334155) !important;
}
</style>
