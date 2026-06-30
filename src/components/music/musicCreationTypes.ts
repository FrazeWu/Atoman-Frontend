import type { UploadAsset } from '@/api/types'

export type MusicCreationFlowStep = 'artist' | 'albumImport' | 'albumDetails'

export interface MusicCreationTrackDraft {
  id: string
  sequence: number
  title: string
  audioUrl?: string
  audioKey?: string
  origin?: string
}

export interface MusicCreationArtistStageNameDraft {
  id: string
  name: string
  isPrimary: boolean
  startDateText: string
  endDateText: string
}

export interface MusicCreationArtistDraft {
  id: string | null
  avatarUrl: string
  avatarAsset?: UploadAsset | null
  name: string
  country: string
  birthday: string
  legalName: string
  stageNames: MusicCreationArtistStageNameDraft[]
  nationality: string
  birthPlace: string
  birthDate: string
  bio: string
  source: string
}

export interface MusicCreationAlbumImportDraft {
  importId: string | null
  archiveName: string
  status: 'pending_upload' | 'uploading' | 'uploaded' | 'extracting' | 'ready' | 'failed' | 'committed'
  uploadProgress: number
  uploadSpeed: number
  coverUrl: string
  coverKey: string
  derivedAlbumTitle: string
  derivedCover: string
  derivedTracks: Array<{
    title: string
    audioKey: string
    origin: string
  }>
  lastSyncedAt: string
  errorMessage: string
}

export interface MusicCreationAlbumSeedDraft {
  title: string
  uploadedAssets: Array<{
    id: string
    url: string
  }>
}

export interface MusicCreationAlbumDetailsDraft {
  coverUrl: string
  coverAsset?: UploadAsset | null
  title: string
  releaseDate: string
  type: string
  releaseYear: string
  bio: string
  source: string
}

export interface MusicCreationDraft {
  artist: MusicCreationArtistDraft
  albumImport: MusicCreationAlbumImportDraft
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
