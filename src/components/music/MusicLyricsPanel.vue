<template>
  <section class="music-lyrics-panel">
    <header class="music-lyrics-panel__header">
      <div class="music-lyrics-panel__heading">
        <p class="music-lyrics-panel__eyebrow">歌词</p>
        <h2>{{ songTitle }}</h2>
        <p class="music-lyrics-panel__meta">{{ artistText }}</p>
      </div>

      <div class="music-lyrics-panel__actions">
        <PButton
          class="music-lyrics-panel__action-btn"
          type="button"
          variant="secondary"
          data-testid="lyrics-versions-trigger"
          @click="toggleVersions"
        >
          版本
        </PButton>
        <PButton
          class="music-lyrics-panel__action-btn"
          v-if="isAuthenticated"
          type="button"
          variant="secondary"
          :disabled="saving || reverting"
          data-testid="lyrics-edit-trigger"
          @click="isLyricEditorOpen = true"
        >
          编辑歌词
        </PButton>
        <button
          type="button"
          class="music-lyrics-panel__close"
          @click="emit('close')"
        >
          关闭
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="music-lyrics-panel__feedback">
      {{ errorMessage }}
    </p>

    <div v-if="versionsVisible" class="music-lyrics-panel__versions">
      <p v-if="versionsLoading" class="music-lyrics-panel__placeholder">正在加载版本</p>
      <p v-else-if="versionsErrorMessage" class="music-lyrics-panel__placeholder">{{ versionsErrorMessage }}</p>
      <p v-else-if="versionsSongId !== songId || !versions.length" class="music-lyrics-panel__placeholder">暂无版本</p>
      <div v-else class="music-lyrics-panel__version-list">
        <article
          v-for="version in versions"
          :key="version.id || version.version"
          class="music-lyrics-panel__version"
        >
          <div>
            <strong>第 {{ version.version }} 版</strong>
            <span>{{ version.edit_summary || '歌词更新' }}</span>
          </div>
          <button
            type="button"
            class="music-lyrics-panel__version-action"
            :data-testid="`lyrics-version-preview-${version.version}`"
            @click="selectVersionPreview(version.version)"
          >
            预览
          </button>

          <div
            v-if="selectedVersionPreview?.version === version.version"
            class="music-lyrics-panel__version-preview"
            :data-testid="`lyrics-version-diff-${version.version}`"
          >
            <p class="music-lyrics-panel__version-impact">
              {{ selectedVersionPreview.affectedActiveAnnotationCount }} 条注释需重新绑定
            </p>
            <div class="music-lyrics-panel__version-diff-lines">
              <p
                v-for="(line, index) in selectedVersionPreview.lines"
                :key="`${line.kind}-${line.currentIndex ?? ''}-${line.targetIndex ?? ''}-${index}`"
                class="music-lyrics-panel__version-diff-line"
                :class="`is-${line.kind}`"
              >
                <span>{{ versionDiffLabel(line.kind) }}</span>
                <del v-if="line.current && line.kind !== 'unchanged'">{{ line.current.text }}</del>
                <ins v-if="line.target && line.kind !== 'removed'">{{ line.target.text }}</ins>
              </p>
            </div>
            <button
              v-if="isAuthenticated"
              type="button"
              class="music-lyrics-panel__version-action"
              :disabled="saving || reverting"
              :data-testid="`lyrics-revert-version-${version.version}`"
              @click="handleRevertVersion(version.version)"
            >
              确认恢复
            </button>
          </div>
        </article>
      </div>
    </div>

    <div class="music-lyrics-panel__layout">
      <div class="music-lyrics-panel__main">
        <div v-if="hasTranslation" class="music-lyrics-panel__display-mode">
          <PSegmentedControl v-model="displayMode" :options="displayModeOptions" />
        </div>
        <p v-if="loading" class="music-lyrics-panel__placeholder">加载中</p>
        <p v-else-if="!lyrics?.lines.length" class="music-lyrics-panel__placeholder">暂无歌词</p>

        <div v-else ref="lyricsLinesElement" class="music-lyrics-panel__lines">
          <MusicLyricsLine
            v-for="line in lyrics.lines"
            :key="line.line_key ?? line.id ?? line.text"
            :line="line"
            :annotations="annotationsByLine.get(line.line_key ?? line.id ?? '') ?? []"
            :active="currentLineId === (line.line_key ?? line.id ?? '')"
            :bilingual="showTranslation"
            :can-select="isAuthenticated"
            @select-text="handleSelectText"
            @open-annotations="handleOpenAnnotations"
          />
        </div>
      </div>

      <aside v-if="showSidebar" class="music-lyrics-panel__sidebar">
        <MusicAnnotationPanel
          v-if="visibleAnnotations.length"
          :annotations="visibleAnnotations"
          :can-write="isAuthenticated"
          :current-user-ids="currentUserIds"
          @vote="handleVoteAnnotation"
          @edit="handleEditAnnotation"
          @delete="handleDeleteAnnotation"
          @rebind="handleRebindAnnotation"
        />

        <MusicAnnotationEditor
          v-if="isAuthenticated"
          :show="annotationEditorVisible"
          :selected-text="annotationSelectedText"
          :initial-body="annotationInitialBody"
          :mode="annotationEditorMode"
          @save="handleSaveAnnotation"
          @cancel="handleCancelAnnotation"
          @confirm-rebind="handleConfirmRebind"
        />
      </aside>
    </div>

    <MusicLyricEditorDrawer
      v-if="isAuthenticated"
      :show="isLyricEditorOpen"
      :song-title="songTitle"
      :content="lyrics?.content ?? ''"
      :translation="lyrics?.translation ?? ''"
      :format="lyrics?.format ?? 'plain'"
      :saving="saving || reverting"
      :current-time-seconds="currentTimeSeconds"
      @close="isLyricEditorOpen = false"
      @save="handleSaveLyrics"
      @seek="emit('seek', $event)"
    />

    <PConfirm
      above-player
      :show="conflictAnnotationIds.length > 0"
      title="保存歌词"
      :message="conflictMessage"
      confirm-text="继续保存"
      cancel-text="取消"
      :loading="saving"
      @confirm="confirmLyricsConflict"
      @cancel="cancelLyricsConflict"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import type {
  MusicLyricsAnnotation,
  MusicSongLyricsLine,
  UpdateMusicSongLyricsInput,
} from '@/api/musicV1'
import MusicAnnotationEditor from '@/components/music/MusicAnnotationEditor.vue'
import MusicAnnotationPanel from '@/components/music/MusicAnnotationPanel.vue'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
import MusicLyricsLine from '@/components/music/MusicLyricsLine.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import { useMusicLyrics } from '@/composables/useMusicLyrics'
import { removePendingMusicLyricsAnnotation } from '@/composables/usePendingMusicLyricsAnnotations'
import { useAuthStore } from '@/stores/auth'
import { buildMusicLyricsVersionPreview, type MusicLyricsVersionDiffKind } from '@/utils/musicLyricsVersionDiff'

