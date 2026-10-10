import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import * as booksApi from '@/api/books'
import BookPublicReaderView from '@/views/books/BookPublicReaderView.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BookPublicReaderView', () => {
  it('opens a published TXT asset without requesting private reading state', async () => {
    vi.spyOn(booksApi, 'getPublishedBookAsset').mockResolvedValue({
      id: 'public-asset-1',
      work_id: 'work-1',
      format: 'txt',
      file_name: 'public.txt',
      content_type: 'text/plain',
      size: 12,
      status: 'published',
      created_at: '2026-08-27T00:00:00Z',
    })
    vi.spyOn(booksApi, 'fetchPublishedBookAssetContent').mockResolvedValue(new Blob(['Public text']))
    const privateStateSpy = vi.spyOn(booksApi, 'getBookReadingState')

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/public-read/:assetId', component: BookPublicReaderView }],
    })
    await router.push('/books/public-read/public-asset-1')
    await router.isReady()
    const wrapper = mount(BookPublicReaderView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Public text')
    expect(wrapper.text()).toContain('公共正文')
    expect(privateStateSpy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('保留公共正文举报动作', async () => {
    vi.spyOn(booksApi, 'getPublishedBookAsset').mockResolvedValue({
      id: 'public-asset-2',
      work_id: 'work-2',
      format: 'txt',
      file_name: 'reported.txt',
      content_type: 'text/plain',
      size: 12,
      status: 'published',
      created_at: '2026-08-27T00:00:00Z',
    })
    vi.spyOn(booksApi, 'fetchPublishedBookAssetContent').mockResolvedValue(new Blob(['Public text']))
    const reportSpy = vi.spyOn(booksApi, 'reportPublishedBookAsset').mockResolvedValue(undefined)
    Object.defineProperty(window, 'prompt', { configurable: true, value: vi.fn(() => '内容不实') })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/public-read/:assetId', component: BookPublicReaderView }],
    })
    await router.push('/books/public-read/public-asset-2')
    await router.isReady()
    const wrapper = mount(BookPublicReaderView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(reportSpy).toHaveBeenCalledWith('public-asset-2', '内容不实')
    expect(wrapper.text()).toContain('举报已提交')
    wrapper.unmount()
  })
})
