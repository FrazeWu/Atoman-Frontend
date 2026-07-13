import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AudioPlayer from '@/components/music/AudioPlayer.vue'
import { usePlayerStore } from '@/stores/player'

const musicApi = vi.hoisted(() => ({
  listMusicPlaylists: vi.fn(),
  recordMusicSongPlay: vi.fn(),
}))

vi.mock('@/composables/useApi', () => ({
  useApiUrl: () => '',
  useApi: () => ({ url: '', podcast: {} }),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicPlaylists: musicApi.listMusicPlaylists,
  recordMusicSongPlay: musicApi.recordMusicSongPlay,
}))

vi.mock('@/composables/useMusicFavoritePlaylist', () => ({
  useMusicFavoritePlaylist: () => ({
    favoriteSongIds: { __v_isRef: true, value: new Set<string>() },
    loadFavoriteSongs: vi.fn().mockResolvedValue(undefined),
    toggleFavoriteSong: vi.fn(),
    addSongToPlaylist: vi.fn(),
  }),
}))

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

describe('AudioPlayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.documentElement.removeAttribute('data-player-active')
    document.documentElement.removeAttribute('data-player-pinned')
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    musicApi.listMusicPlaylists.mockResolvedValue({ data: [] })
    musicApi.recordMusicSongPlay.mockResolvedValue(undefined)
  })

  it('unpinns, auto-hides, reveals on hover, and pins again', async () => {
    vi.useFakeTimers()
    const player = usePlayerStore()
    player.currentSong = {
      id: 'song-1',
      title: 'Song 1',
      artist: 'Artist 1',
      audio_url: '/song-1.mp3',
    } as any

    const wrapper = mount(AudioPlayer, {
      global: {
        stubs: {
          MusicLyricsPanel: true,
          PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
          PToast: true,
        },
      },
    })

    expect(wrapper.get('[aria-label="取消固定播放器"]').exists()).toBe(true)
    expect(document.documentElement.dataset.playerPinned).toBe('true')

    await wrapper.get('[aria-label="取消固定播放器"]').trigger('click')
    expect(wrapper.get('.player').classes()).toContain('is-auto-hidden')
    expect(document.documentElement.dataset.playerPinned).toBe('false')

    await wrapper.get('.player').trigger('mouseenter')
    expect(wrapper.get('.player').classes()).not.toContain('is-auto-hidden')

    await wrapper.get('.player').trigger('mouseleave')
    await vi.advanceTimersByTimeAsync(499)
    expect(wrapper.get('.player').classes()).not.toContain('is-auto-hidden')
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.get('.player').classes()).toContain('is-auto-hidden')

    await wrapper.get('.player').trigger('mouseenter')
    await wrapper.get('[aria-label="固定播放器"]').trigger('click')
    expect(wrapper.get('.player').classes()).not.toContain('is-auto-hidden')
    expect(document.documentElement.dataset.playerPinned).toBe('true')

    wrapper.unmount()
    vi.useRealTimers()
  })
})
