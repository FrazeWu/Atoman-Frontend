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
      kind: 'person',
      legalName: 'Seeded Artist',
      avatarAsset: null,
      stageNames: [
        {
          id: 'stage-name-primary',
          name: '',
          isPrimary: true,
          startDateParts: {
            year: '',
            month: '',
            day: '',
          },
          endDateParts: {
            year: '',
            month: '',
            day: '',
          },
          startDateText: '',
          endDateText: '',
        },
      ],
      nationality: '',
      birthPlace: '',
      birthDateParts: {
        year: '',
        month: '',
        day: '',
      },
      activeStartDateParts: {
        year: '',
        month: '',
        day: '',
      },
      activeEndDateParts: {
        year: '',
        month: '',
        day: '',
      },
      members: [],
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
      contributors: [
        {
          id: 'contributor-artist-seeded',
          artistId: 'artist-seeded',
          name: 'Seeded Artist',
          avatarUrl: '',
          kind: 'person',
          locked: false,
        },
      ],
      releaseDateParts: {
        year: '',
        month: '',
        day: '',
      },
      releaseDate: '',
      type: 'album',
      releaseYear: '',
      bio: '',
      source: '',
    },
    tracks: [],
  },
  tracksCustomized: false,
  titleCustomized: false,
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
  refreshArtist: vi.fn(),
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

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerMocks.state,
    closeMusicCreationFlow: drawerMocks.closeMusicCreationFlow,
    refreshArtist: drawerMocks.refreshArtist,
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
    drawerMocks.refreshArtist.mockReset()
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
    expect(flow?.draft.albumDetails.coverUrl).toBe('')
    expect(flow?.draft.albumImport.derivedCover).toBe('https://img.test/cover.jpg')
    expect(flow?.draft.tracks).toEqual([
      { id: 'import-track-1', sequence: 1, title: 'Track A', audioKey: 'audio-a', origin: 'import' },
      { id: 'import-track-2', sequence: 2, title: 'Track B', audioKey: 'audio-b', origin: 'import' },
    ])

    wrapper.unmount()
  })

  it('最终按钮点击后只提交一次 commitMusicAlbumImport', async () => {
    commitMusicAlbumImportMock.mockResolvedValue({ importId: 'import-1', status: 'committed' })
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'albumImport',
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
      artist_id: 'artist-seeded',
      artist: {
        name: 'Seeded Artist',
        legal_name: 'Seeded Artist',
        stage_names: [],
        birth_place: '',
      },
      artists: [
        {
          artist_id: 'artist-seeded',
          name: 'Seeded Artist',
          legal_name: '',
          stage_names: [],
          birth_place: '',
          artist_form: 'person',
          active_start_date: '',
          active_end_date: '',
          members: [],
        },
      ],
      album: {
        title: '',
        release_year: 0,
        tracks: [],
      },
    })
    expect(drawerMocks.closeMusicCreationFlow).toHaveBeenCalledTimes(1)
  })

  it.each(['uploading', 'extracting'] as const)(
    '%s 状态点击完成不会提交专辑导入',
    async (status) => {
      commitMusicAlbumImportMock.mockResolvedValue({ importId: 'import-1', status: 'committed' })
      drawerMocks.state.value.creationFlow = createFlowState({
        step: 'albumDetails',
        draft: {
          ...createFlowState().draft,
          albumImport: {
            ...createFlowState().draft.albumImport,
            importId: 'import-1',
            status,
          },
        },
      })

      const wrapper = mount(MusicCreationFlowDrawer)
      const finishButton = wrapper.get('[data-testid="music-creation-finish-button"]')

      expect(finishButton.attributes('disabled')).toBeDefined()

      await finishButton.trigger('click')
      await flushPromises()

      expect(commitMusicAlbumImportMock).not.toHaveBeenCalled()
      expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled()
    },
  )

  it('从已有艺术家进入时提交 artist_id 复用现有艺术家', async () => {
    commitMusicAlbumImportMock.mockResolvedValue({ importId: 'import-1', status: 'committed' })
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'albumImport',
      draft: {
        ...createFlowState().draft,
        artist: {
          ...createFlowState().draft.artist,
          id: 'artist-existing',
          legalName: '',
          stageNames: [
            {
              id: 'stage-name-primary',
              name: '',
              isPrimary: true,
              startDateParts: {
                year: '',
                month: '',
                day: '',
              },
              endDateParts: {
                year: '',
                month: '',
                day: '',
              },
              startDateText: '',
              endDateText: '',
            },
          ],
        },
        albumImport: {
          ...createFlowState().draft.albumImport,
          importId: 'import-1',
          status: 'ready',
        },
        albumDetails: {
          ...createFlowState().draft.albumDetails,
          title: 'Graduation',
          releaseDateParts: {
            year: '2007',
            month: '',
            day: '',
          },
          releaseYear: '',
        },
      },
    })

    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(commitMusicAlbumImportMock).toHaveBeenCalledWith('import-1', {
      artist_id: 'artist-existing',
      artist: {
        name: '',
        legal_name: '',
        stage_names: [],
        birth_place: '',
      },
      artists: [
        {
          artist_id: 'artist-existing',
          name: 'Seeded Artist',
          legal_name: '',
          stage_names: [],
          birth_place: '',
          artist_form: 'person',
          active_start_date: '',
          active_end_date: '',
          members: [],
        },
      ],
      album: {
        title: 'Graduation',
        release_year: 2007,
        tracks: [],
      },
    })
  })

  it('填写发行日期时会同时提交 release_date 和推导后的 release_year', async () => {
    commitMusicAlbumImportMock.mockResolvedValue({ importId: 'import-1', status: 'committed' })
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'albumImport',
      draft: {
        ...createFlowState().draft,
        albumImport: {
          ...createFlowState().draft.albumImport,
          importId: 'import-1',
          status: 'ready',
        },
        albumDetails: {
          ...createFlowState().draft.albumDetails,
          title: 'Late Registration',
          releaseDateParts: {
            year: '2005',
            month: '08',
            day: '30',
          },
          releaseDate: '1999-01-01',
          releaseYear: '1999',
        },
      },
    })

    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(commitMusicAlbumImportMock).toHaveBeenCalledWith('import-1', {
      artist_id: 'artist-seeded',
      artist: {
        name: 'Seeded Artist',
        legal_name: 'Seeded Artist',
        stage_names: [],
        birth_place: '',
      },
      artists: [
        {
          artist_id: 'artist-seeded',
          name: 'Seeded Artist',
          legal_name: '',
          stage_names: [],
          birth_place: '',
          artist_form: 'person',
          active_start_date: '',
          active_end_date: '',
          members: [],
        },
      ],
      album: {
        title: 'Late Registration',
        release_date: '2005-08-30',
        release_year: 2005,
        tracks: [],
      },
    })
  })

  it('提交时按当前曲目顺序重新生成连续 trackNumber', async () => {
    commitMusicAlbumImportMock.mockResolvedValue({ importId: 'import-1', status: 'committed' })
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'albumImport',
      draft: {
        ...createFlowState().draft,
        albumImport: {
          ...createFlowState().draft.albumImport,
          importId: 'import-1',
          status: 'ready',
        },
        albumDetails: {
          ...createFlowState().draft.albumDetails,
          title: 'Dragged Album',
        },
        tracks: [
          { id: 'track-9', sequence: 9, title: 'Outro' },
          { id: 'track-3', sequence: 3, title: 'Intro' },
          { id: 'track-5', sequence: 5, title: 'Middle' },
        ],
      },
    })

    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(commitMusicAlbumImportMock).toHaveBeenCalledWith('import-1', expect.objectContaining({
      artists: [
        expect.objectContaining({
          artist_id: 'artist-seeded',
        }),
      ],
      album: expect.objectContaining({
        title: 'Dragged Album',
        tracks: [
          { title: 'Outro', trackNumber: 1 },
          { title: 'Intro', trackNumber: 2 },
          { title: 'Middle', trackNumber: 3 },
        ],
      }),
    }))
  })

  it('提交流里会带上多个创作者，并保留锁定的新艺人', async () => {
    commitMusicAlbumImportMock.mockResolvedValue({ importId: 'import-1', status: 'committed' })
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'albumImport',
      draft: {
        ...createFlowState().draft,
        artist: {
          ...createFlowState().draft.artist,
          id: null,
          kind: 'group',
          legalName: '',
          stageNames: [
            {
              ...createFlowState().draft.artist.stageNames[0],
              name: 'Sweet Trip',
            },
          ],
        },
        albumImport: {
          ...createFlowState().draft.albumImport,
          importId: 'import-1',
          status: 'ready',
        },
        albumDetails: {
          ...createFlowState().draft.albumDetails,
          contributors: [
            {
              id: 'contributor-new-artist',
              artistId: null,
              name: 'Sweet Trip',
              avatarUrl: '',
              kind: 'group',
              locked: true,
            },
            {
              id: 'contributor-artist-2',
              artistId: 'artist-2',
              name: 'Roby Burgos',
              avatarUrl: '',
              kind: 'person',
              locked: false,
            },
          ],
        },
      },
    })

    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(commitMusicAlbumImportMock).toHaveBeenCalledWith('import-1', expect.objectContaining({
      artists: [
        expect.objectContaining({
          artist_id: '',
          name: 'Sweet Trip',
          artist_form: 'group',
        }),
        expect.objectContaining({
          artist_id: 'artist-2',
          name: 'Roby Burgos',
        }),
      ],
    }))
  })

  it('ready import 不会覆盖已经手动调整过的曲目', async () => {
    const wrapper = mount(MusicCreationFlowDrawer)

    drawerMocks.state.value.creationFlow = createFlowState({
      tracksCustomized: true,
      draft: {
        ...createFlowState().draft,
        tracks: [
          { id: 'manual-1', sequence: 1, title: 'Manual Intro' },
          { id: 'manual-2', sequence: 2, title: 'Manual Outro' },
        ],
        albumImport: {
          ...createFlowState().draft.albumImport,
          status: 'ready',
          derivedAlbumTitle: 'Imported Album',
          derivedCover: 'https://img.test/cover.jpg',
          derivedTracks: [
            { title: 'Imported A', audioKey: 'audio-a', origin: 'import' },
            { title: 'Imported B', audioKey: 'audio-b', origin: 'import' },
          ],
        },
      },
    })

    await flushPromises()

    const flow = drawerMocks.state.value.creationFlow
    expect(flow?.draft.albumDetails.title).toBe('Imported Album')
    expect(flow?.draft.albumDetails.coverUrl).toBe('')
    expect(flow?.draft.albumImport.derivedCover).toBe('https://img.test/cover.jpg')
    expect(flow?.draft.tracks).toEqual([
      { id: 'manual-1', sequence: 1, title: 'Manual Intro' },
      { id: 'manual-2', sequence: 2, title: 'Manual Outro' },
    ])

    wrapper.unmount()
  })

  it('仅填写新的生日分段字段时，关闭前仍会视为有未保存内容', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false)
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'artist',
      draft: {
        ...createFlowState().draft,
        albumImport: {
          ...createFlowState().draft.albumImport,
          archiveName: '',
        },
        artist: {
          ...createFlowState().draft.artist,
          legalName: '',
          stageNames: [
            {
              ...createFlowState().draft.artist.stageNames[0],
              name: '',
            },
          ],
          birthDateParts: {
            year: '2001',
            month: '06',
            day: '08',
          },
          birthDate: '',
        },
      },
    })

    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="music-creation-close-button"]').trigger('click')

    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled()

    confirmMock.mockRestore()
  })

  it('提交失败时保留抽屉并显示错误', async () => {
    commitMusicAlbumImportMock.mockRejectedValue(new Error('commit failed'))
    drawerMocks.state.value.creationFlow = createFlowState({
      step: 'albumImport',
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
