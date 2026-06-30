import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import HomeView from '@/views/music/HomeView.vue'
import { useMusicDrawers } from '@/composables/useMusicDrawers'
import * as musicApi from '@/api/musicV1'

const drawerMocks = {
  state: ref({
    artistId: null as string | null,
    creationFlow: null as null | {
      step: 'artist' | 'albumImport'
      draft: {
        artist: {
          id: string | null
          legalName: string
          stageNames: string[]
          nationality: string
          birthPlace: string
          birthDate: string
          bio: string
          source: string
        }
        albumImport: {
          importId: string | null
          archiveName: string
          status: 'idle' | 'uploading' | 'done' | 'error'
          uploadProgress: number
          uploadSpeed: string
          coverUrl: string
          coverKey: string
          errorMessage: string
        }
        albumDetails: {
          title: string
          releaseYear: string
          bio: string
          source: string
        }
        tracks: Array<{
          id: string
          sequence: number
          title: string
          audioKey: string
          origin: string
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

const homeMocks = vi.hoisted(() => ({
  listMusicAlbums: vi.fn(),
  listMusicArtists: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
  openMusicCreationFlow: vi.fn(),
  routeQuery: {} as Record<string, string>,
}))

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
    query: homeMocks.routeQuery,
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
    openArtist: homeMocks.openArtist,
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
    homeMocks.openArtist.mockReset()
    homeMocks.openMusicCreationFlow.mockReset()
    homeMocks.routeQuery = {}
    homeMocks.listMusicAlbums.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 48, total: 0, has_more: false },
    })
    homeMocks.listMusicArtists.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 12, total: 0, has_more: false },
    })
  })

  it('uses the new search placeholder and empty CTA opens artist step', async () => {
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

    await flushPromises()

    expect(wrapper.get('input.search-input').attributes('placeholder')).toBe('搜索艺术家 / 专辑...')

    await wrapper.get('[data-testid="empty-add-artist-and-album"]').trigger('click')

    expect(homeMocks.openMusicCreationFlow).toHaveBeenCalledWith({ startStep: 'artist' })
  })
})

describe('useMusicDrawers creation flow draft model', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('creates the new artist and albumImport draft skeleton', async () => {
    const module = await vi.importActual<typeof import('@/composables/useMusicDrawers')>('@/composables/useMusicDrawers')
    const drawers = module.useMusicDrawers()
    drawers.closeAll()

    drawers.openMusicCreationFlow({ artistId: 'artist-7', startStep: 'albumImport' })

    expect(drawers.state.value.creationFlow?.step).toBe('albumImport')
    expect(drawers.state.value.creationFlow?.draft).toEqual({
      artist: {
        id: 'artist-7',
        legalName: '',
        stageNames: [],
        nationality: '',
        birthPlace: '',
        birthDate: '',
        bio: '',
        source: '',
      },
      albumImport: {
        importId: null,
        archiveName: '',
        status: 'idle',
        uploadProgress: 0,
        uploadSpeed: '',
        coverUrl: '',
        coverKey: '',
        errorMessage: '',
      },
      albumDetails: {
        title: '',
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
    drawerMocks.setMusicCreationStep.mockImplementation((step: 'artist' | 'albumImport') => {
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
          legalName: '',
          stageNames: [],
          nationality: '',
          birthPlace: '',
          birthDate: '',
          bio: '',
          source: '',
        },
        albumImport: {
          importId: null,
          archiveName: '',
          status: 'idle',
          uploadProgress: 0,
          uploadSpeed: '',
          coverUrl: '',
          coverKey: '',
          errorMessage: '',
        },
        albumDetails: {
          title: '',
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

  it('asks for confirmation before discarding a draft with only album import data in the new model', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    if (drawerMocks.state.value.creationFlow) {
      drawerMocks.state.value.creationFlow.draft.albumImport.uploadProgress = 18
    }

    const wrapper = mount(MusicCreationFlowDrawer)
    wrapper.getComponent({ name: 'PSheet' }).vm.$emit('close')

    expect(confirmSpy).toHaveBeenCalledWith('确认关闭？未完成的艺术家/专辑创建不会保存。')
    expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled()
    expect(drawerMocks.state.value.creationFlow).not.toBeNull()
  })
})
