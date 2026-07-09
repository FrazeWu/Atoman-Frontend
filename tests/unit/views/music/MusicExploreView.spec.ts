import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExploreView from '@/views/music/ExploreView.vue'

const mocks = vi.hoisted(() => ({
  listMusicDiscoverFeed: vi.fn(),
  listMusicAlbums: vi.fn(),
  listMusicArtists: vi.fn(),
  listRecommendedArtists: vi.fn(),
  listPublicMusicPlaylists: vi.fn(),
  listPlaylistBookmarks: vi.fn(),
  listAlbumBookmarks: vi.fn(),
  listArtistBookmarks: vi.fn(),
  createPlaylistBookmark: vi.fn(),
  deletePlaylistBookmark: vi.fn(),
  createAlbumBookmark: vi.fn(),
  deleteAlbumBookmark: vi.fn(),
  createArtistBookmark: vi.fn(),
  deleteArtistBookmark: vi.fn(),
  push: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
  openPlaylist: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicDiscoverFeed: mocks.listMusicDiscoverFeed,
  listMusicAlbums: mocks.listMusicAlbums,
  listMusicArtists: mocks.listMusicArtists,
  listRecommendedArtists: mocks.listRecommendedArtists,
  listPublicMusicPlaylists: mocks.listPublicMusicPlaylists,
  listPlaylistBookmarks: mocks.listPlaylistBookmarks,
  listAlbumBookmarks: mocks.listAlbumBookmarks,
  listArtistBookmarks: mocks.listArtistBookmarks,
  createPlaylistBookmark: mocks.createPlaylistBookmark,
  deletePlaylistBookmark: mocks.deletePlaylistBookmark,
  createAlbumBookmark: mocks.createAlbumBookmark,
  deleteAlbumBookmark: mocks.deleteAlbumBookmark,
  createArtistBookmark: mocks.createArtistBookmark,
  deleteArtistBookmark: mocks.deleteArtistBookmark,
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
    openAlbum: mocks.openAlbum,
    openArtist: mocks.openArtist,
    openPlaylist: mocks.openPlaylist,
  }),
}))

