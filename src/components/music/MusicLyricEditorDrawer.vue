<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronLeft, Clock, Download, FileUp, Languages, Minus, Plus, Sparkles } from 'lucide-vue-next'
import type { MusicLyricsEditTarget, MusicLyricsFormat, MusicSongLyricsLine } from '@/api/musicV1'
import MusicLyricsRowEditor from '@/components/music/MusicLyricsRowEditor.vue'
import PButton from '@/components/ui/PButton.vue'
import PActionFeedback from '@/components/ui/PActionFeedback.vue'
import PInput from '@/components/ui/PInput.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PSheet from '@/components/ui/PSheet.vue'
import {
  createMusicLyricDraftRow,
  formatMusicLyricTime,
  parseBilingualLrcDraft,
  parseMusicLyricDraft,
  reconcileImportedLrcRows,
  serializeMusicLyricDraft,
  shiftMusicLyricDraftTimes,
  validateMusicLyricDraft,
  type MusicLyricDraftIssue,
  type MusicLyricDraftRow,
} from '@/utils/musicLyricsDraft'
import { downloadTextFile } from '@/utils/textDownload'

const props = withDefaults(defineProps<{
  show: boolean
  content?: string
  translation?: string
  format?: MusicLyricsFormat
  saving?: boolean
  saveError?: string
  songTitle?: string
  currentTimeSeconds?: number
  lines?: MusicSongLyricsLine[]
  version?: number
  translationLanguage?: string
  source?: string
  defaultEditSummary?: string
  presentation?: 'sheet' | 'page'
}>(), {
  content: '',
  translation: '',
  format: 'plain',
  saving: false,
  saveError: '',
  songTitle: '',
  currentTimeSeconds: 0,
  lines: () => [],
  version: 0,
  translationLanguage: '',
  source: '',
  defaultEditSummary: '',
  presentation: 'sheet',
})

const emit = defineEmits<{
  close: []
  seek: [timeSeconds: number]
  save: [payload: {
    target: 'all'
    language?: string
    translationIncluded?: boolean
    baseVersion: number
    content: string
    translation: string
    format: MusicLyricsFormat
    lines: Array<{ line_key?: string, text: string, translation: string, time_ms: number | null }>
    editSummary: string
  }]
  'dirty-change': [dirty: boolean]
}>()

const targetOptions = [
  { label: '原文', value: 'original' },
  { label: '翻译', value: 'translation' },
] satisfies Array<{ label: string, value: MusicLyricsEditTarget }>

const rows = ref<MusicLyricDraftRow[]>([])
const selectedRowId = ref('')
const draftFormat = ref<MusicLyricsFormat>('plain')
const draftEditSummary = ref('')
const editTarget = ref<MusicLyricsEditTarget>('original')
const draftLanguage = ref('')
const originalImportFile = ref<File | null>(null)
const translationImportFile = ref<File | null>(null)
const importIssues = ref<MusicLyricDraftIssue[]>([])
const importError = ref('')
const importParsing = ref(false)
const importMode = ref(false)
const importIncludesTranslation = ref(false)
const exportError = ref('')
const originalInput = ref<HTMLInputElement | null>(null)
const translationInput = ref<HTMLInputElement | null>(null)
const draggingImport = ref<MusicLyricsEditTarget | null>(null)
const rowEditorRoot = ref<HTMLElement | null>(null)
const initialDraft = ref('')
let importGeneration = 0

const draftSnapshot = computed(() => JSON.stringify({
  rows: rows.value,
  format: draftFormat.value,
  editSummary: draftEditSummary.value,
  language: draftLanguage.value,
}))

const validationIssues = computed(() => validateMusicLyricDraft(rows.value, draftFormat.value))
const blockingIssues = computed(() => [
  ...validationIssues.value,
  ...importIssues.value,
].filter(issue => issue.severity === 'error'))
const hasBlockingIssues = computed(() => blockingIssues.value.length > 0)
const canSave = computed(() => (
  rows.value.length > 0
  && !hasBlockingIssues.value
  && draftEditSummary.value.trim().length > 0
  && !props.saving
  && !importParsing.value
))
const exportBaseName = computed(() => props.songTitle.trim() || 'lyrics')
const workflow = computed<'create' | 'sync' | 'calibrate'>(() => {
  if (rows.value.length === 0) return 'create'
  return draftFormat.value === 'lrc' ? 'calibrate' : 'sync'
})
const workflowTitle = computed(() => ({
  create: '新建歌词',
  sync: '纯文本对时',
  calibrate: '校准时间轴',
}[workflow.value]))
const timedRowCount = computed(() => rows.value.filter(row => row.timeMs !== null).length)
const workflowProgress = computed(() => `${timedRowCount.value} / ${rows.value.length} 行已打点`)

