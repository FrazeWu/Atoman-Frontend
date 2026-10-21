import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import MGuestCard from '@mobile/components/ui/MGuestCard.vue'
import MusicMeView from '@mobile/views/music/MusicMeView.vue'
import { useAuthStore } from '@/stores/auth'
import { useAudioPlayerStore } from '@/stores/player'
import * as musicApi from '@/api/musicV1'

describe('MGuestCard.vue & MusicMeView.vue (Real Data Integration)', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/music/me', component: { template: '<div>Music Me</div>' } },
        { path: '/login', component: { template: '<div>Login</div>' } },
        { path: '/music/album/:id', component: { template: '<div>Album</div>' } },
        { path: '/music/playlist/:id', component: { template: '<div>Playlist</div>' } },
        { path: '/music/artist/:id', component: { template: '<div>Artist</div>' } },
        { path: '/music', component: { template: '<div>Discover</div>' } },
      ],
    })

    await router.push('/music/me')
    await router.isReady()
  })

  describe('MGuestCard.vue', () => {
    it('renders guest card with title, description, and login button link', async () => {
      const wrapper = mount(MGuestCard, {
        props: {
          title: '登录以同步你的音乐',
          description: '登录后可畅享收藏专辑与收听历史。',
          icon: 'music',
          loginRedirect: '/music/me',
        },
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('[data-testid="guest-card"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('登录以同步你的音乐')
      expect(wrapper.text()).toContain('登录后可畅享收藏专辑与收听历史。')
      expect(wrapper.find('[data-testid="guest-login-btn"]').exists()).toBe(true)
      const link = wrapper.find('a')
      expect(link.attributes('href')).toContain('/login?redirect=%2Fmusic%2Fme')
    })
  })

  describe('MusicMeView.vue Real Data Wiring', () => {
    it('renders MGuestCard when user is unauthenticated, without fake user fallback', async () => {
      const authStore = useAuthStore()
      authStore.user = null
      authStore.token = null
      vi.spyOn(authStore, 'restoreSession').mockResolvedValue(false)

      const wrapper = mount(MusicMeView, {
        global: {
          plugins: [pinia, router],
        },
      })

      expect(wrapper.find('[data-testid="guest-card"]').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('音乐爱好者')
      expect(wrapper.text()).not.toContain('@music_listener')
    })

    it('renders real user info and loads real starred, history, and playlists when authenticated', async () => {
      const authStore = useAuthStore()
      authStore.user = {
        uuid: 'u-123',
        username: 'fraze_audio',
        display_name: 'Fraze Music',
        email: 'fraze@music.org',
        avatar_url: 'https://example.com/avatar.png',
      }
      authStore.token = 'mock-jwt-token'
      authStore.isAuthenticated = true

      vi.spyOn(musicApi, 'listAlbumBookmarks').mockResolvedValue({
        data: [
          {
            id: 'b-alb-1',
            album_id: 'alb-1',
            created_at: '2026-10-21T00:00:00Z',
            album: {
              id: 'alb-1',
              title: '无何有之乡',
              artists: [{ id: 'art-1', name: '窦唯' }],
              cover_url: 'https://example.com/douwei.jpg',
            } as any,
          },
        ],
        meta: { total: 1, page: 1, page_size: 50, total_pages: 1 },
      })

      vi.spyOn(musicApi, 'listArtistBookmarks').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, page_size: 50, total_pages: 1 },
      })

      vi.spyOn(musicApi, 'listPlaylistBookmarks').mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, page_size: 50, total_pages: 1 },
      })

      vi.spyOn(musicApi, 'listMusicListeningHistory').mockResolvedValue({
        data: [
          {
            id: 'hist-1',
            listened_at: '2026-10-21T10:00:00Z',
            song: {
              id: 's-1',
              title: '雨吁',
              artist: '窦唯',
              album: '雨吁',
              duration: 245,
              audio_url: 'https://example.com/song.mp3',
            },
          } as any,
        ],
        meta: { total: 1, page: 1, page_size: 50, total_pages: 1 },
      })

      vi.spyOn(musicApi, 'listMusicPlaylists').mockResolvedValue({
        data: [
          {
            id: 'pl-100',
            name: '深夜思考电台',
            song_count: 14,
            is_public: true,
          } as any,
        ],
        meta: { total: 1, page: 1, page_size: 50, total_pages: 1 },
      })

      const wrapper = mount(MusicMeView, {
        global: {
          plugins: [pinia, router],
        },
      })

      // Wait for async loadUserData
      await new Promise((resolve) => setTimeout(resolve, 50))

      // User card
      expect(wrapper.text()).toContain('Fraze Music')
      expect(wrapper.text()).toContain('@fraze_audio')

      // Starred tab & items
      expect(wrapper.find('[data-testid="starred-item"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('无何有之乡')
      expect(wrapper.text()).toContain('窦唯')

      // History tab & item click plays track
      const playerStore = useAudioPlayerStore()
      const playSpy = vi.spyOn(playerStore, 'playSong').mockReturnValue()

      const historyTab = wrapper.find('[data-testid="tab-history"]')
      await historyTab.trigger('click')

      expect(wrapper.find('[data-testid="history-item"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('雨吁')

      await wrapper.find('[data-testid="history-item"]').trigger('click')
      expect(playSpy).toHaveBeenCalled()

      // Playlists tab & item
      const playlistsTab = wrapper.find('[data-testid="tab-playlists"]')
      await playlistsTab.trigger('click')

      expect(wrapper.find('[data-testid="playlist-item"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('深夜思考电台')
      expect(wrapper.text()).toContain('14 首曲目')
    })

    it('creates new playlist via real API createMusicPlaylist', async () => {
      const authStore = useAuthStore()
      authStore.user = {
        uuid: 'u-123',
        username: 'fraze_audio',
        display_name: 'Fraze Music',
        email: 'fraze@music.org',
      }
      authStore.token = 'mock-jwt-token'
      authStore.isAuthenticated = true

      vi.spyOn(musicApi, 'listAlbumBookmarks').mockResolvedValue({ data: [], meta: { total: 0 } as any })
      vi.spyOn(musicApi, 'listArtistBookmarks').mockResolvedValue({ data: [], meta: { total: 0 } as any })
      vi.spyOn(musicApi, 'listPlaylistBookmarks').mockResolvedValue({ data: [], meta: { total: 0 } as any })
      vi.spyOn(musicApi, 'listMusicListeningHistory').mockResolvedValue({ data: [], meta: { total: 0 } as any })
      vi.spyOn(musicApi, 'listMusicPlaylists').mockResolvedValue({ data: [], meta: { total: 0 } as any })

      const createSpy = vi.spyOn(musicApi, 'createMusicPlaylist').mockResolvedValue({
        id: 'pl-created-999',
        name: '数字花园曲集',
        song_count: 0,
        is_public: true,
      } as any)

      const wrapper = mount(MusicMeView, {
        props: {
          initialTab: 'playlists',
        },
        global: {
          plugins: [pinia, router],
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Click "新建歌单"
      const newBtn = wrapper.find('[data-testid="create-playlist-trigger-btn"]')
      expect(newBtn.exists()).toBe(true)
      await newBtn.trigger('click')

      const input = wrapper.find('input')
      await input.setValue('数字花园曲集')

      const submitBtn = wrapper.find('[data-testid="create-playlist-confirm-btn"]')
      await submitBtn.trigger('click')

      expect(createSpy).toHaveBeenCalledWith({ name: '数字花园曲集' })
      expect(wrapper.text()).toContain('数字花园曲集')
    })
  })
})
