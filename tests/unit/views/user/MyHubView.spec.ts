import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const { apiRequestResult, videoLoad, videoRecords } = vi.hoisted(() => ({
  apiRequestResult: vi.fn(),
  videoLoad: vi.fn(),
  videoRecords: { value: {} as Record<string, unknown> },
}))

vi.mock('@/api/client', () => ({ apiRequestResult }))
vi.mock('@/api/musicV1', () => ({

  listAlbumBookmarks: vi.fn(),
  listArtistBookmarks: vi.fn(),
  listPlaylistBookmarks: vi.fn(),
  listMusicListeningHistory: vi.fn(),
}))
vi.mock('@/api/podcast', () => ({ getPodcastBookmarks: vi.fn() }))
vi.mock('@/composables/useVideoBookmarks', () => ({
  useVideoBookmarks: () => ({
    records: videoRecords,
    load: videoLoad,
  }),
}))

import MyHubView from '@/views/user/MyHubView.vue'
import { useAuthStore } from '@/stores/auth'

const LinkStub = defineComponent({
	props: ['to'],
	template: '<a :href="String(to)"><slot /></a>',
})

const ContinueSectionStub = defineComponent({
	props: ['module'],
	template: '<section class="continue-stub" :data-module="module" />',
})

describe('MyHubView', () => {
  it('shows counts loaded from personal content APIs', async () => {
    const { listAlbumBookmarks, listArtistBookmarks, listPlaylistBookmarks, listMusicListeningHistory } = await import('@/api/musicV1')
    const { getPodcastBookmarks } = await import('@/api/podcast')

    apiRequestResult.mockImplementation((url: string) => {
      if (url.includes('/blog/bookmarks')) return Promise.resolve({ ok: true, data: { data: [
        { id: 'blog-1', content: { id: 'post-1', title: '博客文章一', cover_url: '/post-1.jpg' } },
        { id: 'blog-2', content: { id: 'post-2', title: '博客文章二' } },
      ] } })
      if (url.includes('/feed/reading-list')) return Promise.resolve({ ok: true, data: {
        meta: { total: 4 },
        data: [{ target_type: 'post', target_id: 'reading-1', post: { id: 'reading-1', title: '稍后阅读一', cover_url: '/reading-1.jpg' } }],
      } })
      return Promise.resolve({ ok: true, data: { data: [] } })
    })
    vi.mocked(listAlbumBookmarks).mockResolvedValue({ data: [{ id: 'album-1', album: { id: 'album-1', title: '收藏专辑', cover_url: '/album-1.jpg' } }], meta: { total: 1 } } as never)
    vi.mocked(listArtistBookmarks).mockResolvedValue({ data: [{ id: 'artist-1', artist: { id: 'artist-1', name: '收藏艺术家' } }, { id: 'artist-2' }], meta: { total: 2 } } as never)
    vi.mocked(listPlaylistBookmarks).mockResolvedValue({ data: [{ id: 'playlist-1', playlist: { id: 'playlist-1', name: '收藏歌单' } }], meta: { total: 3 } } as never)
    vi.mocked(listMusicListeningHistory).mockResolvedValue({ data: [{ id: 'history-1', song: { id: 'song-1', title: '最近播放歌曲', artists: [{ id: 'artist-1', name: '歌手一' }], album: { id: 'album-1', title: '专辑一' } } }], meta: { total: 7 } } as never)
    vi.mocked(getPodcastBookmarks).mockResolvedValue({ data: [{ id: 'podcast-1', episode: { id: 'episode-1', post: { title: '收藏播客' }, episode_cover_url: '/podcast-1.jpg' } }] })
    videoRecords.value = { 'video-1': { id: 'video-bookmark-1', video_id: 'video-1', video: { id: 'video-1', title: '收藏视频', thumbnail_url: '/video-1.jpg' } } }
    videoLoad.mockResolvedValue(undefined)

    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = {
      uuid: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      display_name: 'Alice',
    }
    authStore.token = 'token'
    authStore.isAuthenticated = true

    const wrapper = mount(MyHubView, {
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: LinkStub,
          PButton: LinkStub,
          PAvatar: defineComponent({ template: '<span />' }),
          ContentContinueSection: ContinueSectionStub,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('a[href="/feed/reading-list"]').text()).toContain('4')
    expect(wrapper.get('a[href="/posts/bookmarks"]').text()).toContain('2')
    expect(wrapper.get('a[href="/music/bookmarks"]').text()).toContain('6')
    expect(wrapper.get('a[href="/music/history"]').text()).toContain('7')
    expect(wrapper.get('a[href="/videos/favorites"]').text()).toContain('1')
    expect(wrapper.get('a[href="/podcasts/favorites"]').text()).toContain('1')
    expect(wrapper.get('[data-testid="hub-preview-saved"]').text()).toContain('博客文章一')
    expect(wrapper.get('[data-testid="hub-preview-saved"]').text()).toContain('收藏专辑')
    expect(wrapper.get('[data-testid="hub-preview-saved"]').text()).toContain('收藏视频')
    expect(wrapper.get('[data-testid="hub-preview-saved"]').text()).toContain('收藏播客')
    expect(wrapper.get('[data-testid="hub-preview-recent"]').text()).toContain('最近播放歌曲')
    expect(wrapper.get('[data-testid="hub-preview-reading"]').text()).toContain('稍后阅读一')
    expect(wrapper.get('[data-testid="hub-preview-reading"] a[href="/feed/reading-list"]').exists()).toBe(true)
  })

  it('keeps failed content counts hidden without blocking the hub', async () => {
    const { listAlbumBookmarks, listArtistBookmarks, listPlaylistBookmarks, listMusicListeningHistory } = await import('@/api/musicV1')
    const { getPodcastBookmarks } = await import('@/api/podcast')
    const error = new Error('request failed')
    apiRequestResult.mockRejectedValue(error)
    vi.mocked(listAlbumBookmarks).mockRejectedValue(error)
    vi.mocked(listArtistBookmarks).mockRejectedValue(error)
    vi.mocked(listPlaylistBookmarks).mockRejectedValue(error)
    vi.mocked(listMusicListeningHistory).mockRejectedValue(error)
    vi.mocked(getPodcastBookmarks).mockRejectedValue(error)
    videoLoad.mockRejectedValue(error)

    const pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.user = { uuid: 'user-1', username: 'alice', email: 'alice@example.com', display_name: 'Alice' }
    authStore.token = 'token'
    authStore.isAuthenticated = true

    const wrapper = mount(MyHubView, {
      global: {
        plugins: [pinia],
        stubs: {
          RouterLink: LinkStub,
          PButton: LinkStub,
          PAvatar: defineComponent({ template: '<span />' }),
          ContentContinueSection: ContinueSectionStub,
        },
      },
    })

    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('我的 Atoman')
    expect(wrapper.findAll('.my-hub__shortcut-badge')).toHaveLength(0)
  })

	it('shows identity, personal shortcuts, and continue sections', () => {
		const pinia = createPinia()
		setActivePinia(pinia)
		const authStore = useAuthStore()
		authStore.user = {
			uuid: 'user-1',
			username: 'alice',
			email: 'alice@example.com',
			display_name: 'Alice',
		}
		authStore.token = 'token'
		authStore.isAuthenticated = true

		const wrapper = mount(MyHubView, {
			global: {
				plugins: [pinia],
				stubs: {
					RouterLink: LinkStub,
					PButton: LinkStub,
					PAvatar: defineComponent({ template: '<span />' }),
					ContentContinueSection: ContinueSectionStub,
				},
			},
		})

		expect(wrapper.get('h1').text()).toBe('我的 Atoman')
		expect(wrapper.text()).toContain('Alice')
		expect(wrapper.find('a[href="/inbox"]').exists()).toBe(true)
		expect(wrapper.find('a[href="/studio"]').exists()).toBe(true)
		expect(wrapper.find('a[href="/users/alice"]').text()).toContain('打开公开主页')
		expect(wrapper.find('a[href="/users/alice/settings"]').exists()).toBe(true)
		expect(wrapper.findAll('.continue-stub').map((item) => item.attributes('data-module'))).toEqual([
			'blog',
			'podcast',
			'video',
		])
	})
})