watch(
  () => [props.show, props.content, props.translation, props.format, props.lines, props.translationLanguage] as const,
  ([show, content, translation, format, lyricLines, translationLanguage]) => {
    importGeneration += 1
    if (!show) {
      selectedRowId.value = ''
      importIssues.value = []
      importError.value = ''
      importParsing.value = false
      return
    }

    draftFormat.value = format ?? 'plain'
    rows.value = lyricLines?.length
      ? lyricLines.map(line => createMusicLyricDraftRow({
          lineKey: line.line_key ?? line.id,
          timeMs: line.time_ms ?? line.startTimeMs ?? null,
          original: line.text,
          translation: line.translation,
        }))
      : parseMusicLyricDraft(content ?? '', translation ?? '', draftFormat.value)
    selectedRowId.value = rows.value.find(row => row.timeMs === null)?.id ?? rows.value[0]?.id ?? ''
    draftEditSummary.value = props.defaultEditSummary
    editTarget.value = 'original'
    draftLanguage.value = translationLanguage || 'zh-CN'
    originalImportFile.value = null
    translationImportFile.value = null
    importIssues.value = []
    importMode.value = false
    importIncludesTranslation.value = false
    importError.value = ''
    importParsing.value = false
    exportError.value = ''
    if (originalInput.value) originalInput.value.value = ''
    if (translationInput.value) translationInput.value.value = ''
    initialDraft.value = draftSnapshot.value
  },
  { immediate: true },
)

watch(draftSnapshot, (snapshot) => {
  emit('dirty-change', props.show && snapshot !== initialDraft.value)
})

watch(() => props.show, (show) => {
  if (!show) emit('dirty-change', false)
})

watch(editTarget, (target) => {
  if (importMode.value && target === 'translation') importIncludesTranslation.value = true
})

function addRow() {
  if (props.saving || editTarget.value !== 'original') return
  const row = createMusicLyricDraftRow()
  rows.value = [...rows.value, row]
  selectedRowId.value = row.id
}

function focusSelectedOriginal() {
  void nextTick(() => {
    if (!selectedRowId.value) return
    rowEditorRoot.value?.querySelector<HTMLInputElement>(`[data-testid="lyric-original-${selectedRowId.value}"]`)?.focus()
  })
}

function beginTiming() {
  if (props.saving || rows.value.length === 0) return
  draftFormat.value = 'lrc'
  selectedRowId.value = rows.value.find(row => row.timeMs === null)?.id ?? rows.value[0]?.id ?? ''
  focusSelectedOriginal()
}

function stampAndInput() {
  if (props.saving) return
  if (rows.value.length === 0) {
    draftFormat.value = 'lrc'
    const row = createMusicLyricDraftRow({ timeMs: Math.round((props.currentTimeSeconds ?? 0) * 1000) })
    rows.value = [row]
    selectedRowId.value = row.id
    focusSelectedOriginal()
    return
  }
  if (draftFormat.value !== 'lrc') draftFormat.value = 'lrc'
  stampCurrentTime()
  focusSelectedOriginal()
}

function stampCurrentTime() {
  if (props.saving || editTarget.value !== 'original' || !selectedRowId.value) return
  const index = rows.value.findIndex((row) => row.id === selectedRowId.value)
  if (index < 0) return

  const timeMs = Math.round((props.currentTimeSeconds ?? 0) * 1000)
  const nextRows = [...rows.value]
  nextRows[index] = { ...nextRows[index], timeMs }
  rows.value = nextRows

  const next = rows.value.slice(index + 1).find(row => row.timeMs === null)
    ?? rows.value[index + 1]
  if (next) selectedRowId.value = next.id
}

function advanceRow(rowId: string) {
  if (props.saving || editTarget.value !== 'original') return
  const index = rows.value.findIndex(row => row.id === rowId)
  if (index < 0) return
  const next = rows.value[index + 1]
  if (next) {
    selectedRowId.value = next.id
    focusSelectedOriginal()
    return
  }
  addRow()
  focusSelectedOriginal()
}

function adjustRowTime(rowId: string, offsetMs: number) {
  if (props.saving || draftFormat.value !== 'lrc') return
  rows.value = rows.value.map(row => row.id === rowId && row.timeMs !== null
    ? { ...row, timeMs: Math.max(0, row.timeMs + offsetMs) }
    : row)
}

