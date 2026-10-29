import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Song } from '@/types'
import { useAudioPlayerStore } from '@/stores/player'
import { canPlayMusicSong, firstPlayableMusicSong, musicAudioFromApi, musicPlaybackDetailsFromApi } from '@mobile/mobileMusicPlayback'
import MusicAlbumDetailView from '@mobile/views/music/MusicAlbumDetailView.vue'
import MusicPlaylistDetailView from '@mobile/views/music/MusicPlaylistDetailView.vue'
import MusicArtistDetailView from '@mobile/views/music/MusicArtistDetailView.vue'
import MusicSearchView from '@mobile/views/music/MusicSearchView.vue'
import MusicLibraryView from '@mobile/views/music/MusicLibraryView.vue'
import MusicDiscoverView from '@mobile/views/music/MusicDiscoverView.vue'
import MusicMeView from '@mobile/views/music/MusicMeView.vue'
import * as api from '@/api/musicV1'

vi.mock('@/api/musicV1', () => ({
  getMusicAlbum: vi.fn(),
  getMusicPlaylist: vi.fn(),
  getMusicArtist: vi.fn(),
  listMusicSongs: vi.fn(),
  listMusicAlbums: vi.fn(),
  listMusicArtists: vi.fn(),
  listPublicMusicPlaylists: vi.fn(),
  getMusicHome: vi.fn(),
  searchMusic: vi.fn(),
}))

const available: Song = {
  id: 'good', title: '可播放曲目', artist: '真实艺人',
  audio_url: 'https://media.example.test/good.mp3', audio_status: 'ready',
}
const missing: Song = {
  id: 'missing', title: '只有元数据', artist: '真实艺人', audio_url: '',
}
const processing: Song = {
  id: 'processing', title: '转码中曲目', artist: '真实艺人',
  audio_url: 'https://media.example.test/processing.mp3', audio_status: 'processing',
}

let router: ReturnType<typeof createRouter>
let pinia: ReturnType<typeof createPinia>
beforeEach(async () => {
  vi.resetAllMocks()
  pinia = createPinia()
  setActivePinia(pinia)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/music', component: { template: '<div />' } },
      { path: '/music/album/:albumId', component: { template: '<div />' } },
      { path: '/music/playlist/:playlistId', component: { template: '<div />' } },
      { path: '/music/artist/:artistId', component: { template: '<div />' } },
      { path: '/music/search', component: { template: '<div />' } },
      { path: '/music/me', component: { template: '<div />' } },
    ],
  })
  await router.push('/music')
  await router.isReady()
})

function spyPlayer() {
  return vi.spyOn(useAudioPlayerStore(), 'playSong').mockImplementation(() => undefined)
}
function spyQueue() {
  return vi.spyOn(useAudioPlayerStore(), 'playAlbum').mockImplementation(() => undefined)
}

