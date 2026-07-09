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
      <p v-else-if="!versions.length" class="music-lyrics-panel__placeholder">暂无版本</p>
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
        <p v-if="loading" class="music-lyrics-panel__placeholder">加载中</p>
        <p v-else-if="!lyrics?.lines.length" class="music-lyrics-panel__placeholder">暂无歌词</p>

        <div v-else class="music-lyrics-panel__lines">
          <MusicLyricsLine
            v-for="line in lyrics.lines"
            :key="line.line_key ?? line.id ?? line.text"
            :line="line"
            :annotations="annotationsByLine.get(line.line_key ?? line.id ?? '') ?? []"
            :active="currentLineId === (line.line_key ?? line.id ?? '')"
            :bilingual="showTranslation"
            @select-text="handleSelectText"
            @open-annotations="handleOpenAnnotations"
          />
        </div>
      </div>

      <aside v-if="showSidebar" class="music-lyrics-panel__sidebar">
        <MusicAnnotationPanel
          v-if="selectedAnnotations.length"
          :annotations="selectedAnnotations"
          @vote="handleVoteAnnotation"
          @edit="handleEditAnnotation"
          @delete="handleDeleteAnnotation"
        />

        <MusicAnnotationEditor
          :show="annotationEditorVisible"
          :selected-text="annotationSelectedText"
          :initial-body="annotationInitialBody"
          @save="handleSaveAnnotation"
          @cancel="handleCancelAnnotation"
        />
      </aside>
    </div>

    <MusicLyricEditorDrawer
      :show="isLyricEditorOpen"
      :content="lyrics?.content ?? ''"
      :translation="lyrics?.translation ?? ''"
      :format="lyrics?.format ?? 'plain'"
      :saving="saving"
      @close="isLyricEditorOpen = false"
      @save="handleSaveLyrics"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import { useMusicLyrics } from '@/composables/useMusicLyrics'

const props = defineProps<{
  songId: string
  songTitle: string
  artistText: string
  currentTimeSeconds: number
}>()

const emit = defineEmits<{
  close: []
}>()

const {
  lyrics,
  loading,
  saving,
  errorMessage,
  annotationsByLine,
  load,
  save,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  voteAnnotation,
  versions,
  versionsLoading,
  loadVersions,
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

const currentLineId = computed(() => currentLine(props.currentTimeSeconds)?.line_key ?? currentLine(props.currentTimeSeconds)?.id ?? '')
const showTranslation = computed(() => Boolean(lyrics.value?.translation.trim()))
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
    selectedAnnotationIds.value = []
    selectedTextDraft.value = null
    editingAnnotation.value = null
    isLyricEditorOpen.value = false
    versionsVisible.value = false
    void load(songId)
  },
  { immediate: true },
)

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
  editingAnnotation.value = null
  selectedAnnotationIds.value = []
  selectedTextDraft.value = payload
}

function handleCancelAnnotation() {
  selectedTextDraft.value = null
  editingAnnotation.value = null
}

async function handleSaveAnnotation(body: string) {
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
  selectedTextDraft.value = null
  editingAnnotation.value = annotation
}

async function handleDeleteAnnotation(annotationId: string) {
  await deleteAnnotation(props.songId, annotationId)
  selectedAnnotationIds.value = selectedAnnotationIds.value.filter((id) => id !== annotationId)
}

async function handleVoteAnnotation(annotationId: string, vote: 'up' | 'down' | null) {
  await voteAnnotation(props.songId, annotationId, vote)
}

async function toggleVersions() {
  versionsVisible.value = !versionsVisible.value
  if (versionsVisible.value) await loadVersions(props.songId)
}

async function handleRevertVersion(version: number) {
  await revertVersion(props.songId, version, `恢复到第 ${version} 版`)
  versionsVisible.value = false
}

async function handleSaveLyrics(payload: {
  content: string
  translation: string
  format: 'plain' | 'lrc'
  editSummary: string
}) {
  const input: UpdateMusicSongLyricsInput = {
    content: payload.content,
    translation: payload.translation,
    format: payload.format,
    edit_summary: payload.editSummary,
  }

  await save(props.songId, input)
  isLyricEditorOpen.value = false
}
</script>

<style scoped>
.music-lyrics-panel {
  position: fixed;
  top: 56px;
  right: 0;
  bottom: 84px;
  left: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 1rem;
  padding: 1.5rem 2rem 2rem;
  background: color-mix(in srgb, var(--a-color-paper) 94%, #efe5d5 6%);
  border-top: 1px solid var(--a-color-line-soft);
  z-index: 2000;
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
  color: var(--a-color-ink-soft);
  font-family: var(--a-font-meta);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-lyrics-panel__heading h2 {
  margin: 0;
  color: var(--a-color-ink);
  font-family: var(--a-font-serif);
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
  color: var(--a-color-ink);
  cursor: pointer;
  font-family: var(--a-font-meta);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.music-lyrics-panel__feedback,
.music-lyrics-panel__placeholder {
  margin: 0;
  color: var(--a-color-ink-soft);
}

.music-lyrics-panel__versions {
  border: 1px solid var(--a-color-line-soft);
  background: var(--a-color-paper-wash);
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
  color: var(--a-color-ink);
}

.music-lyrics-panel__version div {
  display: grid;
  gap: 0.2rem;
}

.music-lyrics-panel__version span {
  color: var(--a-color-ink-soft);
  font-size: 0.82rem;
}

.music-lyrics-panel__version-action {
  border: 0;
  background: transparent;
  color: var(--a-color-ink);
  cursor: pointer;
  font-family: var(--a-font-meta);
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

.music-lyrics-panel__lines {
  display: grid;
  gap: 0.2rem;
}

.music-lyrics-panel__sidebar {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 1rem;
  border-left: 1px solid var(--a-color-line-soft);
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
    border-top: 1px solid var(--a-color-line-soft);
    border-left: 0;
    padding-top: 1rem;
    padding-left: 0;
  }
}
</style>
