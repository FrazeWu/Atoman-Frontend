import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'

const {
  openNestedAction,
  getMusicAlbum,
  playAlbum,
  listAlbumBookmarks,
  createAlbumBookmark,
  deleteAlbumBookmark,
} = vi.hoisted(() => ({
  openNestedAction: vi.fn(),
  getMusicAlbum: vi.fn(),
  playAlbum: vi.fn(),
  listAlbumBookmarks: vi.fn(),
  createAlbumBookmark: vi.fn(),
  deleteAlbumBookmark: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { albumId: '1' } },
    closeAlbum: vi.fn(),
    isAlbumShifted: { value: false },
    openNestedAction
  })
}))

vi.mock('@/api/musicV1', () => ({
  getMusicAlbum,
  listAlbumBookmarks,
  createAlbumBookmark,
  deleteAlbumBookmark,
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    playAlbum,
  }),
}))

describe('AlbumDrawer.vue', () => {
  beforeEach(() => {
    openNestedAction.mockReset()
    getMusicAlbum.mockReset()
    playAlbum.mockReset()
    listAlbumBookmarks.mockReset()
    createAlbumBookmark.mockReset()
    deleteAlbumBookmark.mockReset()
    getMusicAlbum.mockResolvedValue({
      id: '1',
      title: 'Test Album',
      release_date: '2024-01-01',
      album_type: 'album',
      entry_status: 'open',
      songs: [
        { id: '101', title: 'First Song', track_number: 1, audio_url: 'https://cdn.test/1.mp3' },
        { id: '102', title: 'Second Song', track_number: 2, audio_url: 'https://cdn.test/2.mp3' },
      ],
    })
    listAlbumBookmarks.mockResolvedValue({ data: [] })
    createAlbumBookmark.mockResolvedValue({
      id: 'album-bookmark-1',
      album_id: '1',
      created_at: '2026-07-02T00:00:00Z',
    })
    deleteAlbumBookmark.mockResolvedValue({ deleted: true })
  })

  it('renders correctly', () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })
    expect(wrapper.text()).toContain('Album Notes')
  })

  it('plays album songs through the player when clicking play album', async () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    await wrapper.get('button.p-button--primary').trigger('click')

    expect(playAlbum).toHaveBeenCalledTimes(1)
    expect(playAlbum).toHaveBeenCalledWith([
      expect.objectContaining({
        id: '101',
        title: 'First Song',
        audio_url: 'https://cdn.test/1.mp3',
        album: 'Test Album',
      }),
      expect.objectContaining({
        id: '102',
        title: 'Second Song',
        audio_url: 'https://cdn.test/2.mp3',
        album: 'Test Album',
      }),
    ])
  })

  it('plays a single track from the album queue at the clicked index', async () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()
    await wrapper.get('[data-testid="track-play-102"]').trigger('click')

    expect(playAlbum).toHaveBeenCalledTimes(1)
    expect(playAlbum).toHaveBeenCalledWith([
      expect.objectContaining({ id: '101', title: 'First Song' }),
      expect.objectContaining({ id: '102', title: 'Second Song' }),
    ], 1)
  })

  it('disables play button for tracks without audio', async () => {
    getMusicAlbum.mockResolvedValue({
      id: '1',
      title: 'Test Album',
      release_date: '2024-01-01',
      album_type: 'album',
      entry_status: 'open',
      songs: [
        { id: '101', title: 'Playable Song', track_number: 1, audio_url: 'https://cdn.test/1.mp3' },
        { id: '102', title: 'Missing Audio Song', track_number: 2, audio_url: '' },
      ],
    })

    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-testid="track-play-101"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="track-play-102"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('无音频')
  })

  it('supports uuid song ids for playable tracks', async () => {
    getMusicAlbum.mockResolvedValue({
      id: 'album-uuid',
      title: 'UUID Album',
      release_date: '2024-01-01',
      album_type: 'album',
      entry_status: 'open',
      songs: [
        { id: '019f-song-a', title: 'UUID Song A', track_number: 1, audio_url: 'https://cdn.test/a.wav' },
        { id: '019f-song-b', title: 'UUID Song B', track_number: 2, audio_url: 'https://cdn.test/b.wav' },
      ],
    })

    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()
    await wrapper.get('[data-testid="track-play-019f-song-b"]').trigger('click')

    expect(playAlbum).toHaveBeenCalledWith([
      expect.objectContaining({ id: '019f-song-a', title: 'UUID Song A' }),
      expect.objectContaining({ id: '019f-song-b', title: 'UUID Song B' }),
    ], 1)
  })

  it('does not show hard-coded discussion count or fake track durations when data is absent', async () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="discussion-fab"]').text()).toBe('讨论')
    expect(wrapper.text()).not.toContain('03:45')
    expect(wrapper.find('.track-time').exists()).toBe(false)
  })

  it('shows discussion count and track durations when real data exists', async () => {
    getMusicAlbum.mockResolvedValue({
      id: '1',
      title: 'Test Album',
      release_date: '2024-01-01',
      album_type: 'album',
      entry_status: 'open',
      discussion_count: 7,
      songs: [
        { id: 'song-1', title: 'First Song', track_number: 1, duration_sec: 125 },
      ],
    })

    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('[data-test="discussion-fab"]').text()).toBe('讨论(7)')
    expect(wrapper.get('.track-time').text()).toBe('2:05')
  })

  it('renders an edit entry that points to the album edit route', async () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    const editLink = wrapper.find('a.p-button')
    expect(editLink.exists()).toBe(true)
    expect(editLink.text()).toContain('编辑')
    expect(editLink.attributes('href')).toBe('/music/album/1/edit')
  })

  it('uses song cover as fallback when album cover is missing', async () => {
    getMusicAlbum.mockResolvedValue({
      id: '1',
      title: 'Test Album',
      release_date: '2024-01-01',
      album_type: 'album',
      entry_status: 'open',
      songs: [
        { id: '101', title: 'First Song', track_number: 1, audio_url: 'https://cdn.test/1.mp3', cover_url: 'https://cdn.test/cover.jpg' },
      ],
    })

    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('.album-cover-img').attributes('src')).toBe('https://cdn.test/cover.jpg')
  })

  it('falls back to cover placeholder text when album image fails to load', async () => {
    getMusicAlbum.mockResolvedValue({
      id: '1',
      title: 'Test Album',
      cover_url: 'https://cdn.test/broken-cover.jpg',
      release_date: '2024-01-01',
      album_type: 'album',
      entry_status: 'open',
      songs: [],
    })

    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()
    await wrapper.get('.album-cover-img').trigger('error')

    expect(wrapper.find('.album-cover-img').exists()).toBe(false)
    expect(wrapper.get('.album-cover').text()).toContain('COVER')
  })

  it('creates an album bookmark when clicking 订阅 and reflects the new state', async () => {
    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    const bookmarkButton = wrapper.get('[data-testid="album-bookmark-toggle"]')
    expect(bookmarkButton.text()).toContain('订阅')

    await bookmarkButton.trigger('click')
    await flushPromises()

    expect(createAlbumBookmark).toHaveBeenCalledWith('1')
    expect(wrapper.get('[data-testid="album-bookmark-toggle"]').text()).toContain('已订阅')
  })
})
