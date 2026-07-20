import type { UploadAsset } from '@/api/types'
import type { MusicAlbumImportFile, MusicAlbumImportInputMode, MusicAlbumImportStage, MusicAlbumImportStatus } from '@/api/musicV1'

export type MusicCreationFlowStep = 'artist' | 'albumImport' | 'albumDetails'
export type MusicArtistKind = 'person' | 'group'

export interface MusicCreationDatePartsDraft {
  year: string
  month: string
  day: string
}

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
  startDateParts?: MusicCreationDatePartsDraft
  endDateParts?: MusicCreationDatePartsDraft
  startDateText: string
  endDateText: string
}

export interface MusicCreationArtistMemberDraft {
  id: string
  name: string
  joinDateParts: MusicCreationDatePartsDraft
  leaveDateParts: MusicCreationDatePartsDraft
}

export interface MusicCreationArtistDraft {
  id: string | null
  avatarUrl: string
  avatarAsset?: UploadAsset | null
  kind: MusicArtistKind
  legalName: string
  stageNames: MusicCreationArtistStageNameDraft[]
  members: MusicCreationArtistMemberDraft[]
  nationality: string
  birthPlace: string
  birthDateParts?: MusicCreationDatePartsDraft
  activeStartDateParts?: MusicCreationDatePartsDraft
  activeEndDateParts?: MusicCreationDatePartsDraft
  birthDate: string
  bio: string
  source: string
}

export interface MusicCreationAlbumImportDraft {
  importId: string | null
  inputMode: MusicAlbumImportInputMode
  archiveName: string
  status: MusicAlbumImportStatus
  stage: MusicAlbumImportStage
  uploadProgress: number
  uploadSpeed: number
  files: MusicAlbumImportFile[]
  totalBytesLoaded: number
  totalBytesTotal: number
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

export interface MusicCreationAlbumContributorDraft {
  id: string
  artistId: string | null
  name: string
  avatarUrl: string
  kind: MusicArtistKind
  locked: boolean
}

export interface MusicCreationAlbumDetailsDraft {
  coverUrl: string
  coverAsset?: UploadAsset | null
  title: string
  contributors?: MusicCreationAlbumContributorDraft[]
  releaseDateParts?: MusicCreationDatePartsDraft
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
  tracksCustomized: boolean
  titleCustomized: boolean
  dirty: boolean
  submitting: boolean
  errorMessage: string
}
