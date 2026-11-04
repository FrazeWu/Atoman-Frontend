import { ref, onUnmounted, type Ref } from 'vue'
import { uploadMusicAssetWithProgress } from '@/api/musicV1'
import type { UploadAsset } from '@/api/types'
import { normalizeImportedTrackTitle, parseAudioTrackTitleAsync } from '@/utils/musicImportPreview'
import type {
  MusicCreationAlbumDetailsDraft,
  MusicCreationTrackDraft,
} from '@/components/music/musicCreationTypes'

export interface UseMusicCreationTrackAudioUploadOptions {
  orderedTracks: Ref<MusicCreationTrackDraft[]>
  albumDetailsDraft: Ref<MusicCreationAlbumDetailsDraft | null>
  isEditMode: Ref<boolean>
  addPendingTrack: (fileName: string, initialTitle: string) => string
  updateTrackUpload: (trackId: string, progress: number) => void
  completeTrackUpload: (trackId: string, asset: UploadAsset, fileName: string) => void
  failTrackUpload: (trackId: string, error: string) => void
  replaceTrackAudio: (trackId: string, asset: UploadAsset, fileName: string) => void
  updateTrackTitle: (trackId: string, title: string) => void
  removeTrackDraft: (trackId: string) => void
  selectLyricsCandidate: (
    trackId: string,
    candidate: NonNullable<MusicCreationTrackDraft['lyricsCandidates']>[number],
  ) => void
  formatSequence: (sequence: number) => string
  reorderTrackBySequence: (trackId: string, targetSequence: number) => void
}

export function useMusicCreationTrackAudioUpload({
  orderedTracks,
  albumDetailsDraft,
  isEditMode,
  addPendingTrack,
  updateTrackUpload,
  completeTrackUpload,
  failTrackUpload,
  replaceTrackAudio,
  updateTrackTitle,
  removeTrackDraft,
  selectLyricsCandidate,
  formatSequence,
  reorderTrackBySequence,
}: UseMusicCreationTrackAudioUploadOptions) {
  const trackAudioInputRef = ref<HTMLInputElement | null>(null)
  const pendingAudioTrackId = ref<string | null>(null)
  const trackAudioUploading = ref(false)
  const trackAudioError = ref('')
  const pendingTrackRemovalId = ref<string | null>(null)
  const activeTrackUploads = new Map<string, AbortController>()

  function lyricsCandidateLabel(source: string) {
    if (source === 'local') return '本地歌词'
    if (source === 'lrclib') return '在线歌词'
    return source || '歌词候选'
  }

  function selectTrackLyricsCandidate(
    trackId: string,
    candidate: NonNullable<MusicCreationTrackDraft['lyricsCandidates']>[number],
  ) {
    selectLyricsCandidate(trackId, candidate)
  }

  onUnmounted(() => {
    for (const controller of activeTrackUploads.values()) controller.abort()
    activeTrackUploads.clear()
  })

  function removeTrack(trackId: string) {
    activeTrackUploads.get(trackId)?.abort()
    activeTrackUploads.delete(trackId)
    removeTrackDraft(trackId)
  }

  function requestTrackRemoval(trackId: string) {
    const track = orderedTracks.value.find((item) => item.id === trackId)
    if (isEditMode.value && track?.songId) {
      pendingTrackRemovalId.value = trackId
      return
    }
    removeTrack(trackId)
  }

  function confirmTrackRemoval() {
    const trackId = pendingTrackRemovalId.value
    pendingTrackRemovalId.value = null
    if (trackId) removeTrack(trackId)
  }

  function cancelTrackRemoval() {
    pendingTrackRemovalId.value = null
  }

  function handleTrackSequenceChange(trackId: string, event: Event) {
    const input = event.target as HTMLInputElement
    const rawValue = input.value.trim()
    const parsed = parseInt(rawValue, 10)
    const track = orderedTracks.value.find((t) => t.id === trackId)
    if (isNaN(parsed) || parsed < 1) {
      if (track) input.value = formatSequence(track.sequence)
      return
    }
    reorderTrackBySequence(trackId, parsed)
  }

  function openTrackAudioPicker(trackId: string | null = null) {
    if (trackAudioUploading.value) return
    trackAudioError.value = ''
    pendingAudioTrackId.value = trackId
    trackAudioInputRef.value?.click()
  }

  function titleFromAudioFile(file: File): string {
    const baseName = file.name.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '').trim() || file.name
    const title = baseName.replace(/^\s*(?:track\s*)?\d{1,3}\s*(?:[-_.]\s*|\s+)/i, '').trim() || baseName
    return normalizeImportedTrackTitle(
      title,
      albumDetailsDraft.value?.contributors.find((item) =>
        item.roles.some((role) => role.role === 'primary'),
      )?.name || '',
    )
  }

  async function readTrackTitle(file: File): Promise<string> {
    const primaryArtist =
      albumDetailsDraft.value?.contributors.find((item) =>
        item.roles.some((role) => role.role === 'primary'),
      )?.name || ''
    return parseAudioTrackTitleAsync(file, file.name, primaryArtist)
  }

  async function uploadNewTrack(file: File, trackId: string) {
    const controller = new AbortController()
    activeTrackUploads.set(trackId, controller)
    try {
      const asset = await uploadMusicAssetWithProgress(file, 'music.audio', {
        signal: controller.signal,
        timeoutMs: 5 * 60 * 1000,
        onProgress: ({ loaded, total }) =>
          updateTrackUpload(trackId, total > 0 ? Math.round((loaded / total) * 100) : 0),
      })
      completeTrackUpload(trackId, asset, file.name)
    } finally {
      activeTrackUploads.delete(trackId)
    }
  }

  async function handleTrackAudioChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] ?? null
    input.value = ''
    if (!file) return

    const replacingTrackId = pendingAudioTrackId.value
    trackAudioUploading.value = true
    trackAudioError.value = ''
    let pendingTrackId: string | null = null
    try {
      if (replacingTrackId) {
        const controller = new AbortController()
        activeTrackUploads.set(replacingTrackId, controller)
        try {
          const asset = await uploadMusicAssetWithProgress(file, 'music.audio', {
            signal: controller.signal,
            timeoutMs: 5 * 60 * 1000,
          })
          replaceTrackAudio(replacingTrackId, asset, file.name)
        } finally {
          activeTrackUploads.delete(replacingTrackId)
        }
      } else {
        pendingTrackId = addPendingTrack(file.name, titleFromAudioFile(file))
        void readTrackTitle(file).then((title) => updateTrackTitle(pendingTrackId!, title))
        await uploadNewTrack(file, pendingTrackId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '音频上传失败，请重试'
      if (pendingTrackId) {
        failTrackUpload(pendingTrackId, message)
      } else {
        trackAudioError.value = message
      }
    } finally {
      trackAudioUploading.value = false
      pendingAudioTrackId.value = null
    }
  }

  return {
    trackAudioInputRef,
    pendingAudioTrackId,
    trackAudioUploading,
    trackAudioError,
    pendingTrackRemovalId,
    lyricsCandidateLabel,
    selectTrackLyricsCandidate,
    requestTrackRemoval,
    confirmTrackRemoval,
    cancelTrackRemoval,
    handleTrackSequenceChange,
    openTrackAudioPicker,
    handleTrackAudioChange,
  }
}
