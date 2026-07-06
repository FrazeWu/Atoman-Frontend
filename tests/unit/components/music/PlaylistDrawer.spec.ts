import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaylistDrawer from '@/components/music/PlaylistDrawer.vue'

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    template: '<div><slot name="header" /><slot /></div>',
  },
}))

const mocks = vi.hoisted(() => ({
  getMusicPlaylist: vi.fn(),
  updateMusicPlaylist: vi.fn(),
  uploadMusicAsset: vi.fn(),
  playAlbum: vi.fn(),
  closePlaylist: vi.fn(),
  restoreSession: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { playlistId: 'playlist-1' } },
    closePlaylist: mocks.closePlaylist,
  }),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicPlaylist: mocks.getMusicPlaylist,
  updateMusicPlaylist: mocks.updateMusicPlaylist,
  uploadMusicAsset: mocks.uploadMusicAsset,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { uuid: 'user-1' },
    restoreSession: mocks.restoreSession,
  }),
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    playAlbum: mocks.playAlbum,
  }),
}))

describe('PlaylistDrawer', () => {
  beforeEach(() => {
    mocks.getMusicPlaylist.mockReset()
    mocks.updateMusicPlaylist.mockReset()
    mocks.uploadMusicAsset.mockReset()
    mocks.playAlbum.mockReset()
    mocks.closePlaylist.mockReset()
    mocks.restoreSession.mockReset()

    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-1',
      name: '夜航歌单',
      description: '初版简介',
      cover_url: '',
      is_public: false,
      song_count: 0,
      songs: [],
    })
    mocks.uploadMusicAsset.mockResolvedValue({
      url: '/uploads/playlist-cover.jpg',
      key: 'music/covers/playlist-cover.jpg',
      content_type: 'image/jpeg',
      size: 123,
    })
    mocks.updateMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      name: '夜航歌单',
      description: '新简介',
      cover_url: '/uploads/playlist-cover.jpg',
      is_public: true,
      song_count: 0,
      songs: [],
    })
    mocks.restoreSession.mockResolvedValue(true)
  })

  it('updates playlist visibility, description and cover from the drawer editor', async () => {
    const wrapper = mount(PlaylistDrawer)
    await flushPromises()

    await wrapper.get('[data-testid="playlist-edit-button"]').trigger('click')
    await wrapper.get('[data-testid="playlist-description-input"]').setValue('新简介')
    await wrapper.get('[data-testid="playlist-public-toggle"]').setValue(true)

    const file = new File(['cover'], 'cover.jpg', { type: 'image/jpeg' })
    const input = wrapper.get('[data-testid="playlist-cover-input"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()

    await wrapper.get('[data-testid="playlist-save-button"]').trigger('click')
    await flushPromises()

    expect(mocks.uploadMusicAsset).toHaveBeenCalledWith(file, 'music.cover')
    expect(mocks.restoreSession).not.toHaveBeenCalledWith(true)
    expect(mocks.updateMusicPlaylist).toHaveBeenCalledWith('playlist-1', {
      description: '新简介',
      cover_url: '/uploads/playlist-cover.jpg',
      is_public: true,
    })
  })
})
