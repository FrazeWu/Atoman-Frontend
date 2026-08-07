import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicEntityEditorDrawer from '@/components/music/MusicEntityEditorDrawer.vue'

const drawerState = ref({
  artistId: null as string | null,
  albumId: null as string | null,
  musicEditor: null as null | {
    entity: 'artist' | 'album' | 'song'
    mode: 'create' | 'edit'
    id?: string
    seed?: Record<string, unknown>
  },
})

const mocks = vi.hoisted(() => ({
  closeMusicEditor: vi.fn(),
  refreshAlbum: vi.fn(),
  refreshArtist: vi.fn(),
  refreshSong: vi.fn(),
  closeMusicCreationFlow: vi.fn(),
  routerReplace: vi.fn(),
  getMusicArtist: vi.fn(),
  getMusicAlbum: vi.fn(),
	getMusicSongDetail: vi.fn(),
	createMusicArtist: vi.fn(),
  uploadMusicAsset: vi.fn(),
	  submitArtistRevision: vi.fn(),
	  submitAlbumRevision: vi.fn(),
	  submitSongRevision: vi.fn(),
	  queueMusicSongAudioReplacement: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
  }),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerState,
    closeMusicEditor: mocks.closeMusicEditor,
    refreshAlbum: mocks.refreshAlbum,
    refreshArtist: mocks.refreshArtist,
    refreshSong: mocks.refreshSong,
    closeMusicCreationFlow: mocks.closeMusicCreationFlow,
		isLayerShifted: vi.fn(() => false),
		isTopLayer: vi.fn(() => true),
		returnToLayer: vi.fn(),
  }),
}))

vi.mock('@/components/music', () => ({
  AlbumEditorShell: {
    name: 'AlbumEditorShell',
    props: ['meta', 'tracks'],
    emits: ['update:cover', 'update:meta', 'update:tracks'],
    template: '<div data-testid="album-editor-shell-stub" />',
  },
  MusicArtistForm: { name: 'MusicArtistForm', emits: ['submit'], template: '<div data-testid="music-artist-form-stub" />' },
}))

vi.mock('@/components/ui/PSheet.vue', () => ({
  default: {
    props: ['show'],
    template: '<div v-if="show"><slot /></div>',
  },
}))

vi.mock('@/components/ui/PButton.vue', () => ({
  default: {
    template: '<button><slot /></button>',
  },
}))

vi.mock('@/components/music/MusicCreationContributorPicker.vue', () => ({
	default: { props: ['modelValue'], template: '<div data-testid="song-contributors" />' },
}))

vi.mock('@/api/musicV1', () => ({
	createMusicArtist: mocks.createMusicArtist,
  getMusicArtist: mocks.getMusicArtist,
  getMusicAlbum: mocks.getMusicAlbum,
	getMusicSongDetail: mocks.getMusicSongDetail,
	  submitArtistRevision: mocks.submitArtistRevision,
	  submitAlbumRevision: mocks.submitAlbumRevision,
	  submitSongRevision: mocks.submitSongRevision,
	  queueMusicSongAudioReplacement: mocks.queueMusicSongAudioReplacement,
	  uploadMusicAsset: mocks.uploadMusicAsset,
}))

