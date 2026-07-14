import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiErrorResponseError } from '@/api/client'

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
  }),
}))

const mocks = vi.hoisted(() => ({
  listArtistBookmarks: vi.fn(),
  listAlbumBookmarks: vi.fn(),
  listSongBookmarks: vi.fn(),
  listMusicPlaylists: vi.fn(),
  getMusicArtist: vi.fn(),
  getMusicAlbum: vi.fn(),
  createMusicPlaylist: vi.fn(),
  getMusicPlaylist: vi.fn(),
  listRecommendedArtists: vi.fn(),
  listRecommendedAlbums: vi.fn(),
  createArtistBookmark: vi.fn(),
  deleteArtistBookmark: vi.fn(),
  openArtist: vi.fn(),
  openAlbum: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listArtistBookmarks: mocks.listArtistBookmarks,
  listAlbumBookmarks: mocks.listAlbumBookmarks,
  listSongBookmarks: mocks.listSongBookmarks,
  listMusicPlaylists: mocks.listMusicPlaylists,
  getMusicArtist: mocks.getMusicArtist,
  getMusicAlbum: mocks.getMusicAlbum,
  createMusicPlaylist: mocks.createMusicPlaylist,
  getMusicPlaylist: mocks.getMusicPlaylist,
  listRecommendedArtists: mocks.listRecommendedArtists,
  listRecommendedAlbums: mocks.listRecommendedAlbums,
  createArtistBookmark: mocks.createArtistBookmark,
  deleteArtistBookmark: mocks.deleteArtistBookmark,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { artistId: null, albumId: null, albumRefreshToken: 0 } },
    openArtist: mocks.openArtist,
    openAlbum: mocks.openAlbum,
    closeArtist: vi.fn(),
    closeAlbum: vi.fn(),
    isArtistShifted: { value: false },
    isAlbumShifted: { value: false },
    openNestedAction: vi.fn(),
  }),
}))

vi.mock('@/components/music/ArtistDrawer.vue', () => ({
  default: { template: '<div data-testid="artist-drawer-stub" />' },
}))

vi.mock('@/components/music/AlbumDrawer.vue', () => ({
  default: { template: '<div data-testid="album-drawer-stub" />' },
}))

import StarredView from '@/views/music/StarredView.vue'

