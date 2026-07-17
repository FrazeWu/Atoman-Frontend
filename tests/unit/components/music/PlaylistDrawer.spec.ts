import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaylistDrawer from '@/components/music/PlaylistDrawer.vue'

const mocks = vi.hoisted(() => ({
  state: {
    value: {
      playlistId: 'playlist-1',
      playlistRefreshToken: 0,
    },
  },
  closePlaylist: vi.fn(),
  refreshPlaylist: vi.fn(),
  getMusicPlaylist: vi.fn(),
  updateMusicPlaylist: vi.fn(),
  deleteMusicPlaylist: vi.fn(),
  removeMusicPlaylistSong: vi.fn(),
	reorderMusicPlaylistSongs: vi.fn(),
  playAlbum: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: mocks.state,
    closePlaylist: mocks.closePlaylist,
    refreshPlaylist: mocks.refreshPlaylist,
  }),
}))

vi.mock('@/api/musicV1', () => ({
  getMusicPlaylist: mocks.getMusicPlaylist,
  updateMusicPlaylist: mocks.updateMusicPlaylist,
  deleteMusicPlaylist: mocks.deleteMusicPlaylist,
  removeMusicPlaylistSong: mocks.removeMusicPlaylistSong,
	reorderMusicPlaylistSongs: mocks.reorderMusicPlaylistSongs,
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({ playAlbum: mocks.playAlbum }),
}))

const regularPlaylist = () => ({
  id: 'playlist-1',
  name: '通勤',
  description: '',
  song_count: 1,
  is_favorite: false,
  songs: [{
    id: 'song-1',
    title: 'Morning Track',
    track_number: 1,
    audio_url: 'https://cdn.test/song-1.mp3',
    entry_status: 'open',
    artists: [{ id: 'artist-1', name: 'Artist' }],
  }],
})

function mountDrawer() {
  return mount(PlaylistDrawer, {
    global: {
      stubs: {
        PSheet: { template: '<div><slot name="header" /><slot /></div>' },
        PConfirm: {
          props: ['show'],
          emits: ['confirm', 'cancel'],
          template: '<div v-if="show"><button data-testid="confirm-delete" @click="$emit(\'confirm\')">确认删除</button></div>',
        },
      },
    },
  })
}

describe('PlaylistDrawer.vue', () => {
  beforeEach(() => {
    mocks.state.value.playlistId = 'playlist-1'
    mocks.state.value.playlistRefreshToken = 0
    mocks.closePlaylist.mockReset()
    mocks.refreshPlaylist.mockReset()
    mocks.getMusicPlaylist.mockReset()
    mocks.updateMusicPlaylist.mockReset()
    mocks.deleteMusicPlaylist.mockReset()
    mocks.removeMusicPlaylistSong.mockReset()
		mocks.reorderMusicPlaylistSongs.mockReset()
    mocks.playAlbum.mockReset()
    mocks.getMusicPlaylist.mockResolvedValue(regularPlaylist())
    mocks.updateMusicPlaylist.mockResolvedValue({
      id: 'playlist-1',
      name: '夜跑',
      song_count: 0,
      is_favorite: false,
    })
    mocks.deleteMusicPlaylist.mockResolvedValue({ deleted: true })
    mocks.removeMusicPlaylistSong.mockResolvedValue({ deleted: true })
		mocks.reorderMusicPlaylistSongs.mockResolvedValue({ reordered: true })
  })

  it('shows management actions for regular playlists', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.find('[data-testid="playlist-edit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="playlist-delete"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="playlist-remove-song-1"]').exists()).toBe(true)
  })

  it('hides rename and delete for the favorite playlist', async () => {
    mocks.getMusicPlaylist.mockResolvedValue({ ...regularPlaylist(), name: '最爱', is_favorite: true })
    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.find('[data-testid="playlist-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="playlist-delete"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="playlist-remove-song-1"]').exists()).toBe(true)
  })

  it('renames a regular playlist inline', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.get('[data-testid="playlist-edit"]').trigger('click')
    const input = wrapper.get('[data-testid="playlist-name-input"]')
    await input.setValue('夜跑')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(mocks.updateMusicPlaylist).toHaveBeenCalledWith('playlist-1', { name: '夜跑' })
    expect(mocks.refreshPlaylist).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('夜跑')
    expect(wrapper.text()).toContain('1 首单曲')
  })

  it('cancels inline rename with Escape', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.get('[data-testid="playlist-edit"]').trigger('click')
    const input = wrapper.get('[data-testid="playlist-name-input"]')
    await input.setValue('不要保存')
    await input.trigger('keydown.esc')

    expect(mocks.updateMusicPlaylist).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('通勤')
  })

  it('removes a song and refreshes playlist data', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.get('[data-testid="playlist-remove-song-1"]').trigger('click')
    await flushPromises()

    expect(mocks.removeMusicPlaylistSong).toHaveBeenCalledWith('playlist-1', 'song-1')
    expect(mocks.getMusicPlaylist).toHaveBeenCalledTimes(2)
    expect(mocks.refreshPlaylist).toHaveBeenCalledTimes(1)
  })

  it('deletes a regular playlist after confirmation', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.get('[data-testid="playlist-delete"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-delete"]').exists()).toBe(true)
    await wrapper.get('[data-testid="confirm-delete"]').trigger('click')
    await flushPromises()

    expect(mocks.deleteMusicPlaylist).toHaveBeenCalledWith('playlist-1')
    expect(mocks.closePlaylist).toHaveBeenCalledTimes(1)
    expect(mocks.refreshPlaylist).toHaveBeenCalledTimes(1)
  })

	it('reorders favorite playlist songs with accessible controls', async () => {
		mocks.getMusicPlaylist.mockResolvedValue({
			...regularPlaylist(),
			name: '最爱',
			is_favorite: true,
			song_count: 3,
			songs: [
				{ ...regularPlaylist().songs[0], id: 'song-1', title: 'First' },
				{ ...regularPlaylist().songs[0], id: 'song-2', title: 'Second' },
				{ ...regularPlaylist().songs[0], id: 'song-3', title: 'Third' },
			],
		})
		const wrapper = mountDrawer()
		await flushPromises()

		await wrapper.get('[data-testid="playlist-move-song-1-down"]').trigger('click')
		await flushPromises()

		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenCalledWith('playlist-1', ['song-2', 'song-1', 'song-3'])
		expect(wrapper.findAll('.track-name').map((node) => node.text())).toEqual(['Second', 'First', 'Third'])
	})
})
