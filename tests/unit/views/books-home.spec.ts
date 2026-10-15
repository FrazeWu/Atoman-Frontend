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

    expect(wrapper.text()).toContain('书架')
    expect(wrapper.text()).toContain('Private PDF')
    expect(wrapper.text()).toContain('自动安全检查中')
    expect(wrapper.find('[aria-label="删除导入"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('添加图书并公开')
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

  it('opens the import flow from the public catalog instead of navigating to the library', async () => {
    vi.spyOn(booksApi, 'listPublicBookAssets').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    vi.spyOn(booksApi, 'searchPublicBooks').mockResolvedValue({ items: [], total: 0, limit: 24, offset: 0 })
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/books')
    await router.isReady()
    const wrapper = mount(BooksHomeView, {
      global: {
        plugins: [router],
        stubs: {
          BookCreationFlowDrawer: {
            props: ['show'],
            template: '<div v-if="show" data-book-import-flow>导入流程</div>',
          },
        },
      },
    })
    await flushPromises()

    const importButton = wrapper.findAll('button').find(button => button.text().includes('添加图书') || button.text().includes('导入电子书'))
    expect(importButton).toBeTruthy()
    await importButton!.trigger('click')
    expect(wrapper.find('[data-book-import-flow]').exists()).toBe(true)
    expect(router.currentRoute.value.path).toBe('/books')
    wrapper.unmount()
  })

  it('uses the same public creation flow from the library', async () => {
    vi.spyOn(booksApi, 'listBookImports').mockResolvedValue([])
    vi.spyOn(booksApi, 'listBookShelf').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    vi.spyOn(booksApi, 'listContinueReading').mockResolvedValue([])
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/books/library')
    await router.isReady()
    const wrapper = mount(BooksHomeView, {
      global: {
        plugins: [router],
        stubs: {
          BookCreationFlowDrawer: {
            props: ['show'],
            template: '<div v-if="show" data-book-import-flow>公开创建流程</div>',
          },
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text().includes('添加图书并公开'))!.trigger('click')
    expect(wrapper.find('[data-book-import-flow]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not navigate to an empty work route when a new contribution has no work ID yet', async () => {
    vi.spyOn(booksApi, 'listPublicBookAssets').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    vi.spyOn(booksApi, 'searchPublicBooks').mockResolvedValue({ items: [], total: 0, limit: 24, offset: 0 })
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/books')
    await router.isReady()
    const wrapper = mount(BooksHomeView, {
      global: {
        plugins: [router],
        stubs: {
          BookCreationFlowDrawer: {
            props: ['show'],
            emits: ['created'],
            template: '<div v-if="show"><button data-testid="finish-book-creation" @click="$emit(\'created\', \'\')">完成</button></div>',
          },
        },
      },
    })
    await flushPromises()

    const importButton = wrapper.findAll('button').find(button => button.text().includes('添加图书') || button.text().includes('导入电子书'))
    expect(importButton).toBeTruthy()
    await importButton!.trigger('click')
    await wrapper.get('[data-testid="finish-book-creation"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/books')
    expect(wrapper.find('[data-testid="finish-book-creation"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the public reader after a newly created book is published', async () => {
    vi.spyOn(booksApi, 'listPublicBookAssets').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    vi.spyOn(booksApi, 'searchPublicBooks').mockResolvedValue({ items: [], total: 0, limit: 24, offset: 0 })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [...routes, { path: '/books/public-read/:assetId', component: BooksHomeView }],
    })
    await router.push('/books')
    await router.isReady()
    const wrapper = mount(BooksHomeView, {
      global: {
        plugins: [router],
        stubs: {
          BookCreationFlowDrawer: {
            props: ['show'],
            emits: ['created'],
            template: '<div v-if="show"><button data-testid="finish-book-creation" @click="$emit(\'created\', \'work-1\', \'asset-1\', \'\')">完成</button></div>',
          },
        },
      },
    })
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text().includes('添加图书'))!.trigger('click')
    await wrapper.get('[data-testid="finish-book-creation"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/books/public-read/asset-1')
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
