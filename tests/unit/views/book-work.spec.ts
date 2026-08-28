import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import * as booksApi from '@/api/books'
import BookWorkView from '@/views/books/BookWorkView.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BookWorkView', () => {
  it('renders public metadata, editions, and public reviews', async () => {
    vi.spyOn(booksApi, 'getPublicBookWork').mockResolvedValue({
      id: 'work-1',
      title: 'Public Work',
      description: 'A public description',
      lifecycle_status: 'active',
      rating_score: 4.5,
      rating_count: 2,
      authors: [{ id: 'person-1', name: 'Author', role: 'author' }],
      editions: [{ id: 'edition-1', work_id: 'work-1', publisher: 'Press' }],
    })
    vi.spyOn(booksApi, 'getPublicBookReviews').mockResolvedValue({
      items: [{
        id: 'review-1',
        author_id: 'user-1',
        work_id: 'work-1',
        content: 'Worth reading',
        spoiler: false,
        created_at: '2026-08-27T00:00:00Z',
        updated_at: '2026-08-27T00:00:00Z',
      }],
      total: 1,
      limit: 20,
      offset: 0,
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/work/:workId', component: BookWorkView }],
    })
    await router.push('/books/work/work-1')
    await router.isReady()
    const wrapper = mount(BookWorkView, { global: { plugins: [router], stubs: { CommentSection: true } } })
    await flushPromises()

    expect(wrapper.text()).toContain('Public Work')
    expect(wrapper.text()).toContain('Author')
    expect(wrapper.text()).toContain('Worth reading')
    expect(wrapper.find('a[href="/books/edition/edition-1"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('submits a selected rating through the protected API', async () => {
    vi.spyOn(booksApi, 'getPublicBookWork').mockResolvedValue({
      id: 'work-1',
      title: 'Public Work',
      lifecycle_status: 'active',
      rating_score: 0,
      rating_count: 0,
      authors: [],
      editions: [],
    })
    vi.spyOn(booksApi, 'getPublicBookReviews').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    const ratingSpy = vi.spyOn(booksApi, 'setBookRating').mockResolvedValue({
      rating_score: 5,
      rating_count: 1,
      viewer_rating: 5,
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/work/:workId', component: BookWorkView }],
    })
    await router.push('/books/work/work-1')
    await router.isReady()
    const wrapper = mount(BookWorkView, { global: { plugins: [router], stubs: { CommentSection: true } } })
    await flushPromises()
    await wrapper.get('#book-rating').setValue('5')
    await wrapper.findAll('button').find((button) => button.text().includes('提交评分'))!.trigger('click')
    await flushPromises()

    expect(ratingSpy).toHaveBeenCalledWith('work-1', 5)
    expect(wrapper.text()).toContain('评分已保存')
    wrapper.unmount()
  })
})
