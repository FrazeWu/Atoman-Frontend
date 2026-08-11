<script setup lang="ts">
import { ref, watch } from 'vue'
import { ApiErrorResponseError } from '@/api/client'
import type { MusicLyricsFormat, MusicLyricsSaveTarget, UpdateMusicSongLyricsInput } from '@/api/musicV1'
import { useMusicLyrics } from '@/composables/useMusicLyrics'
import MusicLyricEditorDrawer from '@/components/music/MusicLyricEditorDrawer.vue'
import PConfirm from '@/components/ui/PConfirm.vue'
import PToast from '@/components/ui/PToast.vue'

const props = defineProps<{
  show: boolean
  songId: string
  songTitle: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { lyrics, loading, saving, load, save } = useMusicLyrics()
const toastVisible = ref(false)
const toastMessage = ref('')
const pendingInput = ref<UpdateMusicSongLyricsInput | null>(null)
const conflictingAnnotationIds = ref<string[]>([])

watch(
  () => [props.show, props.songId] as const,
  ([show, songId]) => {
    if (show && songId) void load(songId)
  },
  { immediate: true },
)

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
    await save(props.songId, input)
    emit('saved')
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
    toastMessage.value = error instanceof ApiErrorResponseError && error.code === 'music.lyrics_version_conflict'
      ? '歌词已被其他用户更新，请重新打开'
      : '歌词保存失败'
    toastVisible.value = true
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
    await save(props.songId, input)
    emit('saved')
    emit('close')
  } catch {
    toastMessage.value = '歌词保存失败'
    toastVisible.value = true
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
    :saving="saving || loading"
    @close="emit('close')"
    @save="handleSave"
  />
  <PConfirm
    :show="conflictingAnnotationIds.length > 0"
    title="部分注释需要重新定位"
    message="保存后，这些注释会进入待重新绑定状态。"
    confirm-text="继续保存"
    cancel-text="取消"
    :loading="saving"
    @confirm="confirmAnnotationConflict"
    @cancel="cancelAnnotationConflict"
  />
  <PToast v-model="toastVisible" :message="toastMessage" type="error" />
</template>
