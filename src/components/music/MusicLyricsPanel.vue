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
          type="button"
          variant="secondary"
          data-testid="lyrics-versions-trigger"
          @click="toggleVersions"
        >
          版本
        </PButton>
        <PButton
          v-if="isAuthenticated"
          type="button"
          variant="secondary"
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
            v-if="isAuthenticated"
            type="button"
            class="music-lyrics-panel__version-action"
            :disabled="reverting"
            :data-testid="`lyrics-revert-version-${version.version}`"
            @click="handleRevertVersion(version.version)"
          >
            恢复
          </button>
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
          v-if="selectedAnnotations.length"
          :annotations="selectedAnnotations"
          :can-write="isAuthenticated"
          :current-user-ids="currentUserIds"
          @vote="handleVoteAnnotation"
          @edit="handleEditAnnotation"
          @delete="handleDeleteAnnotation"
        />

        <MusicAnnotationEditor
          v-if="isAuthenticated"
          :show="annotationEditorVisible"
          :selected-text="annotationSelectedText"
          :initial-body="annotationInitialBody"
          @save="handleSaveAnnotation"
          @cancel="handleCancelAnnotation"
        />
      </aside>
    </div>

    <MusicLyricEditorDrawer
      v-if="isAuthenticated"
      :show="isLyricEditorOpen"
      :content="lyrics?.content ?? ''"
      :translation="lyrics?.translation ?? ''"
      :format="lyrics?.format ?? 'plain'"
      :saving="saving"
      @close="isLyricEditorOpen = false"
      @save="handleSaveLyrics"
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
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  songId: string
  songTitle: string
  artistText: string
  currentTimeSeconds: number
}>()

const emit = defineEmits<{
  close: []
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
const isLyricEditorOpen = ref(false)
const versionsVisible = ref(false)
const displayMode = ref<'original' | 'bilingual'>('bilingual')
const lyricsLinesElement = ref<HTMLElement | null>(null)
const pendingLyricsInput = ref<UpdateMusicSongLyricsInput | null>(null)
const conflictAnnotationIds = ref<string[]>([])

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
const annotationEditorVisible = computed(() => Boolean(selectedTextDraft.value || editingAnnotation.value))
const annotationSelectedText = computed(() => editingAnnotation.value?.selected_text ?? selectedTextDraft.value?.selectedText ?? '')
const annotationInitialBody = computed(() => editingAnnotation.value?.body ?? '')
const showSidebar = computed(() => selectedAnnotations.value.length > 0 || annotationEditorVisible.value)

watch(
  () => props.songId,
  (songId) => {
    resetVersions()
    selectedAnnotationIds.value = []
    selectedTextDraft.value = null
    editingAnnotation.value = null
    isLyricEditorOpen.value = false
    versionsVisible.value = false
    displayMode.value = 'bilingual'
    pendingLyricsInput.value = null
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

function collectIdentityValues(value: Record<string, unknown> | null | undefined) {
  if (!value) return []
  return [value.id, value.uuid]
    .filter((candidate) => candidate !== null && candidate !== undefined && candidate !== '')
    .map((candidate) => String(candidate))
}

function handleOpenAnnotations(payload: { line: MusicSongLyricsLine; annotationIds: string[] }) {
  selectedTextDraft.value = null
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
  editingAnnotation.value = null
  selectedAnnotationIds.value = []
  selectedTextDraft.value = payload
}

function handleCancelAnnotation() {
  selectedTextDraft.value = null
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

function handleEditAnnotation(annotation: MusicLyricsAnnotation) {
  if (!isAuthenticated.value) return
  selectedTextDraft.value = null
  editingAnnotation.value = annotation
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
  versionsVisible.value = !versionsVisible.value
  if (!versionsVisible.value) {
    resetVersions()
    return
  }
  try {
    await loadVersions(props.songId)
  } catch {
    // The composable exposes the current version error inside this panel.
  }
}

async function handleRevertVersion(version: number) {
  if (!isAuthenticated.value || reverting.value || versionsSongId.value !== props.songId) return
  try {
    await revertVersion(props.songId, version, `恢复到第 ${version} 版`)
    versionsVisible.value = false
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
  if (!isAuthenticated.value) return
  const input: UpdateMusicSongLyricsInput = {
    content: payload.content,
    translation: payload.translation,
    format: payload.format,
    edit_summary: payload.editSummary,
  }

  await attemptLyricsSave(input)
}

async function attemptLyricsSave(input: UpdateMusicSongLyricsInput) {
  try {
    await save(props.songId, input)
    pendingLyricsInput.value = null
    conflictAnnotationIds.value = []
    isLyricEditorOpen.value = false
  } catch (error) {
    const annotationIds = error instanceof ApiErrorResponseError
      && error.status === 409
      && error.code === 'music.annotation_anchor_conflict'
      && Array.isArray(error.details.annotation_ids)
      ? error.details.annotation_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []
    if (annotationIds.length === 0) return

    errorMessage.value = ''
    pendingLyricsInput.value = input
    conflictAnnotationIds.value = annotationIds
  }
}

async function confirmLyricsConflict() {
  if (!pendingLyricsInput.value || conflictAnnotationIds.value.length === 0) return
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
  await attemptLyricsSave(input)
}

function cancelLyricsConflict() {
  conflictAnnotationIds.value = []
  pendingLyricsInput.value = null
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
  background: color-mix(in srgb, var(--a-color-bg) 94%, #efe5d5 6%);
  border-top: 1px solid var(--a-color-border-soft);
  z-index: var(--a-z-player-lyrics);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
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
