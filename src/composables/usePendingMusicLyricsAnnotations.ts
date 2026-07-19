import { ref } from 'vue'
import { listPendingMusicLyricsAnnotations, type PendingMusicLyricsAnnotation } from '@/api/musicV1'

const pendingMusicLyricsAnnotations = ref<PendingMusicLyricsAnnotation[]>([])

export function usePendingMusicLyricsAnnotations() {
  async function loadPendingMusicLyricsAnnotations(isAuthenticated: boolean, token: string | null) {
    if (!isAuthenticated || !token) {
      pendingMusicLyricsAnnotations.value = []
      return
    }
    pendingMusicLyricsAnnotations.value = await listPendingMusicLyricsAnnotations()
  }

  return {
    pendingMusicLyricsAnnotations,
    loadPendingMusicLyricsAnnotations,
  }
}

export function removePendingMusicLyricsAnnotation(annotationId: string) {
  pendingMusicLyricsAnnotations.value = pendingMusicLyricsAnnotations.value.filter(
    (annotation) => annotation.annotation_id !== annotationId,
  )
}