const props = defineProps<{
  songId: string
  songTitle: string
  artistText: string
  currentTimeSeconds: number
  focusAnnotationId?: string
  startRebind?: boolean
}>()

const emit = defineEmits<{
  close: []
  seek: [timeSeconds: number]
}>()

const authStore = useAuthStore()

const {
  lyrics,
  loading,
  saving,
  reverting,
  errorMessage,
  versionsErrorMessage,
  annotationsByLine,
  load,
  save,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  voteAnnotation,
  versions,
  versionsSongId,
  versionsLoading,
  loadVersions,
  resetVersions,
  revertVersion,
  currentLine,
} = useMusicLyrics()

const selectedAnnotationIds = ref<string[]>([])
const selectedTextDraft = ref<{
  line: MusicSongLyricsLine
  selectedText: string
  startOffset: number
  endOffset: number
} | null>(null)
const editingAnnotation = ref<MusicLyricsAnnotation | null>(null)
const rebindingAnnotation = ref<MusicLyricsAnnotation | null>(null)
const isLyricEditorOpen = ref(false)
const versionsVisible = ref(false)
const selectedVersionNumber = ref<number | null>(null)
const displayMode = ref<'original' | 'bilingual'>('bilingual')
const lyricsLinesElement = ref<HTMLElement | null>(null)
const pendingLyricsInput = ref<UpdateMusicSongLyricsInput | null>(null)
const conflictAnnotationIds = ref<string[]>([])
const pendingLyricsSongId = ref('')
let pendingLyricsSaveGeneration = 0
let activeLyricsSaveGeneration = 0
let versionsViewGeneration = 0
let rebindOperationGeneration = 0

