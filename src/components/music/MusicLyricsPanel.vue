<template>
  <section class="music-lyrics-panel">
    <MusicLyricsHeader
      :is-read-only-annotations="isReadOnlyAnnotations"
      :is-annotation-mode="isAnnotationMode"
      :is-player-mode="isPlayerMode"
      :is-pip-supported="isPiPSupported"
      :is-pip-active="isPiPActive"
      :saving="saving"
      :reverting="reverting"
      @open-song-detail="emit('open-song-detail')"
      @toggle-annotation-overview="openAnnotationOverview"
      @toggle-versions="toggleVersions"
      @open-editor="openLyricEditor"
      @toggle-pip="togglePictureInPicture"
      @close="emit('close')"
    />

    <p v-if="errorMessage" class="music-lyrics-panel__feedback">
      {{ errorMessage }}
    </p>

    <MusicLyricsVersionHistory
      v-if="versionsVisible"
      :versions="versions"
      :versions-loading="versionsLoading"
      :versions-error-message="versionsErrorMessage"
      :versions-song-id="versionsSongId"
      :song-id="songId"
      :selected-version-preview="selectedVersionPreview"
      :saving="saving"
      :reverting="reverting"
      @select-preview="selectVersionPreview"
      @revert="handleRevertVersion"
    />

    <div class="music-lyrics-panel__layout">
      <MusicLyricsScroller
        :song-title="songTitle"
        :credit-groups="creditGroups"
        :active-annotation-count="activeAnnotationCount"
        :lyrics="lyrics"
        :loading="loading"
        :annotations-by-line="annotationsByLine"
        :current-line-id="currentLineId"
        :is-player-mode="isPlayerMode"
        :is-annotation-mode="isAnnotationMode"
        :is-authenticated="isAuthenticated"
        :has-translation="hasTranslation"
        :display-mode="displayMode"
        @update:display-mode="displayMode = $event"
        @select-text="handleSelectText"
        @open-annotations="handleOpenAnnotations"
        @seek="emit('seek', $event)"
      />

      <Transition name="lyrics-annotation-panel">
        <aside v-if="!isMobileViewport" class="music-lyrics-panel__sidebar" aria-label="歌词注解">
          <MusicAnnotationWorkspace
            :annotations="visibleAnnotations"
            :can-write="isAuthenticated && isAnnotationMode && !isReadOnlyAnnotations"
            :current-user-ids="currentUserIds"
            :total-count="activeAnnotationCount"
            :selection-mode="Boolean(rebindingAnnotation)"
            :editor-visible="annotationEditorVisible"
            :selected-text="annotationSelectedText"
            :initial-body="annotationInitialBody"
            :editor-mode="annotationEditorMode"
            @vote="handleVoteAnnotation"
            @edit="handleEditAnnotation"
            @delete="handleDeleteAnnotation"
            @rebind="handleRebindAnnotation"
            @save="handleSaveAnnotation"
            @cancel="handleCancelAnnotation"
            @confirm-rebind="handleConfirmRebind"
          />
        </aside>
      </Transition>
    </div>

    <section
      v-if="isMobileViewport && isReadOnlyAnnotations"
      class="music-lyrics-panel__mobile-annotations"
      aria-label="歌词解析"
    >
      <MusicAnnotationWorkspace
        :annotations="visibleAnnotations"
        :can-write="false"
        :current-user-ids="currentUserIds"
        :total-count="activeAnnotationCount"
        :selection-mode="Boolean(rebindingAnnotation)"
        :editor-visible="annotationEditorVisible"
        :selected-text="annotationSelectedText"
        :initial-body="annotationInitialBody"
        :editor-mode="annotationEditorMode"
        @vote="handleVoteAnnotation"
        @edit="handleEditAnnotation"
        @delete="handleDeleteAnnotation"
        @rebind="handleRebindAnnotation"
        @save="handleSaveAnnotation"
        @cancel="handleCancelAnnotation"
        @confirm-rebind="handleConfirmRebind"
      />
    </section>
    <PSheet
      v-else-if="isMobileViewport && isAnnotationMode && !isReadOnlyAnnotations"
      :show="mobileAnnotationOpen"
      side="bottom"
      :title="songTitle.trim() ? `歌词解析-${songTitle.trim()}` : '歌词解析-歌曲'"
      height="min(78dvh, 42rem)"
      close-type="header"
      above-player
      @close="closeMobileAnnotations"
    >
      <MusicAnnotationWorkspace
        :annotations="visibleAnnotations"
        :can-write="isAuthenticated"
        :current-user-ids="currentUserIds"
        :total-count="activeAnnotationCount"
        :selection-mode="Boolean(rebindingAnnotation)"
        :editor-visible="annotationEditorVisible"
        :selected-text="annotationSelectedText"
        :initial-body="annotationInitialBody"
        :editor-mode="annotationEditorMode"
        @vote="handleVoteAnnotation"
        @edit="handleEditAnnotation"
        @delete="handleDeleteAnnotation"
        @rebind="handleRebindAnnotation"
        @save="handleSaveAnnotation"
        @cancel="handleCancelAnnotation"
        @confirm-rebind="handleConfirmRebind"
      />
    </PSheet>

    <MusicLyricEditorDrawer
      v-if="isAuthenticated && isAnnotationMode && !isReadOnlyAnnotations && (presentation === 'sheet' || isLyricEditorOpen)"
      :presentation="mobilePage ? 'page' : 'sheet'"
      :show="isLyricEditorOpen"
      :song-title="songTitle"
      :content="lyrics?.content ?? ''"
      :translation="lyrics?.translation ?? ''"
      :format="lyrics?.format ?? 'plain'"
      :lines="lyrics?.lines ?? []"
      :version="lyrics?.version ?? 0"
      :translation-language="lyrics?.translation_language ?? ''"
      :source="lyrics?.source ?? ''"
      :saving="saving || reverting"
      :current-time-seconds="currentTimeSeconds"
      @close="requestEditorClose"
      @dirty-change="editorDirty = $event"
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

    <PConfirm
      :show="pendingClose !== null"
      title="放弃歌词修改？"
      message="未保存的歌词修改将丢失。"
      confirm-text="放弃并关闭"
      cancel-text="继续编辑"
      danger
      above-player
      @confirm="confirmPendingClose"
      @cancel="pendingClose = null"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { usePictureInPictureLyrics } from '@/composables/usePictureInPictureLyrics'
