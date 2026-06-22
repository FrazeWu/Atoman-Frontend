import type { UploadAsset } from '@/api/types'

export type MusicCreationFlowStep = 'artist' | 'albumSeed' | 'albumDetails'

export interface MusicCreationUploadedAssetDraft {
  id: string
  url: string
}

export interface MusicCreationTrackDraft {
  id: string
  sequence: number
  title: string
  audioUrl: string
}

export interface MusicCreationArtistDraft {
  id: string | null
  avatarUrl: string
  avatarAsset?: UploadAsset | null
  name: string
  country: string
  birthday: string
  bio: string
  source: string
}

export interface MusicCreationAlbumSeedDraft {
  title: string
  uploadedAssets: MusicCreationUploadedAssetDraft[]
}

export interface MusicCreationAlbumDetailsDraft {
  coverUrl: string
  coverAsset?: UploadAsset | null
  title: string
  releaseDate: string
  type: 'album'
  bio: string
  source: string
}

export interface MusicCreationDraft {
  artist: MusicCreationArtistDraft
  albumSeed: MusicCreationAlbumSeedDraft
  albumDetails: MusicCreationAlbumDetailsDraft
  tracks: MusicCreationTrackDraft[]
}

export interface MusicCreationFlowState {
  step: MusicCreationFlowStep
  draft: MusicCreationDraft
  dirty: boolean
  submitting: boolean
  errorMessage: string
}
