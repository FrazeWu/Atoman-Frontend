import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicSidebarPlaylists from '@/components/music/MusicSidebarPlaylists.vue'

const mocks = vi.hoisted(() => ({
  listMusicPlaylists: vi.fn(),
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
  createMusicPlaylist: mocks.createMusicPlaylist,
}))

describe('MusicSidebarPlaylists', () => {
  beforeEach(() => {
    mocks.listMusicPlaylists.mockReset()
    mocks.createMusicPlaylist.mockReset()
    mocks.openPlaylist.mockReset()

    mocks.listMusicPlaylists.mockResolvedValue({ data: [], meta: { page: 1, page_size: 20, total: 0, has_more: false } })
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
})
