export type MusicCreationFlowStep = 'artist' | 'albumImport'

export interface MusicCreationTrackDraft {
  id: string
  sequence: number
  title: string
  audioKey: string
  origin: string
}

export interface MusicCreationArtistDraft {
  id: string | null
  legalName: string
  stageNames: string[]
  nationality: string
  birthPlace: string
  birthDate: string
  bio: string
  source: string
}

export interface MusicCreationAlbumImportDraft {
  importId: string | null
  archiveName: string
  status: 'idle' | 'uploading' | 'done' | 'error'
  uploadProgress: number
  uploadSpeed: string
  coverUrl: string
  coverKey: string
  errorMessage: string
}

export interface MusicCreationAlbumDetailsDraft {
  title: string
  releaseYear: string
  bio: string
  source: string
}

export interface MusicCreationDraft {
  artist: MusicCreationArtistDraft
  albumImport: MusicCreationAlbumImportDraft
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
