import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiErrorResponseError } from '@/api/client'
import AlbumDrawer from '@/components/music/AlbumDrawer.vue'

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    template: '<div><slot /></div>',
  },
}))

vi.mock('@/components/ui/PDiscussionFAB.vue', () => ({
  default: {
    props: ['count'],
    template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>',
  },
}))

const {
  openNestedAction,
  openMusicEditor,
  openAlbum,
  getMusicAlbum,
  playAlbum,
  listAlbumBookmarks,
  createAlbumBookmark,
  deleteAlbumBookmark,
  listMusicPlaylists,
  addMusicPlaylistSong,
} = vi.hoisted(() => ({
  openNestedAction: vi.fn(),
  openMusicEditor: vi.fn(),
  openAlbum: vi.fn(),
  getMusicAlbum: vi.fn(),
  playAlbum: vi.fn(),
  listAlbumBookmarks: vi.fn(),
  createAlbumBookmark: vi.fn(),
  deleteAlbumBookmark: vi.fn(),
  listMusicPlaylists: vi.fn(() => Promise.resolve({ data: [] })),
  addMusicPlaylistSong: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { albumId: '1' } },
    closeAlbum: vi.fn(),
    isAlbumShifted: { value: false },
    isLayerShifted: () => false,
    isTopLayer: () => true,
    openNestedAction,
    openMusicEditor,
    openAlbum,
  })
}))

vi.mock('@/api/musicV1', () => ({
  getMusicAlbum,
  listAlbumBookmarks,
  createAlbumBookmark,
  deleteAlbumBookmark,
  listMusicPlaylists,
  addMusicPlaylistSong,
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    playAlbum,
  }),
}))

describe('AlbumDrawer.vue', () => {
  beforeEach(() => {
    openNestedAction.mockReset()
    openMusicEditor.mockReset()
    openAlbum.mockReset()
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
    })
    expect(wrapper.text()).toContain('Album Notes')
  })

  it('opens the merge target when the album is closed with redirect_to', async () => {
    getMusicAlbum.mockResolvedValueOnce({
      id: '1',
      title: 'Merged Album',
      entry_status: 'closed',
      redirect_to: 'album-target',
      songs: [],
    })
	getMusicAlbum.mockResolvedValueOnce({
		id: 'album-target',
		title: 'Target Album',
		entry_status: 'open',
		songs: [],
	})

    mount(AlbumDrawer)
    await flushPromises()

    expect(openAlbum).toHaveBeenCalledWith('album-target')
  })

  it('plays album songs through the player when clicking play album', async () => {
    const wrapper = mount(AlbumDrawer, {
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
    })

    await flushPromises()

    expect(wrapper.get('[data-test="discussion-fab"]').text()).toBe('讨论')
    expect(wrapper.text()).not.toContain('03:45')
    expect(wrapper.find('.track-time').exists()).toBe(false)
  })

  it('keeps album details visible when bookmark loading requires login', async () => {
    listAlbumBookmarks.mockRejectedValueOnce(
      new ApiErrorResponseError(401, 'auth.unauthorized', 'Login required'),
    )

    const wrapper = mount(AlbumDrawer, {
      global: {
        stubs: {
          PSheet: { template: '<div><slot /></div>' },
          PDiscussionFAB: { props: ['count'], template: '<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Test Album')
    expect(wrapper.text()).not.toContain('专辑信息加载失败')
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
    })

    await flushPromises()

    expect(wrapper.get('[data-test="discussion-fab"]').text()).toBe('讨论(7)')
    expect(wrapper.get('.track-time').text()).toBe('2:05')
  })

  it('opens unified album editor when clicking 编辑', async () => {
    const wrapper = mount(AlbumDrawer, {
    })

    await flushPromises()

    const buttons = wrapper.findAllComponents({ name: 'PButton' })
    await buttons[2].trigger('click')

    expect(openMusicEditor).toHaveBeenCalledWith({
      entity: 'album',
      mode: 'edit',
      id: '1',
    })
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

  it('keeps the latest album visible when an earlier request finishes later', async () => {
    let resolveFirst!: (album: Record<string, unknown>) => void
    const firstRequest = new Promise<Record<string, unknown>>((resolve) => { resolveFirst = resolve })
    getMusicAlbum
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({ id: 'album-b', title: 'Album B', entry_status: 'open', songs: [] })

    const wrapper = mount(AlbumDrawer, {
      props: {
        layer: { key: 'album-a', kind: 'album', title: '专辑详情', payload: { albumId: 'album-a' } },
      },
    })
    await wrapper.setProps({
      layer: { key: 'album-b', kind: 'album', title: '专辑详情', payload: { albumId: 'album-b' } },
    })
    await flushPromises()

    resolveFirst({ id: 'album-a', title: 'Album A', entry_status: 'open', songs: [] })
    await flushPromises()

    expect(wrapper.text()).toContain('Album B')
    expect(wrapper.text()).not.toContain('Album A')
  })

  it('does not apply a delayed album bookmark result after switching albums', async () => {
    let resolveBookmark!: () => void
    createAlbumBookmark.mockReturnValueOnce(new Promise<void>((resolve) => { resolveBookmark = resolve }))
    getMusicAlbum
      .mockResolvedValueOnce({ id: 'album-a', title: 'Album A', entry_status: 'open', songs: [] })
      .mockResolvedValueOnce({ id: 'album-b', title: 'Album B', entry_status: 'open', songs: [] })

    const wrapper = mount(AlbumDrawer, {
      props: {
        layer: { key: 'album-a', kind: 'album', title: '专辑详情', payload: { albumId: 'album-a' } },
      },
    })
    await flushPromises()
    void wrapper.get('[data-testid="album-bookmark-toggle"]').trigger('click')

    await wrapper.setProps({
      layer: { key: 'album-b', kind: 'album', title: '专辑详情', payload: { albumId: 'album-b' } },
    })
    await flushPromises()
    resolveBookmark()
    await flushPromises()

    expect(wrapper.text()).toContain('Album B')
    expect(wrapper.get('[data-testid="album-bookmark-toggle"]').text()).toBe('订阅')
  })

  it('shows feedback when album bookmark update fails', async () => {
    createAlbumBookmark.mockRejectedValueOnce(new Error('network'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(AlbumDrawer)
    await flushPromises()

    await wrapper.get('[data-testid="album-bookmark-toggle"]').trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('订阅失败')
  })
})
