import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import MobileSongView from '../../../apps/mobile/MobileSongView.vue'

const mocks = vi.hoisted(() => ({
  getMusicSongDetail: vi.fn(),
  addMusicSongToLater: vi.fn(),
  loadFavoriteSongs: vi.fn(),
  toggleFavoriteSong: vi.fn(),
  playSong: vi.fn(),
  addToQueue: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicSongDetail: mocks.getMusicSongDetail,
  addMusicSongToLater: mocks.addMusicSongToLater,
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    playSong: mocks.playSong,
    addToQueue: mocks.addToQueue,
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}))

vi.mock('@/composables/useLoginRedirect', () => ({
  useLoginRedirect: () => ({ requireLogin: () => true }),
}))

vi.mock('@/composables/useMusicFavoritePlaylist', () => ({
  useMusicFavoritePlaylist: () => ({
    favoriteSongIds: { value: new Set<string>() },
    loadFavoriteSongs: mocks.loadFavoriteSongs,
    toggleFavoriteSong: mocks.toggleFavoriteSong,
  }),
}))

describe('MobileSongView', () => {
  it('exposes playback and library actions for a loaded song', async () => {
    mocks.getMusicSongDetail.mockResolvedValue({
      song: {
        id: 'song-1',
        title: '夜行列车',
        audio_url: '/song.mp3',
        artists: [{ id: 'artist-1', name: '测试艺人' }],
        album: { id: 'album-1', title: '夜行' },
      },
      artists: [{ id: 'artist-1', name: '测试艺人' }],
      playable: true,
    })
    mocks.loadFavoriteSongs.mockResolvedValue(new Set())
    mocks.toggleFavoriteSong.mockResolvedValue({ message: '已加入最爱' })
    mocks.addMusicSongToLater.mockResolvedValue({})

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/music/song/:songId', component: MobileSongView }],
    })
    await router.push('/music/song/song-1')
    await router.isReady()

    const wrapper = mount(MobileSongView, {
      global: {
        plugins: [router],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('夜行列车')
    expect(wrapper.find('[aria-label="加入最爱"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="加入播放队列"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="稍后播放"]').exists()).toBe(true)

    await wrapper.get('[aria-label="加入播放队列"]').trigger('click')
    await wrapper.get('[aria-label="稍后播放"]').trigger('click')
    await wrapper.get('[aria-label="加入最爱"]').trigger('click')

    expect(mocks.addToQueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'song-1' }))
    expect(mocks.addMusicSongToLater).toHaveBeenCalledWith('song-1')
    expect(mocks.toggleFavoriteSong).toHaveBeenCalledWith('song-1')
  })
})