const displayModeOptions = [
  { label: '原文', value: 'original' },
  { label: '双语', value: 'bilingual' },
]

const isAuthenticated = computed(() => Boolean(authStore.isAuthenticated))
const currentUserIds = computed(() => collectIdentityValues(authStore.user as Record<string, unknown> | null))
const activeTimedLine = computed(() => {
  const line = currentLine(props.currentTimeSeconds)
  const startTime = line?.time_ms ?? line?.startTimeMs
  return typeof startTime === 'number' ? line : null
})
const currentLineId = computed(() => activeTimedLine.value?.line_key ?? activeTimedLine.value?.id ?? '')
const hasTranslation = computed(() => Boolean(lyrics.value?.translation.trim()))
const showTranslation = computed(() => hasTranslation.value && displayMode.value === 'bilingual')
const conflictMessage = computed(() => `这次修改会影响 ${conflictAnnotationIds.value.length} 条注释，保存后将通知作者重新确认。`)
const selectedAnnotations = computed(() => {
  if (!lyrics.value || selectedAnnotationIds.value.length === 0) return []
  const selectedSet = new Set(selectedAnnotationIds.value)
  return lyrics.value.annotations.filter((annotation) => selectedSet.has(annotation.id))
})
const rebindableAnnotations = computed(() => (lyrics.value?.annotations ?? []).filter((annotation) => (
  annotation.status === 'needs_rebind' && canManageAnnotation(annotation)
)))
const visibleAnnotations = computed(() => {
  const seen = new Set<string>()
  return [...selectedAnnotations.value, ...rebindableAnnotations.value].filter((annotation) => {
    if (seen.has(annotation.id)) return false
    seen.add(annotation.id)
    return true
  })
})
const annotationEditorVisible = computed(() => Boolean(selectedTextDraft.value || editingAnnotation.value || rebindingAnnotation.value))
const annotationSelectedText = computed(() => editingAnnotation.value?.selected_text ?? selectedTextDraft.value?.selectedText ?? '')
const annotationInitialBody = computed(() => editingAnnotation.value?.body ?? '')
const annotationEditorMode = computed<'create' | 'edit' | 'rebind'>(() => (
  rebindingAnnotation.value ? 'rebind' : editingAnnotation.value ? 'edit' : 'create'
))
const showSidebar = computed(() => visibleAnnotations.value.length > 0 || annotationEditorVisible.value)
const selectedVersionPreview = computed(() => {
  if (!lyrics.value || selectedVersionNumber.value === null || versionsSongId.value !== props.songId) return null
  const version = versions.value.find((item) => item.version === selectedVersionNumber.value)
  return version ? { version: version.version, ...buildMusicLyricsVersionPreview(lyrics.value, version) } : null
})

watch(
  () => props.songId,
  (songId) => {
    activeLyricsSaveGeneration += 1
    versionsViewGeneration += 1
    resetVersions()
    selectedAnnotationIds.value = []
    clearRebindState()
    editingAnnotation.value = null
    isLyricEditorOpen.value = false
    versionsVisible.value = false
    selectedVersionNumber.value = null
    displayMode.value = 'bilingual'
    pendingLyricsInput.value = null
    pendingLyricsSongId.value = ''
    pendingLyricsSaveGeneration = 0
    conflictAnnotationIds.value = []
    void load(songId)
  },
  { immediate: true },
)

watch(currentLineId, async (lineId, previousLineId) => {
  if (!lineId || lineId === previousLineId) return
  await nextTick()
  lyricsLinesElement.value
    ?.querySelector<HTMLElement>('.music-lyrics-line.is-active')
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})

watch(
  () => [props.focusAnnotationId, props.startRebind, lyrics.value?.song_id, lyrics.value?.annotations] as const,
  async ([annotationId, startRebind]) => {
    if (!annotationId || !lyrics.value) return
    const annotation = lyrics.value.annotations.find((item) => item.id === annotationId)
    if (!annotation) return
    selectedAnnotationIds.value = [annotation.id]
    await nextTick()
    if (startRebind && annotation.status === 'needs_rebind' && canManageAnnotation(annotation)) {
      handleRebindAnnotation(annotation)
    }
  },
  { immediate: true, deep: true },
)

