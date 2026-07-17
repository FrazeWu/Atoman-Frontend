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
  auth: {
    user: { uuid: 'owner-1' } as { uuid: string } | null,
  },
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

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mocks.auth,
}))

const regularPlaylist = () => ({
  id: 'playlist-1',
  name: '通勤',
  description: '',
  song_count: 1,
  is_favorite: false,
  is_public: false,
  user_id: 'owner-1',
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

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((done, fail) => {
		resolve = done
		reject = fail
	})
	return { promise, resolve, reject }
}

function threeSongPlaylist() {
	return {
		...regularPlaylist(),
		song_count: 3,
		songs: [
			{ ...regularPlaylist().songs[0], id: 'song-1', title: 'First' },
			{ ...regularPlaylist().songs[0], id: 'song-2', title: 'Second' },
			{ ...regularPlaylist().songs[0], id: 'song-3', title: 'Third' },
		],
	}
}

describe('PlaylistDrawer.vue', () => {
  beforeEach(() => {
    mocks.state.value.playlistId = 'playlist-1'
    mocks.state.value.playlistRefreshToken = 0
    mocks.auth.user = { uuid: 'owner-1' }
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

  it('renders a public playlist as read-only for a non-owner', async () => {
    mocks.auth.user = null
    mocks.getMusicPlaylist.mockResolvedValue({
      ...threeSongPlaylist(),
      is_public: true,
      user_id: 'another-user',
    })
    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.find('[data-testid="playlist-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="playlist-delete"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="playlist-remove-song-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="playlist-move-song-1-down"]').exists()).toBe(false)
    expect(wrapper.find('.track-drag-handle').exists()).toBe(false)
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
			...threeSongPlaylist(),
			name: '最爱',
			is_favorite: true,
		})
		const wrapper = mountDrawer()
		await flushPromises()

		await wrapper.get('[data-testid="playlist-move-song-1-down"]').trigger('click')
		await flushPromises()

		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenCalledWith('playlist-1', ['song-2', 'song-1', 'song-3'])
		expect(wrapper.findAll('.track-name').map((node) => node.text())).toEqual(['Second', 'First', 'Third'])
	})

	it('queues a new order while the previous order request is in progress', async () => {
		mocks.getMusicPlaylist.mockResolvedValue(threeSongPlaylist())
		const firstRequest = deferred<{ reordered: boolean }>()
		mocks.reorderMusicPlaylistSongs
			.mockReturnValueOnce(firstRequest.promise)
			.mockResolvedValueOnce({ reordered: true })
		const wrapper = mountDrawer()
		await flushPromises()
		const songs = wrapper.vm.$.setupState.playlist.songs

		void wrapper.vm.$.setupState.persistSongOrder([songs[1], songs[0], songs[2]])
		void wrapper.vm.$.setupState.persistSongOrder([songs[1], songs[2], songs[0]])
		await wrapper.vm.$nextTick()

		expect(wrapper.findAll('.track-name').map((node) => node.text())).toEqual(['Second', 'Third', 'First'])
		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenCalledTimes(1)

		firstRequest.resolve({ reordered: true })
		await flushPromises()

		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenNthCalledWith(2, 'playlist-1', ['song-2', 'song-3', 'song-1'])
	})

	it('persists only the latest of several orders queued during one request', async () => {
		mocks.getMusicPlaylist.mockResolvedValue(threeSongPlaylist())
		const firstRequest = deferred<{ reordered: boolean }>()
		mocks.reorderMusicPlaylistSongs
			.mockReturnValueOnce(firstRequest.promise)
			.mockResolvedValueOnce({ reordered: true })
		const wrapper = mountDrawer()
		await flushPromises()
		const songs = wrapper.vm.$.setupState.playlist.songs

		void wrapper.vm.$.setupState.persistSongOrder([songs[1], songs[0], songs[2]])
		void wrapper.vm.$.setupState.persistSongOrder([songs[1], songs[2], songs[0]])
		void wrapper.vm.$.setupState.persistSongOrder([songs[2], songs[1], songs[0]])
		firstRequest.resolve({ reordered: true })
		await flushPromises()

		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenCalledTimes(2)
		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenLastCalledWith('playlist-1', ['song-3', 'song-2', 'song-1'])
	})

	it('uses the queued order playlist id after switching playlists during a request', async () => {
		mocks.getMusicPlaylist.mockResolvedValueOnce(threeSongPlaylist())
		const firstRequest = deferred<{ reordered: boolean }>()
		mocks.reorderMusicPlaylistSongs
			.mockReturnValueOnce(firstRequest.promise)
			.mockResolvedValueOnce({ reordered: true })
		const wrapper = mountDrawer()
		await flushPromises()
		const firstSongs = wrapper.vm.$.setupState.playlist.songs
		void wrapper.vm.$.setupState.persistSongOrder([firstSongs[1], firstSongs[0], firstSongs[2]])

		const secondPlaylist = {
			...threeSongPlaylist(),
			id: 'playlist-2',
			name: '夜跑',
			songs: threeSongPlaylist().songs.map((song, index) => ({
				...song,
				id: `playlist-2-song-${index + 1}`,
			})),
		}
		mocks.getMusicPlaylist.mockResolvedValueOnce(secondPlaylist)
		await wrapper.vm.$.setupState.loadPlaylist('playlist-2')
		const secondSongs = wrapper.vm.$.setupState.playlist.songs
		void wrapper.vm.$.setupState.persistSongOrder([secondSongs[1], secondSongs[0], secondSongs[2]])

		firstRequest.resolve({ reordered: true })
		await flushPromises()

		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenNthCalledWith(2, 'playlist-2', [
			'playlist-2-song-2',
			'playlist-2-song-1',
			'playlist-2-song-3',
		])
	})

	it('persists the latest queued order for every playlist', async () => {
		mocks.getMusicPlaylist.mockResolvedValueOnce(threeSongPlaylist())
		const firstRequest = deferred<{ reordered: boolean }>()
		mocks.reorderMusicPlaylistSongs
			.mockReturnValueOnce(firstRequest.promise)
			.mockResolvedValue({ reordered: true })
		const wrapper = mountDrawer()
		await flushPromises()
		const firstSongs = wrapper.vm.$.setupState.playlist.songs
		void wrapper.vm.$.setupState.persistSongOrder([firstSongs[1], firstSongs[0], firstSongs[2]])

		for (const playlistId of ['playlist-2', 'playlist-3']) {
			const nextPlaylist = {
				...threeSongPlaylist(),
				id: playlistId,
				songs: threeSongPlaylist().songs.map((song, index) => ({
					...song,
					id: `${playlistId}-song-${index + 1}`,
				})),
			}
			mocks.getMusicPlaylist.mockResolvedValueOnce(nextPlaylist)
			await wrapper.vm.$.setupState.loadPlaylist(playlistId)
			const songs = wrapper.vm.$.setupState.playlist.songs
			void wrapper.vm.$.setupState.persistSongOrder([songs[1], songs[0], songs[2]])
		}

		firstRequest.resolve({ reordered: true })
		await flushPromises()

		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenCalledTimes(3)
		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenNthCalledWith(2, 'playlist-2', [
			'playlist-2-song-2',
			'playlist-2-song-1',
			'playlist-2-song-3',
		])
		expect(mocks.reorderMusicPlaylistSongs).toHaveBeenNthCalledWith(3, 'playlist-3', [
			'playlist-3-song-2',
			'playlist-3-song-1',
			'playlist-3-song-3',
		])
	})

	it('rolls back a failed order to the last server-confirmed order', async () => {
		mocks.getMusicPlaylist.mockResolvedValue(threeSongPlaylist())
		mocks.reorderMusicPlaylistSongs
			.mockResolvedValueOnce({ reordered: true })
			.mockRejectedValueOnce(new Error('network'))
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		const wrapper = mountDrawer()
		await flushPromises()
		const songs = wrapper.vm.$.setupState.playlist.songs

		await wrapper.vm.$.setupState.persistSongOrder([songs[1], songs[0], songs[2]])
		const confirmedSongs = wrapper.vm.$.setupState.playlist.songs
		await wrapper.vm.$.setupState.persistSongOrder([confirmedSongs[0], confirmedSongs[2], confirmedSongs[1]])
		await flushPromises()

		expect(wrapper.vm.$.setupState.playlist.songs.map((song: { title: string }) => song.title)).toEqual(['Second', 'First', 'Third'])
		expect(wrapper.text()).toContain('歌单顺序保存失败')
		consoleError.mockRestore()
	})
})
