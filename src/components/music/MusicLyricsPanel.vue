<template>
  <section class="music-lyrics-panel">
    <header class="music-lyrics-panel__header">
      <div class="music-lyrics-panel__actions">
        <PButton
          class="music-lyrics-panel__action-btn"
          type="button"
          variant="secondary"
          data-testid="lyrics-annotations-trigger"
          @click="openAnnotationOverview"
        >
          <MessageSquareText :size="16" aria-hidden="true" />
          解析 {{ activeAnnotationCount }}
        </PButton>
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
          type="button"
          variant="secondary"
          :disabled="saving || reverting"
          data-testid="lyrics-edit-trigger"
          @click="openLyricEditor"
        >
          编辑歌词
        </PButton>
        <button
          type="button"
          class="music-lyrics-panel__close"
          aria-label="关闭歌词"
          title="关闭歌词"
          @click="emit('close')"
        >
          <X :size="18" aria-hidden="true" />
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
                :class="[
                  `is-${line.kind}`,
                  { 'is-translation-only': line.kind === 'modified' && line.current?.text === line.target?.text },
                ]"
              >
                <span>{{ versionDiffLabel(line.kind) }}</span>
                <template v-if="line.kind === 'modified' && line.current && line.target && line.current.text === line.target.text">
                  <span class="music-lyrics-panel__version-diff-original">{{ line.current.text }}</span>
                  <del class="music-lyrics-panel__version-diff-translation">当前译文：{{ line.current.translation || '无译文' }}</del>
                  <ins class="music-lyrics-panel__version-diff-translation">目标译文：{{ line.target.translation || '无译文' }}</ins>
                </template>
                <template v-else>
                  <del v-if="line.current && line.kind !== 'unchanged'">{{ line.current.text }}</del>
                  <ins v-if="line.target && line.kind !== 'removed'">{{ line.target.text }}</ins>
                </template>
              </p>
            </div>
            <button
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
        <section class="music-lyrics-panel__song-info" aria-label="歌曲信息">
          <p class="music-lyrics-panel__eyebrow">歌词 · {{ activeAnnotationCount }} 条注释</p>
          <h2>{{ songTitle }}</h2>
          <dl class="music-lyrics-panel__credits">
            <div v-for="group in creditGroups" :key="group.role">
              <dt>{{ group.label }}</dt>
              <dd>{{ group.names.join(' / ') }}</dd>
            </div>
          </dl>
        </section>

        <div v-if="hasTranslation" class="music-lyrics-panel__display-mode">
          <PSegmentedControl v-model="displayMode" :options="displayModeOptions" />
        </div>
        <p v-if="loading" class="music-lyrics-panel__placeholder">加载中</p>
        <p v-else-if="!lyrics?.lines.length" class="music-lyrics-panel__placeholder">暂无歌词</p>

        <div v-else ref="lyricsLinesElement" class="music-lyrics-panel__lines" @wheel="handleUserScroll" @touchmove="handleUserScroll">
          <MusicLyricsLine
            v-for="line in lyrics.lines"
            :key="line.line_key ?? line.id ?? line.text"
            :line="line"
            :annotations="annotationsByLine.get(line.line_key ?? line.id ?? '') ?? []"
            :active="currentLineId === (line.line_key ?? line.id ?? '')"
            :bilingual="showTranslation"
            :can-select="isAuthenticated"
            :can-annotate="isAuthenticated"
            :annotation-mode="annotationSelectionMode"
            @select-text="handleSelectText"
            @open-annotations="handleOpenAnnotations"
            @annotate-line="handleAnnotateLine"
          />
          <button
            v-if="isUserScrolling"
            type="button"
            class="lyrics-sync-btn"
            @click="resumeAutoScroll"
          >
            <LocateFixed :size="16" aria-hidden="true" />
            回到当前播放
          </button>
        </div>
      </div>

      <aside v-if="!isMobileViewport" class="music-lyrics-panel__sidebar" aria-label="歌词解析">
        <MusicAnnotationWorkspace
          :annotations="visibleAnnotations"
          :can-write="isAuthenticated"
          :current-user-ids="currentUserIds"
          :total-count="activeAnnotationCount"
          :selection-mode="annotationSelectionMode"
          :editor-visible="annotationEditorVisible"
          :selected-text="annotationSelectedText"
          :initial-body="annotationInitialBody"
          :editor-mode="annotationEditorMode"
          @create="startAnnotationSelection"
          @vote="handleVoteAnnotation"
          @edit="handleEditAnnotation"
          @delete="handleDeleteAnnotation"
          @rebind="handleRebindAnnotation"
          @save="handleSaveAnnotation"
          @cancel="handleCancelAnnotation"
          @confirm-rebind="handleConfirmRebind"
        />
      </aside>
    </div>

    <PSheet
      v-if="isMobileViewport"
      :show="mobileAnnotationOpen"
      side="bottom"
      title="歌词解析"
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
        :selection-mode="annotationSelectionMode"
        :editor-visible="annotationEditorVisible"
        :selected-text="annotationSelectedText"
        :initial-body="annotationInitialBody"
        :editor-mode="annotationEditorMode"
        @create="startAnnotationSelection"
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
      v-if="isAuthenticated"
      :show="isLyricEditorOpen"
      :song-title="songTitle"
      :content="lyrics?.content ?? ''"
      :translation="lyrics?.translation ?? ''"
      :format="lyrics?.format ?? 'plain'"
      :lines="lyrics?.lines ?? []"
      :version="lyrics?.version ?? 0"
      :translation-language="lyrics?.translation_language ?? ''"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LocateFixed, MessageSquareText, X } from 'lucide-vue-next'
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
import MusicLyricsLine from '@/components/music/MusicLyricsLine.vue'
import PButton from '@/components/ui/PButton.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PSegmentedControl from '@/components/ui/PSegmentedControl.vue'
import PSheet from '@/components/ui/PSheet.vue'
import { useMusicLyrics } from '@/composables/useMusicLyrics'
import { useLoginRedirect } from '@/composables/useLoginRedirect'
import { removePendingMusicLyricsAnnotation } from '@/composables/usePendingMusicLyricsAnnotations'
import { useAuthStore } from '@/stores/auth'
import { buildMusicLyricsVersionPreview, type MusicLyricsVersionDiffKind } from '@/utils/musicLyricsVersionDiff'
import { albumArtistRoleLabels } from '@/utils/musicAlbumCredits'

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
const { requireLogin } = useLoginRedirect()

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
const annotationSelectionMode = ref(false)
const mobileAnnotationOpen = ref(false)
const isMobileViewport = ref(false)
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
const isUserScrolling = ref(false)
const songCredits = ref<MusicSongDetail['artists']>([])
let scrollLockTimer: ReturnType<typeof setTimeout> | null = null
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
  if (scrollLockTimer) clearTimeout(scrollLockTimer)
})

