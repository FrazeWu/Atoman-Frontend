import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openArtist: vi.fn(),
  openAlbum: vi.fn(),
  openPlaylist: vi.fn(),
  closeAll: vi.fn(),
  routeParams: {} as Record<string, string>,
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: mocks.routeParams,
  }),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    openArtist: mocks.openArtist,
    openAlbum: mocks.openAlbum,
    openPlaylist: mocks.openPlaylist,
    closeAll: mocks.closeAll,
  }),
}))

vi.mock('@/views/music/HomeView.vue', () => ({
  default: {
    name: 'HomeViewStub',
    template: '<div data-testid="music-home-view-stub" />',
  },
}))

describe('music legacy detail route shells', () => {
  beforeEach(() => {
    mocks.openArtist.mockReset()
    mocks.openAlbum.mockReset()
    mocks.openPlaylist.mockReset()
    mocks.closeAll.mockReset()
    mocks.routeParams = {}
  })

  it('opens the artist drawer for /artist/:artistId', async () => {
    mocks.routeParams = { artistId: 'artist-123' }
    const component = (await import('@/views/music/MusicArtistRouteView.vue')).default

    const wrapper = mount(component)

    expect(mocks.openArtist).toHaveBeenCalledWith('artist-123')
    expect(wrapper.find('[data-testid="music-home-view-stub"]').exists()).toBe(true)
  })

  it('opens the album drawer for /album/:albumId', async () => {
    mocks.routeParams = { albumId: 'album-456' }
    const component = (await import('@/views/music/MusicAlbumRouteView.vue')).default

    const wrapper = mount(component)

    expect(mocks.openAlbum).toHaveBeenCalledWith('album-456')
    expect(wrapper.find('[data-testid="music-home-view-stub"]').exists()).toBe(true)
  })

  it('opens the playlist drawer for /playlist/:playlistId', async () => {
    mocks.routeParams = { playlistId: 'playlist-789' }
    const component = (await import('@/views/music/MusicPlaylistRouteView.vue')).default

    const wrapper = mount(component)

    expect(mocks.openPlaylist).toHaveBeenCalledWith('playlist-789')
    expect(wrapper.find('[data-testid="music-home-view-stub"]').exists()).toBe(true)
  })
})
