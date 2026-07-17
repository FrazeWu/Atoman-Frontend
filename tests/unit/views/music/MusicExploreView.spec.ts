import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExploreView from '@/views/music/ExploreView.vue'

const mocks = vi.hoisted(() => ({
  listMusicDiscoverFeed: vi.fn(),
  listAlbumBookmarks: vi.fn(),
  listArtistBookmarks: vi.fn(),
  listRecommendedAlbums: vi.fn(),
  listMusicAlbums: vi.fn(),
  listMusicArtists: vi.fn(),
  push: vi.fn(),
  openPlaylist: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicDiscoverFeed: mocks.listMusicDiscoverFeed,
  listAlbumBookmarks: mocks.listAlbumBookmarks,
  listArtistBookmarks: mocks.listArtistBookmarks,
  createAlbumBookmark: vi.fn(),
  createArtistBookmark: vi.fn(),
  deleteAlbumBookmark: vi.fn(),
  deleteArtistBookmark: vi.fn(),
  listRecommendedAlbums: mocks.listRecommendedAlbums,
  listMusicAlbums: mocks.listMusicAlbums,
  listMusicArtists: mocks.listMusicArtists,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
  RouterLink: {
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
  },
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    openAlbum: vi.fn(),
    openArtist: vi.fn(),
    openPlaylist: mocks.openPlaylist,
  }),
}))

describe('Music ExploreView.vue', () => {
  beforeEach(() => {
    mocks.listMusicDiscoverFeed.mockReset()
    mocks.listAlbumBookmarks.mockReset()
    mocks.listArtistBookmarks.mockReset()
    mocks.listRecommendedAlbums.mockReset()
    mocks.listMusicAlbums.mockReset()
    mocks.listMusicArtists.mockReset()
    mocks.push.mockReset()
    mocks.openPlaylist.mockReset()

    mocks.listRecommendedAlbums.mockResolvedValue({
      data: [
        { id: 'rec-1', title: 'Recommended Album', summary: 'summary', target_path: '/music?album=rec-1', image_url: '' },
      ],
    })
    mocks.listMusicDiscoverFeed.mockResolvedValue({ data: [], meta: { page: 1, page_size: 48, total: 0, has_more: false } })
    mocks.listAlbumBookmarks.mockResolvedValue({ data: [] })
    mocks.listArtistBookmarks.mockResolvedValue({ data: [] })
    mocks.listMusicAlbums.mockResolvedValue({
      data: [
        { id: 'album-1', title: '2049', artists: [{ id: 'artist-1', name: 'Ye' }] },
      ],
      meta: { page: 1, page_size: 10, total: 1, has_more: false },
    })
    mocks.listMusicArtists.mockResolvedValue({
      data: [
        { id: 'artist-1', name: 'Ye', legal_name: 'Kanye' },
      ],
      meta: { page: 1, page_size: 10, total: 1, has_more: false },
    })
  })

  it('loads the mixed discover feed with the selected browse mode', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div>{{ title }}</div>' },
          PSegmentedControl: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: '<div><button v-for="o in options" :key="o.value" :data-mode="o.value" @click="$emit(\'update:modelValue\', o.value)">{{ o.label }}</button></div>',
          },
          RouterLink: true,
          ArtistDrawer: true,
          AlbumDrawer: true,
        },
      },
    })
    await flushPromises()

    expect(mocks.listMusicDiscoverFeed).toHaveBeenCalledWith('hot')
    expect(wrapper.text()).toContain('最新')

    await wrapper.get('[data-mode="latest"]').trigger('click')
    await flushPromises()
    expect(mocks.listMusicDiscoverFeed).toHaveBeenLastCalledWith('latest')
  })

  it('shows album and artist groups in search dropdown', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
          ArtistDrawer: true,
          AlbumDrawer: true,
        },
      },
    })
    await flushPromises()

    const input = wrapper.find('[data-testid="music-explore-search-input"]')
    await input.trigger('focus')
    await input.setValue('ye')
    await flushPromises()

    expect(mocks.listMusicAlbums).toHaveBeenLastCalledWith({ q: 'ye', page: 1, page_size: 10, sort: 'hot' })
    expect(mocks.listMusicArtists).toHaveBeenLastCalledWith({ q: 'ye', page: 1, page_size: 10 })
    expect(wrapper.text()).toContain('专辑')
    expect(wrapper.text()).toContain('艺术家')
    expect(wrapper.text()).toContain('2049')
    expect(wrapper.text()).toContain('Ye')

    const resultButtons = wrapper.findAll('button.search-result')
    await resultButtons[0].trigger('mousedown')
    expect(mocks.push).toHaveBeenCalledWith('/music/album/album-1')

    await input.trigger('focus')
    await input.setValue('ye')
    await flushPromises()
    const reopenedButtons = wrapper.findAll('button.search-result')
    await reopenedButtons[1].trigger('mousedown')
    expect(mocks.push).toHaveBeenCalledWith('/music/artist/artist-1')
  })

  it('opens a public playlist in the existing playlist drawer', async () => {
    mocks.listMusicDiscoverFeed.mockResolvedValue({
      data: [{ id: 'playlist-1', type: 'playlist', title: '通勤歌单', song_count: 3 }],
      meta: { page: 1, page_size: 48, total: 1, has_more: false },
    })
    const wrapper = mount(ExploreView, {
      global: { stubs: { RouterLink: true, ArtistDrawer: true, AlbumDrawer: true } },
    })
    await flushPromises()

    await wrapper.get('[data-testid="discover-playlist-card"]').trigger('click')

    expect(mocks.openPlaylist).toHaveBeenCalledWith('playlist-1')
    expect(mocks.push).not.toHaveBeenCalledWith('/music/playlist/playlist-1')
  })

  it('uses the current loading skeleton and empty state', async () => {
    mocks.listMusicDiscoverFeed.mockReturnValue(new Promise(() => {}))
    const loadingWrapper = mount(ExploreView, {
      global: { stubs: { RouterLink: true, ArtistDrawer: true, AlbumDrawer: true } },
    })
    await loadingWrapper.vm.$nextTick()

    expect(loadingWrapper.get('.state-line').text()).toBe('正在加载...')

    loadingWrapper.unmount()
    mocks.listMusicDiscoverFeed.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 48, total: 0, has_more: false },
    })
    const emptyWrapper = mount(ExploreView, {
      global: { stubs: { RouterLink: true, ArtistDrawer: true, AlbumDrawer: true } },
    })
    await flushPromises()

    expect(emptyWrapper.get('.state-line').text()).toBe('暂无发现内容')
  })

  it('shows the discovery loading error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.listMusicDiscoverFeed.mockRejectedValueOnce(new Error('network'))
    const wrapper = mount(ExploreView, {
      global: { stubs: { RouterLink: true, ArtistDrawer: true, AlbumDrawer: true } },
    })
    await flushPromises()

    expect(wrapper.get('.state-line--error').text()).toBe('发现内容加载失败')
    consoleError.mockRestore()
  })
})
