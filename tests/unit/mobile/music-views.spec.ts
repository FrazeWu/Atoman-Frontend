import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAudioPlayerStore, usePlayerStore } from '@/stores/player'
import MusicDiscoverView from '@mobile/views/music/MusicDiscoverView.vue'
import MusicLibraryView from '@mobile/views/music/MusicLibraryView.vue'
import MusicPlaylistsView from '@mobile/views/music/MusicPlaylistsView.vue'
import MobileAudioPlayer from '@mobile/MobileAudioPlayer.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'

vi.mock('@/api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicHome: vi.fn(),
  listPublicMusicPlaylists: vi.fn(),
  listMusicPlaylists: vi.fn(),
  listMusicSongs: vi.fn(),
  searchMusicSongs: vi.fn(),
  createMusicPlaylist: vi.fn(),
}))

const mockPlaylists = [
  { id: 'pl-1', name: '深度工作流', song_count: 18, is_public: true, cover_url: '' },
  { id: 'pl-2', name: '午夜脉冲', song_count: 24, is_public: true, cover_url: '' },
]

const mockTracks = [
  { id: 'tr-1', title: 'Echoes of Silence', artist: 'Lumine', album: 'Abyssal', duration: 215, audio_url: '/audio/1.mp3' },
  { id: 'tr-2', title: 'Quantum Drift', artist: 'Aethel', album: 'Synapse', duration: 184, audio_url: '/audio/2.mp3' },
  { id: 'tr-3', title: 'Midnight City Lights', artist: 'Lumine', album: 'Abyssal', duration: 240, audio_url: '/audio/3.mp3' },
]

