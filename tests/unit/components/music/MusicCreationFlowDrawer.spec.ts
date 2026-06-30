import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import type { MusicCreationFlowState } from '@/components/music/musicCreationTypes'
import * as musicApi from '@/api/musicV1'

const createFlowState = (overrides: Partial<MusicCreationFlowState> = {}): MusicCreationFlowState => ({
  step: 'albumImport',
  draft: {
    artist: {
      id: 'artist-seeded',
      avatarUrl: '',
      name: '',
      country: '',
      birthday: '',
      legalName: 'Seeded Artist',
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
      importId: 'import-1',
      archiveName: 'seed.zip',
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
  ...overrides,
})

const drawerMocks = {
  state: ref({
    artistId: null as string | null,
    creationFlow: null as MusicCreationFlowState | null,
  }),
  closeMusicCreationFlow: vi.fn(),
  setMusicCreationStep: vi.fn(),
}

vi.mock('@/api/musicV1', async () => {
  const actual = await vi.importActual<typeof import('@/api/musicV1')>('@/api/musicV1')
  return {
    ...actual,
    commitMusicAlbumImport: vi.fn(),
  }
})

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    name: 'PSheet',
    props: ['show', 'width', 'index'],
    template: '<section v-if="show"><slot /></section>',
  },
}))

vi.mock('@/components/music/MusicCreationArtistStep.vue', () => ({
  default: {
    name: 'MusicCreationArtistStep',
    template: '<section data-testid="artist-step">artist step</section>',
  },
}))

vi.mock('@/components/music/MusicCreationAlbumDetailsStep.vue', () => ({
  default: {
    name: 'MusicCreationAlbumDetailsStep',
    template: '<section data-testid="album-details-step">album details step</section>',
  },
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerMocks.state,
    closeMusicCreationFlow: drawerMocks.closeMusicCreationFlow,
    setMusicCreationStep: drawerMocks.setMusicCreationStep,
    isMainShifted: computed(() => false),
    isCreationFlowOpen: computed(() => drawerMocks.state.value.creationFlow !== null),
  }),
}))

const commitMusicAlbumImportMock = vi.mocked(
  (musicApi as typeof musicApi & {
    commitMusicAlbumImport: ReturnType<typeof vi.fn>
  }).commitMusicAlbumImport,
)

describe('MusicCreationFlowDrawer', () => {
  beforeEach(() => {
    commitMusicAlbumImportMock.mockReset()
    drawerMocks.closeMusicCreationFlow.mockReset()
    drawerMocks.closeMusicCreationFlow.mockImplementation(() => {
      drawerMocks.state.value.creationFlow = null
    })
    drawerMocks.setMusicCreationStep.mockReset()
    drawerMocks.setMusicCreationStep.mockImplementation((step: MusicCreationFlowState['step']) => {
      if (drawerMocks.state.value.creationFlow) {
        drawerMocks.state.value.creationFlow.step = step
      }
    })
    drawerMocks.state.value.artistId = null
    drawerMocks.state.value.creationFlow = createFlowState()
  })

  afterEach(() => {
    drawerMocks.state.value.creationFlow = null
  })

  it('回填 ready import 的专辑标题和曲目', async () => {
    const wrapper = mount(MusicCreationFlowDrawer)

    drawerMocks.state.value.creationFlow = createFlowState({
      draft: {
        ...createFlowState().draft,
        albumImport: {
          ...createFlowState().draft.albumImport,
          status: 'ready',
          derivedAlbumTitle: 'Imported Album',
          derivedCover: 'https://img.test/cover.jpg',
          derivedTracks: [
            { title: 'Track A', audioKey: 'audio-a', origin: 'import' },
            { title: 'Track B', audioKey: 'audio-b', origin: 'import' },
          ],
        },
      },
    })

    await flushPromises()

    const flow = drawerMocks.state.value.creationFlow
    expect(flow?.draft.albumDetails.title).toBe('Imported Album')
    expect(flow?.draft.albumDetails.coverUrl).toBe('https://img.test/cover.jpg')
    expect(flow?.draft.tracks).toEqual([
      { id: 'import-track-1', sequence: 1, title: 'Track A', audioKey: 'audio-a', origin: 'import' },
      { id: 'import-track-2', sequence: 2, title: 'Track B', audioKey: 'audio-b', origin: 'import' },
    ])

    wrapper.unmount()
  })

  it('最终按钮点击后只提交一次 commitMusicAlbumImport', async () => {
    commitMusicAlbumImportMock.mockResolvedValue({ importId: 'import-1', status: 'committed' })
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'albumDetails',
      draft: {
        ...createFlowState().draft,
        albumImport: {
          ...createFlowState().draft.albumImport,
          importId: 'import-1',
          status: 'ready',
        },
      },
    })

    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(commitMusicAlbumImportMock).toHaveBeenCalledTimes(1)
    expect(commitMusicAlbumImportMock).toHaveBeenCalledWith('import-1', {
      artist: {
        name: 'Seeded Artist',
        legal_name: 'Seeded Artist',
        stage_names: [],
        birth_place: '',
      },
      album: {
        title: '',
        release_year: 0,
        tracks: [],
      },
    })
    expect(drawerMocks.closeMusicCreationFlow).toHaveBeenCalledTimes(1)
  })

  it('提交失败时保留抽屉并显示错误', async () => {
    commitMusicAlbumImportMock.mockRejectedValue(new Error('commit failed'))
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'albumDetails',
      draft: {
        ...createFlowState().draft,
        albumImport: {
          ...createFlowState().draft.albumImport,
          importId: 'import-1',
          status: 'ready',
        },
      },
    })

    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(commitMusicAlbumImportMock).toHaveBeenCalledTimes(1)
    expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled()
    expect(drawerMocks.state.value.creationFlow).not.toBeNull()
    expect(wrapper.get('[data-testid="music-creation-error"]').text()).toContain('commit failed')
  })
})
