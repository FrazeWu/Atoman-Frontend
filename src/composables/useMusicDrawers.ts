import { ref, computed } from 'vue'
import type {
  MusicCreationDraft,
  MusicCreationFlowState,
  MusicCreationFlowStep,
} from '@/components/music/musicCreationTypes'

type NestedActionType = 'revise' | 'history' | 'add_album' | 'add_artist' | 'discussion' | 'revise_artist' | null

interface DrawerState {
  artistId: string | null
  albumId: string | null
  nestedAction: NestedActionType
  nestedPayload: any
  creationFlow: MusicCreationFlowState | null
}

function createEmptyDraft(seed?: { artistId?: string | null }): MusicCreationDraft {
  return {
    artist: {
      id: seed?.artistId ?? null,
      avatarUrl: '',
      name: '',
      country: '',
      birthday: '',
      bio: '',
      source: '',
    },
    albumSeed: {
      title: '',
      uploadedAssets: [],
    },
    albumDetails: {
      coverUrl: '',
      title: '',
      releaseDate: '',
      type: 'album',
      bio: '',
      source: '',
    },
    tracks: [],
  }
}

// Global state singleton
const state = ref<DrawerState>({
  artistId: null,
  albumId: null,
  nestedAction: null,
  nestedPayload: null,
  creationFlow: null,
})

export function useMusicDrawers() {
  const openArtist = (id: string) => { state.value.artistId = id }
  const closeArtist = () => { state.value.artistId = null }
  
  const openAlbum = (id: string) => { state.value.albumId = id }
  const closeAlbum = () => { state.value.albumId = null }
  
  const openNestedAction = (action: NestedActionType, payload: any = null) => {
    state.value.nestedAction = action
    state.value.nestedPayload = payload
  }
  const closeNestedAction = () => {
    state.value.nestedAction = null
    state.value.nestedPayload = null
  }

  const openMusicCreationFlow = (seed?: { artistId?: string | null }) => {
    state.value.creationFlow = {
      step: 'artist',
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
    state.value.albumId = null
    state.value.nestedAction = null
    state.value.nestedPayload = null
    state.value.creationFlow = null
  }

  const isMainShifted = computed(() => state.value.artistId !== null || state.value.nestedAction === 'add_artist' || state.value.creationFlow !== null)
  const isArtistShifted = computed(() => state.value.albumId !== null || state.value.nestedAction === 'add_album' || state.value.nestedAction === 'revise_artist' || state.value.creationFlow !== null)
  const isAlbumShifted = computed(() => state.value.nestedAction === 'revise' || state.value.nestedAction === 'history' || state.value.nestedAction === 'discussion')
  const isCreationFlowOpen = computed(() => state.value.creationFlow !== null)

  return {
    state,
    openArtist, closeArtist,
    openAlbum, closeAlbum,
    openNestedAction, closeNestedAction,
    openMusicCreationFlow,
    setMusicCreationStep,
    closeMusicCreationFlow,
    closeAll,
    isMainShifted, isArtistShifted, isAlbumShifted,
    isCreationFlowOpen,
  }
}
