import type { Artist } from '@/types'
import type { UploadAsset } from '@/api/types'

export type MusicTrackDraft = {
  id: string
  trackNumber: string
  title: string
  file?: File | null
  songId?: number
  isExisting?: boolean
}

export type MusicSourceDraft = {
  id: string
  title: string
  url: string
}

export type MusicAlbumMetaDraft = {
  artist: Artist[]
  album: string
  releaseDate: string
  albumType?: 'single' | 'ep' | 'album'
}

export type MusicCoverDraft = {
  file: File | null
  previewUrl: string
  asset?: UploadAsset | null
}

export type MusicReviewNotesDraft = {
  editNote: string
  reviewNote: string
}