import { ApiErrorResponseError } from '@/api/client'
import {
  getMusicSongDetail,
  type MusicSongDetail,
  type MusicLyricsAnnotation,
  type MusicLyricsFormat,
  type MusicLyricsSaveTarget,
  type MusicSongLyricsLine,
  type UpdateMusicSongLyricsInput,
} from '@/api/musicV1'
import MusicAnnotationWorkspace from '@/components/music/MusicAnnotationWorkspace.vue'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
import MusicLyricsHeader from '@/components/music/lyrics/MusicLyricsHeader.vue'
import MusicLyricsVersionHistory from '@/components/music/lyrics/MusicLyricsVersionHistory.vue'
import MusicLyricsScroller from '@/components/music/lyrics/MusicLyricsScroller.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicLyrics } from '@/composables/useMusicLyrics'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { removePendingMusicLyricsAnnotation } from '@/composables/usePendingMusicLyricsAnnotations'
import { useAuthStore } from '@/stores/auth'
import { buildMusicLyricsVersionPreview } from '@/utils/musicLyricsVersionDiff'
import { albumArtistRoleLabels } from '@/utils/musicAlbumCredits'

const props = defineProps<{
  songId: string
  songTitle: string
  artistText: string
  currentTimeSeconds: number
  focusAnnotationId?: string
  startRebind?: boolean
  presentation?: 'sheet' | 'page'
  mode?: 'annotation' | 'player'
  readOnlyAnnotations?: boolean
}>()