describe('Mobile Independent Music Views & Player', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/music', component: MusicDiscoverView },
        { path: '/music/library', component: MusicLibraryView },
        { path: '/music/playlists', component: MusicPlaylistsView },
        { path: '/music/player', component: { template: '<div>Player</div>' } },
      ],
    })
    vi.clearAllMocks()
  })

  describe('MusicDiscoverView.vue', () => {
    it('renders curated playlist grid cards', async () => {
      const musicApi = await import('@/api/musicV1')
      vi.mocked(musicApi.getMusicHome).mockResolvedValue({
        personalized: true,
        recently_played: [],
        for_you: [],
      } as any)
      vi.mocked(musicApi.listPublicMusicPlaylists).mockResolvedValue({
        data: mockPlaylists,
        total: mockPlaylists.length,
      } as any)

      const wrapper = mount(MusicDiscoverView, {
        global: {
          plugins: [pinia, router],
          stubs: { MIcon: true },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 10))

      const cards = wrapper.findAll('[data-testid="playlist-card"]')
      expect(cards.length).toBeGreaterThanOrEqual(2)
      expect(wrapper.text()).toContain('深度工作流')
      expect(wrapper.text()).toContain('午夜脉冲')
    })

    it('renders recent tracks list', async () => {
      const musicApi = await import('@/api/musicV1')
      vi.mocked(musicApi.getMusicHome).mockResolvedValue({
        personalized: true,
        recently_played: [
          { song: mockTracks[0], played_at: '2026-10-19T10:00:00Z' },
          { song: mockTracks[1], played_at: '2026-10-19T09:00:00Z' },
        ],
        for_you: [],
      } as any)
      vi.mocked(musicApi.listPublicMusicPlaylists).mockResolvedValue({
        data: mockPlaylists,
        total: mockPlaylists.length,
      } as any)

      const wrapper = mount(MusicDiscoverView, {
        global: {
          plugins: [pinia, router],
          stubs: { MIcon: true },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 10))

      const trackItems = wrapper.findAll('[data-testid="track-item"]')
      expect(trackItems.length).toBeGreaterThanOrEqual(2)
      expect(wrapper.text()).toContain('Echoes of Silence')
      expect(wrapper.text()).toContain('Lumine')
    })

    it('clicking a song item triggers playback in useAudioPlayerStore()', async () => {
      const musicApi = await import('@/api/musicV1')
      vi.mocked(musicApi.getMusicHome).mockResolvedValue({
        personalized: true,
        recently_played: [
          { song: mockTracks[0], played_at: '2026-10-19T10:00:00Z' },
        ],
        for_you: [],
      } as any)
      vi.mocked(musicApi.listPublicMusicPlaylists).mockResolvedValue({
        data: mockPlaylists,
        total: mockPlaylists.length,
      } as any)

      const playerStore = useAudioPlayerStore()
      const playSongSpy = vi.spyOn(playerStore, 'playSong').mockImplementation(async () => {})

      const wrapper = mount(MusicDiscoverView, {
        global: {
          plugins: [pinia, router],
          stubs: { MIcon: true },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 10))

      const trackItem = wrapper.find('[data-testid="track-item"]')
      expect(trackItem.exists()).toBe(true)
      await trackItem.trigger('click')

      expect(playSongSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Echoes of Silence',
      }))
    })
  })

  describe('MusicLibraryView.vue', () => {
    it('renders search input (MInput) and track list', async () => {
      const musicApi = await import('@/api/musicV1')
      vi.mocked(musicApi.listMusicSongs).mockResolvedValue({
        data: mockTracks,
        total: mockTracks.length,
      } as any)

      const wrapper = mount(MusicLibraryView, {
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 10))

      const searchInput = wrapper.findComponent(MInput)
      expect(searchInput.exists()).toBe(true)
      expect(searchInput.props('placeholder')).toContain('搜索')

      const tracks = wrapper.findAll('[data-testid="library-track-item"]')
      expect(tracks.length).toBe(3)
      expect(wrapper.text()).toContain('Echoes of Silence')
      expect(wrapper.text()).toContain('Quantum Drift')
    })

    it('filters songs when search text is entered', async () => {
      const musicApi = await import('@/api/musicV1')
      vi.mocked(musicApi.listMusicSongs).mockResolvedValue({
        data: mockTracks,
        total: mockTracks.length,
      } as any)

      const wrapper = mount(MusicLibraryView, {
        global: {
          plugins: [pinia, router],
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 10))

      const searchInput = wrapper.findComponent(MInput)
      await searchInput.setValue('Quantum')
      await wrapper.vm.$nextTick()

      const tracks = wrapper.findAll('[data-testid="library-track-item"]')
      expect(tracks.length).toBe(1)
      expect(tracks[0].text()).toContain('Quantum Drift')
      expect(wrapper.text()).not.toContain('Echoes of Silence')
    })
  })

  describe('MusicPlaylistsView.vue', () => {
    it('renders playlists list when playlists exist', async () => {
      const musicApi = await import('@/api/musicV1')
      vi.mocked(musicApi.listMusicPlaylists).mockResolvedValue({
        data: mockPlaylists,
        total: mockPlaylists.length,
      } as any)

      const wrapper = mount(MusicPlaylistsView, {
        global: {
          plugins: [pinia, router],
          stubs: { MIcon: true },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 10))

      const playlistItems = wrapper.findAll('[data-testid="playlist-item"]')
      expect(playlistItems.length).toBe(2)
      expect(wrapper.text()).toContain('深度工作流')
      expect(wrapper.text()).toContain('午夜脉冲')
    })

    it('renders empty state when playlists are empty', async () => {
      const musicApi = await import('@/api/musicV1')
      vi.mocked(musicApi.listMusicPlaylists).mockResolvedValue({
        data: [],
        total: 0,
      } as any)
      vi.mocked(musicApi.listPublicMusicPlaylists).mockResolvedValue({
        data: [],
        total: 0,
      } as any)

      const wrapper = mount(MusicPlaylistsView, {
        global: {
          plugins: [pinia, router],
          stubs: { MIcon: true },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 10))

      expect(wrapper.text()).toContain('暂无歌单')
    })
  })

  describe('MobileAudioPlayer.vue', () => {
    it('renders current track title and artist', async () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-42',
        title: 'Celestial Drift',
        artist: 'Astral Echo',
        duration: 260,
      } as any

      const wrapper = mount(MobileAudioPlayer, {
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('Celestial Drift')
      expect(wrapper.text()).toContain('Astral Echo')
    })

    it('play/pause button toggles playback', async () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-42',
        title: 'Celestial Drift',
        artist: 'Astral Echo',
      } as any
      const togglePlaySpy = vi.spyOn(playerStore, 'togglePlay').mockImplementation(() => {})

      const wrapper = mount(MobileAudioPlayer, {
        global: {
          plugins: [pinia, router],
        },
      })

      const playButton = wrapper.find('[data-testid="player-play-btn"]')
      expect(playButton.exists()).toBe(true)
      await playButton.trigger('click')

      expect(togglePlaySpy).toHaveBeenCalled()
    })

    it('uses MIcon for previous, play/pause, next controls', () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-42',
        title: 'Celestial Drift',
        artist: 'Astral Echo',
      } as any

      const wrapper = mount(MobileAudioPlayer, {
        global: {
          plugins: [pinia, router],
        },
      })

      const icons = wrapper.findAllComponents(MIcon)
      const iconNames = icons.map((icon) => icon.props('name'))

      // Expect previous, play or player-play or pause, and next controls
      expect(iconNames.some((name) => ['player-prev', 'previous', 'skip-back'].includes(name))).toBe(true)
      expect(iconNames.some((name) => ['player-play', 'player-pause', 'play', 'pause'].includes(name))).toBe(true)
      expect(iconNames.some((name) => ['player-next', 'next', 'skip-forward'].includes(name))).toBe(true)
    })
  })
})
