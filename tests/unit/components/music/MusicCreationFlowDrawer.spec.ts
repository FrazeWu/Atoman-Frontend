import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicCreationFlowDrawer from '@/components/music/MusicCreationFlowDrawer.vue'
import * as musicApi from '@/api/musicV1'

const mocks = {
  state: ref({
    creationFlow: null as null | {
      step: 'artist' | 'albumSeed' | 'albumDetails'
      draft: {
        artist: {
          id: string | null
          avatarUrl: string
          name: string
          country: string
          birthday: string
          bio: string
          source: string
        }
        albumSeed: { title: string; uploadedAssets: Array<{ id: string; url: string }> }
        albumDetails: {
          coverUrl: string
          title: string
          releaseDate: string
          type: 'album'
          bio: string
          source: string
        }
        tracks: Array<{
          id: string
          sequence: number
          title: string
          audioUrl: string
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

vi.mock('@/api/musicV1', () => ({
  buildArtistEditFromCreationFlow: vi.fn((artist: {
    avatarUrl: string
    name: string
    country: string
    birthday: string
    bio: string
    source: string
  }) => ({
    type: 'create_artist',
    entity_type: 'artist',
    payload: {
      name: artist.name,
      image_url: artist.avatarUrl || undefined,
      nationality: artist.country,
      birth_date: artist.birthday,
      bio: artist.bio,
    },
    reason: 'Create artist and debut album from music creation flow',
    sources: artist.source ? [{ type: 'url', url: artist.source }] : [],
  })),
  buildAlbumEditFromCreationFlow: vi.fn((album: {
    coverUrl: string
    title: string
    releaseDate: string
    type: string
    bio: string
    source: string
  }, artistId: string) => ({
    type: 'create_album',
    entity_type: 'album',
    payload: {
      title: album.title,
      artist_ids: [artistId],
      release_date: album.releaseDate,
      description: album.bio,
      album_type: album.type,
      cover_url: album.coverUrl || undefined,
    },
    reason: 'Create artist and debut album from music creation flow',
    sources: album.source ? [{ type: 'url', url: album.source }] : [],
  })),
  cancelMusicEdit: vi.fn(),
  revertMusicEdit: vi.fn(),
  submitMusicEdit: vi.fn(),
}))

const cancelMusicEditMock = musicApi.cancelMusicEdit as ReturnType<typeof vi.fn>
const revertMusicEditMock = musicApi.revertMusicEdit as ReturnType<typeof vi.fn>
const submitMusicEditMock = musicApi.submitMusicEdit as ReturnType<typeof vi.fn>

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
    template: '<section data-testid="album-seed-step">real album seed component</section>',
  },
}))

vi.mock('@/components/music/MusicCreationAlbumDetailsStep.vue', () => ({
  default: {
    name: 'MusicCreationAlbumDetailsStep',
    template: `
      <section data-testid="album-details-step">
        <div data-testid="album-details-title">{{ title }}</div>
        <div data-testid="album-details-track-count">{{ trackCount }}</div>
        <div data-testid="album-details-footer">
          <button data-testid="album-details-finish-button" type="button">完成</button>
        </div>
      </section>
    `,
    setup() {
      return {
        title: computed(() => mocks.state.value.creationFlow?.draft.albumDetails.title ?? ''),
        trackCount: computed(() => String(mocks.state.value.creationFlow?.draft.tracks.length ?? 0)),
      }
    },
  },
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: mocks.state,
    closeMusicCreationFlow: mocks.closeMusicCreationFlow,
    setMusicCreationStep: mocks.setMusicCreationStep,
    isCreationFlowOpen: computed(() => mocks.state.value.creationFlow !== null),
  }),
}))

