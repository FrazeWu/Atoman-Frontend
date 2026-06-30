import { flushPromises, mount } from '@vue/test-utils'
import { computed, nextTick, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import * as musicApi from '@/api/musicV1'

const drawerMocks = {
  state: ref({
    artistId: null as string | null,
    creationFlow: null as null | {
      step: 'artist' | 'albumImport' | 'albumDetails'
      draft: {
        artist: {
          id: string | null
          avatarUrl: string
          name: string
          country: string
          birthday: string
          legalName: string
          avatarAsset?: { id: string; url: string } | null
          stageNames: Array<{
            id: string
            name: string
            isPrimary: boolean
            startDateText: string
            endDateText: string
          }>
          nationality: string
          birthPlace: string
          birthDate: string
          bio: string
          source: string
        }
        albumImport: {
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
        albumSeed: {
          title: string
          uploadedAssets: Array<{
            id: string
            url: string
          }>
        }
        albumDetails: {
          coverUrl: string
          coverAsset?: { id: string; url: string } | null
          title: string
          releaseDate: string
          type: string
          releaseYear: string
          bio: string
          source: string
        }
        tracks: Array<{
          id: string
          sequence: number
          title: string
          audioUrl?: string
          audioKey?: string
          origin?: string
        }>
      }
      dirty: boolean
      submitting: boolean
      errorMessage: string
    },
  }),
  closeMusicCreationFlow: vi.fn(),
  setMusicCreationStep: vi.fn(),
}

const routeQuery = reactive<Record<string, string | undefined>>({})
const mountedWrappers: Array<{ unmount: () => void }> = []

const homeMocks = vi.hoisted(() => ({
  listMusicAlbums: vi.fn(),
  listMusicArtists: vi.fn(),
  openAlbum: vi.fn(),
  closeAlbum: vi.fn(),
  openArtist: vi.fn(),
  closeArtist: vi.fn(),
  openMusicCreationFlow: vi.fn(),
}))

afterEach(() => {
  while (mountedWrappers.length) {
    mountedWrappers.pop()?.unmount()
  }
})

vi.mock('@/api/musicV1', async () => {
  const actual = await vi.importActual<typeof import('@/api/musicV1')>('@/api/musicV1')
  return {
    ...actual,
    listMusicAlbums: homeMocks.listMusicAlbums,
    listMusicArtists: homeMocks.listMusicArtists,
    buildArtistEditFromCreationFlow: vi.fn(),
    buildAlbumEditFromCreationFlow: vi.fn(),
    cancelMusicEdit: vi.fn(),
    revertMusicEdit: vi.fn(),
    submitMusicEdit: vi.fn(),
  }
})

const cancelMusicEditMock = musicApi.cancelMusicEdit as ReturnType<typeof vi.fn>
const revertMusicEditMock = musicApi.revertMusicEdit as ReturnType<typeof vi.fn>
const submitMusicEditMock = musicApi.submitMusicEdit as ReturnType<typeof vi.fn>

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeQuery,
  }),
}))

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    name: 'PSheet',
    props: ['show', 'width', 'isShifted'],
    template: '<section><slot /></section>',
  },
}))

vi.mock('@/components/music/MusicCreationAlbumSeedStep.vue', () => ({
  default: {
    name: 'MusicCreationAlbumSeedStep',
    template: '<section data-testid="album-seed-step">legacy album seed component</section>',
  },
}))

vi.mock('@/components/music/MusicCreationAlbumDetailsStep.vue', () => ({
  default: {
    name: 'MusicCreationAlbumDetailsStep',
    template: '<section data-testid="album-details-step">legacy album details component</section>',
  },
}))

vi.mock('@/components/music/MusicCreationArtistStep.vue', () => ({
  default: {
    name: 'MusicCreationArtistStep',
    template: '<section data-testid="artist-step"><button type="button">artist action</button></section>',
  },
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerMocks.state,
    openAlbum: homeMocks.openAlbum,
    closeAlbum: homeMocks.closeAlbum,
    openArtist: homeMocks.openArtist,
    closeArtist: homeMocks.closeArtist,
    openMusicCreationFlow: homeMocks.openMusicCreationFlow,
    closeMusicCreationFlow: drawerMocks.closeMusicCreationFlow,
    setMusicCreationStep: drawerMocks.setMusicCreationStep,
    isMainShifted: computed(() => false),
    isCreationFlowOpen: computed(() => drawerMocks.state.value.creationFlow !== null),
  }),
}))

