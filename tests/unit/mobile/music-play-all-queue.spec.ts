import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Song } from '@/types'
import * as api from '@/api/musicV1'
import { useAudioPlayerStore } from '@/stores/player'
import { fetchFullMobilePlaylist, playableMusicQueue, startMobileMusicQueue } from '@mobile/mobileMusicPlayback'
import MusicAlbumDetailView from '@mobile/views/music/MusicAlbumDetailView.vue'
import MusicArtistDetailView from '@mobile/views/music/MusicArtistDetailView.vue'
import MusicPlaylistDetailView from '@mobile/views/music/MusicPlaylistDetailView.vue'

vi.mock('@/api/musicV1', () => ({
  getMusicAlbum: vi.fn(),
  getMusicArtist: vi.fn(),
  getMusicPlaylist: vi.fn(),
  listMusicSongs: vi.fn(),
  listMusicPlaylistSongs: vi.fn(),
}))

const song = (id: string, extra: Partial<Song> = {}): Song => ({
  id, title: id, artist: '真实艺人', audio_url: '/media/' + id + '.mp3', audio_status: 'ready', ...extra,
})
const missing = song('missing', { audio_url: '' })
const processing = song('processing', { audio_status: 'processing' })
const first = song('first')
const second = song('second')
const third = song('third')
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
      { path: '/music/artist/:artistId', component: { template: '<div />' } },
      { path: '/music/playlist/:playlistId', component: { template: '<div />' } },
    ],
  })
  await router.push('/music')
  await router.isReady()
})
const spyQueue = () => vi.spyOn(useAudioPlayerStore(), 'playAlbum').mockImplementation(() => undefined)

