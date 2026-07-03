import { ref, computed } from 'vue'
import type {
  MusicCreationDraft,
  MusicCreationFlowState,
  MusicCreationFlowStep,
} from '@/components/music/musicCreationTypes'

type NestedActionType = 'revise' | 'history' | 'add_album' | 'add_artist' | 'discussion' | 'revise_artist' | null

export type MusicEditorEntity = 'artist' | 'album'
export type MusicEditorMode = 'create' | 'edit'

export interface MusicEditorState {
  entity: MusicEditorEntity
  mode: MusicEditorMode
  id?: string
  seed?: Record<string, unknown>
}

interface DrawerState {
  artistId: string | null
  artistRefreshToken: number
  albumId: string | null
  playlistId: string | null
  albumRefreshToken: number
  nestedAction: NestedActionType
  nestedPayload: unknown
  musicEditor: MusicEditorState | null
  creationFlow: MusicCreationFlowState | null
}

type MusicCreationFlowSeed = {
  artistId?: string | null
  artistName?: string
  artistLegalName?: string
}

function createEmptyDraft(seed?: MusicCreationFlowSeed): MusicCreationDraft {
  return {
    artist: {
      id: seed?.artistId ?? null,
      avatarUrl: '',
      avatarAsset: null,
      name: seed?.artistName ?? '',
      country: '',
      birthday: '',
      legalName: seed?.artistLegalName ?? '',
      stageNames: [
        {
          id: 'stage-name-primary',
          name: seed?.artistName ?? '',
          isPrimary: true,
          startDateText: '',
          endDateText: '',
        },
      ],
      nationality: '',
      birthPlace: '',
      birthDate: '',
      bio: '',
      source: '',
    },
    albumImport: {
      importId: null,
      archiveName: '',
      status: 'pending_upload',
      uploadProgress: 0,
      uploadSpeed: 0,
      coverUrl: '',
      coverKey: '',
      derivedAlbumTitle: '',
      derivedCover: '',
      derivedTracks: [],
      lastSyncedAt: '',
      errorMessage: '',
    },
    albumSeed: {
      title: '',
      uploadedAssets: [],
    },
    albumDetails: {
      coverUrl: '',
      coverAsset: null,
      title: '',
      releaseDate: '',
      type: 'album',
      releaseYear: '',
      bio: '',
      source: '',
    },
    tracks: [],
  }
}

// Global state singleton
const state = ref<DrawerState>({
  artistId: null,
  artistRefreshToken: 0,
  albumId: null,
  playlistId: null,
  albumRefreshToken: 0,
  nestedAction: null,
  nestedPayload: null,
  musicEditor: null,
  creationFlow: null,
})

export function useMusicDrawers() {
  const openArtist = (id: string) => { state.value.artistId = id }
  const closeArtist = () => { state.value.artistId = null }
  const refreshArtist = () => { state.value.artistRefreshToken += 1 }
  
  const openAlbum = (id: string) => { state.value.albumId = id }
  const closeAlbum = () => { state.value.albumId = null }
  const refreshAlbum = () => { state.value.albumRefreshToken += 1 }

  const openPlaylist = (id: string) => { state.value.playlistId = id }
  const closePlaylist = () => { state.value.playlistId = null }
  
  const openNestedAction = (action: NestedActionType, payload: unknown = null) => {
    state.value.nestedAction = action
    state.value.nestedPayload = payload
  }
  const closeNestedAction = () => {
    state.value.nestedAction = null
    state.value.nestedPayload = null
  }

  const openMusicEditor = (editor: MusicEditorState) => {
    state.value.musicEditor = editor
  }

  const closeMusicEditor = () => {
    state.value.musicEditor = null
  }

  const openMusicCreationFlow = (seed?: {
    artistId?: string | null
    artistName?: string
    artistLegalName?: string
    startStep?: MusicCreationFlowStep
  }) => {
    state.value.creationFlow = {
      step: seed?.startStep ?? 'artist',
      draft: createEmptyDraft(seed),
      dirty: false,
      submitting: false,
      errorMessage: '',
    }
  }

  const setMusicCreationStep = (step: MusicCreationFlowStep) => {
    if (state.value.creationFlow) state.value.creationFlow.step = step
  }

  const closeMusicCreationFlow = () => {
    state.value.creationFlow = null
  }
  
  const closeAll = () => {
    state.value.artistId = null
    state.value.artistRefreshToken = 0
    state.value.albumId = null
    state.value.playlistId = null
    state.value.albumRefreshToken = 0
    state.value.nestedAction = null
    state.value.nestedPayload = null
    state.value.musicEditor = null
    state.value.creationFlow = null
  }

  const isMainShifted = computed(() => (
    state.value.artistId !== null
    || state.value.playlistId !== null
    || state.value.nestedAction === 'add_artist'
    || state.value.creationFlow !== null
    || state.value.musicEditor !== null
  ))
  const isArtistShifted = computed(() => (
    state.value.albumId !== null
    || state.value.nestedAction === 'add_album'
    || state.value.nestedAction === 'revise_artist'
    || state.value.creationFlow !== null
    || state.value.musicEditor?.entity === 'artist'
    || state.value.musicEditor?.entity === 'album'
  ))
  const isAlbumShifted = computed(() => (
    state.value.nestedAction === 'revise'
    || state.value.nestedAction === 'history'
    || state.value.nestedAction === 'discussion'
    || (state.value.musicEditor?.entity === 'album' && state.value.musicEditor?.mode === 'edit')
  ))
  const isCreationFlowOpen = computed(() => state.value.creationFlow !== null)
  const isMusicEditorOpen = computed(() => state.value.musicEditor !== null)

  return {
    state,
    openArtist, closeArtist, refreshArtist,
    openAlbum, closeAlbum, refreshAlbum,
    openPlaylist, closePlaylist,
    openNestedAction, closeNestedAction,
    openMusicEditor, closeMusicEditor,
    openMusicCreationFlow,
    setMusicCreationStep,
    closeMusicCreationFlow,
    closeAll,
    isMainShifted, isArtistShifted, isAlbumShifted,
    isCreationFlowOpen,
    isMusicEditorOpen,
  }
}
