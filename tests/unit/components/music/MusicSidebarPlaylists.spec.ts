import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicSidebarPlaylists from '@/components/music/MusicSidebarPlaylists.vue'

const mocks = vi.hoisted(() => ({
  listMusicPlaylists: vi.fn(),
  listPlaylistBookmarks: vi.fn(),
  createMusicPlaylist: vi.fn(),
  openPlaylist: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/music' }),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { playlistId: null } },
    openPlaylist: mocks.openPlaylist,
  }),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicPlaylists: mocks.listMusicPlaylists,
  listPlaylistBookmarks: mocks.listPlaylistBookmarks,
  createMusicPlaylist: mocks.createMusicPlaylist,
}))

describe('MusicSidebarPlaylists', () => {
  beforeEach(() => {
    mocks.listMusicPlaylists.mockReset()
    mocks.listPlaylistBookmarks.mockReset()
    mocks.createMusicPlaylist.mockReset()
    mocks.openPlaylist.mockReset()

    mocks.listMusicPlaylists.mockResolvedValue({ data: [], meta: { page: 1, page_size: 20, total: 0, has_more: false } })
    mocks.listPlaylistBookmarks.mockResolvedValue({ data: [], meta: { page: 1, page_size: 20, total: 0, has_more: false } })
    mocks.createMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      name: '新歌单',
      description: '',
      song_count: 0,
      is_public: false,
      songs: [],
    })
  })

  it('creates playlists as private by default', async () => {
    const wrapper = mount(MusicSidebarPlaylists, {
      props: { collapsed: false },
    })

    await flushPromises()
    await wrapper.get('.create-playlist-btn').trigger('click')
    await wrapper.get('input.playlist-input').setValue('新歌单')
    await wrapper.get('input.playlist-input').trigger('keydown.enter')
    await flushPromises()

    expect(mocks.createMusicPlaylist).toHaveBeenCalledWith({
      name: '新歌单',
      is_public: false,
    })
  })

  it('shows bookmarked playlists under my playlists', async () => {
    mocks.listMusicPlaylists.mockResolvedValue({
      data: [{ id: 'own-1', name: '我的歌单', song_count: 0, is_public: false }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    })
    mocks.listPlaylistBookmarks.mockResolvedValue({
      data: [
        {
          id: 'bookmark-1',
          playlist_id: 'shared-1',
          playlist: {
            id: 'shared-1',
            name: '公开歌单',
            owner_username: 'bob',
            song_count: 12,
            is_public: true,
          },
        },
      ],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    })

    const wrapper = mount(MusicSidebarPlaylists, {
      props: { collapsed: false },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('我的歌单 / PLAYLISTS')
    expect(wrapper.text()).toContain('收藏的歌单')
    expect(wrapper.text()).toContain('我的歌单')
    expect(wrapper.text()).toContain('bob/公开歌单')

    await wrapper.get('[data-testid="bookmarked-playlist-shared-1"]').trigger('click')

    expect(mocks.openPlaylist).toHaveBeenCalledWith('shared-1')
  })
})
