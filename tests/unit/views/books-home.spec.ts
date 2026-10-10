import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import * as booksApi from '@/api/books'
import BooksHomeView from '@/views/books/BooksHomeView.vue'

const routes = [
  { path: '/books', component: BooksHomeView },
  { path: '/books/library', component: BooksHomeView },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BooksHomeView', () => {
  it('loads the authenticated private library and shows processing state', async () => {
    vi.spyOn(booksApi, 'listBookImports').mockResolvedValue([{
      id: 'import-1',
      title: 'Private PDF',
      file_name: 'private.pdf',
      format: 'pdf',
      content_type: 'application/pdf',
      size: 1024,
      status: 'scanning',
      part_size: 16 * 1024 * 1024,
      completed_parts: [],
      expires_at: '2026-08-27T00:00:00Z',
      processing_status: 'scanning',
    }])

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/books/library')
    await router.isReady()
    const wrapper = mount(BooksHomeView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Private PDF')
    expect(wrapper.text()).toContain('等待扫描')
    expect(wrapper.find('[aria-label="删除导入"]').exists()).toBe(true)
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('.epub,.pdf,.txt,.cbz,.cbr,.mobi,.azw3,application/epub+zip,application/pdf,text/plain,application/vnd.comicbook+zip,application/vnd.rar,application/x-mobipocket-ebook,application/vnd.amazon.mobi8-ebook')
    wrapper.unmount()
  })

  it('shows public catalog results without private import fields', async () => {
    vi.spyOn(booksApi, 'listPublicBookAssets').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    vi.spyOn(booksApi, 'searchPublicBooks').mockResolvedValue({
      items: [{
        id: 'work-1',
        title: 'Public Work',
        lifecycle_status: 'active',
        rating_score: 0,
        rating_count: 0,
        authors: [{ id: 'person-1', name: 'Public Author', role: 'author' }],
        editions: [{ id: 'edition-1', work_id: 'work-1', publisher: 'Public Press', cover_url: 'https://covers.openlibrary.org/b/id/123-M.jpg' }],
      }],
      total: 1,
      limit: 20,
      offset: 0,
    })

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/books?q=novel&page=2')
    await router.isReady()
    const wrapper = mount(BooksHomeView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Public Work')
    expect(wrapper.text()).toContain('Public Author')
    expect(wrapper.find('a[href="/books/work/work-1?q=novel&page=2"]').exists()).toBe(true)
    expect(wrapper.find('img').attributes('src')).toBe('https://covers.openlibrary.org/b/id/123-M.jpg')
    expect(wrapper.find('.books-nav').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps catalog results visible when readable assets fail to load', async () => {
    vi.spyOn(booksApi, 'listPublicBookAssets').mockRejectedValue(new Error('Assets unavailable'))
    vi.spyOn(booksApi, 'searchPublicBooks').mockResolvedValue({
      items: [{ id: 'work-1', title: '书籍仍可查看', lifecycle_status: 'active', rating_score: 0, rating_count: 0, authors: [], editions: [] }],
      total: 1, limit: 24, offset: 0,
    })
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/books')
    await router.isReady()
    const wrapper = mount(BooksHomeView, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('书籍仍可查看')
    expect(wrapper.text()).toContain('电子书加载失败，请重试')
    wrapper.unmount()
  })
})
