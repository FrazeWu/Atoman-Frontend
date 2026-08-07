import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LibraryView from '@/views/music/LibraryView.vue'

const mocks = vi.hoisted(() => ({
  listMusicLibrary: vi.fn(),
  openAlbum: vi.fn(),
  openArtist: vi.fn(),
  openPlaylist: vi.fn(),
  playSong: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicLibrary: mocks.listMusicLibrary,
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    openAlbum: mocks.openAlbum,
    openArtist: mocks.openArtist,
    openPlaylist: mocks.openPlaylist,
  }),
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({ playSong: mocks.playSong }),
}))

vi.mock('@/components/ui/PPageHeader.vue', () => ({
  default: { props: ['title'], template: '<header><h1>{{ title }}</h1><slot name="action" /></header>' },
}))

vi.mock('@/components/ui/PSegmentedControl.vue', () => ({
  default: {
    name: 'PSegmentedControl',
    props: ['modelValue', 'options'],
    emits: ['update:modelValue'],
    template: '<button v-for="option in options" :key="option.value" :data-option="option.value" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button>',
  },
}))

describe('LibraryView', () => {
  beforeEach(() => {
    mocks.listMusicLibrary.mockReset()
    mocks.openAlbum.mockReset()
    mocks.openArtist.mockReset()
    mocks.openPlaylist.mockReset()
    mocks.playSong.mockReset()
  })

  it('uses 收藏 as the page name and search label', async () => {
    mocks.listMusicLibrary.mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 24, total: 0, has_more: false },
    })

    const wrapper = mount(LibraryView)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('收藏')
    expect(wrapper.get('input[type="search"]').attributes('placeholder')).toBe('搜索收藏')
    expect(wrapper.text()).not.toContain('音乐库')
  })

  it('resets old pagination before loading a different collection kind', async () => {
    let resolveAlbums!: (value: unknown) => void
    const albumRequest = new Promise(resolve => { resolveAlbums = resolve })
    mocks.listMusicLibrary
      .mockResolvedValueOnce({
        data: [{ song: { id: 'song-1', title: 'Song 1', audio_url: '/song-1.mp3' } }],
        meta: { page: 1, page_size: 24, total: 25, has_more: true },
      })
      .mockReturnValueOnce(albumRequest)

    const wrapper = mount(LibraryView)
    await flushPromises()
    expect(wrapper.text()).toContain('加载更多')

    await wrapper.get('[data-option="album"]').trigger('click')
    expect(wrapper.text()).not.toContain('加载更多')
    expect(mocks.listMusicLibrary).toHaveBeenCalledTimes(2)

    resolveAlbums({
      data: [{ album: { id: 'album-1', title: 'Album 1', entry_status: 'open' } }],
      meta: { page: 1, page_size: 24, total: 1, has_more: false },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('Album 1')
  })

  it('opens artist and album details from a saved song', async () => {
    mocks.listMusicLibrary.mockResolvedValue({
      data: [{
        song: {
          id: 'song-1', title: 'Song 1', audio_url: '/song-1.mp3', entry_status: 'open',
          artists: [{ id: 'artist-1', name: 'Artist 1' }],
          album: { id: 'album-1', title: 'Album 1' },
        },
      }],
      meta: { page: 1, page_size: 24, total: 1, has_more: false },
    })

    const wrapper = mount(LibraryView, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    await wrapper.get('[data-testid="library-song-artist-artist-1"]').trigger('click')
    await wrapper.get('[data-testid="library-song-album-album-1"]').trigger('click')

    expect(mocks.openArtist).toHaveBeenCalledWith('artist-1')
    expect(mocks.openAlbum).toHaveBeenCalledWith('album-1')
  })
})
