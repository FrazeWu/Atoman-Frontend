import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MusicMergeDrawer from '@/components/music/MusicMergeDrawer.vue'

const mocks = vi.hoisted(() => ({
  state: { value: { artistId: 'artist-source', albumId: null as string | null, nestedAction: 'merge_artist', nestedPayload: { name: '来源艺术家' } } },
  listMusicArtists: vi.fn(),
  listMusicAlbums: vi.fn(),
  submitMusicEdit: vi.fn(),
  closeNestedAction: vi.fn(),
  closeArtist: vi.fn(),
  closeAlbum: vi.fn(),
  openArtist: vi.fn(),
  openAlbum: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({
    state: mocks.state,
    closeNestedAction: mocks.closeNestedAction,
    closeArtist: mocks.closeArtist,
    closeAlbum: mocks.closeAlbum,
    openArtist: mocks.openArtist,
    openAlbum: mocks.openAlbum,
  }),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: mocks.listMusicArtists,
  listMusicAlbums: mocks.listMusicAlbums,
  submitMusicEdit: mocks.submitMusicEdit,
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
    mocks.submitMusicEdit.mockResolvedValue({ id: 'merge-edit', status: 'open' })
  })

  it('submits an artist merge for review without navigating to the target', async () => {
    const wrapper = mount(MusicMergeDrawer, {
      global: { stubs: { PSheet: { template: '<section><slot /></section>' } } },
    })

    await wrapper.get('[data-test="merge-search-input"]').setValue('目标')
    await wrapper.get('[data-test="merge-search-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('来源艺术家')
    await wrapper.get('[data-test="merge-target-artist-target"]').trigger('click')
    await wrapper.get('[data-test="merge-continue"]').trigger('click')
    expect(wrapper.text()).toContain('审核通过后，当前条目将并入目标条目')

    await wrapper.get('[data-test="merge-confirm"]').trigger('click')
    await flushPromises()

    expect(mocks.submitMusicEdit).toHaveBeenCalledWith({
      type: 'merge_artist',
      entity_type: 'artist',
      entity_id: 'artist-source',
      changes: { target_id: 'artist-target' },
      reason: '合并重复艺术家',
    })
    expect(wrapper.text()).toContain('已提交审核')
    expect(mocks.closeArtist).not.toHaveBeenCalled()
    expect(mocks.openArtist).not.toHaveBeenCalled()
  })
})