describe('Music HomeView search entry', () => {
  beforeEach(() => {
    homeMocks.listMusicAlbums.mockReset()
    homeMocks.listMusicArtists.mockReset()
    homeMocks.openAlbum.mockReset()
    homeMocks.closeAlbum.mockReset()
    homeMocks.openArtist.mockReset()
    homeMocks.closeArtist.mockReset()
    homeMocks.openMusicCreationFlow.mockReset()
    for (const key of Object.keys(routeQuery)) {
      delete routeQuery[key]
    }
    homeMocks.listMusicAlbums.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 48, total: 0, has_more: false },
    })
    homeMocks.listMusicArtists.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 12, total: 0, has_more: false },
    })
  })

  it('uses music-search-input and both CTAs open artist creation with the new copy', async () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: true,
        },
      },
    })
    mountedWrappers.push(wrapper)

    await flushPromises()

    const searchInput = wrapper.get('[data-testid="music-search-input"]')
    expect(searchInput.attributes('placeholder')).toBe('搜索艺术家 / 专辑...')
    expect(wrapper.text()).toContain('找不到？添加艺术家和首张专辑')

    await wrapper.get('.search-bar .paper-action').trigger('click')
    expect(homeMocks.openMusicCreationFlow).toHaveBeenNthCalledWith(1, { startStep: 'artist' })

    await wrapper.get('[data-testid="empty-add-artist-and-album"]').trigger('click')

    expect(homeMocks.openMusicCreationFlow).toHaveBeenNthCalledWith(2, { startStep: 'artist' })
  })

  it('keeps album results when artist search fails', async () => {
    homeMocks.listMusicAlbums.mockImplementation(async ({ q }: { q?: string }) => {
      if (q === 'album') {
        return {
          data: [
            {
              id: 'album-1',
              title: 'Album Survives',
              cover_url: '',
              release_date: '2024-01-01',
              year: 2024,
              album_type: 'album',
              entry_status: 'confirmed',
              hot_score: 88,
              artists: [{ id: 'artist-1', name: 'Artist One' }],
            },
          ],
          meta: { page: 1, page_size: 48, total: 1, has_more: false },
        }
      }
      return {
        data: [],
        meta: { page: 1, page_size: 48, total: 0, has_more: false },
      }
    })
    homeMocks.listMusicArtists.mockRejectedValueOnce(new Error('artist search failed'))

    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: true,
        },
      },
    })
    mountedWrappers.push(wrapper)

    await wrapper.get('[data-testid="music-search-input"]').setValue('album')
    await flushPromises()

    expect(wrapper.text()).toContain('Album Survives')
    expect(wrapper.findAll('[data-testid="album-card"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="artist-card"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('专辑列表加载失败')
  })

  it('ignores stale responses when a newer search resolves first', async () => {
    let resolveFirstAlbums!: (value: { data: Array<any>; meta: any }) => void
    const firstAlbums = new Promise<{ data: Array<any>; meta: any }>((resolve) => {
      resolveFirstAlbums = resolve
    })
    const secondAlbums = Promise.resolve({
      data: [
        {
          id: 'album-new',
          title: 'Newest Album',
          cover_url: '',
          release_date: '2025-01-01',
          year: 2025,
          album_type: 'album',
          entry_status: 'confirmed',
          hot_score: 91,
          artists: [],
        },
      ],
      meta: { page: 1, page_size: 48, total: 1, has_more: false },
    })
    homeMocks.listMusicAlbums.mockImplementation(() => {
      return homeMocks.listMusicAlbums.mock.calls.length === 1 ? firstAlbums : secondAlbums
    })

    let resolveFirstArtists!: (value: { data: Array<any>; meta: any }) => void
    const firstArtists = new Promise<{ data: Array<any>; meta: any }>((resolve) => {
      resolveFirstArtists = resolve
    })
    const secondArtists = Promise.resolve({
      data: [],
      meta: { page: 1, page_size: 12, total: 0, has_more: false },
    })
    homeMocks.listMusicArtists.mockImplementation(() => {
      return homeMocks.listMusicArtists.mock.calls.length === 1 ? firstArtists : secondArtists
    })

    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: true,
        },
      },
    })
    mountedWrappers.push(wrapper)

    await wrapper.get('[data-testid="music-search-input"]').setValue('old')
    await wrapper.get('[data-testid="music-search-input"]').setValue('new')
    await flushPromises()

    resolveFirstAlbums({
      data: [
        {
          id: 'album-old',
          title: 'Old Album',
          cover_url: '',
          release_date: '2023-01-01',
          year: 2023,
          album_type: 'album',
          entry_status: 'confirmed',
          hot_score: 70,
          artists: [],
        },
      ],
      meta: { page: 1, page_size: 48, total: 1, has_more: false },
    })
    resolveFirstArtists({
      data: [],
      meta: { page: 1, page_size: 12, total: 0, has_more: false },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Newest Album')
    expect(wrapper.text()).not.toContain('Old Album')
  })

  it('closes artist and album drawers after matching route query params are removed', async () => {
    routeQuery.artist = 'artist-9'
    routeQuery.album = 'album-7'

    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          ArtistDrawer: true,
          AlbumDrawer: true,
          NestedActionDrawer: true,
          MusicCreationFlowDrawer: true,
        },
      },
    })
    mountedWrappers.push(wrapper)
    await flushPromises()

    expect(homeMocks.openArtist).toHaveBeenCalledWith('artist-9')
    expect(homeMocks.openAlbum).toHaveBeenCalledWith('album-7')
    homeMocks.closeArtist.mockReset()
    homeMocks.closeAlbum.mockReset()

    delete routeQuery.artist
    delete routeQuery.album
    await nextTick()

    expect(homeMocks.closeArtist).toHaveBeenCalledTimes(1)
    expect(homeMocks.closeAlbum).toHaveBeenCalledTimes(1)
  })
})

