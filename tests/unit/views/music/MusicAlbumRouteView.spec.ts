import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openAlbum: vi.fn(),
  syncEntityRoute: vi.fn((_key: string, open: () => void) => open()),
  getMusicAlbum: vi.fn(),
  player: { playSong: vi.fn(), showLyrics: false },
}))

const route = reactive({
  params: { albumId: 'album-1' } as Record<string, string>,
  query: { song_id: 'song-1', annotation_id: 'annotation-1' } as Record<string, string>,
})

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({}),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({ openAlbum: mocks.openAlbum }),
}))

vi.mock('@/composables/useMusicSheetRouteSync', () => ({
  useMusicSheetRouteSync: () => ({ syncEntityRoute: mocks.syncEntityRoute }),
}))

vi.mock('@/api/musicV1', () => ({ getMusicAlbum: mocks.getMusicAlbum }))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => mocks.player,
}))

vi.mock('@/utils/musicMedia', () => ({
  buildPlayableSongsFromAlbum: () => [
    { id: 'song-1', title: '第一首' },
    { id: 'song-2', title: '第二首' },
  ],
}))

vi.mock('@/views/music/HomeView.vue', () => ({
  default: { template: '<div data-testid="music-home-view-stub" />' },
}))

describe('MusicAlbumRouteView', () => {
  beforeEach(() => {
    mocks.openAlbum.mockReset()
    mocks.syncEntityRoute.mockClear()
    mocks.getMusicAlbum.mockReset()
    mocks.getMusicAlbum.mockResolvedValue({ id: 'album-1' })
    mocks.player.playSong.mockReset()
    mocks.player.showLyrics = false
    route.params = { albumId: 'album-1' }
    route.query = { song_id: 'song-1', annotation_id: 'annotation-1' }
  })

  it('reopens the lyric target when annotation query changes within the same album', async () => {
    const component = (await import('@/views/music/MusicAlbumRouteView.vue')).default
    const wrapper = mount(component)
    await flushPromises()

    route.query = { song_id: 'song-1', annotation_id: 'annotation-2' }
    await nextTick()
    await flushPromises()

    expect(mocks.syncEntityRoute).toHaveBeenCalledTimes(2)
    expect(mocks.openAlbum).toHaveBeenCalledTimes(2)
    expect(mocks.getMusicAlbum).toHaveBeenCalledTimes(2)
    expect(mocks.player.playSong).toHaveBeenCalledTimes(2)
    expect(mocks.player.showLyrics).toBe(true)
    wrapper.unmount()
  })

  it('reopens the lyric target when song query changes within the same album', async () => {
    const component = (await import('@/views/music/MusicAlbumRouteView.vue')).default
    const wrapper = mount(component)
    await flushPromises()

    route.query = { song_id: 'song-2', annotation_id: 'annotation-1' }
    await nextTick()
    await flushPromises()

    expect(mocks.getMusicAlbum).toHaveBeenCalledTimes(2)
    expect(mocks.player.playSong).toHaveBeenLastCalledWith({ id: 'song-2', title: '第二首' })
    expect(mocks.player.showLyrics).toBe(true)
    wrapper.unmount()
  })
})