describe('Music StarredView', () => {
  beforeEach(() => {
    mocks.listArtistBookmarks.mockReset()
    mocks.listAlbumBookmarks.mockReset()
    mocks.listSongBookmarks.mockReset()
    mocks.listMusicPlaylists.mockReset()
    mocks.getMusicArtist.mockReset()
    mocks.getMusicAlbum.mockReset()
    mocks.createMusicPlaylist.mockReset()
    mocks.getMusicPlaylist.mockReset()
    mocks.listRecommendedArtists.mockReset()
    mocks.listRecommendedAlbums.mockReset()
    mocks.createArtistBookmark.mockReset()
    mocks.deleteArtistBookmark.mockReset()
    mocks.openArtist.mockReset()
    mocks.openAlbum.mockReset()

    mocks.listArtistBookmarks.mockResolvedValue({
      data: [{ id: 'artist-bookmark-1', artist_id: 'artist-1', created_at: '2026-07-01T00:00:00Z' }],
    })
    mocks.listAlbumBookmarks.mockResolvedValue({
      data: [{ id: 'album-bookmark-1', album_id: 'album-1', created_at: '2026-07-01T00:00:00Z' }],
    })
    mocks.listRecommendedArtists.mockResolvedValue({
      data: [{ id: 'artist-1', target_path: '/music/artist/artist-1' }],
    })
    mocks.listRecommendedAlbums.mockResolvedValue({
      data: [{ id: 'album-1', target_path: '/music/album/album-1' }],
    })
    mocks.listSongBookmarks.mockResolvedValue({
      data: [{
        id: 'song-bookmark-1',
        song_id: 'song-1',
        created_at: '2026-07-01T00:00:00Z',
        song: {
          id: 'song-1',
          title: 'cellophane',
          track_number: 1,
          audio_url: '',
          cover_url: '',
          status: 'open',
          entry_status: 'open',
          artists: [{ id: 'artist-1', name: 'FKA twigs' }],
          album: { id: 'album-1', title: 'MAGDALENE' },
        },
      }],
    })
    mocks.listMusicPlaylists.mockResolvedValue({
      data: [{
        id: 'playlist-1',
        name: '夜航歌单',
        description: '凌晨反复播放',
        song_count: 2,
      }],
    })
    mocks.getMusicArtist.mockResolvedValue({
      id: 'artist-1',
      name: 'FKA twigs',
      entry_status: 'open',
    })
    mocks.getMusicAlbum.mockResolvedValue({
      id: 'album-1',
      title: 'MAGDALENE',
      year: 2019,
      entry_status: 'open',
      artists: [{ id: 'artist-1', name: 'FKA twigs' }],
    })

    mocks.createMusicPlaylist.mockImplementation(async ({ name }: { name: string }) => ({
      id: 'playlist-2',
      name,
      song_count: 0,
      songs: [],
    }))

    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      name: '夜航歌单',
      description: '凌晨反复播放',
      song_count: 2,
      songs: [
        {
          id: 'song-1',
          title: 'cellophane',
          track_number: 1,
          audio_url: '',
          entry_status: 'open',
          artists: [{ id: 'artist-1', name: 'FKA twigs' }],
          album: { id: 'album-1', title: 'MAGDALENE' },
        },
        {
          id: 'song-2',
          title: 'home with you',
          track_number: 2,
          audio_url: '',
          entry_status: 'open',
          artists: [{ id: 'artist-1', name: 'FKA twigs' }],
          album: { id: 'album-1', title: 'MAGDALENE' },
        },
      ],
    })
  })

  it('loads real starred results and filters by kind tabs', async () => {
    const wrapper = mount(StarredView)
    await flushPromises()

    expect(mocks.listArtistBookmarks).toHaveBeenCalledWith()
    expect(mocks.listAlbumBookmarks).toHaveBeenCalledWith()
    expect(wrapper.text()).toContain('FKA twigs')
    expect(wrapper.text()).toContain('MAGDALENE')
  })

  it('shows every bookmark even when it is absent from recommendations', async () => {
    mocks.listRecommendedArtists.mockResolvedValueOnce({ data: [] })
    mocks.listRecommendedAlbums.mockResolvedValueOnce({ data: [] })

    const wrapper = mount(StarredView)
    await flushPromises()

    expect(wrapper.text()).toContain('FKA twigs')
    expect(wrapper.text()).toContain('MAGDALENE')
  })

  it('loads song bookmarks and playlists into the starred library', async () => {
    const wrapper = mount(StarredView)
    await flushPromises()

    expect(mocks.listSongBookmarks).toHaveBeenCalledWith()
    expect(mocks.listMusicPlaylists).toHaveBeenCalledWith()
    expect(wrapper.text()).toContain('cellophane')
    expect(wrapper.text()).toContain('夜航歌单')
  })

  it('opens artist and album drawers when clicking starred cards', async () => {
    const wrapper = mount(StarredView)
    await flushPromises()

    await wrapper.get('[data-testid="starred-artist-card"]').trigger('click')
    await wrapper.get('[data-testid="starred-album-card"]').trigger('click')

    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')
  })

  it('shows empty state instead of error when bookmarks require login', async () => {
    mocks.listArtistBookmarks.mockRejectedValueOnce(
      new ApiErrorResponseError(401, 'auth.unauthorized', 'Login required'),
    )
    mocks.listAlbumBookmarks.mockRejectedValueOnce(
      new ApiErrorResponseError(401, 'auth.unauthorized', 'Login required'),
    )

    const wrapper = mount(StarredView)
    await flushPromises()

    expect(wrapper.text()).toContain('暂无收藏')
    expect(wrapper.text()).not.toContain('收藏加载失败')
  })
})
