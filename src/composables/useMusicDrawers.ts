import { ref, computed, watch } from 'vue'
import type {
  MusicCreationDraft,
  MusicCreationFlowState,
  MusicCreationFlowStep,
} from '@/components/music/musicCreationTypes'
import type { MusicCreationFlowSeed, MusicEditorState, MusicSheetLayer, NestedActionType } from '@/components/music/musicSheetTypes'
import { createSheetStack } from '@/composables/useSheetStack'

export type { MusicEditorEntity, MusicEditorMode, MusicEditorState } from '@/components/music/musicSheetTypes'

interface DrawerState {
  artistId: string | null
  artistRefreshToken: number
  albumId: string | null
  playlistId: string | null
  albumRefreshToken: number
  playlistRefreshToken: number
  nestedAction: NestedActionType
  nestedPayload: unknown
  musicEditor: MusicEditorState | null
  creationFlow: MusicCreationFlowState | null
}

function createEmptyDateParts() {
  return {
    year: '',
    month: '',
    day: '',
  }
}

function createSeededContributors(seed?: MusicCreationFlowSeed) {
  if (!seed?.artistId) return []

  return [
    {
      id: `contributor-${seed.artistId}`,
      artistId: seed.artistId,
      name: seed.artistName ?? '',
      avatarUrl: '',
      kind: 'person' as const,
      locked: false,
    },
  ]
}

function createEmptyDraft(seed?: MusicCreationFlowSeed): MusicCreationDraft {
  return {
    artist: {
      id: seed?.artistId ?? null,
      avatarUrl: '',
      avatarAsset: null,
      kind: 'person',
      legalName: seed?.artistLegalName ?? '',
      stageNames: [
        {
          id: 'stage-name-primary',
          name: seed?.artistName ?? '',
          isPrimary: true,
          startDateParts: createEmptyDateParts(),
          endDateParts: createEmptyDateParts(),
          startDateText: '',
          endDateText: '',
        },
      ],
      members: [],
      nationality: '',
      birthPlace: '',
      birthDateParts: createEmptyDateParts(),
      activeStartDateParts: createEmptyDateParts(),
      activeEndDateParts: createEmptyDateParts(),
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
      contributors: createSeededContributors(seed),
      releaseDateParts: createEmptyDateParts(),
      releaseDate: '',
      type: 'album',
      releaseYear: '',
      bio: '',
      source: '',
    },
    tracks: [],
  }
}

const artistLayer = (id: string): MusicSheetLayer => ({
  key: `artist:${id}`,
  kind: 'artist',
  title: '艺术家详情',
  route: `/music/artist/${id}`,
  payload: { artistId: id },
})

const albumLayer = (id: string): MusicSheetLayer => ({
  key: `album:${id}`,
  kind: 'album',
  title: '专辑详情',
  route: `/music/album/${id}`,
  payload: { albumId: id },
})

function resolveShortestMusicPath(layer: MusicSheetLayer): MusicSheetLayer[] {
  if (layer.kind !== 'action') return [layer]
  if (!layer.payload.data || typeof layer.payload.data !== 'object') return [layer]

  if ('albumId' in layer.payload.data) {
    return [albumLayer(String(layer.payload.data.albumId)), layer]
  }
  if ('artistId' in layer.payload.data) {
    return [artistLayer(String(layer.payload.data.artistId)), layer]
  }
  return [layer]
}

// Global state singleton
const state = ref<DrawerState>({
  artistId: null,
  artistRefreshToken: 0,
  albumId: null,
  playlistId: null,
  albumRefreshToken: 0,
  playlistRefreshToken: 0,
  nestedAction: null,
  nestedPayload: null,
  musicEditor: null,
  creationFlow: null,
})

const sheetStack = createSheetStack<MusicSheetLayer>({
  maxLayers: 3,
  resolveOverflow: resolveShortestMusicPath,
})

watch(sheetStack.layers, (layers) => {
  const reversed = [...layers].reverse()
  const artist = reversed.find(layer => layer.kind === 'artist')
  const album = reversed.find(layer => layer.kind === 'album')
  const playlist = reversed.find(layer => layer.kind === 'playlist')
  const action = reversed.find(layer => layer.kind === 'action')
  const editor = reversed.find(layer => layer.kind === 'editor')

  state.value.artistId = artist?.kind === 'artist' ? artist.payload.artistId : null
  state.value.albumId = album?.kind === 'album' ? album.payload.albumId : null
  state.value.playlistId = playlist?.kind === 'playlist' ? playlist.payload.playlistId : null
  state.value.nestedAction = action?.kind === 'action' ? action.payload.action : null
  state.value.nestedPayload = action?.kind === 'action' ? action.payload.data : null
  state.value.musicEditor = editor?.kind === 'editor' ? editor.payload : null
}, { flush: 'sync' })

