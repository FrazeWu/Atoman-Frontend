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
  listMusicPlaylists: vi.fn(),
  getMusicArtist: vi.fn(),
  getMusicAlbum: vi.fn(),
  listRecommendedArtists: vi.fn(),
  listRecommendedAlbums: vi.fn(),
  deleteAlbumBookmark: vi.fn(),
  deleteArtistBookmark: vi.fn(),
  openArtist: vi.fn(),
  openAlbum: vi.fn(),
  openPlaylist: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listArtistBookmarks: mocks.listArtistBookmarks,
  listAlbumBookmarks: mocks.listAlbumBookmarks,
  listMusicPlaylists: mocks.listMusicPlaylists,
  getMusicArtist: mocks.getMusicArtist,
  getMusicAlbum: mocks.getMusicAlbum,
  listRecommendedArtists: mocks.listRecommendedArtists,
  listRecommendedAlbums: mocks.listRecommendedAlbums,
  deleteAlbumBookmark: mocks.deleteAlbumBookmark,
  deleteArtistBookmark: mocks.deleteArtistBookmark,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { artistId: null, albumId: null, albumRefreshToken: 0 } },
    openArtist: mocks.openArtist,
    openAlbum: mocks.openAlbum,
    openPlaylist: mocks.openPlaylist,
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

vi.mock('@/components/music/PlaylistDrawer.vue', () => ({
  default: { template: '<div data-testid="playlist-drawer-stub" />' },
}))

import StarredView from '@/views/music/StarredView.vue'

describe('Music StarredView', () => {
  beforeEach(() => {
    mocks.listArtistBookmarks.mockReset()
    mocks.listAlbumBookmarks.mockReset()
    mocks.listMusicPlaylists.mockReset()
    mocks.getMusicArtist.mockReset()
    mocks.getMusicAlbum.mockReset()
    mocks.listRecommendedArtists.mockReset()
    mocks.listRecommendedAlbums.mockReset()
    mocks.deleteAlbumBookmark.mockReset()
    mocks.deleteArtistBookmark.mockReset()
    mocks.openArtist.mockReset()
    mocks.openAlbum.mockReset()
    mocks.openPlaylist.mockReset()

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
  })

  it('shows three starred columns and switches among album artist and playlist results', async () => {
    const wrapper = mount(StarredView)
    await flushPromises()

    expect(mocks.listArtistBookmarks).toHaveBeenCalledWith()
    expect(mocks.listAlbumBookmarks).toHaveBeenCalledWith()
    expect(mocks.listMusicPlaylists).toHaveBeenCalledWith()
    expect(wrapper.text()).toContain('收藏专辑')
    expect(wrapper.text()).toContain('收藏艺人')
    expect(wrapper.text()).toContain('收藏歌单')
    expect(wrapper.text()).not.toContain('全部')
    expect(wrapper.text()).toContain('MAGDALENE')
    expect(wrapper.findAll('[data-testid="starred-album-card"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="starred-artist-card"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="starred-playlist-card"]')).toHaveLength(0)

    await wrapper.get('[data-testid="filter-artist"]').trigger('click')
    expect(wrapper.findAll('[data-testid="starred-album-card"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="starred-artist-card"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="starred-playlist-card"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('FKA twigs')
    expect(wrapper.text()).not.toContain('MAGDALENE')

    await wrapper.get('[data-testid="filter-playlist"]').trigger('click')
    expect(wrapper.findAll('[data-testid="starred-album-card"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="starred-artist-card"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="starred-playlist-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('夜航歌单')
    expect(wrapper.text()).not.toContain('MAGDALENE')
  })

  it('opens artist and album drawers when clicking starred cards', async () => {
    const wrapper = mount(StarredView)
    await flushPromises()

    await wrapper.get('[data-testid="starred-album-card"]').trigger('click')
    await wrapper.get('[data-testid="filter-artist"]').trigger('click')
    await wrapper.get('[data-testid="starred-artist-card"]').trigger('click')

    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')
    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
  })

  it('opens playlist drawer when clicking starred playlist cards', async () => {
    const wrapper = mount(StarredView)
    await flushPromises()

    await wrapper.get('[data-testid="filter-playlist"]').trigger('click')

    expect(wrapper.find('[data-testid="playlist-drawer-stub"]').exists()).toBe(true)

    await wrapper.get('[data-testid="starred-playlist-card"]').trigger('click')

    expect(mocks.openPlaylist).toHaveBeenCalledWith('playlist-1')
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
