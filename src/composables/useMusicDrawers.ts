import { ref, computed } from 'vue'

type NestedActionType = 'revise' | 'history' | 'add_album' | 'add_artist' | 'discussion' | 'revise_artist' | null

interface DrawerState {
  artistId: string | null
  albumId: string | null
  nestedAction: NestedActionType
  nestedPayload: any
}

// Global state singleton
const state = ref<DrawerState>({
  artistId: null,
  albumId: null,
  nestedAction: null,
  nestedPayload: null
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
  
  const closeAll = () => {
    state.value.artistId = null
    state.value.albumId = null
    state.value.nestedAction = null
    state.value.nestedPayload = null
  }

  const isMainShifted = computed(() => state.value.artistId !== null || state.value.nestedAction === 'add_artist')
  const isArtistShifted = computed(() => state.value.albumId !== null || state.value.nestedAction === 'add_album' || state.value.nestedAction === 'revise_artist')
  const isAlbumShifted = computed(() => state.value.nestedAction === 'revise' || state.value.nestedAction === 'history' || state.value.nestedAction === 'discussion')

  return {
    state,
    openArtist, closeArtist,
    openAlbum, closeAlbum,
    openNestedAction, closeNestedAction,
    closeAll,
    isMainShifted, isArtistShifted, isAlbumShifted
  }
}
