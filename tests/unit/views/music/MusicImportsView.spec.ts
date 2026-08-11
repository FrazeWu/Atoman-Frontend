import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ImportsView from '@/views/music/ImportsView.vue'

const mocks = vi.hoisted(() => ({
  listMusicAlbumImports: vi.fn(),
  resumeMusicCreationFlow: vi.fn(),
}))

vi.mock('@/api/musicV1', () => ({
  listMusicAlbumImports: mocks.listMusicAlbumImports,
  cancelMusicAlbumImportSession: vi.fn(),
  deleteMusicAlbumImportRecord: vi.fn(),
  deleteMusicAlbumImportFile: vi.fn(),
  getMusicAlbum: vi.fn(),
  repairMusicAlbumImport: vi.fn(),
  replaceAndUploadMusicAlbumImportFile: vi.fn(),
  retryMusicAlbumImportFile: vi.fn(),
}))

vi.mock('@/composables/useMusicDrawers', () => ({
  useMusicDrawers: () => ({ resumeMusicCreationFlow: mocks.resumeMusicCreationFlow }),
}))

function importRecord(status: 'pending_upload' | 'uploaded' | 'ready', importId = 'import-1') {
  return {
    importId, targetAlbumId: '', albumTitle: 'Album', status,
    archiveName: 'album.zip', uploadProgress: 100, uploadSpeed: 0,
    coverUrl: '', coverKey: '', derivedAlbumTitle: 'Album', derivedCover: '',
    derivedTracks: [], lastSyncedAt: '', errorMessage: '', inputMode: 'archive',
    stage: 'processing', progress: {}, files: [], errors: [],
  }
}

function response(status: 'pending_upload' | 'uploaded' | 'ready') {
  return { data: [importRecord(status)], meta: { page: 1, page_size: 50, total: 1, has_more: false } }
}

describe('Music ImportsView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.listMusicAlbumImports.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not poll while waiting for the user to upload files', async () => {
    mocks.listMusicAlbumImports.mockResolvedValue(response('pending_upload'))
    const wrapper = mount(ImportsView)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(3_000)
    expect(mocks.listMusicAlbumImports).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('continues polling after a transient error and stops when the import is ready', async () => {
    mocks.listMusicAlbumImports
      .mockResolvedValueOnce(response('uploaded'))
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(response('ready'))
    const wrapper = mount(ImportsView)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(3_000)
    await flushPromises()
    expect(mocks.listMusicAlbumImports).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(3_000)
    await flushPromises()
    expect(mocks.listMusicAlbumImports).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(3_000)
    expect(mocks.listMusicAlbumImports).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('keeps loaded later pages when polling refreshes the first page', async () => {
    mocks.listMusicAlbumImports
      .mockResolvedValueOnce({
        data: [importRecord('uploaded', 'import-1')],
        meta: { page: 1, page_size: 50, total: 2, has_more: true },
      })
      .mockResolvedValueOnce({
        data: [importRecord('ready', 'import-2')],
        meta: { page: 2, page_size: 50, total: 2, has_more: false },
      })
      .mockResolvedValueOnce({
        data: [importRecord('ready', 'import-1')],
        meta: { page: 1, page_size: 50, total: 2, has_more: true },
      })
      .mockResolvedValueOnce({
        data: [importRecord('ready', 'import-2')],
        meta: { page: 2, page_size: 50, total: 2, has_more: false },
      })

    const wrapper = mount(ImportsView)
    await flushPromises()
    const loadMoreButton = wrapper.findAll('button').find((button) => button.text() === '加载更多')
    expect(loadMoreButton).toBeDefined()
    await loadMoreButton!.trigger('click')
    await flushPromises()

    await vi.advanceTimersByTimeAsync(3_000)
    await flushPromises()

    expect((wrapper.vm as unknown as { imports: Array<{ importId: string }> }).imports.map((item) => item.importId))
      .toEqual(['import-1', 'import-2'])
    expect(mocks.listMusicAlbumImports).toHaveBeenNthCalledWith(3, { page: 1, page_size: 50 })
    expect(mocks.listMusicAlbumImports).toHaveBeenNthCalledWith(4, { page: 2, page_size: 50 })
    wrapper.unmount()
  })
})