export function useMusicDrawers() {
  const closeLayerAndAbove = (key: string) => {
    if (!sheetStack.layers.value.some(layer => layer.key === key)) return
    sheetStack.popTo(key)
    sheetStack.pop()
  }

  const openArtist = (id: string) => {
    sheetStack.push(artistLayer(id))
  }
  const closeArtist = (key = sheetStack.top.value?.key ?? '') => closeLayerAndAbove(key)
  const refreshArtist = () => { state.value.artistRefreshToken += 1 }
  
  const openAlbum = (id: string) => {
    sheetStack.push(albumLayer(id))
  }
  const closeAlbum = (key = sheetStack.top.value?.key ?? '') => closeLayerAndAbove(key)
  const refreshAlbum = () => { state.value.albumRefreshToken += 1 }

  const openPlaylist = (id: string) => {
    sheetStack.push({
      key: `playlist:${id}`,
      kind: 'playlist',
      title: '歌单详情',
      route: `/music/playlist/${id}`,
      payload: { playlistId: id },
    })
  }
  const closePlaylist = (key = sheetStack.top.value?.key ?? '') => closeLayerAndAbove(key)
  const refreshPlaylists = () => { state.value.playlistRefreshToken += 1 }
  
  const openNestedAction = (action: Exclude<NestedActionType, null>, payload: unknown = null) => {
    const payloadOwner = payload && typeof payload === 'object'
      ? ('albumId' in payload ? String(payload.albumId) : 'artistId' in payload ? String(payload.artistId) : null)
      : null
    const ownerId = payloadOwner ?? state.value.albumId ?? state.value.artistId ?? 'root'
    sheetStack.push({
      key: `action:${action}:${ownerId}`,
      kind: 'action',
      title: action === 'history' || action === 'artist_history' ? '历史记录' : '操作',
      payload: { action, data: payload },
    })
  }
  const closeNestedAction = (key = sheetStack.top.value?.key ?? '') => closeLayerAndAbove(key)

  const openMusicEditor = (editor: MusicEditorState) => {
    state.value.creationFlow = null
    sheetStack.push({
      key: `editor:${editor.entity}:${editor.mode}:${editor.id ?? 'new'}`,
      kind: 'editor',
      title: editor.mode === 'create' ? '创建条目' : '修改条目',
      payload: editor,
    })
  }

  const closeMusicEditor = (keyOrEvent?: string | Event) => {
    state.value.creationFlow = null
    const key = typeof keyOrEvent === 'string' ? keyOrEvent : undefined
    const targetKey = key ?? sheetStack.layers.value.find(layer => layer.kind === 'editor')?.key
    if (targetKey) closeLayerAndAbove(targetKey)
  }

  const openMusicCreationFlow = (seed: MusicCreationFlowSeed = {}) => {
    state.value.creationFlow = {
      step: seed.startStep ?? 'artist',
      draft: createEmptyDraft(seed),
      tracksCustomized: false,
      titleCustomized: false,
      dirty: false,
      submitting: false,
      errorMessage: '',
    }
    sheetStack.push({
      key: `creation:${seed.artistId ?? 'new'}`,
      kind: 'creation',
      title: '创建音乐条目',
      payload: seed,
    })
  }

  const setMusicCreationStep = (step: MusicCreationFlowStep) => {
    if (state.value.creationFlow) state.value.creationFlow.step = step
  }

  const closeMusicCreationFlow = (keyOrEvent?: string | Event) => {
    state.value.creationFlow = null
    const key = typeof keyOrEvent === 'string' ? keyOrEvent : undefined
    const createEditorKey = !key && state.value.musicEditor?.mode === 'create'
      ? sheetStack.layers.value.find(layer => layer.kind === 'editor' && layer.payload.mode === 'create')?.key
      : undefined
    const targetKey = key
      ?? createEditorKey
      ?? sheetStack.layers.value.find(layer => layer.kind === 'creation')?.key
    if (targetKey) closeLayerAndAbove(targetKey)
  }
  
  const closeAll = () => {
    sheetStack.clear()
    state.value.artistId = null
    state.value.artistRefreshToken = 0
    state.value.albumId = null
    state.value.playlistId = null
    state.value.albumRefreshToken = 0
    state.value.playlistRefreshToken = 0
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
    || state.value.nestedAction === 'artist_history'
    || state.value.nestedAction === 'merge_artist'
    || state.value.creationFlow !== null
    || state.value.musicEditor?.entity === 'artist'
    || state.value.musicEditor?.entity === 'album'
  ))
  const isAlbumShifted = computed(() => (
    state.value.nestedAction === 'revise'
    || state.value.nestedAction === 'history'
    || state.value.nestedAction === 'discussion'
    || state.value.nestedAction === 'merge_album'
    || (state.value.musicEditor?.entity === 'album' && state.value.musicEditor?.mode === 'edit')
  ))
  const isCreationFlowOpen = computed(() => state.value.creationFlow !== null)
  const isMusicEditorOpen = computed(() => state.value.musicEditor !== null)

  return {
    state,
    openArtist, closeArtist, refreshArtist,
    openAlbum, closeAlbum, refreshAlbum,
    openPlaylist, closePlaylist, refreshPlaylists,
    openNestedAction, closeNestedAction,
    openMusicEditor, closeMusicEditor,
    openMusicCreationFlow,
    setMusicCreationStep,
    closeMusicCreationFlow,
    closeAll,
    isMainShifted, isArtistShifted, isAlbumShifted,
    isCreationFlowOpen,
    isMusicEditorOpen,
    layers: sheetStack.layers,
    topLayer: sheetStack.top,
    popLayer: sheetStack.pop,
    popToLayer: sheetStack.popTo,
    isTopLayer: sheetStack.isTop,
    isLayerShifted: sheetStack.isShifted,
  }
}
