import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicArtistDetailView from '@mobile/views/music/MusicArtistDetailView.vue'

const mocks = vi.hoisted(() => ({ artist: vi.fn(), albums: vi.fn(), songs: vi.fn(), push: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { artistId: 'member' } }), useRouter: () => ({ push: mocks.push, back: vi.fn() }) }))
vi.mock('@/api/musicV1', () => ({ getMusicArtist: mocks.artist, listMusicAlbums: mocks.albums, listMusicSongs: mocks.songs }))
vi.mock('@/stores/player', () => ({ useAudioPlayerStore: () => ({ currentSong: null }) }))
vi.mock('@/composables/useMusicFavoritePlaylist', () => ({ useMusicFavoritePlaylist: () => ({ favoriteSongIds: ref(new Set()), loadFavoriteSongs: vi.fn() }) }))

describe('Mobile artist group works', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.artist.mockResolvedValue({ id: 'member', name: '成员', artist_form: 'person', albums: [] })
    mocks.albums.mockResolvedValue({ data: [{ id: 'group-album', title: '乐队专辑', artists: [{ id: 'group', name: '交工乐队' }] }], meta: { page: 1, has_more: false } })
    mocks.songs.mockResolvedValue({ data: [], meta: { page: 1, has_more: false } })
  })
  it('defaults to related works and opens the original album and group', async () => {
    const wrapper = mount(MusicArtistDetailView)
    await flushPromises()
    expect(wrapper.get('[data-testid="artist-tab-group"]').attributes('aria-selected')).toBe('true')
    const panel = wrapper.get('[aria-label="乐队作品"]')
    expect(panel.text()).toContain('不代表个人署名')
    const buttons = panel.findAll('button')
    await buttons[0].trigger('click')
    expect(mocks.push).toHaveBeenCalledWith('/music/album/group-album')
    await buttons[1].trigger('click')
    expect(mocks.push).toHaveBeenCalledWith('/music/artist/group')
    wrapper.unmount()
  })
  it('preserves personal album priority', async () => {
    mocks.artist.mockResolvedValue({ id: 'member', name: '成员', albums: [{ id: 'personal', title: '个人专辑' }] })
    const wrapper = mount(MusicArtistDetailView)
    await flushPromises()
    expect(wrapper.get('[data-testid="artist-tab-albums"]').attributes('aria-selected')).toBe('true')
    wrapper.unmount()
  })
  it('keeps a failed related request separate from personal artist loading', async () => {
    mocks.albums.mockRejectedValue(new Error('unavailable'))
    const wrapper = mount(MusicArtistDetailView)
    await flushPromises()
    expect(wrapper.find('[data-testid="artist-load-error"]').exists()).toBe(false)
    await wrapper.get('[data-testid="artist-tab-group"]').trigger('click')
    expect(wrapper.get('[role="alert"]').text()).toContain('乐队作品加载失败')
    wrapper.unmount()
  })
})