describe('MusicCreationFlowDrawer.vue', () => {
  beforeEach(() => {
    cancelMusicEditMock.mockReset()
    revertMusicEditMock.mockReset()
    submitMusicEditMock.mockReset()
    mocks.closeMusicCreationFlow.mockReset()
    mocks.closeMusicCreationFlow.mockImplementation(() => {
      mocks.state.value.creationFlow = null
    })
    mocks.setMusicCreationStep.mockReset()
    mocks.setMusicCreationStep.mockImplementation((step: 'artist' | 'albumSeed' | 'albumDetails') => {
      if (mocks.state.value.creationFlow) {
        mocks.state.value.creationFlow.step = step
      }
    })
    mocks.state.value.creationFlow = {
      step: 'artist',
      draft: {
        artist: {
          id: 'artist-seeded',
          avatarUrl: '',
          name: '',
          country: '',
          birthday: '',
          bio: '',
          source: '',
        },
        albumSeed: { title: '', uploadedAssets: [] },
        albumDetails: {
          coverUrl: '',
          title: '',
          releaseDate: '',
          type: 'album',
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

  it('asks for confirmation before discarding a dirty draft and stays open when confirmation is rejected', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    if (mocks.state.value.creationFlow) {
      mocks.state.value.creationFlow.draft.artist.name = 'kanye_west'
      mocks.state.value.creationFlow.dirty = true
    }

    const wrapper = mount(MusicCreationFlowDrawer)
    await wrapper.get('[data-testid="music-creation-close-button"]').trigger('click')

    expect(confirmSpy).toHaveBeenCalledWith('确认关闭？未完成的艺术家/专辑创建不会保存。')
    expect(mocks.closeMusicCreationFlow).not.toHaveBeenCalled()
    expect(mocks.state.value.creationFlow).not.toBeNull()
  })

  it('closes immediately without confirmation when the draft is clean', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="music-creation-close-button"]').trigger('click')

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(mocks.closeMusicCreationFlow).toHaveBeenCalledTimes(1)
    expect(mocks.state.value.creationFlow).toBeNull()
  })

  it('renders the artist shell when the creation flow opens on the artist step', () => {
    const wrapper = mount(MusicCreationFlowDrawer)

    expect(wrapper.text()).toContain('创建艺术家')
    expect(wrapper.get('[data-testid="creation-flow-footer"]').text()).toContain('关闭')
    expect(wrapper.text()).toContain('下一步')
    expect(wrapper.text()).toContain('第 1 步')
    expect(wrapper.findAll('[data-testid="artist-step"] button')).toHaveLength(0)
  })

  it('writes artist fields in the locked order and advances to album seed without losing seeded artist id', async () => {
    const wrapper = mount(MusicCreationFlowDrawer)

    await wrapper.get('[data-testid="artist-name-input"]').setValue('kanye_west')
    await wrapper.get('[data-testid="artist-country-input"]').setValue('United States')
    await wrapper.get('[data-testid="artist-birthday-input"]').setValue('1977-06-08')
    await wrapper.get('[data-testid="artist-bio-input"]').setValue('bio')
    await wrapper.get('[data-testid="artist-source-input"]').setValue('wiki')
    await wrapper.get('[data-testid="artist-next-button"]').trigger('click')

    expect(mocks.state.value.creationFlow?.draft.artist).toMatchObject({
      id: 'artist-seeded',
      name: 'kanye_west',
      country: 'United States',
      birthday: '1977-06-08',
      bio: 'bio',
      source: 'wiki',
    })
    expect(mocks.setMusicCreationStep).toHaveBeenCalledWith('albumSeed')
    expect(mocks.state.value.creationFlow?.step).toBe('albumSeed')
  })

  it('renders the album seed step component when the flow reaches albumSeed', () => {
    if (mocks.state.value.creationFlow) {
      mocks.state.value.creationFlow.step = 'albumSeed'
    }

    const wrapper = mount(MusicCreationFlowDrawer)

    expect(wrapper.text()).toContain('上传音频')
    expect(wrapper.text()).toContain('第 2 步')
    expect(wrapper.get('[data-testid="album-seed-step"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="creation-flow-footer"]').exists()).toBe(false)
  })

  it('renders the real album details step with seeded draft data after album seed handoff', async () => {
    if (mocks.state.value.creationFlow) {
      mocks.state.value.creationFlow.step = 'albumDetails'
      mocks.state.value.creationFlow.draft.artist.id = 'artist-seeded'
      mocks.state.value.creationFlow.draft.albumSeed.title = 'Late Registration'
      mocks.state.value.creationFlow.draft.albumDetails = {
        coverUrl: 'https://img.example/cover.jpg',
        title: 'Late Registration',
        releaseDate: '2005-08-30',
        type: 'album',
        bio: 'second studio album',
        source: 'https://en.wikipedia.org/wiki/Late_Registration',
      }
      mocks.state.value.creationFlow.draft.tracks = [
        { id: 'track-1', sequence: 1, title: 'Wake Up Mr. West', audioUrl: 'https://audio/1.mp3' },
        { id: 'track-2', sequence: 2, title: 'Heard Em Say', audioUrl: 'https://audio/2.mp3' },
      ]
    }

    const wrapper = mount(MusicCreationFlowDrawer)

    expect(wrapper.text()).toContain('完善专辑')
    expect(wrapper.text()).toContain('第 3 步')
    expect(wrapper.find('[data-testid="creation-flow-footer"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="album-details-step"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="album-details-title"]').text()).toBe('Late Registration')
    expect(wrapper.get('[data-testid="album-details-track-count"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="album-details-footer"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="music-creation-finish-button"]').text()).toContain('完成')
    expect(wrapper.get('[data-testid="music-creation-close-button"]').text()).toContain('关闭')
    expect(mocks.closeMusicCreationFlow).not.toHaveBeenCalled()

    // Assert back button exists in parent footer
    const backBtn = wrapper.get('[data-testid="album-details-back-button"]')
    expect(backBtn.text()).toContain('返回上一步')
    await backBtn.trigger('click')
    expect(mocks.setMusicCreationStep).toHaveBeenCalledWith('albumSeed')
  })

  it('clears the flow after creating artist then album successfully from step 3', async () => {
    submitMusicEditMock
      .mockResolvedValueOnce({
        id: 'artist-edit',
        type: 'create_artist',
        status: 'applied',
        entity_type: 'artist',
        entity_id: 'artist-created',
        submitted_by: 'user-1',
        auto_applied: true,
        votable: false,
        votes: { yes: 0, no: 0 },
        created_at: '2026-06-21T00:00:00Z',
      })
      .mockResolvedValueOnce({
        id: 'album-edit',
        type: 'create_album',
        status: 'applied',
        entity_type: 'album',
        entity_id: 'album-created',
        submitted_by: 'user-1',
        auto_applied: true,
        votable: false,
        votes: { yes: 0, no: 0 },
        created_at: '2026-06-21T00:00:01Z',
      })

    if (mocks.state.value.creationFlow) {
      mocks.state.value.creationFlow.step = 'albumDetails'
      mocks.state.value.creationFlow.draft.artist = {
        id: null,
        avatarUrl: 'https://img.example/artist.jpg',
        name: 'kanye_west',
        country: 'United States',
        birthday: '1977-06-08',
        bio: 'artist bio',
        source: 'https://artist.example',
      }
      mocks.state.value.creationFlow.draft.albumDetails = {
        coverUrl: 'https://img.example/cover.jpg',
        title: 'Late Registration',
        releaseDate: '2005-08-30',
        type: 'album',
        bio: 'album bio',
        source: 'https://album.example',
      }
      mocks.state.value.creationFlow.draft.tracks = [
        { id: 'track-1', sequence: 1, title: 'Wake Up Mr. West', audioUrl: 'https://audio/1.mp3' },
      ]
    }

    const wrapper = mount(MusicCreationFlowDrawer)
    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(submitMusicEditMock).toHaveBeenCalledTimes(2)
    expect(submitMusicEditMock.mock.calls[0]?.[0]).toMatchObject({
      type: 'create_artist',
      entity_type: 'artist',
      payload: {
        name: 'kanye_west',
        image_url: 'https://img.example/artist.jpg',
        nationality: 'United States',
        birth_date: '1977-06-08',
        bio: 'artist bio',
      },
      reason: 'Create artist and debut album from music creation flow',
      sources: [{ type: 'url', url: 'https://artist.example' }],
    })
    expect(submitMusicEditMock.mock.calls[1]?.[0]).toMatchObject({
      type: 'create_album',
      entity_type: 'album',
      payload: {
        title: 'Late Registration',
        artist_ids: ['artist-created'],
        release_date: '2005-08-30',
        description: 'album bio',
        album_type: 'album',
        cover_url: 'https://img.example/cover.jpg',
      },
      reason: 'Create artist and debut album from music creation flow',
      sources: [{ type: 'url', url: 'https://album.example' }],
    })
    expect(mocks.closeMusicCreationFlow).toHaveBeenCalledTimes(1)
    expect(mocks.state.value.creationFlow).toBeNull()
    expect(wrapper.find('[data-testid="music-creation-error"]').exists()).toBe(false)
  })

  it('creates the album under the seeded artist without creating a new artist', async () => {
    submitMusicEditMock.mockResolvedValueOnce({
      id: 'album-edit',
      type: 'create_album',
      status: 'applied',
      entity_type: 'album',
      entity_id: 'album-created',
      submitted_by: 'user-1',
      auto_applied: true,
      votable: false,
      votes: { yes: 0, no: 0 },
      created_at: '2026-06-21T00:00:01Z',
    })

    if (mocks.state.value.creationFlow) {
      mocks.state.value.creationFlow.step = 'albumDetails'
      mocks.state.value.creationFlow.draft.artist = {
        id: 'artist-seeded',
        avatarUrl: '',
        name: 'kanye_west',
        country: 'United States',
        birthday: '1977-06-08',
        bio: 'artist bio',
        source: 'https://artist.example',
      }
      mocks.state.value.creationFlow.draft.albumDetails = {
        coverUrl: '',
        title: 'Late Registration',
        releaseDate: '2005-08-30',
        type: 'album',
        bio: 'album bio',
        source: 'https://album.example',
      }
    }

    const wrapper = mount(MusicCreationFlowDrawer)
    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(submitMusicEditMock).toHaveBeenCalledTimes(1)
    expect(submitMusicEditMock.mock.calls[0]?.[0]).toMatchObject({
      type: 'create_album',
      entity_type: 'album',
      payload: {
        title: 'Late Registration',
        artist_ids: ['artist-seeded'],
        release_date: '2005-08-30',
        description: 'album bio',
        album_type: 'album',
      },
    })
    expect(mocks.closeMusicCreationFlow).toHaveBeenCalledTimes(1)
    expect(revertMusicEditMock).not.toHaveBeenCalled()
    expect(cancelMusicEditMock).not.toHaveBeenCalled()
  })

  it('reverts a newly created artist and keeps the drawer open when album creation fails', async () => {
    submitMusicEditMock
      .mockResolvedValueOnce({
        id: 'artist-edit',
        type: 'create_artist',
        status: 'applied',
        entity_type: 'artist',
        entity_id: 'artist-created',
        submitted_by: 'user-1',
        auto_applied: true,
        votable: false,
        votes: { yes: 0, no: 0 },
        created_at: '2026-06-21T00:00:00Z',
      })
      .mockRejectedValueOnce(new Error('album failed'))
    revertMusicEditMock.mockResolvedValueOnce({
      id: 'artist-edit',
      type: 'create_artist',
      status: 'reverted',
      entity_type: 'artist',
      entity_id: 'artist-created',
      submitted_by: 'user-1',
      auto_applied: true,
      votable: false,
      votes: { yes: 0, no: 0 },
      created_at: '2026-06-21T00:00:02Z',
    })

    if (mocks.state.value.creationFlow) {
      mocks.state.value.creationFlow.step = 'albumDetails'
      mocks.state.value.creationFlow.draft.artist = {
        id: null,
        avatarUrl: '',
        name: 'kanye_west',
        country: 'United States',
        birthday: '1977-06-08',
        bio: 'artist bio',
        source: 'https://artist.example',
      }
      mocks.state.value.creationFlow.draft.albumDetails = {
        coverUrl: '',
        title: 'Late Registration',
        releaseDate: '2005-08-30',
        type: 'album',
        bio: 'album bio',
        source: 'https://album.example',
      }
      mocks.state.value.creationFlow.draft.tracks = [
        { id: 'track-1', sequence: 1, title: 'Wake Up Mr. West', audioUrl: 'https://audio/1.mp3' },
      ]
    }

    const wrapper = mount(MusicCreationFlowDrawer)
    await wrapper.get('[data-testid="music-creation-finish-button"]').trigger('click')
    await flushPromises()

    expect(submitMusicEditMock).toHaveBeenCalledTimes(2)
    expect(revertMusicEditMock).toHaveBeenCalledWith(
      'artist-edit',
      'Rollback artist creation after album creation failed in music creation flow',
    )
    expect(cancelMusicEditMock).not.toHaveBeenCalled()
    expect(mocks.closeMusicCreationFlow).not.toHaveBeenCalled()
    expect(mocks.state.value.creationFlow).not.toBeNull()
    expect(mocks.state.value.creationFlow?.submitting).toBe(false)
    expect(mocks.state.value.creationFlow?.draft.artist.name).toBe('kanye_west')
    expect(mocks.state.value.creationFlow?.draft.albumDetails.title).toBe('Late Registration')
    expect(wrapper.get('[data-testid="music-creation-error"]').text()).toContain('album failed')
  })
})