function shiftAllTimes(offsetMs: number) {
  if (props.saving || draftFormat.value !== 'lrc') return
  rows.value = shiftMusicLyricDraftTimes(rows.value, offsetMs)
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (!props.show || props.saving || editTarget.value !== 'original') return
  if (
    (event.ctrlKey && event.code === 'Space')
    || (event.altKey && event.key.toLowerCase() === 's')
    || (event.shiftKey && event.key === 'Enter')
  ) {
    event.preventDefault()
    stampCurrentTime()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  emit('dirty-change', false)
})

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

async function selectImportFile(kind: 'original' | 'translation', event: Event) {
  if (props.saving) return
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  await setImportFile(kind, file)
}

async function setImportFile(kind: 'original' | 'translation', file: File | null) {
  if (props.saving || !file) return
  if (!file.name.toLowerCase().endsWith('.lrc')) {
    importError.value = '请选择 .lrc 文件'
    return
  }
  if (kind === 'original') originalImportFile.value = file
  else translationImportFile.value = file
  importIssues.value = []
  importError.value = ''
  if (!originalImportFile.value) return
  await importSelectedLrc()
}

async function handleImportDrop(kind: 'original' | 'translation', event: DragEvent) {
  event.preventDefault()
  draggingImport.value = null
  await setImportFile(kind, event.dataTransfer?.files?.[0] ?? null)
}

async function importSelectedLrc() {
  if (props.saving || !originalImportFile.value) return

  importGeneration += 1
  const generation = importGeneration
  const originalFile = originalImportFile.value
  const translationFile = translationImportFile.value
  const isStale = () => generation !== importGeneration || !props.show
  importParsing.value = true
  let original: string
  try {
    original = await originalFile.text()
  } catch {
    if (isStale()) return
    importIssues.value = []
    importError.value = `读取 LRC 文件失败：${originalFile.name}`
    importParsing.value = false
    return
  }
  if (isStale()) return

  let translation = ''
  if (translationFile) {
    try {
      translation = await translationFile.text()
    } catch {
      if (isStale()) return
      importIssues.value = []
      importError.value = `读取 LRC 文件失败：${translationFile.name}`
      importParsing.value = false
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
    importIssues.value = [
      ...locatedParseIssues,
      ...(parsed.rows.length === 0 ? [{
        severity: 'error' as const,
        code: 'empty_import',
        message: '未找到可导入的歌词',
      }] : []),
    ]
    importError.value = ''
    if (parsed.rows.length > 0) {
      importIncludesTranslation.value = Boolean(translationFile)
      rows.value = reconcileImportedLrcRows(
        parsed.rows,
        rows.value,
        importIncludesTranslation.value,
      )
      selectedRowId.value = rows.value[0]?.id ?? ''
      draftFormat.value = 'lrc'
      importMode.value = true
    }
    importParsing.value = false
  } catch {
    if (isStale()) return
    importIssues.value = []
    importError.value = `解析 LRC 文件失败：${originalFile.name}`
    importParsing.value = false
  }
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
    target: 'all',
    language: serialized.translation.trim() ? (draftLanguage.value.trim() || undefined) : undefined,
    baseVersion: props.version,
    content: serialized.content,
    translation: serialized.translation,
    format: draftFormat.value,
    lines: rows.value.map(row => ({
      line_key: row.lineKey,
      text: row.original,
      translation: row.translation,
      time_ms: row.timeMs,
    })),
    editSummary,
  })
}
</script>

