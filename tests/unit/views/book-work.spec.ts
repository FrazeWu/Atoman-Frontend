import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import * as booksApi from '@/api/books'
import { useAuthStore } from '@/stores/auth'
import BookWorkView from '@/views/books/BookWorkView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  useAuthStore().isAuthenticated = true
})

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
    vi.spyOn(booksApi, 'getBookRating').mockResolvedValue({
      rating_score: 4.5,
      rating_count: 2,
      viewer_rating: 9,
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
    expect(wrapper.text()).toContain('评分人数不足（2/5）')
    expect(wrapper.text()).toContain('我的评分 9/10 · 4.5 星')
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
    vi.spyOn(booksApi, 'getBookRating').mockResolvedValue({ rating_score: 0, rating_count: 0 })
    const ratingSpy = vi.spyOn(booksApi, 'setBookRating').mockResolvedValue({
      rating_score: 9,
      rating_count: 1,
      viewer_rating: 9,
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/work/:workId', component: BookWorkView }],
    })
    await router.push('/books/work/work-1')
    await router.isReady()
    const wrapper = mount(BookWorkView, { global: { plugins: [router], stubs: { CommentSection: true } } })
    await flushPromises()
    await wrapper.get('button[data-score="9"]').trigger('click')
    await flushPromises()

    expect(ratingSpy).toHaveBeenCalledWith('work-1', 9)
    expect(wrapper.text()).toContain('评分已保存')
    wrapper.unmount()
  })

  it('clears the persisted personal rating', async () => {
    vi.spyOn(booksApi, 'getPublicBookWork').mockResolvedValue({
      id: 'work-1',
      title: 'Public Work',
      lifecycle_status: 'active',
      rating_score: 8,
      rating_count: 5,
      authors: [],
      editions: [],
    })
    vi.spyOn(booksApi, 'getPublicBookReviews').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    vi.spyOn(booksApi, 'getBookRating').mockResolvedValue({ rating_score: 8, rating_count: 5, viewer_rating: 8 })
    const deleteSpy = vi.spyOn(booksApi, 'deleteBookRating').mockResolvedValue({ rating_score: 7.5, rating_count: 4 })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/work/:workId', component: BookWorkView }],
    })
    await router.push('/books/work/work-1')
    await router.isReady()
    const wrapper = mount(BookWorkView, { global: { plugins: [router], stubs: { CommentSection: true } } })
    await flushPromises()
    await wrapper.get('.rating-control__clear').trigger('click')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('work-1')
    expect(wrapper.find('.rating-control__mine').exists()).toBe(false)
    expect(wrapper.text()).toContain('评分人数不足（4/5）')
    wrapper.unmount()
  })

  it('restores the personal rating when the login session arrives after the work', async () => {
    const authStore = useAuthStore()
    authStore.isAuthenticated = false
    vi.spyOn(booksApi, 'getPublicBookWork').mockResolvedValue({
      id: 'work-1',
      title: 'Public Work',
      lifecycle_status: 'active',
      rating_score: 8,
      rating_count: 5,
      authors: [],
      editions: [],
    })
    vi.spyOn(booksApi, 'getPublicBookReviews').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
    const ratingSpy = vi.spyOn(booksApi, 'getBookRating').mockResolvedValue({
      rating_score: 8,
      rating_count: 5,
      viewer_rating: 9,
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/work/:workId', component: BookWorkView }],
    })
    await router.push('/books/work/work-1')
    await router.isReady()
    const wrapper = mount(BookWorkView, { global: { plugins: [router], stubs: { CommentSection: true } } })
    await flushPromises()
    expect(ratingSpy).not.toHaveBeenCalled()

    authStore.isAuthenticated = true
    await flushPromises()

    expect(ratingSpy).toHaveBeenCalledWith('work-1')
    expect(wrapper.text()).toContain('我的评分 9/10 · 4.5 星')
    wrapper.unmount()
  })
})