const emit = defineEmits<{
  close: []
  seek: [timeSeconds: number]
  'mode-change': [mode: 'annotation' | 'player']
  'open-song-detail': []
}>()

const mobilePage = computed(() => props.presentation === 'page')
const isPlayerMode = computed(() => props.mode === 'player' || props.readOnlyAnnotations === true)
const isAnnotationMode = computed(() => !isPlayerMode.value)
const isReadOnlyAnnotations = computed(() => Boolean(props.readOnlyAnnotations || isPlayerMode.value))

const authStore = useAuthStore()
const { requireLogin } = useLoginRedirect()

const {
  lyrics,
  loading,
  saving,
  reverting,
  errorMessage,
  versionsErrorMessage,
  versions,
  versionsSongId,
  versionsLoading,
  annotationsByLine,
  load,
  save,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  voteAnnotation,
  loadVersions,
  resetVersions,
  revertVersion,
  currentLine,
} = useMusicLyrics()

const { isPiPActive, isPiPSupported, togglePictureInPicture } = usePictureInPictureLyrics({
  songTitle: computed(() => props.songTitle),
  artistText: computed(() => props.artistText),
  currentTimeSeconds: computed(() => props.currentTimeSeconds),
  lines: computed(() => (lyrics.value?.lines ?? []).map((l) => ({
    text: l.text,
    translation: l.translation || '',
    time_ms: l.time_ms ?? undefined,
  }))),
})

const selectedAnnotationIds = ref<string[]>([])
const mobileAnnotationOpen = ref(false)
const isMobileViewport = ref(false)
const selectedTextDraft = ref<{
  line: MusicSongLyricsLine
  selectedText: string
  startOffset: number
  endOffset: number
  startLineKey?: string
  endLineKey?: string
  startLineId?: string
  endLineId?: string
} | null>(null)
const editingAnnotation = ref<MusicLyricsAnnotation | null>(null)
const rebindingAnnotation = ref<MusicLyricsAnnotation | null>(null)
const isLyricEditorOpen = ref(false)
const editorDirty = ref(false)
const pendingClose = ref<'editor' | 'lyrics' | null>(null)
const versionsVisible = ref(false)
const selectedVersionNumber = ref<number | null>(null)
const displayMode = ref<'original' | 'bilingual'>('bilingual')
const pendingLyricsInput = ref<UpdateMusicSongLyricsInput | null>(null)
const conflictAnnotationIds = ref<string[]>([])
const pendingLyricsSongId = ref('')
const songCredits = ref<MusicSongDetail['artists']>([])
let pendingLyricsSaveGeneration = 0
let activeLyricsSaveGeneration = 0
let versionsViewGeneration = 0
let rebindOperationGeneration = 0
let songCreditsGeneration = 0
let mobileViewportQuery: MediaQueryList | null = null

function syncMobileViewport() {
  isMobileViewport.value = mobileViewportQuery?.matches ?? false
  if (!isMobileViewport.value) mobileAnnotationOpen.value = false
}

onMounted(() => {
  mobileViewportQuery = window.matchMedia?.('(max-width: 900px)') ?? null
  syncMobileViewport()
  mobileViewportQuery?.addEventListener('change', syncMobileViewport)
})

onBeforeUnmount(() => {
  mobileViewportQuery?.removeEventListener('change', syncMobileViewport)
})