function collectIdentityValues(value: Record<string, unknown> | null | undefined) {
  if (!value) return []
  return [value.id, value.uuid]
    .filter((candidate) => candidate !== null && candidate !== undefined && candidate !== '')
    .map((candidate) => String(candidate))
}

function canManageAnnotation(annotation: MusicLyricsAnnotation) {
  if (!isAuthenticated.value || currentUserIds.value.length === 0) return false
  const creatorIds = collectIdentityValues(annotation.creator as Record<string, unknown> | null)
  return creatorIds.some((creatorId) => currentUserIds.value.includes(creatorId))
}

function handleOpenAnnotations(payload: { line: MusicSongLyricsLine; annotationIds: string[] }) {
  clearRebindState()
  editingAnnotation.value = null
  selectedAnnotationIds.value = payload.annotationIds
}

function handleSelectText(payload: {
  line: MusicSongLyricsLine
  selectedText: string
  startOffset: number
  endOffset: number
}) {
  if (!isAuthenticated.value) return
  if (rebindingAnnotation.value) rebindOperationGeneration += 1
  editingAnnotation.value = null
  selectedAnnotationIds.value = []
  selectedTextDraft.value = payload
}

function handleCancelAnnotation() {
  clearRebindState()
  editingAnnotation.value = null
}

async function handleSaveAnnotation(body: string) {
  if (!isAuthenticated.value) return
  if (editingAnnotation.value) {
    await updateAnnotation(props.songId, editingAnnotation.value.id, { body })
    editingAnnotation.value = null
    return
  }

  if (!selectedTextDraft.value) return

  const lineKey = selectedTextDraft.value.line.line_key ?? selectedTextDraft.value.line.id
  if (!lineKey) return

  await createAnnotation(props.songId, {
    line_key: lineKey,
    selected_text: selectedTextDraft.value.selectedText,
    start_offset: selectedTextDraft.value.startOffset,
    end_offset: selectedTextDraft.value.endOffset,
    body,
  })

  selectedTextDraft.value = null
}

function handleRebindAnnotation(annotation: MusicLyricsAnnotation) {
  if (!canManageAnnotation(annotation) || annotation.status !== 'needs_rebind') return
  clearRebindState()
  editingAnnotation.value = null
  rebindingAnnotation.value = annotation
}

function versionDiffLabel(kind: MusicLyricsVersionDiffKind) {
  return {
    unchanged: '未变更',
    added: '新增',
    removed: '删除',
    modified: '修改',
  }[kind]
}

async function handleConfirmRebind() {
  if (!isAuthenticated.value || !rebindingAnnotation.value || !selectedTextDraft.value) return
  const lineKey = selectedTextDraft.value.line.line_key ?? selectedTextDraft.value.line.id
  if (!lineKey) return

  const annotation = rebindingAnnotation.value
  const songId = props.songId
  const operationGeneration = ++rebindOperationGeneration
  try {
    await updateAnnotation(songId, annotation.id, {
      line_key: lineKey,
      selected_text: selectedTextDraft.value.selectedText,
      start_offset: selectedTextDraft.value.startOffset,
      end_offset: selectedTextDraft.value.endOffset,
    })
  } catch {
    return
  }
  if (props.songId !== songId || rebindOperationGeneration !== operationGeneration) return
  removePendingMusicLyricsAnnotation(annotation.id)
  clearRebindState()
}

function handleEditAnnotation(annotation: MusicLyricsAnnotation) {
  if (!isAuthenticated.value) return
  clearRebindState()
  editingAnnotation.value = annotation
}

function clearRebindState() {
  rebindOperationGeneration += 1
  selectedTextDraft.value = null
  rebindingAnnotation.value = null
}

async function handleDeleteAnnotation(annotationId: string) {
  if (!isAuthenticated.value) return
  await deleteAnnotation(props.songId, annotationId)
  selectedAnnotationIds.value = selectedAnnotationIds.value.filter((id) => id !== annotationId)
}

async function handleVoteAnnotation(annotationId: string, vote: 'up' | 'down' | null) {
  if (!isAuthenticated.value) return
  await voteAnnotation(props.songId, annotationId, vote)
}

