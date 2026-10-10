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

  it('将长 TXT 正文渲染为带页码的独立双栏页面', async () => {
    vi.spyOn(booksApi, 'getBookAsset').mockResolvedValue(asset)
    vi.spyOn(booksApi, 'getBookReadingState').mockResolvedValue(readingState)
    vi.spyOn(booksApi, 'fetchBookAssetContent').mockResolvedValue(new Blob(['正文'.repeat(3_000)]))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/read/:assetId', component: BookReaderView }],
    })
    await router.push('/books/read/asset-1')
    await router.isReady()
    const wrapper = mount(BookReaderView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.findAll('.books-reader__text-page:not(.books-reader__text-page--measure)')).toHaveLength(3)
    expect(wrapper.text()).toContain('第 1 / 3 页')

    await wrapper.find('[aria-label="下一页"]').trigger('click')
    expect(wrapper.text()).toContain('第 2 / 3 页')
    await wrapper.find('[aria-label="上一页"]').trigger('click')
    expect(wrapper.text()).toContain('第 1 / 3 页')
  })

  it('添加、跳转并删除私有书签', async () => {
    vi.spyOn(booksApi, 'getBookAsset').mockResolvedValue(asset)
    vi.spyOn(booksApi, 'getBookReadingState').mockResolvedValue(readingState)
    vi.spyOn(booksApi, 'fetchBookAssetContent').mockResolvedValue(new Blob(['Private text']))
    const saveState = vi.spyOn(booksApi, 'saveBookReadingState').mockImplementation(async (_assetId, input) => ({
      ...readingState,
      ...input,
      preferences: input.preferences || {},
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/read/:assetId', component: BookReaderView }],
    })
    await router.push('/books/read/asset-1')
    await router.isReady()
    const wrapper = mount(BookReaderView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[aria-label="添加书签"]').trigger('click')
    await flushPromises()

    expect(saveState).toHaveBeenCalledWith('asset-1', expect.objectContaining({
      preferences: expect.objectContaining({
        bookmarks: [expect.objectContaining({ label: expect.any(String), txt_offset: 0 })],
      }),
    }))
    expect(wrapper.find('.books-reader__bookmarks').exists()).toBe(true)

    await wrapper.find('.books-reader__bookmarks li button').trigger('click')
    await wrapper.find('.books-reader__bookmarks li button:nth-child(2)').trigger('click')
    await flushPromises()

    expect(wrapper.find('.books-reader__bookmarks').exists()).toBe(false)
    expect(saveState).toHaveBeenLastCalledWith('asset-1', expect.objectContaining({
      preferences: expect.objectContaining({ bookmarks: [] }),
    }))
  })

  it('搜索私有 TXT 正文并跳转到匹配位置', async () => {
    vi.spyOn(booksApi, 'getBookAsset').mockResolvedValue(asset)
    vi.spyOn(booksApi, 'getBookReadingState').mockResolvedValue(readingState)
    vi.spyOn(booksApi, 'fetchBookAssetContent').mockResolvedValue(new Blob(['前言\n目标段落在这里']))
    vi.spyOn(booksApi, 'saveBookReadingState').mockResolvedValue(readingState)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/read/:assetId', component: BookReaderView }],
    })
    await router.push('/books/read/asset-1')
    await router.isReady()
    const wrapper = mount(BookReaderView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.get('#private-book-search').setValue('目标段落')
    await wrapper.find('.books-reader__search').trigger('submit')

    expect(wrapper.text()).toContain('找到 1 处匹配')
    expect(wrapper.findAll('.books-reader__search-results button')).toHaveLength(1)
    await wrapper.find('.books-reader__search-results button').trigger('click')
    expect(booksApi.saveBookReadingState).toHaveBeenCalled()
  })
})