describe('useMusicDrawers creation flow draft model', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('creates the new artist and album seed draft skeleton', async () => {
    const module = await vi.importActual<typeof import('@/composables/useMusicDrawers')>('@/composables/useMusicDrawers')
    const drawers = module.useMusicDrawers()
    drawers.closeAll()

    drawers.openMusicCreationFlow({ artistId: 'artist-7', startStep: 'albumImport' })

    expect(drawers.state.value.creationFlow?.step).toBe('albumImport')
    expect(drawers.state.value.creationFlow?.draft).toEqual({
      artist: {
        id: 'artist-7',
        avatarUrl: '',
        name: '',
        country: '',
        birthday: '',
        legalName: '',
        avatarAsset: null,
        stageNames: [
          {
            id: 'stage-name-primary',
            name: '',
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
    })
  })
})

describe('MusicCreationFlowDrawer.vue shell', () => {
  beforeEach(() => {
    cancelMusicEditMock.mockReset()
    revertMusicEditMock.mockReset()
    submitMusicEditMock.mockReset()
    drawerMocks.closeMusicCreationFlow.mockReset()
    drawerMocks.closeMusicCreationFlow.mockImplementation(() => {
      drawerMocks.state.value.creationFlow = null
    })
    drawerMocks.setMusicCreationStep.mockReset()
    drawerMocks.setMusicCreationStep.mockImplementation((step: 'artist' | 'albumImport' | 'albumDetails') => {
      if (drawerMocks.state.value.creationFlow) {
        drawerMocks.state.value.creationFlow.step = step
      }
    })
    drawerMocks.state.value.artistId = null
    drawerMocks.state.value.creationFlow = {
      step: 'artist',
      draft: {
        artist: {
          id: 'artist-seeded',
          avatarUrl: '',
          name: '',
          country: '',
          birthday: '',
          legalName: '',
          avatarAsset: null,
          stageNames: [
            {
              id: 'stage-name-primary',
              name: '',
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
      },
      dirty: false,
      submitting: false,
      errorMessage: '',
    }
  })

  it('renders the artist shell when the flow opens on the artist step', () => {
    const wrapper = mount(MusicCreationFlowDrawer)

    expect(wrapper.text()).toContain('创建艺术家')
    expect(wrapper.get('[data-testid="creation-flow-footer"]').text()).toContain('关闭')
    expect(wrapper.text()).toContain('下一步')
    expect(wrapper.text()).toContain('第 1 步')
    expect(wrapper.findAll('[data-testid="artist-step"] button')).toHaveLength(1)
  })
})
