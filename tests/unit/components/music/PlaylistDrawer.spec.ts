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
  deleteMusicPlaylist: vi.fn(),
  updateMusicPlaylist: vi.fn(),
  removeMusicPlaylistSong: vi.fn(),
  reorderMusicPlaylistSongs: vi.fn(),
  uploadMusicAsset: vi.fn(),
  listPlaylistBookmarks: vi.fn(),
  createPlaylistBookmark: vi.fn(),
  deletePlaylistBookmark: vi.fn(),
  playAlbum: vi.fn(),
  closePlaylist: vi.fn(),
  refreshPlaylists: vi.fn(),
  restoreSession: vi.fn(),
  auth: {
    isAuthenticated: true,
    user: { uuid: 'user-1' } as { uuid: string } | null,
  },
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: { value: { playlistId: 'playlist-1' } },
    closePlaylist: mocks.closePlaylist,
    refreshPlaylists: mocks.refreshPlaylists,
    isLayerShifted: () => false,
    isTopLayer: () => true,
  }),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicPlaylist: mocks.getMusicPlaylist,
  deleteMusicPlaylist: mocks.deleteMusicPlaylist,
  updateMusicPlaylist: mocks.updateMusicPlaylist,
  removeMusicPlaylistSong: mocks.removeMusicPlaylistSong,
  reorderMusicPlaylistSongs: mocks.reorderMusicPlaylistSongs,
  uploadMusicAsset: mocks.uploadMusicAsset,
  listPlaylistBookmarks: mocks.listPlaylistBookmarks,
  createPlaylistBookmark: mocks.createPlaylistBookmark,
  deletePlaylistBookmark: mocks.deletePlaylistBookmark,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => Object.assign(mocks.auth, { restoreSession: mocks.restoreSession }),
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    playAlbum: mocks.playAlbum,
  }),
}))

