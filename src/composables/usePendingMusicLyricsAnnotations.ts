import { ref } from 'vue'
import { listPendingMusicLyricsAnnotations, type PendingMusicLyricsAnnotation } from '@/api/musicV1'

const pendingMusicLyricsAnnotations = ref<PendingMusicLyricsAnnotation[]>([])
let activeIdentity = ''
let loadGeneration = 0

function pendingAnnotationsIdentity(isAuthenticated: boolean, token: string | null, userId?: string) {
  if (!isAuthenticated || !token || !userId) return ''
  return `${userId}:${token}`
}

export function usePendingMusicLyricsAnnotations() {
  async function loadPendingMusicLyricsAnnotations(isAuthenticated: boolean, token: string | null, userId?: string) {
    const identity = pendingAnnotationsIdentity(isAuthenticated, token, userId)
    const generation = ++loadGeneration
    activeIdentity = identity
    if (!identity) {
      pendingMusicLyricsAnnotations.value = []
      return
    }
    const annotations = await listPendingMusicLyricsAnnotations()
    if (generation !== loadGeneration || activeIdentity !== identity) return
    pendingMusicLyricsAnnotations.value = annotations
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
