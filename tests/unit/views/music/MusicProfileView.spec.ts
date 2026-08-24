import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import MusicProfileView from '@/views/music/MusicProfileView.vue'

const mocks = vi.hoisted(() => ({
  authState: {
    isAuthenticated: true,
    user: null as { username: string } | null,
  },
  getMusicHome: vi.fn(),
  listMusicListeningHistory: vi.fn(),
  listAlbumBookmarks: vi.fn(),
  listArtistBookmarks: vi.fn(),
  deleteAlbumBookmark: vi.fn(),
  deleteArtistBookmark: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicHome: mocks.getMusicHome,
  listMusicListeningHistory: mocks.listMusicListeningHistory,
  listAlbumBookmarks: mocks.listAlbumBookmarks,
  listArtistBookmarks: mocks.listArtistBookmarks,
  deleteAlbumBookmark: mocks.deleteAlbumBookmark,
  deleteArtistBookmark: mocks.deleteArtistBookmark,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mocks.authState,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    openAlbum: mocks.openAlbum,
    openArtist: mocks.openArtist,
  }),
}))

vi.mock('@/components/ui/PPageHeader.vue', () => ({
  default: {
    props: ['title'],
    template: '<header><h1>{{ title }}</h1><slot name="action" /></header>',
  },
}))

vi.mock('@/components/ui/PEmpty.vue', () => ({
  default: {
    props: ['title', 'description'],
    template: '<section data-testid="empty-state"><h2>{{ title }}</h2><p>{{ description }}</p><slot name="action" /></section>',
  },
}))

vi.mock('@/components/music', () => ({
  MusicAlbumCard: {
    props: ['album'],
    emits: ['click', 'click-artist', 'toggle-bookmark'],
    template: '<article data-testid="album-card" @click="$emit(\'click\')"><span>{{ album.title }}</span><button data-testid="album-bookmark" type="button" @click.stop="$emit(\'toggle-bookmark\')">remove</button></article>',
  },
  MusicArtistCard: {
    props: ['artist'],
    emits: ['click', 'toggle-bookmark'],
    template: '<article data-testid="artist-card" @click="$emit(\'click\')"><span>{{ artist.name }}</span><button data-testid="artist-bookmark" type="button" @click.stop="$emit(\'toggle-bookmark\')">remove</button></article>',
  },
}))

function setSuccessfulResponses() {
  mocks.listMusicListeningHistory.mockResolvedValue({
    data: [],
    meta: { page: 1, page_size: 1, total: 12, has_more: false },
  })
  mocks.listAlbumBookmarks.mockResolvedValue({
    data: [{
      id: 'album-bookmark-1',
      album_id: 'album-1',
      album: { id: 'album-1', title: '收藏专辑' },
    }],
    meta: { page: 1, page_size: 100, total: 1, has_more: false },
  })
  mocks.listArtistBookmarks.mockResolvedValue({
    data: [{
      id: 'artist-bookmark-1',
      artist_id: 'artist-1',
      artist: { id: 'artist-1', name: '收藏艺人' },
    }],
    meta: { page: 1, page_size: 100, total: 1, has_more: false },
  })
  mocks.getMusicHome.mockResolvedValue({ recently_played: [{ id: 'recent-1' }, { id: 'recent-2' }] })
}

function mountView() {
  return mount(MusicProfileView, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('MusicProfileView.vue', () => {
  beforeEach(() => {
    mocks.authState.isAuthenticated = true
    mocks.authState.user = { username: 'music-user' }
    mocks.getMusicHome.mockReset()
    mocks.listMusicListeningHistory.mockReset()
    mocks.listAlbumBookmarks.mockReset()
    mocks.listArtistBookmarks.mockReset()
    mocks.deleteAlbumBookmark.mockReset()
    mocks.deleteArtistBookmark.mockReset()
    mocks.openAlbum.mockReset()
    mocks.openArtist.mockReset()
    mocks.deleteAlbumBookmark.mockResolvedValue({})
    mocks.deleteArtistBookmark.mockResolvedValue({})
  })

  it('shows the login state without requesting private music data', async () => {
    mocks.authState.isAuthenticated = false
    mocks.authState.user = null

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('登录后查看音乐统计')
    expect(wrapper.find('[data-testid="music-profile-refresh"]').exists()).toBe(false)
    expect(mocks.getMusicHome).not.toHaveBeenCalled()
    expect(mocks.listAlbumBookmarks).not.toHaveBeenCalled()
  })

  it('loads statistics, renders favorites, opens entities, and removes an album bookmark', async () => {
    setSuccessfulResponses()

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('.music-profile__stat strong').map((node) => node.text())).toEqual(['12', '2', '2'])
    expect(wrapper.text()).toContain('收藏专辑')
    expect(wrapper.text()).toContain('收藏艺人')
    await wrapper.get('[data-testid="album-card"]').trigger('click')
    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')

    await wrapper.get('[data-testid="album-bookmark"]').trigger('click')
    await flushPromises()
    expect(mocks.deleteAlbumBookmark).toHaveBeenCalledWith('album-1')
    expect(wrapper.find('[data-testid="album-card"]').exists()).toBe(false)
    expect(wrapper.findAll('.music-profile__stat strong').at(1)?.text()).toBe('1')
  })

  it('shows an error and recovers through the refresh control', async () => {
    setSuccessfulResponses()
    mocks.getMusicHome.mockRejectedValueOnce(new Error('home unavailable'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('统计加载失败')
    expect(wrapper.get('[data-testid="music-profile-refresh"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="music-profile-refresh"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('收藏专辑')
    expect(mocks.getMusicHome).toHaveBeenCalledTimes(2)
  })

  it('renders the empty state when there are no favorites', async () => {
    mocks.listMusicListeningHistory.mockResolvedValue({ data: [], meta: { total: 0 } })
    mocks.listAlbumBookmarks.mockResolvedValue({ data: [], meta: { total: 0 } })
    mocks.listArtistBookmarks.mockResolvedValue({ data: [], meta: { total: 0 } })
    mocks.getMusicHome.mockResolvedValue({ recently_played: [] })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('还没有收藏专辑或艺人')
  })
})