describe('PlaylistDrawer', () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = true
    mocks.auth.user = { uuid: 'user-1' }
    mocks.getMusicPlaylist.mockReset()
    mocks.deleteMusicPlaylist.mockReset()
    mocks.updateMusicPlaylist.mockReset()
    mocks.removeMusicPlaylistSong.mockReset()
    mocks.reorderMusicPlaylistSongs.mockReset()
    mocks.uploadMusicAsset.mockReset()
    mocks.listPlaylistBookmarks.mockReset()
    mocks.createPlaylistBookmark.mockReset()
    mocks.deletePlaylistBookmark.mockReset()
    mocks.playAlbum.mockReset()
    mocks.closePlaylist.mockReset()
    mocks.refreshPlaylists.mockReset()
    mocks.restoreSession.mockReset()

    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-1',
      name: '夜航歌单',
      description: '初版简介',
      cover_url: '',
      is_public: false,
      song_count: 0,
      owner_username: 'alice',
      songs: [],
    })
    mocks.listPlaylistBookmarks.mockResolvedValue({ data: [] })
    mocks.createPlaylistBookmark.mockResolvedValue({
      id: 'bookmark-1',
      playlist_id: 'playlist-1',
      created_at: '2026-07-09T00:00:00Z',
    })
    mocks.deletePlaylistBookmark.mockResolvedValue({ deleted: true })
    mocks.deleteMusicPlaylist.mockResolvedValue({ deleted: true })
    mocks.removeMusicPlaylistSong.mockResolvedValue({ deleted: true })
    mocks.reorderMusicPlaylistSongs.mockResolvedValue({ reordered: true })
    mocks.uploadMusicAsset.mockResolvedValue({
      url: '/uploads/playlist-cover.jpg',
      key: 'music/covers/playlist-cover.jpg',
      content_type: 'image/jpeg',
      size: 123,
    })
    mocks.updateMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      name: '深夜歌单',
      description: '新简介',
      cover_url: '/uploads/playlist-cover.jpg',
      is_public: true,
      song_count: 0,
      owner_username: 'alice',
      songs: [],
    })
    mocks.restoreSession.mockResolvedValue(true)
  })

  it('updates playlist name, visibility, description and cover from the drawer editor', async () => {
    const wrapper = mount(PlaylistDrawer)
    await flushPromises()

    await wrapper.get('[data-testid="playlist-edit-button"]').trigger('click')
    await wrapper.get('[data-testid="playlist-name-input"]').setValue('深夜歌单')
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
      name: '深夜歌单',
      description: '新简介',
      cover_url: '/uploads/playlist-cover.jpg',
      is_public: true,
    })
  })

  it('deletes the playlist from the drawer editor after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(PlaylistDrawer)
    await flushPromises()

    await wrapper.get('[data-testid="playlist-edit-button"]').trigger('click')
    await wrapper.get('[data-testid="playlist-delete-button"]').trigger('click')
    await flushPromises()

    expect(window.confirm).toHaveBeenCalledWith('删除后无法恢复，确定删除这张歌单吗？')
    expect(mocks.deleteMusicPlaylist).toHaveBeenCalledWith('playlist-1')
    expect(mocks.refreshPlaylists).toHaveBeenCalled()
    expect(mocks.closePlaylist).toHaveBeenCalled()
  })

  it('shows the playlist owner username in the header', async () => {
    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-2',
      owner_username: 'bob',
      name: '公开歌单',
      description: '',
      cover_url: '',
      is_public: true,
      song_count: 3,
      songs: [],
    })

    const wrapper = mount(PlaylistDrawer)
    await flushPromises()

    expect(wrapper.text()).toContain('bob')
    expect(wrapper.text()).not.toContain('Atoman Studio')
  })

  it('bookmarks a public playlist owned by another user from the drawer', async () => {
    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-2',
      owner_username: 'bob',
      name: '公开歌单',
      description: '',
      cover_url: '',
      is_public: true,
      song_count: 3,
      songs: [],
    })

    const wrapper = mount(PlaylistDrawer)
    await flushPromises()

    await wrapper.get('[data-testid="playlist-bookmark-button"]').trigger('click')
    await flushPromises()

    expect(mocks.createPlaylistBookmark).toHaveBeenCalledWith('playlist-1')
    expect(mocks.refreshPlaylists).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="playlist-bookmark-button"]').text()).toContain('取消收藏')
  })

  it('removes songs from an owned playlist', async () => {
    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-1',
      owner_username: 'alice',
      name: '夜航歌单',
      description: '',
      cover_url: '',
      is_public: false,
      song_count: 2,
      songs: [
        { id: 'song-1', title: 'First Song', entry_status: 'open', audio_url: 'https://cdn.test/1.mp3' },
        { id: 'song-2', title: 'Second Song', entry_status: 'open', audio_url: 'https://cdn.test/2.mp3' },
      ],
    })

    const wrapper = mount(PlaylistDrawer)
    await flushPromises()

    await wrapper.get('[data-testid="playlist-remove-song-song-1"]').trigger('click')
    await flushPromises()

    expect(mocks.removeMusicPlaylistSong).toHaveBeenCalledWith('playlist-1', 'song-1')
    expect(mocks.refreshPlaylists).toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('First Song')
    expect(wrapper.text()).toContain('Second Song')
  })

  it('reorders songs in an owned playlist', async () => {
    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-1',
      owner_username: 'alice',
      name: '夜航歌单',
      description: '',
      cover_url: '',
      is_public: false,
      song_count: 2,
      songs: [
        { id: 'song-1', title: 'First Song', entry_status: 'open', audio_url: 'https://cdn.test/1.mp3' },
        { id: 'song-2', title: 'Second Song', entry_status: 'open', audio_url: 'https://cdn.test/2.mp3' },
      ],
    })

    const wrapper = mount(PlaylistDrawer)
    await flushPromises()

    await wrapper.get('[data-testid="playlist-move-song-down-song-1"]').trigger('click')
    await flushPromises()

    expect(mocks.reorderMusicPlaylistSongs).toHaveBeenCalledWith('playlist-1', ['song-2', 'song-1'])
    expect(mocks.refreshPlaylists).toHaveBeenCalled()
    const text = wrapper.text()
    expect(text.indexOf('Second Song')).toBeLessThan(text.indexOf('First Song'))
  })

  it('renders a public playlist as read-only for a non-owner', async () => {
    mocks.auth.user = { uuid: 'user-2' }
    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-1',
      owner_username: 'alice',
      name: '公开歌单',
      description: '',
      cover_url: '',
      is_public: true,
      song_count: 1,
      songs: [{ id: 'song-1', title: 'First Song', entry_status: 'open', audio_url: 'https://cdn.test/1.mp3' }],
    })

    const wrapper = mount(PlaylistDrawer)
    await flushPromises()

    expect(wrapper.find('[data-testid="playlist-edit-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="playlist-remove-song-song-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="playlist-move-song-down-song-1"]').exists()).toBe(false)
  })

  it('keeps only the latest queued order for each playlist', async () => {
    let resolveFirst!: (value: { reordered: boolean }) => void
    const firstRequest = new Promise<{ reordered: boolean }>((resolve) => { resolveFirst = resolve })
    mocks.reorderMusicPlaylistSongs
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({ reordered: true })
    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-1',
      name: '夜航歌单',
      song_count: 3,
      songs: [
        { id: 'song-1', title: 'First', entry_status: 'open' },
        { id: 'song-2', title: 'Second', entry_status: 'open' },
        { id: 'song-3', title: 'Third', entry_status: 'open' },
      ],
    })
    const wrapper = mount(PlaylistDrawer)
    await flushPromises()
    const songs = wrapper.vm.$.setupState.playlist.songs

    void wrapper.vm.$.setupState.persistSongOrder([songs[1], songs[0], songs[2]])
    void wrapper.vm.$.setupState.persistSongOrder([songs[2], songs[1], songs[0]])
    resolveFirst({ reordered: true })
    await flushPromises()

    expect(mocks.reorderMusicPlaylistSongs).toHaveBeenCalledTimes(2)
    expect(mocks.reorderMusicPlaylistSongs).toHaveBeenLastCalledWith('playlist-1', ['song-3', 'song-2', 'song-1'])
  })

  it('rolls back a failed order to the last confirmed order', async () => {
    mocks.reorderMusicPlaylistSongs
      .mockResolvedValueOnce({ reordered: true })
      .mockRejectedValueOnce(new Error('network'))
    mocks.getMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      user_id: 'user-1',
      name: '夜航歌单',
      song_count: 3,
      songs: [
        { id: 'song-1', title: 'First', entry_status: 'open' },
        { id: 'song-2', title: 'Second', entry_status: 'open' },
        { id: 'song-3', title: 'Third', entry_status: 'open' },
      ],
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mount(PlaylistDrawer)
    await flushPromises()
    const songs = wrapper.vm.$.setupState.playlist.songs

    await wrapper.vm.$.setupState.persistSongOrder([songs[1], songs[0], songs[2]])
    const confirmed = wrapper.vm.$.setupState.playlist.songs
    await wrapper.vm.$.setupState.persistSongOrder([confirmed[0], confirmed[2], confirmed[1]])
    await flushPromises()

    expect(wrapper.vm.$.setupState.playlist.songs.map((song: { title: string }) => song.title)).toEqual(['Second', 'First', 'Third'])
    expect(wrapper.text()).toContain('歌单顺序保存失败')
  })

  it('loads a public playlist without waiting for session restoration', async () => {
    mocks.restoreSession.mockReturnValue(new Promise(() => {}))

    mount(PlaylistDrawer)

    expect(mocks.getMusicPlaylist).toHaveBeenCalledWith('playlist-1')
  })

  it('loads bookmark state after session restoration without delaying a public playlist', async () => {
    let restoreSession!: () => void
    mocks.auth.isAuthenticated = false
    mocks.restoreSession.mockImplementation(() => new Promise<void>((resolve) => {
      restoreSession = () => {
        mocks.auth.isAuthenticated = true
        resolve()
      }
    }))

    mount(PlaylistDrawer)
    await flushPromises()

    expect(mocks.getMusicPlaylist).toHaveBeenCalledWith('playlist-1')
    expect(mocks.listPlaylistBookmarks).not.toHaveBeenCalled()

    restoreSession()
    await flushPromises()

    expect(mocks.listPlaylistBookmarks).toHaveBeenCalledTimes(1)
  })

  it('keeps the latest playlist visible when an earlier request finishes later', async () => {
    let resolveFirst!: (playlist: Record<string, unknown>) => void
    const firstRequest = new Promise<Record<string, unknown>>((resolve) => { resolveFirst = resolve })
    mocks.getMusicPlaylist
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce({
        id: 'playlist-b', user_id: 'user-1', name: '歌单 B', description: '',
        cover_url: '', is_public: true, is_favorite: false, song_count: 0, songs: [],
      })

    const wrapper = mount(PlaylistDrawer, {
      props: {
        layer: { key: 'playlist-a', kind: 'playlist', title: '歌单详情', payload: { playlistId: 'playlist-a' } },
      },
    })
    await wrapper.setProps({
      layer: { key: 'playlist-b', kind: 'playlist', title: '歌单详情', payload: { playlistId: 'playlist-b' } },
    })
    await flushPromises()

    resolveFirst({
      id: 'playlist-a', user_id: 'user-1', name: '歌单 A', description: '',
      cover_url: '', is_public: true, is_favorite: false, song_count: 0, songs: [],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('歌单 B')
    expect(wrapper.text()).not.toContain('歌单 A')
  })
})
