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
import { buildLyricsAnnotationIndex, computeCurrentLyricLine } from '@/utils/musicLyrics'

function replaceAnnotation(lyrics: MusicSongLyrics, updated: MusicLyricsAnnotation) {
  lyrics.annotations = lyrics.annotations.map((annotation) => annotation.id === updated.id ? updated : annotation)
}

export function useMusicLyrics() {
  const lyrics = ref<MusicSongLyrics | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')

  const annotationsByLine = computed(() => buildLyricsAnnotationIndex(lyrics.value?.annotations ?? []).annotationsByLine)

  async function load(songId: string) {
    loading.value = true
    errorMessage.value = ''
    try {
      lyrics.value = await getMusicSongLyrics(songId)
    } catch {
      lyrics.value = null
      errorMessage.value = '歌词加载失败'
    } finally {
      loading.value = false
    }
  }

  async function save(songId: string, input: UpdateMusicSongLyricsInput) {
    saving.value = true
    errorMessage.value = ''
    try {
      lyrics.value = await updateMusicSongLyrics(songId, input)
      return lyrics.value
    } catch (error) {
      errorMessage.value = '歌词保存失败'
      throw error
    } finally {
      saving.value = false
    }
  }

  async function createAnnotation(songId: string, input: CreateMusicLyricsAnnotationInput) {
    errorMessage.value = ''
    try {
      const annotation = await createMusicLyricsAnnotation(songId, input)
      if (lyrics.value) {
        lyrics.value.annotations = [...lyrics.value.annotations, annotation]
      }
      return annotation
    } catch (error) {
      errorMessage.value = '注释创建失败'
      throw error
    }
  }

  async function updateAnnotation(annotationId: string, input: UpdateMusicLyricsAnnotationInput) {
    errorMessage.value = ''
    try {
      const updated = await updateMusicLyricsAnnotation(annotationId, input)
      if (lyrics.value) replaceAnnotation(lyrics.value, updated)
      return updated
    } catch (error) {
      errorMessage.value = '注释更新失败'
      throw error
    }
  }

  async function deleteAnnotation(annotationId: string) {
    errorMessage.value = ''
    try {
      const result = await deleteMusicLyricsAnnotation(annotationId)
      if (result.deleted && lyrics.value) {
        lyrics.value.annotations = lyrics.value.annotations.filter((annotation) => annotation.id !== annotationId)
      }
      return result
    } catch (error) {
      errorMessage.value = '注释删除失败'
      throw error
    }
  }

  async function voteAnnotation(annotationId: string, vote: MusicLyricsAnnotationVote | null) {
    errorMessage.value = ''
    try {
      const updated = await voteMusicLyricsAnnotation(annotationId, vote)
      if (lyrics.value) replaceAnnotation(lyrics.value, updated)
      return updated
    } catch (error) {
      errorMessage.value = '注释投票失败'
      throw error
    }
  }

  function currentLine(currentTimeSeconds: number) {
    return computeCurrentLyricLine(lyrics.value?.lines ?? [], currentTimeSeconds)
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
