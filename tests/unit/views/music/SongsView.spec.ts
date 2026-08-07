import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SongsView from '@/views/music/SongsView.vue'

const mocks = vi.hoisted(() => ({
  searchMusic: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
  openPlaylist: vi.fn(),
  playSong: vi.fn(),
  addToQueue: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({ searchMusic: mocks.searchMusic }))
vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    openAlbum: mocks.openAlbum,
    openArtist: mocks.openArtist,
    openPlaylist: mocks.openPlaylist,
  }),
}))
vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({ playSong: mocks.playSong, addToQueue: mocks.addToQueue }),
}))

describe('SongsView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.values(mocks).forEach(mock => mock.mockReset())
    mocks.searchMusic.mockResolvedValue({
      songs: [{
        id: 'song-1', title: 'Song 1', audio_url: '/song-1.mp3', entry_status: 'open',
        artists: [{ id: 'artist-1', name: 'Artist 1' }],
        album: { id: 'album-1', title: 'Album 1' },
      }],
      albums: [], artists: [], playlists: [],
    })
  })

  afterEach(() => vi.useRealTimers())

  it('links the song and opens its artist and album details', async () => {
    const wrapper = mount(SongsView, {
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        },
      },
    })
    await wrapper.get('input[type="search"]').setValue('Song')
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()

    expect(wrapper.get('a[href="/music/song/song-1"]').exists()).toBe(true)
    await wrapper.get('[data-testid="song-result-artist-artist-1"]').trigger('click')
    await wrapper.get('[data-testid="song-result-album-album-1"]').trigger('click')

    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')
  })
})