function handleUserScroll() {
  isUserScrolling.value = true
  if (scrollLockTimer) clearTimeout(scrollLockTimer)
  scrollLockTimer = setTimeout(() => {
    isUserScrolling.value = false
    scrollToActiveLine()
  }, 4000)
}

function resumeAutoScroll() {
  if (scrollLockTimer) clearTimeout(scrollLockTimer)
  isUserScrolling.value = false
  scrollToActiveLine()
}

function scrollToActiveLine() {
  if (isUserScrolling.value || !lyricsLinesElement.value || !currentLineId.value) return
  const activeEl = lyricsLinesElement.value.querySelector('.music-lyrics-line.is-active') as HTMLElement | null
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const displayModeOptions = [
  { label: '原文', value: 'original' },
  { label: '翻译', value: 'bilingual' },
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
    annotationSelectionMode.value = false
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
  annotationSelectionMode.value = false
  selectedAnnotationIds.value = payload.annotationIds
  if (isMobileViewport.value) mobileAnnotationOpen.value = true
}

function openAnnotationOverview() {
  if (isMobileViewport.value) mobileAnnotationOpen.value = true
}

function startAnnotationSelection() {
  if (!requireLogin()) return
  clearRebindState()
  editingAnnotation.value = null
  selectedAnnotationIds.value = []
  annotationSelectionMode.value = true
  if (isMobileViewport.value) mobileAnnotationOpen.value = false
}

function handleAnnotateLine(line: MusicSongLyricsLine) {
  if (!requireLogin() || !line.text) return
  handleSelectText({
    line,
    selectedText: line.text,
    startOffset: 0,
    endOffset: line.text.length,
  })
}

function openLyricEditor() {
  if (!requireLogin()) return
  isLyricEditorOpen.value = true
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
  annotationSelectionMode.value = false
  selectedTextDraft.value = payload
  if (isMobileViewport.value) mobileAnnotationOpen.value = true
}

function handleCancelAnnotation() {
  clearRebindState()
  editingAnnotation.value = null
  annotationSelectionMode.value = false
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

  const annotation = await createAnnotation(props.songId, {
    line_key: lineKey,
    selected_text: selectedTextDraft.value.selectedText,
    start_offset: selectedTextDraft.value.startOffset,
    end_offset: selectedTextDraft.value.endOffset,
    body,
  })

  selectedTextDraft.value = null
  annotationSelectionMode.value = false
  if (annotation?.id) selectedAnnotationIds.value = [annotation.id]
}

function handleRebindAnnotation(annotation: MusicLyricsAnnotation) {
  if (!canManageAnnotation(annotation) || annotation.status !== 'needs_rebind') return
  clearRebindState()
  editingAnnotation.value = null
  rebindingAnnotation.value = annotation
  annotationSelectionMode.value = true
  if (isMobileViewport.value) mobileAnnotationOpen.value = false
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
  annotationSelectionMode.value = false
  editingAnnotation.value = annotation
  if (isMobileViewport.value) mobileAnnotationOpen.value = true
}

function closeMobileAnnotations() {
  mobileAnnotationOpen.value = false
  handleCancelAnnotation()
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
:root.dark .music-lyrics-panel {
  background: rgba(15, 23, 42, 0.88);
  border-top: 1px solid var(--a-color-border-dark, #334155);
}

.music-lyrics-panel__header {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  align-items: flex-start;
}

.music-lyrics-panel__song-info {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 2rem;
  min-width: 0;
}

.music-lyrics-panel__eyebrow {
  margin: 0;
  color: var(--a-color-muted);
  font-family: var(--a-font-sans);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-lyrics-panel__song-info h2 {
  margin: 0;
  color: var(--a-color-text);
  font-family: var(--a-font-sans);
  font-size: 1.8rem;
  font-weight: 900;
}

.music-lyrics-panel__credits {
  display: grid;
  gap: 0.3rem;
  margin: 0.25rem 0 0;
}

.music-lyrics-panel__credits div {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: 0.75rem;
}

.music-lyrics-panel__credits dt,
.music-lyrics-panel__credits dd {
  margin: 0;
  line-height: 1.5;
}

.music-lyrics-panel__credits dt {
  color: var(--a-color-muted);
  font-size: 0.75rem;
}

.music-lyrics-panel__credits dd {
  color: var(--a-color-text);
  font-size: 0.875rem;
}

.music-lyrics-panel__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.music-lyrics-panel__action-btn {
  border-radius: 4px !important;
}

.music-lyrics-panel__close {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--a-color-border-soft);
  padding: 0.5rem;
  background: transparent;
  color: var(--a-color-text);
  cursor: pointer;
  font-family: var(--a-font-sans);
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

.music-lyrics-panel__version-diff-line.is-translation-only {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
}

.music-lyrics-panel__version-diff-line.is-translation-only > span:first-child {
  grid-column: 1;
}

.music-lyrics-panel__version-diff-original,
.music-lyrics-panel__version-diff-translation {
  grid-column: 2;
}

.music-lyrics-panel__layout {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  gap: 1.25rem;
}

.music-lyrics-panel__main {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
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
  overflow: hidden;
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

  .music-lyrics-panel__main {
    padding-right: 0;
  }

  .music-lyrics-panel__sidebar {
    border-top: 1px solid var(--a-color-border-soft);
    border-left: 0;
    padding-top: 1rem;
    padding-left: 0;
  }
}

.lyrics-sync-btn {
  position: sticky;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--a-color-text);
  color: var(--a-color-bg);
  font-family: var(--a-font-sans);
  font-size: 12px;
  font-weight: 700;
  border: 0;
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
  cursor: pointer;
  z-index: 10;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.lyrics-sync-btn:hover {
  transform: translateX(-50%) scale(1.05);
}

@media (prefers-reduced-motion: reduce) {
  .lyrics-sync-btn {
    transition: none;
  }
}
</style>
