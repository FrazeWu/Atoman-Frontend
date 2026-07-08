import { computed, ref } from 'vue'
import {
  createMusicLyricsAnnotation,
  deleteMusicLyricsAnnotation,
  getMusicSongLyrics,
  updateMusicLyricsAnnotation,
  updateMusicSongLyrics,
  voteMusicLyricsAnnotation,
  type CreateMusicLyricsAnnotationInput,
  type MusicLyricsAnnotation,
  type MusicLyricsAnnotationVote,
  type MusicSongLyrics,
  type UpdateMusicLyricsAnnotationInput,
  type UpdateMusicSongLyricsInput,
} from '@/api/musicV1'
import { computeCurrentLyricLine } from '@/utils/musicLyrics'

function replaceAnnotation(lyrics: MusicSongLyrics, updated: MusicLyricsAnnotation) {
  lyrics.annotations = lyrics.annotations.map((annotation) => annotation.id === updated.id ? updated : annotation)
}

function buildAnnotationsByLine(annotations: MusicLyricsAnnotation[]) {
  const grouped = new Map<string, MusicLyricsAnnotation[]>()

  for (const annotation of annotations) {
    if (annotation.status !== 'active') continue
    const lineKey = annotation.line_key ?? annotation.line_id
    if (!lineKey) continue
    const lineAnnotations = grouped.get(lineKey) ?? []
    lineAnnotations.push(annotation)
    grouped.set(lineKey, lineAnnotations)
  }

  for (const lineAnnotations of grouped.values()) {
    lineAnnotations.sort((left, right) => (
      (right.upvotes - right.downvotes) - (left.upvotes - left.downvotes)
      || right.upvotes - left.upvotes
      || left.id.localeCompare(right.id)
    ))
  }

  return grouped
}

export function useMusicLyrics() {
  const lyrics = ref<MusicSongLyrics | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')
  let activeLoadRequestId = 0
  let activeSaveRequestId = 0
  const activeSongId = ref('')

  const annotationsByLine = computed(() => buildAnnotationsByLine(lyrics.value?.annotations ?? []))

  async function load(songId: string) {
    const requestId = ++activeLoadRequestId
    activeSongId.value = songId
    loading.value = true
    errorMessage.value = ''
    try {
      const nextLyrics = await getMusicSongLyrics(songId)
      if (requestId !== activeLoadRequestId) return
      lyrics.value = nextLyrics
    } catch {
      if (requestId !== activeLoadRequestId) return
      lyrics.value = null
      errorMessage.value = '歌词加载失败'
    } finally {
      if (requestId !== activeLoadRequestId) return
      loading.value = false
    }
  }

  async function save(songId: string, input: UpdateMusicSongLyricsInput) {
    const requestId = ++activeSaveRequestId
    saving.value = true
    errorMessage.value = ''
    try {
      const updatedLyrics = await updateMusicSongLyrics(songId, input)
      if (activeSongId.value === songId) {
        lyrics.value = updatedLyrics
      }
      return updatedLyrics
    } catch (error) {
      if (activeSongId.value === songId) {
        errorMessage.value = '歌词保存失败'
      }
      throw error
    } finally {
      if (requestId === activeSaveRequestId) {
        saving.value = false
      }
    }
  }

  async function createAnnotation(songId: string, input: CreateMusicLyricsAnnotationInput) {
    errorMessage.value = ''
    try {
      const annotation = await createMusicLyricsAnnotation(songId, input)
      if (activeSongId.value === songId && lyrics.value) {
        lyrics.value.annotations = [...lyrics.value.annotations, annotation]
      }
      return annotation
    } catch (error) {
      if (activeSongId.value === songId) {
        errorMessage.value = '注释创建失败'
      }
      throw error
    }
  }

  async function updateAnnotation(songId: string, annotationId: string, input: UpdateMusicLyricsAnnotationInput) {
    errorMessage.value = ''
    try {
      const updated = await updateMusicLyricsAnnotation(songId, annotationId, input)
      if (activeSongId.value === songId && lyrics.value) replaceAnnotation(lyrics.value, updated)
      return updated
    } catch (error) {
      if (activeSongId.value === songId) {
        errorMessage.value = '注释更新失败'
      }
      throw error
    }
  }

  async function deleteAnnotation(songId: string, annotationId: string) {
    errorMessage.value = ''
    try {
      const result = await deleteMusicLyricsAnnotation(songId, annotationId)
      if (activeSongId.value === songId && result.deleted && lyrics.value) {
        lyrics.value.annotations = lyrics.value.annotations.filter((annotation) => annotation.id !== annotationId)
      }
      return result
    } catch (error) {
      if (activeSongId.value === songId) {
        errorMessage.value = '注释删除失败'
      }
      throw error
    }
  }

  async function voteAnnotation(songId: string, annotationId: string, vote: MusicLyricsAnnotationVote | null) {
    errorMessage.value = ''
    try {
      const updated = await voteMusicLyricsAnnotation(songId, annotationId, vote)
      if (activeSongId.value === songId && lyrics.value) replaceAnnotation(lyrics.value, updated)
      return updated
    } catch (error) {
      if (activeSongId.value === songId) {
        errorMessage.value = '注释投票失败'
      }
      throw error
    }
  }

  function currentLine(currentTimeSeconds: number) {
    const normalizedLines = (lyrics.value?.lines ?? []).map((line, index, lines) => ({
      id: line.line_key ?? line.id ?? `line-${index}`,
      text: line.text,
      translation: line.translation,
      startTimeMs: line.time_ms ?? line.startTimeMs ?? null,
      endTimeMs: lines[index + 1]?.time_ms ?? lines[index + 1]?.startTimeMs ?? null,
      lineNumber: line.line_index ?? line.lineNumber ?? index,
    }))
    const activeLine = computeCurrentLyricLine(normalizedLines, currentTimeSeconds)
    return lyrics.value?.lines.find((line) => (line.line_key ?? line.id) === activeLine?.id) ?? null
  }

  return {
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
    currentLine,
  }
}
