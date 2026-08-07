import type { UploadAsset } from '@/api/types'
import type { MusicCreationAlbumContributorDraft } from './musicCreationTypes'

export type MusicTrackDraft = {
  id: string
  trackNumber: string
  discNumber: string
  title: string
  lyrics?: string
  audioUrl?: string
  audioAsset?: UploadAsset | null
  pendingAudioAsset?: UploadAsset | null
  file?: File | null
  coverUrl?: string
  coverFile?: File | null
  contributors: MusicCreationAlbumContributorDraft[]
  songId?: string
  isExisting?: boolean
  removed?: boolean
}

export type MusicSourceDraft = {
  id: string
  title: string
  url: string
}

export type MusicAlbumMetaDraft = {
	contributors: MusicCreationAlbumContributorDraft[]
  album: string
  releaseDate: string
  albumType?: string
  description: string
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
