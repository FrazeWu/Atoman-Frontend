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
  default: { template: '<header><slot name="action" /></header>' },
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
})