describe('MusicEntityEditorDrawer.vue', () => {
  let consoleError: ReturnType<typeof vi.spyOn>
  const mountedWrappers: VueWrapper[] = []

  function mountDrawer() {
    const wrapper = mount(MusicEntityEditorDrawer)
    mountedWrappers.push(wrapper)
    return wrapper
  }

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    drawerState.value = {
      artistId: null,
      albumId: null,
      musicEditor: null,
    }
    mocks.closeMusicEditor.mockReset()
    mocks.refreshAlbum.mockReset()
    mocks.refreshArtist.mockReset()
    mocks.refreshSong.mockReset()
    mocks.closeMusicCreationFlow.mockReset()
    mocks.routerReplace.mockReset()
    mocks.getMusicArtist.mockReset()
    mocks.getMusicAlbum.mockReset()
	mocks.getMusicSongDetail.mockReset()
	mocks.createMusicArtist.mockReset()
    mocks.uploadMusicAsset.mockReset()
	    mocks.submitArtistRevision.mockReset()
	    mocks.submitAlbumRevision.mockReset()
	    mocks.submitSongRevision.mockReset()
	    mocks.queueMusicSongAudioReplacement.mockReset()
    mocks.getMusicArtist.mockResolvedValue({ id: 'artist-1', name: 'Test Artist' })
	mocks.createMusicArtist.mockResolvedValue({ id: 'artist-created', name: 'Created Artist', entry_status: 'open' })
    mocks.getMusicAlbum.mockResolvedValue({
      id: 'album-1',
      title: 'Test Album',
      entry_status: 'open',
      songs: [],
    })
		mocks.getMusicSongDetail.mockResolvedValue({
			song: { id: 'song-1', title: 'Original Song', track_number: 2, disc_number: 1, lyrics: 'Lyrics' },
			artists: [{ id: 'artist-1', name: 'Test Artist', role: 'primary', position: 1 }],
			bookmarked: false,
			playable: true,
		})
    mocks.uploadMusicAsset.mockResolvedValue({
      url: 'https://assets.example.test/covers/new.webp',
      key: 'music/covers/new.webp',
      content_type: 'image/webp',
      size: 1,
    })
	    mocks.submitArtistRevision.mockResolvedValue({ status: 'approved' })
	    mocks.submitAlbumRevision.mockResolvedValue({ status: 'approved' })
	    mocks.submitSongRevision.mockResolvedValue({ status: 'approved' })
	    mocks.queueMusicSongAudioReplacement.mockResolvedValue({ status: 'pending' })
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    consoleError.mockRestore()
  })

  it('uses the artist form in artist create mode', () => {
    drawerState.value.musicEditor = { entity: 'artist', mode: 'create' }

    const wrapper = mountDrawer()

    expect(wrapper.find('[data-testid="music-artist-form-stub"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('新建艺术家')
  })

  it('keeps artist edit mode on the legacy artist form path', async () => {
    drawerState.value.musicEditor = { entity: 'artist', mode: 'edit', id: 'artist-1' }

    const wrapper = mountDrawer()

    expect(wrapper.find('[data-testid="music-artist-form-stub"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('编辑艺术家')

    await flushPromises()
    expect(mocks.getMusicArtist).toHaveBeenCalledWith('artist-1')
    expect(consoleError).not.toHaveBeenCalled()
  })

	  it('submits artist edits through revisions', async () => {
    drawerState.value.musicEditor = { entity: 'artist', mode: 'edit', id: 'artist-1' }
    const wrapper = mountDrawer()
    await flushPromises()

    wrapper.getComponent({ name: 'MusicArtistForm' }).vm.$emit('submit', {
      name: 'Updated Artist',
      bio: 'Updated biography',
    })
    await flushPromises()

	    expect(mocks.submitArtistRevision).toHaveBeenCalledWith('artist-1', {
      name: 'Updated Artist',
      bio: 'Updated biography',
      reason: '编辑艺术家',
      sources: [],
    })
  })

	it('opens the created artist detail after creating an artist', async () => {
		drawerState.value.musicEditor = { entity: 'artist', mode: 'create' }
		const wrapper = mountDrawer()

		wrapper.getComponent({ name: 'MusicArtistForm' }).vm.$emit('submit', { name: 'Created Artist' })
		await flushPromises()

		expect(mocks.routerReplace).toHaveBeenCalledWith('/music/artist/artist-created')
	})

  it('uploads the selected replacement cover when saving an album', async () => {
    const artistId = '5f37b1a2-80ef-4c4f-963f-c7c3c260e662'
    mocks.getMusicAlbum.mockResolvedValue({
      id: 'album-1',
      title: 'Test Album',
      entry_status: 'open',
      artists: [{ id: artistId, name: 'Test Artist' }],
      release_date: '2007-11-10T00:00:00Z',
      description: '原专辑简介',
      songs: [],
    })
    drawerState.value.musicEditor = { entity: 'album', mode: 'edit', id: 'album-1' }
    const file = new File(['cover'], 'cover.webp', { type: 'image/webp' })
    const wrapper = mountDrawer()

    await flushPromises()
    const albumEditor = wrapper.getComponent({ name: 'AlbumEditorShell' })
    expect(albumEditor.props('meta')).toEqual(expect.objectContaining({ description: '原专辑简介' }))
    albumEditor.vm.$emit('update:meta', {
      ...albumEditor.props('meta'),
      description: '更新后的专辑简介',
    })
    albumEditor.vm.$emit('update:cover', {
      file,
      previewUrl: 'data:image/webp;base64,Y292ZXI=',
      asset: null,
    })
    await nextTick()

    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存全部')
    await saveButton?.trigger('click')
    await flushPromises()

    expect(mocks.uploadMusicAsset).toHaveBeenCalledWith(file, 'music.cover')
	    expect(mocks.submitAlbumRevision).toHaveBeenCalledWith('album-1', expect.objectContaining({
		artist_credits: [{
			artist_id: artistId,
			position: 1,
			roles: [{ role: 'primary' }],
		}],
      release_date: '2007-11-10',
      description: '更新后的专辑简介',
      cover: expect.objectContaining({ url: 'https://assets.example.test/covers/new.webp' }),
    }))
  })

	  it('keeps the album editor open when the revision request fails', async () => {
	    mocks.submitAlbumRevision.mockRejectedValue(new Error('failed'))
	mocks.getMusicAlbum.mockResolvedValue({
		id: 'album-1',
		title: 'Test Album',
		entry_status: 'open',
		artists: [{ id: 'artist-1', name: 'Test Artist' }],
		songs: [],
	})
    drawerState.value.musicEditor = { entity: 'album', mode: 'edit', id: 'album-1' }
    const wrapper = mountDrawer()

    await flushPromises()
    const saveButton = wrapper.findAll('button').find((button) => button.text() === '保存全部')
    await saveButton?.trigger('click')
    await flushPromises()

    expect(mocks.refreshAlbum).not.toHaveBeenCalled()
    expect(mocks.closeMusicEditor).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('保存失败')
  })

	it('submits song metadata and credits through a song revision', async () => {
		drawerState.value.musicEditor = { entity: 'song', mode: 'edit', id: 'song-1' }
		const wrapper = mountDrawer()
		await flushPromises()

		wrapper.findAllComponents({ name: 'PInput' })[0]?.vm.$emit('update:modelValue', 'Updated Song')
		await nextTick()
		const saveButton = wrapper.findAll('button').find(button => button.text() === '保存歌曲')
		await saveButton?.trigger('click')
		await flushPromises()

		expect(mocks.submitSongRevision).toHaveBeenCalledWith('song-1', expect.objectContaining({
			title: 'Updated Song',
			track_number: 2,
			disc_number: 1,
			lyrics: 'Lyrics',
			artist_credits: [{
				artist_id: 'artist-1',
				position: 1,
				roles: [{ role: 'primary' }],
			}],
		}))
		expect(mocks.refreshSong).toHaveBeenCalled()
	})

	it('reports only the failed track audio queue after album metadata is saved', async () => {
		mocks.getMusicAlbum.mockResolvedValue({
			id: 'album-1',
			title: 'Test Album',
			entry_status: 'open',
			artists: [{ id: 'artist-1', name: 'Test Artist' }],
			songs: [{ id: 'song-1', title: 'Existing Song', track_number: 1, disc_number: 1, audio_url: 'old.mp3' }],
		})
		mocks.queueMusicSongAudioReplacement.mockRejectedValue(new Error('queue unavailable'))
		drawerState.value.musicEditor = { entity: 'album', mode: 'edit', id: 'album-1' }
		const wrapper = mountDrawer()
		await flushPromises()

		const editor = wrapper.getComponent({ name: 'AlbumEditorShell' })
		const file = new File(['audio'], 'replacement.mp3', { type: 'audio/mpeg' })
		editor.vm.$emit('update:tracks', editor.props('tracks').map((track: Record<string, unknown>) => ({ ...track, file })))
		await nextTick()
		const saveButton = wrapper.findAll('button').find(button => button.text() === '保存全部')
		await saveButton?.trigger('click')
		await flushPromises()

		expect(mocks.submitAlbumRevision).toHaveBeenCalled()
		expect(mocks.queueMusicSongAudioReplacement).toHaveBeenCalled()
		expect(mocks.refreshAlbum).toHaveBeenCalled()
		expect(mocks.closeMusicEditor).not.toHaveBeenCalled()
		expect(wrapper.text()).toContain('专辑资料已保存，但部分音频替换提交失败，请重试')
	})

	it('keeps the saved metadata result clear when audio replacement queueing fails', async () => {
		mocks.queueMusicSongAudioReplacement.mockRejectedValue(new Error('queue unavailable'))
		drawerState.value.musicEditor = { entity: 'song', mode: 'edit', id: 'song-1' }
		const wrapper = mountDrawer()
		await flushPromises()

		const audioFile = new File(['audio'], 'replacement.mp3', { type: 'audio/mpeg' })
		const audioInput = wrapper.find('input[accept="audio/*"]')
		Object.defineProperty(audioInput.element, 'files', { value: [audioFile] })
		await audioInput.trigger('change')
		const saveButton = wrapper.findAll('button').find(button => button.text() === '保存歌曲')
		await saveButton?.trigger('click')
		await flushPromises()

		expect(mocks.uploadMusicAsset).toHaveBeenCalledWith(audioFile, 'music.audio')
		expect(mocks.submitSongRevision).toHaveBeenCalled()
		expect(mocks.queueMusicSongAudioReplacement).toHaveBeenCalled()
		expect(mocks.refreshSong).toHaveBeenCalled()
		expect(mocks.closeMusicEditor).not.toHaveBeenCalled()
		expect(wrapper.text()).toContain('歌曲资料已保存，但音频替换提交失败，请重试')
	})
})
