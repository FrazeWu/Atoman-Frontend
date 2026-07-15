import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AudioPlayer from '@/components/music/AudioPlayer.vue'

const mocks = vi.hoisted(() => ({
  openNestedAction: vi.fn(),
  listMusicPlaylists: vi.fn(),
  player: {
    currentSong: { id: 'song-1', title: 'Track A', audio_url: 'https://example.com/a.mp3' },
    currentTime: 12,
    duration: 180,
    isPlaying: false,
    playbackMode: 'loop',
    volume: 1,
    queue: [],
    showQueue: false,
    showLyrics: false,
    skip: vi.fn(),
    playPrevious: vi.fn(),
    togglePlay: vi.fn(),
    playNext: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    cyclePlaybackMode: vi.fn(),
    toggleQueue: vi.fn(),
    toggleLyrics: vi.fn(),
    playQueuedSong: vi.fn(),
  },
}))

vi.mock('@/stores/player', () => ({ usePlayerStore: () => mocks.player }))
vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({ openNestedAction: mocks.openNestedAction }),
}))
vi.mock('@/api/musicV1', () => ({
  listMusicPlaylists: mocks.listMusicPlaylists,
  addMusicPlaylistSong: vi.fn(),
  removeMusicPlaylistSong: vi.fn(),
  createMusicPlaylist: vi.fn(),
  getMusicPlaylist: vi.fn(),
}))

describe('AudioPlayer song discussion', () => {
  beforeEach(() => {
    mocks.openNestedAction.mockReset()
    mocks.listMusicPlaylists.mockResolvedValue({ data: [] })
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
  })

  it('opens discussion for the currently playing song', async () => {
    const wrapper = mount(AudioPlayer, {
      global: {
        stubs: {
          PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
          PToast: true,
        },
      },
    })

    const action = wrapper.get('[data-test="player-song-discussion"]')
    expect(action.attributes('title')).toBe('讨论')
    await action.trigger('click')

    expect(mocks.openNestedAction).toHaveBeenCalledWith('discussion', { songId: 'song-1' })
  })
})
