import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AudioPlayer from '@/components/music/AudioPlayer.vue'

const mocks = vi.hoisted(() => ({
  openNestedAction: vi.fn(),
  listMusicPlaylists: vi.fn(),
  player: {
    currentSong: { id: 'song-1', title: 'Track A', audio_url: 'https://example.com/a.mp3' } as {
      id: string
      title: string
      audio_url: string
      lyrics?: string
      media_kind?: 'music_song' | 'feed_item'
    },
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
    mocks.player.currentSong = { id: 'song-1', title: 'Track A', audio_url: 'https://example.com/a.mp3' }
    mocks.player.showLyrics = false
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

  it('does not offer music discussion for a podcast feed item', () => {
    mocks.player.currentSong = {
      id: 'feed-item-1',
      title: 'Podcast Episode',
      audio_url: 'https://example.com/episode.mp3',
      media_kind: 'feed_item',
    }

    const wrapper = mount(AudioPlayer, {
      global: { stubs: { PDropdown: true, PToast: true } },
    })

    expect(wrapper.find('[data-test="player-song-discussion"]').exists()).toBe(false)
  })

  it('shows the current song lyrics in the lyrics panel', () => {
    mocks.player.currentSong = {
      id: 'song-1',
      title: 'Track A',
      audio_url: 'https://example.com/a.mp3',
      lyrics: 'First line\nSecond line',
    }
    mocks.player.showLyrics = true

    const wrapper = mount(AudioPlayer, {
      global: { stubs: { PDropdown: true, PToast: true } },
    })

    expect(wrapper.get('[data-testid="lyrics-text"]').element.textContent).toBe('First line\nSecond line')
  })
})
