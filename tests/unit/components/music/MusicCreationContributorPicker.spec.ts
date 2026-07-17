import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import MusicCreationContributorPicker from '@/components/music/MusicCreationContributorPicker.vue'
import { listMusicArtists } from '@/api/musicV1'

vi.mock('@/api/musicV1', () => ({
  listMusicArtists: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('MusicCreationContributorPicker.vue', () => {
  beforeEach(() => {
    vi.mocked(listMusicArtists).mockReset()
  })

  it('keeps only the latest search result when earlier requests resolve later', async () => {
    const first = deferred<{
      data: Array<{ id: string; name: string; entry_status: 'open' }>
      meta: { page: number; page_size: number; total: number; has_more: boolean }
    }>()
    const second = deferred<{
      data: Array<{ id: string; name: string; entry_status: 'open' }>
      meta: { page: number; page_size: number; total: number; has_more: boolean }
    }>()

    vi.mocked(listMusicArtists)
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never)

    const wrapper = mount(MusicCreationContributorPicker, {
      props: {
        modelValue: [],
      },
    })

    await wrapper.get('[data-testid="album-contributor-search-input"]').setValue('a')
    await wrapper.get('[data-testid="album-contributor-search-input"]').setValue('ab')

    second.resolve({
      data: [{ id: 'artist-2', name: 'Latest Artist', entry_status: 'open' }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Latest Artist')

    first.resolve({
      data: [{ id: 'artist-1', name: 'Stale Artist', entry_status: 'open' }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Latest Artist')
    expect(wrapper.text()).not.toContain('Stale Artist')
  })
})