async function toggleVersions() {
  versionsViewGeneration += 1
  versionsVisible.value = !versionsVisible.value
  if (!versionsVisible.value) {
    selectedVersionNumber.value = null
    resetVersions()
    return
  }
  try {
    await loadVersions(props.songId)
  } catch {
    // The composable exposes the current version error inside this panel.
  }
}

function selectVersionPreview(version: number) {
  selectedVersionNumber.value = selectedVersionNumber.value === version ? null : version
}

async function handleRevertVersion(version: number) {
  if (
    !isAuthenticated.value
    || saving.value
    || reverting.value
    || versionsSongId.value !== props.songId
    || selectedVersionNumber.value !== version
  ) return
  const songId = props.songId
  const viewGeneration = versionsViewGeneration
  try {
    const succeeded = await revertVersion(songId, version, `恢复到第 ${version} 版`)
    if (
      succeeded
      && props.songId === songId
      && versionsVisible.value
      && versionsViewGeneration === viewGeneration
    ) {
      versionsVisible.value = false
      selectedVersionNumber.value = null
    }
  } catch {
    // The composable exposes the current version error inside this panel.
  }
}

async function handleSaveLyrics(payload: {
  content: string
  translation: string
  format: 'plain' | 'lrc'
  editSummary: string
}) {
  if (!isAuthenticated.value || saving.value || reverting.value) return
  const input: UpdateMusicSongLyricsInput = {
    content: payload.content,
    translation: payload.translation,
    format: payload.format,
    edit_summary: payload.editSummary,
  }

  const songId = props.songId
  const generation = ++activeLyricsSaveGeneration
  await attemptLyricsSave(songId, generation, input)
}

async function attemptLyricsSave(songId: string, generation: number, input: UpdateMusicSongLyricsInput) {
  try {
    await save(songId, input)
    if (generation !== activeLyricsSaveGeneration || props.songId !== songId) return
    pendingLyricsInput.value = null
    pendingLyricsSongId.value = ''
    pendingLyricsSaveGeneration = 0
    conflictAnnotationIds.value = []
    isLyricEditorOpen.value = false
  } catch (error) {
    if (generation !== activeLyricsSaveGeneration || props.songId !== songId) return
    const annotationIds = error instanceof ApiErrorResponseError
      && error.status === 409
      && error.code === 'music.annotation_anchor_conflict'
      && Array.isArray(error.details.annotation_ids)
      ? error.details.annotation_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    if (annotationIds.length === 0) return

    errorMessage.value = ''
    pendingLyricsInput.value = input
    pendingLyricsSongId.value = songId
    pendingLyricsSaveGeneration = generation
    conflictAnnotationIds.value = annotationIds
  }
}

async function confirmLyricsConflict() {
  if (
    !pendingLyricsInput.value
    || conflictAnnotationIds.value.length === 0
    || pendingLyricsSongId.value !== props.songId
    || pendingLyricsSaveGeneration !== activeLyricsSaveGeneration
  ) return
  const songId = pendingLyricsSongId.value
  const generation = pendingLyricsSaveGeneration
  const resolutionsByAnnotationId = new Map(
    (pendingLyricsInput.value.annotation_resolutions ?? []).map((resolution) => [resolution.annotation_id, resolution]),
  )
  for (const annotationId of conflictAnnotationIds.value) {
    resolutionsByAnnotationId.set(annotationId, {
      annotation_id: annotationId,
      action: 'needs_rebind',
    })
  }
  const input: UpdateMusicSongLyricsInput = {
    ...pendingLyricsInput.value,
    annotation_resolutions: [...resolutionsByAnnotationId.values()],
  }
  conflictAnnotationIds.value = []
  await attemptLyricsSave(songId, generation, input)
}

function cancelLyricsConflict() {
  if (pendingLyricsSongId.value !== props.songId || pendingLyricsSaveGeneration !== activeLyricsSaveGeneration) return
  conflictAnnotationIds.value = []
  pendingLyricsInput.value = null
  pendingLyricsSongId.value = ''
  pendingLyricsSaveGeneration = 0
}
</script>

<style scoped>
.music-lyrics-panel {
  position: fixed;
  top: var(--a-topbar-height);
  right: 0;
  bottom: var(--a-content-bottom-offset);
  left: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 1rem;
  padding: 1.5rem 2rem 2rem;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--a-color-border-soft);
  box-shadow: none;
  z-index: var(--a-z-player-lyrics);
}

