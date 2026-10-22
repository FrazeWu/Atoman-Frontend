import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useAudioPlayerStore, usePlayerStore } from '@/stores/player'
import MusicDiscoverView from '@mobile/views/music/MusicDiscoverView.vue'
import MusicLibraryView from '@mobile/views/music/MusicLibraryView.vue'
import MusicPlaylistsView from '@mobile/views/music/MusicPlaylistsView.vue'
import MusicSearchView from '@mobile/views/music/MusicSearchView.vue'
import MusicPlaylistDetailView from '@mobile/views/music/MusicPlaylistDetailView.vue'
import MusicAlbumDetailView from '@mobile/views/music/MusicAlbumDetailView.vue'
import MusicMeView from '@mobile/views/music/MusicMeView.vue'
import MobileAudioPlayer from '@mobile/MobileAudioPlayer.vue'
import MobilePlayerView from '@mobile/MobilePlayerView.vue'
import MIcon from '@mobile/components/ui/MIcon.vue'
import MInput from '@mobile/components/ui/MInput.vue'

vi.mock('@/api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicHome: vi.fn(),
  listPublicMusicPlaylists: vi.fn(),
  listMusicPlaylists: vi.fn(),
  listPlaylistBookmarks: vi.fn().mockResolvedValue({ data: [], total: 0 }),
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
        { path: '/music/search', component: MusicSearchView },
        { path: '/music/playlists', component: MusicPlaylistsView },
        { path: '/music/playlist/:playlistId', component: MusicPlaylistDetailView },
        { path: '/music/album/:albumId', component: MusicAlbumDetailView },
        { path: '/music/me', component: MusicMeView },
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
    it('renders guest state when user is not authenticated', async () => {
      const auth = (await import('@/stores/auth')).useAuthStore()
      auth.user = null
      auth.token = null
      auth.isAuthenticated = false

      const wrapper = mount(MusicPlaylistsView, {
        global: {
          plugins: [pinia, router],
          stubs: { MIcon: true },
        },
      })
      await flushPromises()

      expect(wrapper.find('[data-testid="guest-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('登录开启自建歌单')
      expect(wrapper.find('[data-testid="create-playlist-btn"]').exists()).toBe(false)
    })

    it('renders playlists list when authenticated and playlists exist', async () => {
      const auth = (await import('@/stores/auth')).useAuthStore()
      auth.user = { id: 'u-1', uuid: 'u-1', username: 'testuser', display_name: 'Test' } as any
      auth.token = 'test-token'
      auth.isAuthenticated = true

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
      await flushPromises()

      const playlistItems = wrapper.findAll('[data-testid="playlist-item"]')
      expect(playlistItems.length).toBe(2)
      expect(wrapper.text()).toContain('深度工作流')
      expect(wrapper.text()).toContain('午夜脉冲')
      expect(wrapper.find('[data-testid="create-playlist-btn"]').exists()).toBe(true)
    })

    it('renders empty state when authenticated and playlists are empty', async () => {
      const auth = (await import('@/stores/auth')).useAuthStore()
      auth.user = { id: 'u-1', uuid: 'u-1', username: 'testuser', display_name: 'Test' } as any
      auth.token = 'test-token'
      auth.isAuthenticated = true

      const musicApi = await import('@/api/musicV1')
      vi.mocked(musicApi.listMusicPlaylists).mockResolvedValue({
        data: [],
        total: 0,
      } as any)

      const wrapper = mount(MusicPlaylistsView, {
        global: {
          plugins: [pinia, router],
          stubs: { MIcon: true },
        },
      })
      await flushPromises()

      expect(wrapper.text()).toContain('暂无歌单')
      expect(wrapper.find('[data-testid="create-playlist-btn"]').exists()).toBe(true)
    })
  })

  describe('MusicSearchView.vue', () => {
    const mockSongs = [
      { id: 's-1', title: 'Power', artist: 'Kanye West', album: 'MBDTF', duration: 292 },
      { id: 's-2', title: 'Stronger', artist: 'Kanye West', album: 'Graduation', duration: 311 },
    ]
    const mockAlbums = [
      { id: 'alb-1', title: 'Graduation', artist: 'Kanye West', year: 2007 },
    ]
    const mockPlaylists = [
      { id: 'pl-1', name: 'Kanye 精选', song_count: 25 },
    ]

    it('renders search input and hot search tags when query is empty', async () => {
      const wrapper = mount(MusicSearchView, {
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.find('[data-testid="music-search-input"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('热门搜索')
      expect(wrapper.text()).toContain('Ye')
      expect(wrapper.text()).toContain('Kanye')
    })

    it('renders song, album, and playlist results when search query returns data', async () => {
      const wrapper = mount(MusicSearchView, {
        props: {
          initialQuery: 'Kanye',
          initialSongs: mockSongs,
          initialAlbums: mockAlbums,
          initialPlaylists: mockPlaylists,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('Power')
      expect(wrapper.text()).toContain('Stronger')
      expect(wrapper.text()).toContain('Graduation')
      expect(wrapper.text()).toContain('Kanye 精选')
      expect(wrapper.findAll('[data-testid="search-song-item"]').length).toBe(2)
      expect(wrapper.findAll('[data-testid="search-album-item"]').length).toBe(1)
      expect(wrapper.findAll('[data-testid="search-playlist-item"]').length).toBe(1)
    })

    it('clicking a search song triggers playback', async () => {
      const playerStore = useAudioPlayerStore()
      const playSpy = vi.spyOn(playerStore, 'playSong').mockImplementation(async () => {})

      const wrapper = mount(MusicSearchView, {
        props: {
          initialQuery: 'Kanye',
          initialSongs: mockSongs,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const item = wrapper.find('[data-testid="search-song-item"]')
      await item.trigger('click')
      expect(playSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Power',
      }))
    })
  })

  describe('MusicPlaylistDetailView.vue', () => {
    const mockDetail = {
      id: 'pl-100',
      name: '极简专注音',
      description: '适合深度工作流的背景音乐精选',
      creator: { display_name: 'Atoman 官方' },
    }
    const mockSongs = [
      { id: 's-10', title: 'Focus Track 1', artist: 'Deep Flow', duration: 180 },
      { id: 's-11', title: 'Focus Track 2', artist: 'Deep Flow', duration: 210 },
    ]

    it('renders playlist hero info, play all button, and songs list', async () => {
      const wrapper = mount(MusicPlaylistDetailView, {
        props: {
          initialPlaylist: mockDetail,
          initialSongs: mockSongs,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('极简专注音')
      expect(wrapper.text()).toContain('适合深度工作流的背景音乐精选')
      expect(wrapper.text()).toContain('Atoman 官方')
      expect(wrapper.text()).toContain('2 首歌曲')
      expect(wrapper.find('[data-testid="play-all-btn"]').exists()).toBe(true)
      expect(wrapper.findAll('[data-testid="playlist-song-item"]').length).toBe(2)
      expect(wrapper.text()).toContain('Focus Track 1')
    })

    it('clicking play all triggers playback of first song', async () => {
      const playerStore = useAudioPlayerStore()
      const playSpy = vi.spyOn(playerStore, 'playSong').mockImplementation(async () => {})

      const wrapper = mount(MusicPlaylistDetailView, {
        props: {
          initialPlaylist: mockDetail,
          initialSongs: mockSongs,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      const playAllBtn = wrapper.find('[data-testid="play-all-btn"]')
      await playAllBtn.trigger('click')
      expect(playSpy).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Focus Track 1',
      }))
    })
  })

  describe('MusicAlbumDetailView.vue', () => {
    const mockAlbum = {
      id: 'alb-2049',
      title: '2049',
      artist: 'Ye',
      year: 2026,
    }
    const mockSongs = [
      { id: 's-20', title: 'Track 2049', artist: 'Ye', duration: 240 },
    ]

    it('renders album info and songs list', async () => {
      const wrapper = mount(MusicAlbumDetailView, {
        props: {
          initialAlbum: mockAlbum,
          initialSongs: mockSongs,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.text()).toContain('2049')
      expect(wrapper.text()).toContain('Ye')
      expect(wrapper.text()).toContain('2026 年')
      expect(wrapper.findAll('[data-testid="album-song-item"]').length).toBe(1)
    })
  })

  describe('MusicMeView.vue', () => {
    const mockStarred = [
      { id: 'star-1', title: '2049', subtitle: 'Ye', kind: 'album' as const },
      { id: 'star-2', title: '极简专注音', subtitle: '15 首歌曲', kind: 'playlist' as const },
    ]
    const mockHistory = [
      { id: 'hist-1', title: 'Power', artist: 'Kanye West', duration: 292 },
    ]
    const mockPlaylists = [
      { id: 'pl-mine', name: '我的私藏', song_count: 8, is_public: false },
    ]

    it('renders music stats and switches between 收藏, 收听历史, and 我的歌单 tabs', async () => {
      const wrapper = mount(MusicMeView, {
        props: {
          initialTab: 'starred',
          initialStarred: mockStarred,
          initialHistory: mockHistory,
          initialPlaylists: mockPlaylists,
        },
        global: {
          plugins: [pinia, router],
        },
      })

      // Starred Tab
      expect(wrapper.text()).toContain('我的收藏')
      expect(wrapper.text()).toContain('收听历史')
      expect(wrapper.text()).toContain('自建歌单')
      expect(wrapper.findAll('[data-testid="starred-item"]').length).toBe(2)
      expect(wrapper.text()).toContain('2049')

      // Switch to History Tab
      const historyTab = wrapper.find('[data-testid="tab-history"]')
      await historyTab.trigger('click')
      expect(wrapper.findAll('[data-testid="history-item"]').length).toBe(1)
      expect(wrapper.text()).toContain('Power')

      // Switch to Playlists Tab
      const playlistsTab = wrapper.find('[data-testid="tab-playlists"]')
      await playlistsTab.trigger('click')
      expect(wrapper.findAll('[data-testid="playlist-item"]').length).toBe(1)
      expect(wrapper.text()).toContain('我的私藏')
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

    it('swiping up on track card navigates to full player (/music/player)', async () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-42',
        title: 'Celestial Drift',
        artist: 'Astral Echo',
      } as any

      const pushSpy = vi.spyOn(router, 'push')

      const wrapper = mount(MobileAudioPlayer, {
        global: {
          plugins: [pinia, router],
        },
      })

      const track = wrapper.find('.mobile-mini-player__track')
      expect(track.exists()).toBe(true)

      await track.trigger('touchstart', {
        touches: [{ clientX: 100, clientY: 200 }],
      })
      await track.trigger('touchmove', {
        touches: [{ clientX: 100, clientY: 140 }],
      })
      await track.trigger('touchend', {
        changedTouches: [{ clientX: 100, clientY: 140 }],
      })

      expect(pushSpy).toHaveBeenCalledWith('/music/player')
    })

    it('swiping left on track card triggers playNext', async () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-42',
        title: 'Celestial Drift',
        artist: 'Astral Echo',
      } as any
      const nextSpy = vi.spyOn(playerStore, 'playNext').mockImplementation(() => {})

      const wrapper = mount(MobileAudioPlayer, {
        global: {
          plugins: [pinia, router],
        },
      })

      const track = wrapper.find('.mobile-mini-player__track')
      await track.trigger('touchstart', {
        touches: [{ clientX: 200, clientY: 100 }],
      })
      await track.trigger('touchmove', {
        touches: [{ clientX: 130, clientY: 100 }],
      })
      await track.trigger('touchend', {
        changedTouches: [{ clientX: 130, clientY: 100 }],
      })

      expect(nextSpy).toHaveBeenCalled()
    })

    it('swiping right on track card triggers playPrevious', async () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-42',
        title: 'Celestial Drift',
        artist: 'Astral Echo',
      } as any
      const prevSpy = vi.spyOn(playerStore, 'playPrevious').mockImplementation(() => {})

      const wrapper = mount(MobileAudioPlayer, {
        global: {
          plugins: [pinia, router],
        },
      })

      const track = wrapper.find('.mobile-mini-player__track')
      await track.trigger('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }],
      })
      await track.trigger('touchmove', {
        touches: [{ clientX: 170, clientY: 100 }],
      })
      await track.trigger('touchend', {
        changedTouches: [{ clientX: 170, clientY: 100 }],
      })

      expect(prevSpy).toHaveBeenCalled()
    })
  })

  describe('MobilePlayerView.vue', () => {
    it('renders current track title, artist, and media controls', () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-99',
        title: 'Horizon Departure',
        artist: 'Solaris',
      } as any

      const wrapper = mount(MobilePlayerView, {
        global: {
          plugins: [pinia, router],
          stubs: {
            PortalTeleport: true,
          },
        },
      })

      expect(wrapper.text()).toContain('Horizon Departure')
      expect(wrapper.text()).toContain('Solaris')
      const icons = wrapper.findAllComponents(MIcon)
      expect(icons.length).toBeGreaterThan(0)
    })

    it('toggles playback when play/pause button is clicked', async () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-99',
        title: 'Horizon Departure',
        artist: 'Solaris',
      } as any
      const togglePlaySpy = vi.spyOn(playerStore, 'togglePlay').mockImplementation(() => {})

      const wrapper = mount(MobilePlayerView, {
        global: {
          plugins: [pinia, router],
          stubs: {
            PortalTeleport: true,
          },
        },
      })

      const playBtn = wrapper.find('.mobile-player-view__control--primary')
      expect(playBtn.exists()).toBe(true)
      await playBtn.trigger('click')

      expect(togglePlaySpy).toHaveBeenCalled()
    })

    it('renders dismiss button and triggers navigation back when clicked', async () => {
      const playerStore = usePlayerStore()
      playerStore.currentSong = {
        id: 's-99',
        title: 'Horizon Departure',
        artist: 'Solaris',
      } as any
      const pushSpy = vi.spyOn(router, 'push').mockImplementation(async () => {})

      const wrapper = mount(MobilePlayerView, {
        global: {
          plugins: [pinia, router],
          stubs: {
            PortalTeleport: true,
          },
        },
      })

      const dismissBtn = wrapper.find('[data-testid="player-dismiss-btn"]')
      expect(dismissBtn.exists()).toBe(true)
      await dismissBtn.trigger('click')
      expect(pushSpy).toHaveBeenCalledWith('/music')
    })
  })
})