describe('mobile complete music queues', () => {
  it('preserves actual source order and avoids empty or processing media', () => {
    expect(playableMusicQueue([missing, second, processing, first, third]).map(s => s.id)).toEqual(['second', 'first', 'third'])
    const queue = spyQueue()
    const player = useAudioPlayerStore()
    expect(startMobileMusicQueue(player, [missing, processing])).toBe(false)
    expect(startMobileMusicQueue(player, [first, missing], 'missing')).toBe(false)
    expect(queue).not.toHaveBeenCalled()
    expect(startMobileMusicQueue(player, [first, processing, second, third], 'second')).toBe(true)
    expect(queue).toHaveBeenCalledWith([first, second, third], 1)
  })

  it('re-tapping the current track toggles only when the entire queue is already the same', () => {
    const player = useAudioPlayerStore()
    player.currentSong = second
    player.queue = [first, second, third]
    const queue = vi.spyOn(player, 'playAlbum').mockImplementation(() => undefined)
    const toggle = vi.spyOn(player, 'togglePlay').mockImplementation(() => undefined)
    startMobileMusicQueue(player, [first, second, third], second.id)
    expect(toggle).toHaveBeenCalledOnce()
    expect(queue).not.toHaveBeenCalled()
    player.queue = [second]
    startMobileMusicQueue(player, [first, second, third], second.id)
    expect(queue).toHaveBeenCalledWith([first, second, third], 1)
  })

  it('album play-all orders discs and skips unavailable media; track tap picks the correct queue index', async () => {
    const queue = spyQueue()
    const list = [
      song('d2', { disc_number: 2, track_number: 1 }),
      processing,
      song('d1t2', { disc_number: 1, track_number: 2 }),
      song('d1t1', { disc_number: 1, track_number: 1 }),
      missing,
    ]
    const wrapper = mount(MusicAlbumDetailView, {
      props: { initialAlbum: { id: 'a', title: '双碟专辑', artist: '艺术家' }, initialSongs: list },
      global: { plugins: [pinia, router] },
    })
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    expect(queue).toHaveBeenCalledOnce()
    expect(queue.mock.calls[0][0].map(s => s.id)).toEqual(['d1t1', 'd1t2', 'd2'])
    const target = wrapper.findAll('[data-testid="album-song-item"]').find(row => row.text().includes('d2'))
    expect(target).toBeDefined()
    await target!.trigger('click')
    expect(queue.mock.calls[1][0].map(s => s.id)).toEqual(['d1t1', 'd1t2', 'd2'])
    expect(queue.mock.calls[1][1]).toBe(2)
    wrapper.unmount()
  })

  it('artist play-all preserves API ranking and individual song starts from that rank', async () => {
    const queue = spyQueue()
    const wrapper = mount(MusicArtistDetailView, {
      props: { initialArtist: { id: 'artist', name: '热门艺人' }, initialSongs: [third, missing, first, processing, second], initialAlbums: [] },
      global: { plugins: [pinia, router] },
    })
    await wrapper.get('[data-testid="artist-play-all-btn"]').trigger('click')
    expect(queue.mock.calls[0][0].map(s => s.id)).toEqual(['third', 'first', 'second'])
    await wrapper.findAll('[data-testid="artist-song-item"]')[4].trigger('click')
    expect(queue.mock.calls[1][1]).toBe(2)
    wrapper.unmount()
  })

  it('playlist with 105 songs queues ALL pages, excluding unavailable tracks', async () => {
    const queue = spyQueue()
    const full = Array.from({ length: 105 }, (_, i) => song('track-' + String(i + 1).padStart(3, '0')))
    full[4] = missing
    full[101] = processing
    await router.push('/music/playlist/long')
    vi.mocked(api.getMusicPlaylist).mockResolvedValue({ id: 'long', name: '完整歌单', song_count: 105, songs: full.slice(0, 20) } as never)
    vi.mocked(api.listMusicPlaylistSongs).mockImplementation(async (_id, opts) => {
      const page = opts?.page ?? 1
      return { data: full.slice((page - 1) * 100, page * 100), meta: { page, page_size: 100, total: 105, has_more: page === 1 } } as never
    })
    const wrapper = mount(MusicPlaylistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('105 首歌曲')
    expect(wrapper.findAll('[data-testid="playlist-song-item"]')).toHaveLength(20)
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    await flushPromises()
    expect(api.listMusicPlaylistSongs).toHaveBeenNthCalledWith(1, 'long', { page: 1, page_size: 100 })
    expect(api.listMusicPlaylistSongs).toHaveBeenNthCalledWith(2, 'long', { page: 2, page_size: 100 })
    expect(queue).toHaveBeenCalledOnce()
    const tracks = queue.mock.calls[0][0]
    expect(tracks).toHaveLength(103)
    expect(tracks[0].id).toBe('track-001')
    expect(tracks[4].id).toBe('track-006')
    expect(tracks.at(-1)?.id).toBe('track-105')
    expect(tracks.every(s => s.audio_url && s.audio_status === 'ready')).toBe(true)
    expect(wrapper.find('[data-testid="playlist-queue-error"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('playlist track tap starts from selected song and reuses fetched complete queue', async () => {
    const queue = spyQueue()
    await router.push('/music/playlist/select')
    vi.mocked(api.getMusicPlaylist).mockResolvedValue({ id: 'select', name: '点击歌曲', song_count: 4, songs: [first, missing, second, third] } as never)
    vi.mocked(api.listMusicPlaylistSongs).mockResolvedValue({
      data: [first, missing, second, third], meta: { page: 1, page_size: 100, total: 4, has_more: false },
    } as never)
    const wrapper = mount(MusicPlaylistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.findAll('[data-testid="playlist-song-item"]')[2].trigger('click')
    await flushPromises()
    expect(queue).toHaveBeenCalledOnce()
    expect(queue.mock.calls[0][0].map(s => s.id)).toEqual(['first', 'second', 'third'])
    expect(queue.mock.calls[0][1]).toBe(1)
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    await flushPromises()
    expect(queue).toHaveBeenCalledTimes(2)
    expect(api.listMusicPlaylistSongs).toHaveBeenCalledTimes(1)
    expect(queue.mock.calls[1][1]).toBe(0)
    wrapper.unmount()
  })

  it('a second page failure does not silently play the first page; retry succeeds', async () => {
    const queue = spyQueue()
    const full = Array.from({ length: 110 }, (_, i) => song('item-' + (i + 1)))
    await router.push('/music/playlist/flaky')
    vi.mocked(api.getMusicPlaylist).mockResolvedValue({ id: 'flaky', name: '网络恢复', song_count: 110, songs: full.slice(0, 20) } as never)
    let failSecond = true
    vi.mocked(api.listMusicPlaylistSongs).mockImplementation(async (_id, opts) => {
      const page = opts?.page ?? 1
      if (page === 2 && failSecond) throw new Error('offline')
      return { data: full.slice((page - 1) * 100, page * 100), meta: { page, page_size: 100, total: 110, has_more: page === 1 } } as never
    })
    const wrapper = mount(MusicPlaylistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    await flushPromises()
    expect(queue).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="playlist-queue-error"]').text()).toContain('完整歌单加载失败')
    failSecond = false
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    await flushPromises()
    expect(queue).toHaveBeenCalledOnce()
    expect(queue.mock.calls[0][0]).toHaveLength(110)
    expect(wrapper.find('[data-testid="playlist-queue-error"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('does not change the player if navigation unmounts before full pagination resolves', async () => {
    const queue = spyQueue()
    await router.push('/music/playlist/slow')
    vi.mocked(api.getMusicPlaylist).mockResolvedValue({ id: 'slow', name: '慢速歌单', song_count: 2, songs: [first, second] } as never)
    let resolvePage!: (value: unknown) => void
    vi.mocked(api.listMusicPlaylistSongs).mockReturnValue(new Promise(resolve => { resolvePage = resolve }) as never)
    const wrapper = mount(MusicPlaylistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="playlist-queue-loading"]').exists()).toBe(true)
    wrapper.unmount()
    resolvePage({ data: [first, second], meta: { has_more: false } })
    await flushPromises()
    expect(queue).not.toHaveBeenCalled()
  })

  it('validates pagination and rejects a permanently empty next page', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ data: [first], meta: { has_more: true } })
      .mockResolvedValueOnce({ data: [], meta: { has_more: true } })
    await expect(fetchFullMobilePlaylist('bad', fetchPage)).rejects.toThrow('Playlist pagination made no progress')
    expect(fetchPage).toHaveBeenCalledTimes(2)
    await expect(fetchFullMobilePlaylist('bad', async () => ({
      data: [first], meta: {} as { has_more: boolean },
    }))).rejects.toThrow('Invalid playlist pagination response')
  })

  it('allows play-all when preview 20 tracks have no audio but the next page has music', async () => {
    const queue = spyQueue()
    const noSources = Array.from({ length: 20 }, (_, i) => song('offline-' + i, { audio_url: '' }))
    await router.push('/music/playlist/later')
    vi.mocked(api.getMusicPlaylist).mockResolvedValue({ id: 'later', name: '后面可播放', song_count: 21, songs: noSources } as never)
    vi.mocked(api.listMusicPlaylistSongs).mockResolvedValue({
      data: [...noSources, third], meta: { page: 1, page_size: 100, total: 21, has_more: false },
    } as never)
    const wrapper = mount(MusicPlaylistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    const button = wrapper.get('[data-testid="play-all-btn"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(queue).toHaveBeenCalledWith([expect.objectContaining({ id: 'third' })], 0)
    wrapper.unmount()
  })

  it('reused playlist detail invalidates an in-flight old queue and loads the new ID', async () => {
    const queue = spyQueue()
    const old = song('old')
    const fresh = song('fresh')
    await router.push('/music/playlist/a')
    vi.mocked(api.getMusicPlaylist).mockImplementation(async (id) => ({
      id, name: '歌单-' + id, song_count: 1, songs: [id === 'a' ? old : fresh],
    }) as never)
    let resolveOld!: (value: unknown) => void
    vi.mocked(api.listMusicPlaylistSongs).mockImplementation((id) => {
      if (id === 'a') return new Promise(resolve => { resolveOld = resolve }) as never
      return Promise.resolve({ data: [fresh], meta: { has_more: false } } as never)
    })
    const wrapper = mount(MusicPlaylistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="playlist-queue-loading"]').exists()).toBe(true)
    await router.push('/music/playlist/b')
    await flushPromises()
    expect(wrapper.text()).toContain('歌单-b')
    resolveOld({ data: [old], meta: { has_more: false } })
    await flushPromises()
    expect(queue).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    await flushPromises()
    expect(queue).toHaveBeenCalledWith([expect.objectContaining({ id: 'fresh' })], 0)
    wrapper.unmount()
  })

  it('reused album detail only plays the new album after route changes', async () => {
    const queue = spyQueue()
    await router.push('/music/album/a')
    vi.mocked(api.getMusicAlbum).mockImplementation(async (id) => ({
      id, title: '专辑-' + id, songs: [id === 'a' ? first : second],
    }) as never)
    const wrapper = mount(MusicAlbumDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await router.push('/music/album/b')
    await flushPromises()
    expect(wrapper.text()).toContain('专辑-b')
    await wrapper.get('[data-testid="play-all-btn"]').trigger('click')
    expect(queue).toHaveBeenCalledWith([expect.objectContaining({ id: 'second' })], 0)
    wrapper.unmount()
  })

  it('reused artist detail loads only the new artist song list after route changes', async () => {
    const queue = spyQueue()
    await router.push('/music/artist/a')
    vi.mocked(api.getMusicArtist).mockImplementation(async (id) => ({
      id, name: '歌手-' + id, albums: [],
    }) as never)
    vi.mocked(api.listMusicSongs).mockImplementation(async (filters) => ({
      data: [filters.artist_id === 'a' ? first : second],
    }) as never)
    const wrapper = mount(MusicArtistDetailView, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await router.push('/music/artist/b')
    await flushPromises()
    expect(wrapper.text()).toContain('歌手-b')
    await wrapper.get('[data-testid="artist-play-all-btn"]').trigger('click')
    expect(queue).toHaveBeenCalledWith([expect.objectContaining({ id: 'second' })], 0)
    wrapper.unmount()
  })

})