@media (prefers-color-scheme: dark) {
  .music-lyrics-panel {
    background: rgba(15, 23, 42, 0.88);
    border-top: 1px solid var(--a-color-border-dark, #334155);
  }
}

:root[data-theme='dark'] .music-lyrics-panel {
  background: rgba(15, 23, 42, 0.88);
  border-top: 1px solid var(--a-color-border-dark, #334155);
}

.music-lyrics-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.music-lyrics-panel__heading {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.music-lyrics-panel__eyebrow,
.music-lyrics-panel__meta {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-lyrics-panel__heading h2 {
  margin: 0;
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: clamp(1.2rem, 2vw, 1.8rem);
  font-weight: 900;
}

.music-lyrics-panel__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.music-lyrics-panel__action-btn {
  border-radius: 4px !important;
}

.music-lyrics-panel__close {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 4px;
  box-shadow: none;
}

.music-lyrics-panel__feedback,
.music-lyrics-panel__placeholder {
  margin: 0;
  color: var(--a-color-muted);
}

.music-lyrics-panel__versions {
  border: 1px solid var(--a-color-border-soft);
  background: var(--a-color-surface-muted);
  padding: 0.75rem;
}

.music-lyrics-panel__version-list {
  display: grid;
  gap: 0.5rem;
}

.music-lyrics-panel__version {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  color: var(--a-color-text);
}

.music-lyrics-panel__version div {
  display: grid;
  gap: 0.2rem;
}

.music-lyrics-panel__version span {
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.music-lyrics-panel__version-action {
  border: 0;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
  font-size: 0.72rem;
  font-weight: 800;
  border-radius: 4px;
  box-shadow: none;
}

.music-lyrics-panel__version-preview {
  grid-column: 1 / -1;
  display: grid;
  gap: 0.6rem;
  border-top: 1px solid var(--a-color-border-soft);
  padding-top: 0.75rem;
}

.music-lyrics-panel__version-impact {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.82rem;
}

.music-lyrics-panel__version-diff-lines {
  display: grid;
  gap: 0.25rem;
  max-height: 14rem;
  overflow: auto;
}

.music-lyrics-panel__version-diff-line {
  display: flex;
  gap: 0.5rem;
  margin: 0;
  color: var(--a-color-text);
  font-size: 0.82rem;
  line-height: 1.5;
}

.music-lyrics-panel__version-diff-line > span {
  flex: 0 0 3rem;
  color: var(--a-color-muted);
  font-weight: 700;
}

.music-lyrics-panel__version-diff-line del,
.music-lyrics-panel__version-diff-line ins {
  text-decoration: none;
}

.music-lyrics-panel__version-diff-line.is-added ins {
  color: var(--a-color-success);
}

.music-lyrics-panel__version-diff-line.is-removed del {
  color: var(--a-color-danger);
}

.music-lyrics-panel__version-diff-line.is-modified del {
  color: var(--a-color-danger);
}

.music-lyrics-panel__version-diff-line.is-modified ins {
  color: var(--a-color-success);
}

.music-lyrics-panel__layout {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  gap: 1.25rem;
}

.music-lyrics-panel__main {
  min-height: 0;
  overflow: auto;
  padding-right: 1rem;
  /* 增加高质感渐变遮罩 */
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
}

.music-lyrics-panel__display-mode {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.music-lyrics-panel__lines {
  display: grid;
  gap: 0.2rem;
}

.music-lyrics-panel__sidebar {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 1rem;
  border-left: 1px solid var(--a-color-border-soft);
  padding-left: 1.25rem;
}

@media (max-width: 900px) {
  .music-lyrics-panel {
    padding: 1rem 1rem 1.25rem;
  }

  .music-lyrics-panel__header {
    display: grid;
  }

  .music-lyrics-panel__actions {
    justify-content: flex-start;
  }

  .music-lyrics-panel__layout {
    grid-template-columns: 1fr;
  }

  .music-lyrics-panel__sidebar {
    border-top: 1px solid var(--a-color-border-soft);
    border-left: 0;
    padding-top: 1rem;
    padding-left: 0;
  }
}
</style>
