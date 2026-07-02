import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import PortalHomeView from '@/views/portal/HomeView.vue'

const mocks = vi.hoisted(() => ({
  listMusicArtists: vi.fn(),
  fetchSongs: vi.fn(),
  songs: [],
  currentSong: null as null | { album?: string },
}))

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: mocks.listMusicArtists,
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    fetchSongs: mocks.fetchSongs,
    songs: mocks.songs,
    currentSong: mocks.currentSong,
    playSong: vi.fn(),
  }),
}))

describe('Portal HomeView.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.listMusicArtists.mockReset()
    mocks.fetchSongs.mockReset()
    mocks.songs = []
    mocks.currentSong = null
    mocks.listMusicArtists.mockResolvedValue({
      data: [
        { id: 'artist-ye', name: 'Ye' },
      ],
      meta: { page: 1, page_size: 24, total: 1, has_more: false },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses music artist api for search input', async () => {
    const wrapper = mount(PortalHomeView, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn })],
        stubs: {
          RouterLink: true,
        },
      },
    })

    await flushPromises()
    expect(mocks.listMusicArtists).toHaveBeenCalledWith({
      q: undefined,
      page: 1,
      page_size: 24,
    })

    const input = wrapper.find('input[placeholder="搜索艺术家..."]')
    await input.setValue('kanye')
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(mocks.listMusicArtists).toHaveBeenLastCalledWith({
      q: 'kanye',
      page: 1,
      page_size: 24,
    })
  })
})
