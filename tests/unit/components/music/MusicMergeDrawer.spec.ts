import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicMergeDrawer from '@/components/music/MusicMergeDrawer.vue'

const mocks = vi.hoisted(() => ({
  state: { value: { artistId: 'artist-source', albumId: null as string | null, nestedAction: 'merge_artist', nestedPayload: { name: '来源艺术家' } } },
  listMusicArtists: vi.fn(),
  listMusicAlbums: vi.fn(),
  mergeMusicArtists: vi.fn(),
  mergeMusicAlbums: vi.fn(),
  previewMusicAlbumMerge: vi.fn(),
  closeNestedAction: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: mocks.state,
    closeNestedAction: mocks.closeNestedAction,
    returnToLayer: vi.fn(),
    isLayerShifted: () => false,
    isTopLayer: () => true,
  }),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: mocks.listMusicArtists,
  listMusicAlbums: mocks.listMusicAlbums,
  mergeMusicArtists: mocks.mergeMusicArtists,
  mergeMusicAlbums: mocks.mergeMusicAlbums,
  previewMusicAlbumMerge: mocks.previewMusicAlbumMerge,
}))

describe('MusicMergeDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.value = { artistId: 'artist-source', albumId: null, nestedAction: 'merge_artist', nestedPayload: { name: '来源艺术家' } }
    mocks.listMusicArtists.mockResolvedValue({
      data: [
        { id: 'artist-source', name: '来源艺术家', entry_status: 'open' },
        { id: 'artist-target', name: '目标艺术家', entry_status: 'open' },
      ],
      meta: { page: 1, page_size: 20, total: 2, has_more: false },
    })
    mocks.mergeMusicArtists.mockResolvedValue({ message: 'merged' })
  })

  it('直接合并艺术家', async () => {
    const wrapper = mount(MusicMergeDrawer, {
      global: { stubs: { PSheet: { template: '<section><slot /></section>' } } },
    })

    await wrapper.get('[data-test="merge-search-input"]').setValue('目标')
    await wrapper.get('[data-test="merge-search-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('来源艺术家')
    await wrapper.get('[data-test="merge-target-artist-target"]').trigger('click')
    await wrapper.get('[data-test="merge-continue"]').trigger('click')
    expect(wrapper.text()).toContain('确认后，当前条目将并入目标条目')

    await wrapper.get('[data-test="merge-confirm"]').trigger('click')
    await flushPromises()

    expect(mocks.mergeMusicArtists).toHaveBeenCalledWith('artist-target', 'artist-source')
    expect(wrapper.text()).toContain('合并完成')
  })
})