<template>
  <component
    :is="presentation === 'page' ? 'section' : PSheet"
    :show="show"
    :title="songTitle.trim() ? `歌词-${songTitle.trim()}` : '歌词-歌曲'"
    :aria-label="songTitle.trim() ? `歌词-${songTitle.trim()}` : '歌词-歌曲'"
    content-max-width="72rem"
    close-type="header"
    panel-class="lyric-editor-drawer"
    class="music-lyric-editor-drawer"
    @close="emit('close')"
  >
    <header v-if="presentation === 'page'" class="music-lyric-editor-drawer__page-header">
      <button type="button" class="music-lyric-editor-drawer__back" aria-label="返回播放器" @click="emit('close')">
        <ChevronLeft :size="20" aria-hidden="true" />
        <span>返回</span>
      </button>
      <h1>{{ songTitle.trim() ? `歌词-${songTitle.trim()}` : '歌词-歌曲' }}</h1>
    </header>
    <div class="music-lyric-editor-drawer__body">
      <div class="music-lyric-editor-drawer__toolbar">
        <PSegmentedControl
          v-model="editTarget"
          :options="targetOptions"
          :disabled="saving"
          aria-label="修改内容"
        />
      </div>
      <p v-if="source" class="music-lyric-editor-drawer__source">
        歌词来源：{{ source === 'lrclib' ? 'LRCLIB' : source }}
      </p>

      <div class="music-lyric-editor-drawer__workflow" role="status" aria-live="polite">
        <strong>{{ workflowTitle }}</strong>
        <span v-if="rows.length">{{ workflowProgress }}</span>
        <span v-else>播放歌曲后点击“打点并输入”</span>
      </div>

      <section v-if="editTarget === 'original'" class="music-lyric-editor-drawer__import" aria-label="导入 LRC">
        <div class="music-lyric-editor-drawer__file-grid">
          <div
            class="music-lyric-editor-drawer__file-field"
            :class="{
              'music-lyric-editor-drawer__file-field--selected': originalImportFile,
              'music-lyric-editor-drawer__file-field--dragging': draggingImport === 'original',
              'music-lyric-editor-drawer__file-field--disabled': saving,
            }"
            @dragenter.prevent="draggingImport = 'original'"
            @dragover.prevent="draggingImport = 'original'"
            @dragleave.prevent="draggingImport = null"
            @drop="handleImportDrop('original', $event)"
          >
            <input
              ref="originalInput"
              class="music-lyric-editor-drawer__file-input"
              type="file"
              accept=".lrc,text/plain"
              aria-label="原文 LRC"
              :disabled="saving"
              @change="selectImportFile('original', $event)"
            />
            <span class="music-lyric-editor-drawer__file-icon">
              <FileUp :size="20" aria-hidden="true" />
            </span>
            <span class="music-lyric-editor-drawer__file-copy">
              <strong>{{ originalImportFile?.name || '原文 LRC' }}</strong>
              <span>{{ draggingImport === 'original' ? '松开以上传' : originalImportFile ? '文件已导入' : '点击或拖入 .lrc 文件' }}</span>
            </span>
            <PButton
              type="button"
              size="sm"
              variant="secondary"
              :disabled="saving"
              @click="originalInput?.click()"
            >
              {{ originalImportFile ? '重新选择' : '选择文件' }}
            </PButton>
          </div>
        </div>

        <div v-if="draftFormat === 'lrc'" class="music-lyric-editor-drawer__import-actions">
          <PButton
            type="button"
            variant="secondary"
            :disabled="saving || importParsing || hasBlockingIssues"
            @click="exportLyrics('original')"
          >
            <Download :size="17" aria-hidden="true" />
            导出原文
          </PButton>
          <PButton
            type="button"
            variant="secondary"
            :disabled="saving || importParsing || hasBlockingIssues"
            @click="exportLyrics('translation')"
          >
            <Download :size="17" aria-hidden="true" />
            导出翻译
          </PButton>
        </div>
        <p
          v-if="importParsing"
          class="music-lyric-editor-drawer__import-status"
          role="status"
          aria-live="polite"
        >
          正在解析 LRC...
        </p>
        <p
          v-else-if="importMode && originalImportFile && !importError"
          class="music-lyric-editor-drawer__import-status"
          role="status"
          aria-live="polite"
        >
          已解析 {{ rows.length }} 行歌词
        </p>
        <p v-if="exportError" class="music-lyric-editor-drawer__read-error" role="alert">
          {{ exportError }}
        </p>
      </section>

      <section
        v-if="editTarget === 'translation'"
        class="music-lyric-editor-drawer__import"
        aria-label="导入翻译 LRC"
      >
        <div
          class="music-lyric-editor-drawer__file-field"
          :class="{
            'music-lyric-editor-drawer__file-field--selected': translationImportFile,
            'music-lyric-editor-drawer__file-field--dragging': draggingImport === 'translation',
            'music-lyric-editor-drawer__file-field--disabled': saving,
          }"
          @dragenter.prevent="draggingImport = 'translation'"
          @dragover.prevent="draggingImport = 'translation'"
          @dragleave.prevent="draggingImport = null"
          @drop="handleImportDrop('translation', $event)"
        >
          <input ref="translationInput" class="music-lyric-editor-drawer__file-input" type="file" accept=".lrc,text/plain" aria-label="翻译 LRC" :disabled="saving" @change="selectImportFile('translation', $event)" />
          <span class="music-lyric-editor-drawer__file-icon"><Languages :size="20" aria-hidden="true" /></span>
          <span class="music-lyric-editor-drawer__file-copy">
            <strong>{{ translationImportFile?.name || '翻译 LRC' }}</strong>
            <span>{{ draggingImport === 'translation' ? '松开以上传' : translationImportFile ? '文件已导入' : '点击或拖入 .lrc 文件' }}</span>
          </span>
          <PButton type="button" size="sm" variant="secondary" :disabled="saving" @click="translationInput?.click()">{{ translationImportFile ? '重新选择' : '选择文件' }}</PButton>
        </div>
      </section>

      <p v-if="importError" class="music-lyric-editor-drawer__read-error" role="alert">
        {{ importError }}
      </p>
      <ul v-if="importIssues.length" class="music-lyric-editor-drawer__import-issues" aria-label="LRC 解析问题">
        <li
          v-for="issue in importIssues"
          :key="`${issue.code}-${issue.sourceLine ?? issue.message}`"
          :class="`music-lyric-editor-drawer__import-issue--${issue.severity}`"
        >
          {{ issue.message }}
        </li>
      </ul>

      <div ref="rowEditorRoot" class="music-lyric-editor-drawer__row-editor">
        <MusicLyricsRowEditor
          :rows="rows"
          :format="draftFormat"
          :edit-target="editTarget"
          :issues="validationIssues"
          :disabled="saving"
          :selected-row-id="selectedRowId"
          @update:rows="handleRowsUpdate"
          @select-row="selectedRowId = $event"
          @select-target="editTarget = $event"
          @seek="emit('seek', $event)"
          @advance-row="advanceRow"
          @adjust-time="adjustRowTime"
        >
          <template #tools>
            <div class="music-lyric-editor-drawer__tools-primary">
              <PButton
                v-if="workflow === 'create'"
                type="button"
                variant="primary"
                :disabled="saving"
                @click="stampAndInput"
              >
                <Sparkles :size="17" aria-hidden="true" />
                打点并输入
              </PButton>
              <PButton
                v-else-if="workflow === 'sync'"
                type="button"
                variant="primary"
                :disabled="saving"
                @click="beginTiming"
              >
                <Clock :size="17" aria-hidden="true" />
                开始对时
              </PButton>
              <PButton
                v-if="editTarget === 'original' && draftFormat === 'lrc'"
                type="button"
                variant="secondary"
                :disabled="saving || !selectedRowId"
                title="快捷键 Ctrl+Space / Shift+Enter"
                @click="stampCurrentTime"
              >
                <Clock :size="17" aria-hidden="true" />
                打点 ({{ formatMusicLyricTime(Math.round((currentTimeSeconds ?? 0) * 1000)) }})
              </PButton>

              <div v-if="workflow === 'calibrate'" class="music-lyric-editor-drawer__offset-actions" aria-label="整体调整时间">
                <span>整体偏移</span>
                <button type="button" class="music-lyric-editor-drawer__icon-action" title="全部提前 0.1 秒" aria-label="全部提前 0.1 秒" :disabled="saving" @click="shiftAllTimes(-100)">
                  <Minus :size="14" aria-hidden="true" />
                </button>
                <button type="button" class="music-lyric-editor-drawer__icon-action" title="全部延后 0.1 秒" aria-label="全部延后 0.1 秒" :disabled="saving" @click="shiftAllTimes(100)">
                  <Plus :size="14" aria-hidden="true" />
                </button>
              </div>
            </div>

            <PButton
              v-if="editTarget === 'original'"
              class="music-lyric-editor-drawer__add-row"
              type="button"
              variant="secondary"
              :disabled="saving"
              @click="addRow"
            >
              <Plus :size="17" aria-hidden="true" />
              增加行
            </PButton>
          </template>
        </MusicLyricsRowEditor>
      </div>

      <PInput
        v-if="editTarget === 'translation' || (importMode && importIncludesTranslation)"
        v-model="draftLanguage"
        label="翻译语言"
        placeholder="例如 zh-CN"
        :disabled="saving"
      />

      <PInput
        v-model="draftEditSummary"
        data-testid="lyrics-edit-summary"
        label="修改原因"
        placeholder="写本次修改"
        :disabled="saving"
      />

      <div class="music-lyric-editor-drawer__actions">
        <PButton type="button" variant="secondary" :disabled="saving" @click="emit('close')">
          取消
        </PButton>
        <div class="music-lyric-editor-drawer__save-action">
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
          <PActionFeedback :message="saveError" />
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped>
@import "./musicLyricEditorDrawer.css";
</style>
