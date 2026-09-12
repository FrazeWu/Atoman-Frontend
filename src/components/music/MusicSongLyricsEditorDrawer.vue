<script setup lang="ts">
import { ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import type { MusicLyricsFormat, MusicLyricsSaveTarget, MusicSongLyrics, UpdateMusicSongLyricsInput } from '@/api/musicV1'
import { useMusicLyrics } from '@/composables/useMusicLyrics'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
import PConfirm from '@/components/ui/PConfirm.vue'

const props = defineProps<{
  show: boolean
  songId: string
  songTitle: string
  currentTimeSeconds?: number
}>()

const emit = defineEmits<{
  close: []
  seek: [timeSeconds: number]
  saved: [lyrics: MusicSongLyrics]
}>()

const { lyrics, loading, saving, load, save } = useMusicLyrics()
const saveError = ref('')
const editorDirty = ref(false)
const pendingClose = ref(false)
const pendingInput = ref<UpdateMusicSongLyricsInput | null>(null)
const conflictingAnnotationIds = ref<string[]>([])

watch(
  () => [props.show, props.songId] as const,
  ([show, songId]) => {
    if (show && songId) void load(songId)
  },
  { immediate: true },
)

watch(() => props.show, (show) => {
  if (!show) {
    editorDirty.value = false
    pendingClose.value = false
    saveError.value = ''
  }
})

function requestClose() {
  if (editorDirty.value) {
    pendingClose.value = true
    return
  }
  emit('close')
}

function confirmClose() {
  pendingClose.value = false
  editorDirty.value = false
  emit('close')
}

function cancelClose() {
  pendingClose.value = false
}

async function handleSave(payload: {
  target: MusicLyricsSaveTarget
  language?: string
  translationIncluded?: boolean
  baseVersion: number
  content: string
  translation: string
  format: MusicLyricsFormat
  lines: UpdateMusicSongLyricsInput['lines']
  editSummary: string
}) {
  const input: UpdateMusicSongLyricsInput = {
    target: payload.target,
    base_version: payload.baseVersion,
    content: payload.content,
    translation: payload.translation,
    format: payload.format,
    language: payload.language,
    translation_included: payload.translationIncluded,
    lines: payload.lines,
    edit_summary: payload.editSummary,
  }
  try {
    saveError.value = ''
    const updated = await save(props.songId, input)
    editorDirty.value = false
    emit('saved', updated)
    emit('close')
  } catch (error) {
    if (error instanceof ApiErrorResponseError && error.status === 409 && error.code === 'music.annotation_anchor_conflict') {
      const annotationIds = Array.isArray(error.details.annotation_ids)
        ? error.details.annotation_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : []
      if (annotationIds.length > 0) {
        pendingInput.value = input
        conflictingAnnotationIds.value = annotationIds
        return
      }
    }
    saveError.value = error instanceof ApiErrorResponseError && error.code === 'music.lyrics_version_conflict'
      ? '歌词已被其他用户更新，请重新打开'
      : '歌词保存失败，请重试'
  }
}

async function confirmAnnotationConflict() {
  if (!pendingInput.value || conflictingAnnotationIds.value.length === 0) return
  const input: UpdateMusicSongLyricsInput = {
    ...pendingInput.value,
    annotation_resolutions: conflictingAnnotationIds.value.map(annotationId => ({
      annotation_id: annotationId,
      action: 'needs_rebind',
    })),
  }
  pendingInput.value = null
  conflictingAnnotationIds.value = []
  try {
    saveError.value = ''
    const updated = await save(props.songId, input)
    editorDirty.value = false
    emit('saved', updated)
    emit('close')
  } catch {
    saveError.value = '歌词保存失败，请重试'
  }
}

function cancelAnnotationConflict() {
  pendingInput.value = null
  conflictingAnnotationIds.value = []
}
</script>

<template>
  <MusicLyricEditorDrawer
    :show="show"
    :song-title="songTitle"
    :content="lyrics?.content ?? ''"
    :translation="lyrics?.translation ?? ''"
    :format="lyrics?.format ?? 'plain'"
    :lines="lyrics?.lines ?? []"
    :version="lyrics?.version ?? 0"
    :translation-language="lyrics?.translation_language ?? ''"
    :source="lyrics?.source ?? ''"
    :save-error="saveError"
    :current-time-seconds="currentTimeSeconds"
    :saving="saving || loading"
    @close="requestClose"
    @dirty-change="editorDirty = $event"
    @seek="emit('seek', $event)"
    @save="handleSave"
  />
  <PConfirm
    above-player
    :show="pendingClose"
    title="放弃歌词修改？"
    message="未保存的歌词修改将丢失。"
    confirm-text="放弃并关闭"
    cancel-text="继续编辑"
    danger
    @confirm="confirmClose"
    @cancel="cancelClose"
  />
  <PConfirm
    above-player
    :show="conflictingAnnotationIds.length > 0"
    title="部分注释需要重新定位"
    message="保存后，这些注释会进入待重新绑定状态。"
    confirm-text="继续保存"
    cancel-text="取消"
    :loading="saving"
    @confirm="confirmAnnotationConflict"
    @cancel="cancelAnnotationConflict"
  />
</template>
