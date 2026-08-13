import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicSongRouteView from '@/views/music/MusicSongRouteView.vue'

const mocks = vi.hoisted(() => ({
  getMusicSongDetail: vi.fn(),
  route: { params: { songId: 'song-1' } },
  drawerState: { songRefreshToken: 0 },
  loadLyrics: vi.fn(),
  currentLyricLine: vi.fn(),
}))
const route = reactive(mocks.route)
const drawerState = ref(mocks.drawerState)
const lyrics = ref<any>(null)
const lyricsLoading = ref(false)
const lyricsError = ref('')

vi.mock('@/api/musicV1', () => ({
  getMusicSongDetail: mocks.getMusicSongDetail,
  addMusicSongToLater: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({ currentSong: null, currentTime: 0, playSong: vi.fn(), addToQueue: vi.fn() }),
}))
vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: drawerState, openAlbum: vi.fn(), openArtist: vi.fn(),
    openMusicEditor: vi.fn(), openNestedAction: vi.fn(),
  }),
}))
vi.mock('@/composables/useLoginRedirect', () => ({ useLoginRedirect: () => ({ requireLogin: () => true }) }))
vi.mock('@/composables/useMusicFavoritePlaylist', () => ({
	useMusicFavoritePlaylist: () => ({
		favoriteSongIds: ref(new Set<string>()), playlists: ref([]),
		loadFavoriteSongs: vi.fn(), loadPlaylists: vi.fn(), toggleFavoriteSong: vi.fn(), addSongToPlaylist: vi.fn(),
	}),
}))
vi.mock('@/composables/useMusicLyrics', () => ({
  useMusicLyrics: () => ({
    lyrics,
    loading: lyricsLoading,
    errorMessage: lyricsError,
    load: mocks.loadLyrics,
    currentLine: mocks.currentLyricLine,
  }),
}))
vi.mock('@/components/music/MusicLyricsLine.vue', () => ({
  default: {
    props: ['line', 'active', 'bilingual'],
    template: '<div class="lyric-line-stub"><span>{{ line.text }}</span><span v-if="bilingual">{{ line.translation }}</span></div>',
  },
}))
vi.mock('@/components/music/MusicSongLyricsEditorDrawer.vue', () => ({
  default: {
    props: ['show', 'songId', 'songTitle'],
    template: '<div v-if="show" data-testid="song-lyrics-editor"><button data-testid="song-lyrics-editor-save" @click="$emit(\'saved\', { song_id: songId, content: \'Updated\', translation: \'\', format: \'plain\', version: 2, lines: [{ line_key: \'line-2\', line_index: 0, time_ms: null, text: \'Updated\', translation: \'\' }], annotations: [] })">save</button></div>',
  },
}))
vi.mock('@/components/ui/PSegmentedControl.vue', () => ({
  default: {
    props: ['modelValue', 'options'],
    template: '<div><button v-for="option in options" :key="option.value" :data-testid="`lyrics-mode-${option.value}`" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button></div>',
  },
}))

function detail(id: string, title: string) {
  return {
    song: { id, title, audio_url: `/${id}.mp3`, artists: [], status: 'open' },
    artists: [], playable: true, previous: null, next: null,
  }
}

describe('MusicSongRouteView', () => {
  beforeEach(() => {
    mocks.getMusicSongDetail.mockReset()
    route.params.songId = 'song-1'
    drawerState.value.songRefreshToken = 0
    mocks.loadLyrics.mockReset()
    mocks.loadLyrics.mockResolvedValue(undefined)
    mocks.currentLyricLine.mockReset()
    mocks.currentLyricLine.mockReturnValue(null)
    lyricsLoading.value = false
    lyricsError.value = ''
    lyrics.value = {
      song_id: 'song-1',
      content: '[00:01.00]Original',
      translation: '[00:01.00]翻译',
      format: 'lrc',
      version: 1,
      lines: [{ line_key: 'line-1', line_index: 0, time_ms: 1000, text: 'Original', translation: '翻译' }],
      annotations: [],
    }
  })

  it('renders structured lyrics and edits them through the revision editor', async () => {
    mocks.getMusicSongDetail.mockResolvedValue(detail('song-1', 'First Song'))
    const wrapper = mount(MusicSongRouteView, {
      global: { stubs: { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, PToast: { template: '<div />' } } },
    })
    await flushPromises()

    expect(mocks.loadLyrics).toHaveBeenCalledWith('song-1')
    expect(wrapper.get('.song-detail__lyric-lines').text()).toBe('Original')
    expect(wrapper.text()).not.toContain('[00:01.00]Original')

    await wrapper.get('.song-detail__lyrics-actions button:nth-child(2)').trigger('click')
    expect(wrapper.get('.song-detail__lyric-lines').text()).toContain('翻译')

    await wrapper.get('[data-testid="song-detail-edit-lyrics"]').trigger('click')
    expect(wrapper.find('[data-testid="song-lyrics-editor"]').exists()).toBe(true)
    await wrapper.get('[data-testid="song-lyrics-editor-save"]').trigger('click')
    expect(wrapper.get('.song-detail__lyric-lines').text()).toContain('Updated')
    expect(wrapper.find('[data-testid="song-lyrics-editor"]').exists()).toBe(false)
  })

  it('ignores an obsolete response after navigating to another song', async () => {
    let resolveFirst!: (value: ReturnType<typeof detail>) => void
    const first = new Promise<ReturnType<typeof detail>>(resolve => { resolveFirst = resolve })
    mocks.getMusicSongDetail.mockImplementation((songId: string) => (
      songId === 'song-1' ? first : Promise.resolve(detail('song-2', 'Second Song'))
    ))

    const wrapper = mount(MusicSongRouteView, {
      global: {
        stubs: {
          RouterLink: { props: ['to'], template: '<a><slot /></a>' },
          PToast: { template: '<div />' },
        },
      },
    })
    route.params.songId = 'song-2'
    await flushPromises()
    expect(wrapper.text()).toContain('Second Song')

    resolveFirst(detail('song-1', 'First Song'))
    await flushPromises()
    expect(wrapper.text()).toContain('Second Song')
    expect(wrapper.text()).not.toContain('First Song')
  })
})