describe('Music ExploreView.vue', () => {
  beforeEach(() => {
    mocks.listMusicDiscoverFeed.mockReset()
    mocks.listMusicAlbums.mockReset()
    mocks.listMusicArtists.mockReset()
    mocks.listRecommendedArtists.mockReset()
    mocks.listPublicMusicPlaylists.mockReset()
    mocks.listPlaylistBookmarks.mockReset()
    mocks.listAlbumBookmarks.mockReset()
    mocks.listArtistBookmarks.mockReset()
    mocks.createPlaylistBookmark.mockReset()
    mocks.deletePlaylistBookmark.mockReset()
    mocks.createAlbumBookmark.mockReset()
    mocks.deleteAlbumBookmark.mockReset()
    mocks.createArtistBookmark.mockReset()
    mocks.deleteArtistBookmark.mockReset()
    mocks.push.mockReset()
    mocks.openAlbum.mockReset()
    mocks.openArtist.mockReset()
    mocks.openPlaylist.mockReset()

    mocks.listMusicDiscoverFeed.mockResolvedValue({
      data: [
        {
          type: 'album',
          id: 'album-1',
          title: '2049',
          image_url: '/uploads/2049.jpg',
          target_path: '/music/album/album-1',
          artists: [{ id: 'artist-1', name: 'Ye' }],
          play_count: 12,
          bookmark_count: 4,
        },
        {
          type: 'playlist',
          id: 'playlist-1',
          title: 'Late Night Mix',
          description: '夜间循环',
          cover_url: '/uploads/late-night.jpg',
          song_count: 18,
          owner_username: 'alice',
          play_count: 42,
          bookmark_count: 7,
          target_path: '/music/playlist/playlist-1',
        },
        {
          type: 'artist',
          id: 'artist-1',
          name: 'Ye',
          title: 'Ye',
          summary: 'Kanye',
          image_url: '',
          target_path: '/music/artist/artist-1',
          play_count: 3,
          bookmark_count: 1,
          entry_status: 'open',
        },
      ],
    })
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
    mocks.listRecommendedArtists.mockResolvedValue({
      data: [
        {
          id: 'artist-1',
          title: 'Ye',
          summary: 'Kanye',
          image_url: '',
          target_path: '/music?artist=artist-1',
          play_count: 3,
          bookmark_count: 1,
        },
      ],
      meta: { page: 1, page_size: 10, total: 1, has_more: false },
    })
    mocks.listPublicMusicPlaylists.mockResolvedValue({
      data: [
        {
          id: 'playlist-1',
          name: 'Late Night Mix',
          description: '夜间循环',
          cover_url: '/uploads/late-night.jpg',
          song_count: 18,
          owner_username: 'alice',
          play_count: 42,
          bookmark_count: 7,
        },
      ],
      meta: { page: 1, page_size: 10, total: 1, has_more: false },
    })
    mocks.listAlbumBookmarks.mockResolvedValue({ data: [] })
    mocks.listArtistBookmarks.mockResolvedValue({ data: [] })
    mocks.listPlaylistBookmarks.mockResolvedValue({ data: [] })
  })

  it('uses 发现 as the default page title', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: {
            props: ['title'],
            template: '<div data-testid="page-header-title">{{ title }}</div>',
          },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="page-header-title"]').text()).toBe('发现')
  })

  it('uses the external page title when provided', async () => {
    const wrapper = mount(ExploreView, {
      props: {
        pageTitle: '专辑',
      },
      global: {
        stubs: {
          PPageHeader: {
            props: ['title'],
            template: '<div data-testid="page-header-title">{{ title }}</div>',
          },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="page-header-title"]').text()).toBe('专辑')
  })

  it('renders album-only content when used in albums mode', async () => {
    const wrapper = mount(ExploreView, {
      props: {
        pageTitle: '专辑',
        contentMode: 'albums',
      },
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    expect(mocks.listMusicDiscoverFeed).not.toHaveBeenCalled()
    expect(mocks.listMusicAlbums).toHaveBeenCalledWith({ page: 1, page_size: 48, sort: 'hot' })
    expect(wrapper.find('[aria-label="专辑列表"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="discover-album-card"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="discover-artist-card"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="discover-playlist-card"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('2049')
    expect(wrapper.text()).not.toContain('Late Night Mix')
  })

  it('shows album and artist groups in search dropdown', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span><slot /><slot name="action" /></div>' },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
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
    expect(mocks.push).toHaveBeenCalledWith('/music?album=album-1')

    await input.trigger('focus')
    await input.setValue('ye')
    await flushPromises()
    const reopenedButtons = wrapper.findAll('button.search-result')
    await reopenedButtons[1].trigger('mousedown')
    expect(mocks.push).toHaveBeenCalledWith('/music?artist=artist-1')
  })

  it('renders discover sections from the backend discover feed', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span></div>' },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    expect(mocks.listMusicDiscoverFeed).toHaveBeenCalled()
    expect(mocks.listMusicAlbums).not.toHaveBeenCalled()
    expect(mocks.listRecommendedArtists).not.toHaveBeenCalled()
    expect(mocks.listPublicMusicPlaylists).not.toHaveBeenCalled()
    expect(wrapper.find('[aria-label="发现分区"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="推荐专辑列表"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="发现专辑分区"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="发现歌单分区"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="发现艺人分区"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="discover-album-card"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="discover-artist-card"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="discover-playlist-card"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('2049')
    expect(wrapper.text()).toContain('Ye')
    expect(wrapper.text()).toContain('alice/Late Night Mix')
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('7')
    expect(wrapper.get('[data-testid="discover-playlist-card"] img').attributes('src')).toBe('/uploads/late-night.jpg')

    const sections = wrapper.findAll('[data-testid="discover-section-title"]').map(node => node.text())
    expect(sections).toEqual(['专辑', '歌单', '艺人'])
  })

  it('keeps the playlist section structure visible when public playlists are empty', async () => {
    mocks.listMusicDiscoverFeed.mockResolvedValueOnce({
      data: [
        {
          type: 'album',
          id: 'album-1',
          title: '2049',
          target_path: '/music/album/album-1',
          artists: [{ id: 'artist-1', name: 'Ye' }],
        },
        {
          type: 'artist',
          id: 'artist-1',
          name: 'Ye',
          target_path: '/music/artist/artist-1',
          entry_status: 'open',
        },
      ],
    })

    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span></div>' },
          PSegmentedControl: { props: ['options'], template: '<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('[aria-label="发现歌单分区"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="discover-playlist-card"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="discover-playlist-placeholder"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('暂无公开歌单')
  })

  it('opens playlist route when clicking a discover playlist card', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="discover-playlist-card"]').trigger('click')

    expect(mocks.push).toHaveBeenCalledWith('/music/playlist/playlist-1')
    expect(mocks.openPlaylist).not.toHaveBeenCalled()
  })

  it('opens album drawer when clicking a discover album card', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    await wrapper.get('[aria-label="发现专辑分区"] [data-testid="discover-album-card"]').trigger('click')

    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')
    expect(mocks.push).not.toHaveBeenCalledWith('/music?album=album-1')
  })

  it('opens artist drawer when clicking a discover artist card', async () => {
    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    await wrapper.get('[data-testid="discover-artist-card"]').trigger('click')

    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
    expect(mocks.push).not.toHaveBeenCalledWith('/music?artist=artist-1')
  })

  it('toggles playlist bookmark from the discover feed', async () => {
    mocks.createPlaylistBookmark.mockResolvedValue({
      id: 'playlist-bookmark-1',
      playlist_id: 'playlist-1',
      created_at: '2026-07-05T00:00:00Z',
    })

    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    const playlistCard = wrapper.find('[data-testid="discover-playlist-card"]')
    expect(playlistCard.find('button[aria-label="收藏"]').exists()).toBe(true)

    await playlistCard.find('button[aria-label="收藏"]').trigger('click')

    expect(mocks.createPlaylistBookmark).toHaveBeenCalledWith('playlist-1')
    expect(wrapper.text()).toContain('收藏 8')
  })

  it('toggles artist bookmark from the discover feed', async () => {
    mocks.createArtistBookmark.mockResolvedValue({
      id: 'artist-bookmark-1',
      artist_id: 'artist-1',
      created_at: '2026-07-05T00:00:00Z',
    })

    const wrapper = mount(ExploreView, {
      global: {
        stubs: {
          PPageHeader: { props: ['title'], template: '<div><span>{{ title }}</span></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>' },
        },
      },
    })
    await flushPromises()

    const artistCard = wrapper.find('[data-testid="discover-artist-card"]')
    expect(artistCard.find('button[aria-label="收藏"]').exists()).toBe(true)

    await artistCard.find('button[aria-label="收藏"]').trigger('click')

    expect(mocks.createArtistBookmark).toHaveBeenCalledWith('artist-1')
  })
})