const isAuthenticated = computed(() => Boolean(authStore.isAuthenticated))
const currentUserIds = computed(() => collectIdentityValues(authStore.user as Record<string, unknown> | null))
const activeTimedLine = computed(() => {
  if (!isPlayerMode.value) return null
  const line = currentLine(props.currentTimeSeconds)
  const startTime = line?.time_ms ?? line?.startTimeMs
  return typeof startTime === 'number' ? line : null
})
const currentLineId = computed(() => activeTimedLine.value?.line_key ?? activeTimedLine.value?.id ?? '')
const hasTranslation = computed(() => Boolean(lyrics.value?.translation.trim()))
const activeAnnotationCount = computed(() => (
  lyrics.value?.annotations.filter((annotation) => annotation.status === 'active').length ?? 0
))
const creditGroups = computed(() => {
  const groups = new Map<string, { role: string; label: string; names: string[] }>()

  for (const credit of songCredits.value) {
    const role = credit.role === 'custom'
      ? `custom:${credit.custom_role?.trim() || '其他'}`
      : credit.role
    const label = credit.role === 'custom'
      ? credit.custom_role?.trim() || '其他'
      : credit.role === 'primary'
        ? '艺术家'
        : albumArtistRoleLabels[credit.role]
    const group = groups.get(role) ?? { role, label, names: [] }
    if (!group.names.includes(credit.name)) group.names.push(credit.name)
    groups.set(role, group)
  }

  if (!groups.size && props.artistText.trim()) {
    groups.set('primary', { role: 'primary', label: '艺术家', names: [props.artistText.trim()] })
  }

  return [...groups.values()]
})
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
  const annotations = isReadOnlyAnnotations.value
    ? selectedAnnotations.value
    : [...selectedAnnotations.value, ...rebindableAnnotations.value]
  return annotations.filter((annotation) => {
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
    mobileAnnotationOpen.value = false
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
    void loadSongCredits(songId)
  },
  { immediate: true },
)

async function loadSongCredits(songId: string) {
  const generation = ++songCreditsGeneration
  songCredits.value = []
  try {
    const detail = await getMusicSongDetail(songId)
    if (generation === songCreditsGeneration && props.songId === songId) {
      songCredits.value = detail.artists
    }
  } catch {
    // 歌词仍可使用播放器已有的艺术家信息展示。
  }
}

