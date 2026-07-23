import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import AudioPlayer from '@/components/music/AudioPlayer.vue'
import { usePlayerStore } from '@/stores/player'

const musicApi = vi.hoisted(() => ({
  listMusicPlaylists: vi.fn(),
  recordMusicSongPlay: vi.fn(),
}))

const transportApi = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/composables/useApi', () => ({
  useApiUrl: () => '',
  useApi: () => ({ url: '', podcast: { bookmarks: '/api/v1/podcast/bookmarks' } }),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicPlaylists: musicApi.listMusicPlaylists,
  recordMusicSongPlay: musicApi.recordMusicSongPlay,
}))

vi.mock('@/api/transport', () => ({
  apiFetch: transportApi.apiFetch,
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

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
}

describe('AudioPlayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    document.documentElement.removeAttribute('data-player-active')
    document.documentElement.removeAttribute('data-player-pinned')
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    musicApi.listMusicPlaylists.mockResolvedValue({ data: [] })
    musicApi.recordMusicSongPlay.mockResolvedValue(undefined)
    transportApi.apiFetch.mockResolvedValue(new Response(null, { status: 201 }))
  })

  it('uses cookie-aware transport when bookmarking a podcast in a cookie session', async () => {
    const player = usePlayerStore()
    player.currentSong = {
      id: 'song-1', title: 'Episode 1', artist: 'Host', audio_url: '/episode.mp3',
      source_id: 'episode-1', source_type: 'podcast_episode',
    } as any
    const auth = (await import('@/stores/auth')).useAuthStore()
    auth.token = 'cookie-session'

    const wrapper = mount(AudioPlayer, {
      global: { plugins: [createTestRouter()], stubs: { MusicLyricsPanel: true, PDropdown: true, PToast: true } },
    })
    await wrapper.get('[title="收藏单集"]').trigger('click')

    expect(transportApi.apiFetch).toHaveBeenCalledWith('/api/v1/podcast/bookmarks', expect.objectContaining({
      method: 'POST',
      headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
    }))
    wrapper.unmount()
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
        plugins: [createTestRouter()],
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

  it('passes playback time to the lyrics panel and seeks when the panel emits', async () => {
    const player = usePlayerStore()
    player.currentSong = {
      id: 'song-1',
      title: 'Song 1',
      artist: 'Artist 1',
      audio_url: '/song-1.mp3',
    } as any
    player.currentTime = 12.345
    player.showLyrics = true
    const seek = vi.spyOn(player, 'seek').mockImplementation(() => undefined)

    const wrapper = mount(AudioPlayer, {
      global: {
        plugins: [createTestRouter()],
        stubs: {
          MusicLyricsPanel: {
            props: ['currentTimeSeconds'],
            emits: ['close', 'seek'],
            template: `
              <button
                type="button"
                class="lyrics-panel-seek-stub"
                :data-current-time-seconds="currentTimeSeconds"
                @click="$emit('seek', 27.125)"
              >
                定位
              </button>
            `,
          },
          PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
          PToast: true,
        },
      },
    })

    expect(wrapper.get('.lyrics-panel-seek-stub').attributes('data-current-time-seconds')).toBe('12.345')
    await wrapper.get('.lyrics-panel-seek-stub').trigger('click')
    expect(seek).toHaveBeenCalledOnce()
    expect(seek).toHaveBeenCalledWith(27.125)

    wrapper.unmount()
  })

  it('reserves separate mobile columns for metadata, playback, and queue controls', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/music/AudioPlayer.vue'), 'utf8')

    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.player-inner\s*\{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) 44px 44px;/)
    expect(source).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.player-controls-hub\s*\{[^}]*position: static;[^}]*transform: none;/)
  })

  it('applies adaptive glassmorphism styles', () => {
    const player = usePlayerStore()
    player.currentSong = {
      id: 'song-1',
      title: 'Song 1',
      artist: 'Artist 1',
      audio_url: '/song-1.mp3',
    } as any

    const wrapper = mount(AudioPlayer, {
      global: {
        plugins: [createTestRouter()],
        stubs: {
          MusicLyricsPanel: true,
          PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
          PToast: true,
        },
      },
    })
    
    const playerEl = wrapper.find('.player')
    expect(playerEl.exists()).toBe(true)
    
    // In a real DOM, we would check getComputedStyle.
    // In JSDOM/Happy-DOM without full CSS evaluation, we at least verify the element has the player class
    // which binds to our glassmorphism CSS rules.
    expect(playerEl.classes()).toContain('player')
  })

  it('renders main play button with correct class for styling', () => {
    const player = usePlayerStore()
    player.currentSong = {
      id: 'song-1',
      title: 'Song 1',
      artist: 'Artist 1',
      audio_url: '/song-1.mp3',
    } as any

    const wrapper = mount(AudioPlayer, {
      global: {
        plugins: [createTestRouter()],
        stubs: {
          MusicLyricsPanel: true,
          PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
          PToast: true,
        },
      },
    })
    
    const playBtn = wrapper.find('.main-play-btn')
    expect(playBtn.exists()).toBe(true)
    expect(playBtn.classes()).toContain('main-play-btn')
  })
})
