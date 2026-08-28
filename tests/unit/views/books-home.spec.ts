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
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('.epub,.pdf,application/epub+zip,application/pdf')
    wrapper.unmount()
  })

  it('shows public catalog results without private import fields', async () => {
    vi.spyOn(booksApi, 'searchPublicBooks').mockResolvedValue({
      items: [{
        id: 'work-1',
        title: 'Public Work',
        lifecycle_status: 'active',
        rating_score: 0,
        rating_count: 0,
        authors: [{ id: 'person-1', name: 'Public Author', role: 'author' }],
        editions: [{ id: 'edition-1', work_id: 'work-1', publisher: 'Public Press' }],
      }],
      total: 1,
      limit: 20,
      offset: 0,
    })

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/books')
    await router.isReady()
    const wrapper = mount(BooksHomeView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Public Work')
    expect(wrapper.text()).toContain('Public Author')
    expect(wrapper.find('a[href="/books/work/work-1"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