watch(
  () => [props.focusAnnotationId, props.startRebind, lyrics.value?.song_id, lyrics.value?.annotations] as const,
  async ([annotationId, startRebind]) => {
    if (!annotationId || !lyrics.value) return
    if (isPlayerMode.value && !isReadOnlyAnnotations.value) emit('mode-change', 'annotation')
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
  if (isMobileViewport.value) mobileAnnotationOpen.value = true
}

function openAnnotationOverview() {
  if (isPlayerMode.value) {
    emit('mode-change', 'annotation')
    if (isMobileViewport.value) mobileAnnotationOpen.value = true
    return
  }
  mobileAnnotationOpen.value = false
  handleCancelAnnotation()
  emit('mode-change', 'player')
}

function openLyricEditor() {
  if (!requireLogin()) return
  isLyricEditorOpen.value = true
}

function closeLyrics() {
  isLyricEditorOpen.value = false
  editorDirty.value = false
  emit('close')
}

function requestClose() {
  if (isLyricEditorOpen.value && editorDirty.value) {
    pendingClose.value = 'lyrics'
    return
  }
  closeLyrics()
}

function requestEditorClose() {
  if (editorDirty.value) {
    pendingClose.value = 'editor'
    return
  }
  isLyricEditorOpen.value = false
}

function confirmPendingClose() {
  const target = pendingClose.value
  pendingClose.value = null
  if (target === 'lyrics') {
    closeLyrics()
    return
  }
  if (target === 'editor') {
    isLyricEditorOpen.value = false
    editorDirty.value = false
  }
}

defineExpose({ requestClose })

function handleSelectText(payload: {
  line: MusicSongLyricsLine
  selectedText: string
  startOffset: number
  endOffset: number
  startLineKey?: string
  endLineKey?: string
  startLineId?: string
  endLineId?: string
}) {
  if (!isAuthenticated.value) return
  if (rebindingAnnotation.value) rebindOperationGeneration += 1
  editingAnnotation.value = null
  selectedAnnotationIds.value = []
  selectedTextDraft.value = payload
  if (isMobileViewport.value) mobileAnnotationOpen.value = true
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

  const draft = selectedTextDraft.value
  const lineKey = draft.line.line_key || draft.line.id
  if (!lineKey) return
  const hasRange = Boolean(
    (draft.startLineKey && draft.endLineKey && draft.startLineKey !== draft.endLineKey)
    || (draft.startLineId && draft.endLineId && draft.startLineId !== draft.endLineId),
  )
  const rangeInput = hasRange
    ? {
        ...(draft.startLineKey ? { start_line_key: draft.startLineKey } : {}),
        ...(draft.startLineId ? { start_line_id: draft.startLineId } : {}),
        ...(draft.endLineKey ? { end_line_key: draft.endLineKey } : {}),
        ...(draft.endLineId ? { end_line_id: draft.endLineId } : {}),
      }
    : draft.line.line_key
      ? { line_key: draft.line.line_key }
      : draft.line.id
        ? { line_id: draft.line.id }
        : { line_key: lineKey }

  const annotation = await createAnnotation(props.songId, {
    ...rangeInput,
    selected_text: draft.selectedText,
    start_offset: draft.startOffset,
    end_offset: draft.endOffset,
    body,
  })

  selectedTextDraft.value = null
  if (annotation?.id) selectedAnnotationIds.value = [annotation.id]
}

function handleRebindAnnotation(annotation: MusicLyricsAnnotation) {
  if (!canManageAnnotation(annotation) || annotation.status !== 'needs_rebind') return
  clearRebindState()
  editingAnnotation.value = null
  rebindingAnnotation.value = annotation
  if (isMobileViewport.value) mobileAnnotationOpen.value = false
}

async function handleConfirmRebind() {
  if (!isAuthenticated.value || !rebindingAnnotation.value || !selectedTextDraft.value) return
  const lineKey = selectedTextDraft.value.line.line_key ?? selectedTextDraft.value.line.id
  if (!lineKey) return
  const rangeInput = selectedTextDraft.value.startLineKey && selectedTextDraft.value.endLineKey
    ? {
        start_line_key: selectedTextDraft.value.startLineKey,
        end_line_key: selectedTextDraft.value.endLineKey,
      }
    : { line_key: lineKey }

  const annotation = rebindingAnnotation.value
  const songId = props.songId
  const operationGeneration = ++rebindOperationGeneration
  try {
    await updateAnnotation(songId, annotation.id, {
      ...rangeInput,
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
  if (isMobileViewport.value) mobileAnnotationOpen.value = true
}

function closeMobileAnnotations() {
  mobileAnnotationOpen.value = false
  handleCancelAnnotation()
  emit('mode-change', 'player')
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
  if (!requireLogin()) return
  if (
    saving.value
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
  target: MusicLyricsSaveTarget
  language?: string
  translationIncluded?: boolean
  baseVersion: number
  content: string
  translation: string
  format: MusicLyricsFormat
  lines: Array<{ line_key?: string, text: string, translation: string, time_ms: number | null }>
  editSummary: string
}) {
  if (!requireLogin() || saving.value || reverting.value) return
  const input: UpdateMusicSongLyricsInput = {
    target: payload.target,
    base_version: payload.baseVersion,
    lines: payload.lines,
    content: payload.content,
    translation: payload.translation,
    format: payload.format,
    edit_summary: payload.editSummary,
    ...(payload.language ? { language: payload.language } : {}),
    ...(payload.translationIncluded !== undefined
      ? { translation_included: payload.translationIncluded }
      : {}),
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
    if (error instanceof ApiErrorResponseError && error.status === 409 && error.code === 'music.lyrics_version_conflict') {
      errorMessage.value = '歌词已被其他用户更新，请重新打开编辑器'
      return
    }
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
/* Contract requirement: z-index: var(--a-z-player-lyrics); */
@import './styles/musicLyrics.css';
</style>