describe('mobile music playback integrity', () => {
  it('preserves real lyric data and marks only unknown lyrics for detail hydration', () => {
    expect(musicPlaybackDetailsFromApi({
      lyrics: '[00:01.00]真实歌词', waveform_peaks: [0.1, 0.8],
    })).toEqual({
      lyrics: '[00:01.00]真实歌词', waveform_peaks: [0.1, 0.8], summary_only: false,
    })
    expect(musicPlaybackDetailsFromApi({})).toEqual({ summary_only: true })
    expect(musicPlaybackDetailsFromApi({ lyrics: '' })).toEqual({
      lyrics: '', summary_only: true,
    })
    expect(musicPlaybackDetailsFromApi({ lyrics: '', summary_only: false })).toEqual({
      lyrics: '', summary_only: false,
    })
    expect(musicPlaybackDetailsFromApi({ lyrics: 'known', waveform_peaks: [Number.NaN] }))
      .toEqual({ lyrics: 'known', summary_only: false })
  })

  it('keeps only actual API audio URLs and rejects missing / processing assets', () => {
    expect(musicAudioFromApi({})).toEqual({ audio_url: '', audio_status: undefined })
    expect(musicAudioFromApi({ audio_url: '  /media/valid.mp3  ', audio_status: 'ready' })).toEqual({
      audio_url: '/media/valid.mp3', audio_status: 'ready',
    })
    expect(musicAudioFromApi({ audio_url: 11, audio_status: null })).toEqual({
      audio_url: '', audio_status: undefined,
    })
    expect(canPlayMusicSong(missing)).toBe(false)
    expect(canPlayMusicSong(processing)).toBe(false)
    expect(canPlayMusicSong(available)).toBe(true)
    expect(firstPlayableMusicSong([missing, processing, available])).toEqual(available)
  })

  it('album keeps unavailable tracks visible but queues only ready sources', async () => {
    const play = spyQueue()
    const wrapper = mount(MusicAlbumDetailView, {
      props: { initialAlbum: { id: 'a', title: '真实专辑', artist: '艺人' }, initialSongs: [missing, processing, available] },
      global: { plugins: [pinia, router] },
    })
    const rows = wrapper.findAll('[data-testid="album-song-item"]')
    expect(rows).toHaveLength(3)
    expect(rows[0].element.tagName).toBe('BUTTON')
    expect(rows[0].attributes('disabled')).toBeDefined()
    expect(rows[1].attributes('disabled')).toBeDefined()
    expect(rows[2].attributes('disabled')).toBeUndefined()
    expect(rows[0].text()).toContain('暂无音源')
    await rows[0].trigger('click')
    expect(play).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    expect(play).toHaveBeenCalledOnce()
    expect(play).toHaveBeenCalledWith([available], 0)
    wrapper.unmount()
  })

  it('playlist play-all is unavailable with no actual audio', async () => {
    const play = spyQueue()
    const wrapper = mount(MusicPlaylistDetailView, {
      props: { initialPlaylist: { id: 'p', name: '公开歌单' }, initialSongs: [missing, processing] },
      global: { plugins: [pinia, router] },
    })
    expect(wrapper.get('[data-testid="play-all-btn"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('[data-testid="playlist-song-item"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('暂无音源')
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    expect(play).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('artist play-all skips missing audio and preserves the real song order', async () => {
    const play = spyQueue()
    const wrapper = mount(MusicArtistDetailView, {
      props: {
        initialArtist: { id: 'art', name: '艺人' },
        initialAlbums: [],
        initialSongs: [missing, available],
      },
      global: { plugins: [pinia, router] },
    })
    expect(wrapper.get('[data-testid="artist-song-item"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="artist-play-all-btn"]').trigger('click')
    expect(play).toHaveBeenCalledOnce()
    expect(play).toHaveBeenCalledWith([available], 0)
    wrapper.unmount()
  })

  it('search results keep metadata-only songs disabled instead of inventing playback', async () => {
    const play = spyPlayer()
    const wrapper = mount(MusicSearchView, {
      props: {
        initialQuery: '真实艺人',
        initialSongs: [missing, processing, available],
        initialAlbums: [], initialArtists: [], initialPlaylists: [],
      },
      global: { plugins: [pinia, router] },
    })
    const rows = wrapper.findAll('[data-testid="search-song-item"]')
    expect(rows).toHaveLength(3)
    expect(rows[0].attributes('disabled')).toBeDefined()
    expect(rows[1].attributes('disabled')).toBeDefined()
    expect(rows[2].attributes('disabled')).toBeUndefined()
    expect(rows[0].attributes('aria-label')).toContain('暂无可播放音源')
    await rows[0].trigger('click')
    expect(play).not.toHaveBeenCalled()
    await rows[2].trigger('click')
    expect(play).toHaveBeenCalledOnce()
    expect(play).toHaveBeenCalledWith(expect.objectContaining({ id: 'good', audio_url: available.audio_url }))
    wrapper.unmount()
  })

  it('library and discovery expose unavailable media without triggering the player', async () => {
    vi.mocked(api.listMusicSongs).mockResolvedValue({ data: [missing, processing] } as never)
    vi.mocked(api.getMusicHome).mockResolvedValue({ recently_played: [{ song: missing }] } as never)
    vi.mocked(api.listPublicMusicPlaylists).mockResolvedValue({ data: [] } as never)
    vi.mocked(api.listMusicAlbums).mockResolvedValue({ data: [] } as never)
    vi.mocked(api.listMusicArtists).mockResolvedValue({ data: [] } as never)
    const play = spyPlayer()
    const library = mount(MusicLibraryView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const libRow = library.get('[data-testid="library-track-item"]')
    expect(libRow.element.tagName).toBe('BUTTON')
    expect(libRow.attributes('disabled')).toBeDefined()
    await libRow.trigger('click')
    expect(play).not.toHaveBeenCalled()
    library.unmount()

    const discover = mount(MusicDiscoverView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const row = discover.get('[data-testid="track-item"]')
    expect(row.attributes('disabled')).toBeDefined()
    expect(row.text()).toContain('暂无音源')
    await row.trigger('click')
    expect(play).not.toHaveBeenCalled()
    discover.unmount()
  })

  it('music listening history does not replay a track whose source is missing', async () => {
    const play = spyPlayer()
    const wrapper = mount(MusicMeView, {
      props: {
        initialTab: 'history', initialStarred: [], initialHistory: [missing], initialPlaylists: [],
      },
      global: { plugins: [pinia, router] },
    })
    const row = wrapper.get('[data-testid="history-item"]')
    expect(row.element.tagName).toBe('BUTTON')
    expect(row.attributes('disabled')).toBeDefined()
    await row.trigger('click')
    expect(play).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('never fabricates a playlist or unrelated songs on API failure; retry restores the actual playlist', async () => {
    await router.push('/music/playlist/real-playlist')
    vi.mocked(api.getMusicPlaylist)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ id: 'real-playlist', name: '正版歌单', owner_username: '作者', songs: [available] } as never)
    const wrapper = mount(MusicPlaylistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.get('[data-testid="playlist-load-error"]').text()).toContain('歌单加载失败')
    expect(wrapper.text()).not.toContain('精选歌单')
    expect(wrapper.findAll('[data-testid="playlist-song-item"]')).toHaveLength(0)
    expect(vi.mocked(api.listMusicSongs)).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="playlist-load-error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('正版歌单')
    expect(wrapper.text()).toContain('作者')
    expect(wrapper.findAll('[data-testid="playlist-song-item"]')).toHaveLength(1)
    wrapper.unmount()
  })

  it('never invents a demo album or borrows other music on album error', async () => {
    await router.push('/music/album/real-album')
    vi.mocked(api.getMusicAlbum)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ id: 'real-album', title: '真实作品集', year: 2023, songs: [available] } as never)
    const wrapper = mount(MusicAlbumDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.get('[data-testid="album-load-error"]').text()).toContain('专辑加载失败')
    expect(wrapper.findAll('[data-testid="album-song-item"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('精选专辑')
    expect(vi.mocked(api.listMusicSongs)).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="album-load-error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('真实作品集')
    expect(wrapper.findAll('[data-testid="album-song-item"]')).toHaveLength(1)
    expect(api.getMusicAlbum).toHaveBeenLastCalledWith('real-album', { force: true })
    wrapper.unmount()
  })

  it('artist fetch failures never show unrelated hits and recover on retry', async () => {
    await router.push('/music/artist/real-artist')
    vi.mocked(api.getMusicArtist)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ id: 'real-artist', name: '真实歌手', albums: [] } as never)
    vi.mocked(api.listMusicSongs).mockResolvedValue({ data: [available] } as never)
    const wrapper = mount(MusicArtistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.get('[data-testid="artist-load-error"]').text()).toContain('歌手加载失败')
    expect(wrapper.text()).not.toContain('精选歌手')
    expect(vi.mocked(api.listMusicSongs)).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="artist-load-error"] button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('真实歌手')
    expect(wrapper.findAll('[data-testid="artist-song-item"]')).toHaveLength(1)
    expect(api.listMusicSongs).toHaveBeenLastCalledWith(
      { artist_id: 'real-artist', page: 1, page_size: 20 },
      { force: true },
    )
    wrapper.unmount()
  })

  it('artist song-list error preserves artist profile and gives an explicit retry', async () => {
    await router.push('/music/artist/real-artist')
    vi.mocked(api.getMusicArtist).mockResolvedValue({ id: 'real-artist', name: '真实歌手' } as never)
    vi.mocked(api.listMusicSongs).mockRejectedValue(new Error('network down'))
    const wrapper = mount(MusicArtistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('真实歌手')
    expect(wrapper.text()).toContain('该歌手曲目加载失败')
    expect(wrapper.findAll('[data-testid="artist-song-item"]')).toHaveLength(0)
    wrapper.unmount()
  })
})
