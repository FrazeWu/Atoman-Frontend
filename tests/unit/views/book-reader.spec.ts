import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import * as booksApi from '@/api/books'
import BookReaderView from '@/views/books/BookReaderView.vue'

const asset = {
  id: 'asset-1',
  import_id: 'import-1',
  title: 'Private text',
  file_name: 'private.txt',
  format: 'txt',
  content_type: 'text/plain',
  size: 12,
  status: 'metadata_ready',
  scan_status: 'clean',
  processing_status: 'private_available',
}

const readingState = {
  asset_id: 'asset-1',
  pdf_page: 0,
  txt_offset: 0,
  reading_percent: 0,
  preferences: {},
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BookReaderView', () => {
  it('opens a private TXT asset and saves its reading state', async () => {
    vi.spyOn(booksApi, 'getBookAsset').mockResolvedValue(asset)
    vi.spyOn(booksApi, 'getBookReadingState').mockResolvedValue(readingState)
    vi.spyOn(booksApi, 'fetchBookAssetContent').mockResolvedValue(new Blob(['Private text']))
    vi.spyOn(booksApi, 'saveBookReadingState').mockResolvedValue({
      ...readingState,
      reading_percent: 0.25,
      private_notes: 'remember this',
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/read/:assetId', component: BookReaderView }],
    })
    await router.push('/books/read/asset-1')
    await router.isReady()
    const wrapper = mount(BookReaderView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Private text')
    expect(wrapper.text()).toContain('阅读进度')
    await wrapper.find('textarea').setValue('remember this')
    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存位置'))
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')
    await flushPromises()

    expect(booksApi.saveBookReadingState).toHaveBeenCalledWith('asset-1', expect.objectContaining({
      private_notes: 'remember this',
    }))
  })
})
