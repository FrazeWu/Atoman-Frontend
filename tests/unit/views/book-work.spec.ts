import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import * as booksApi from '@/api/books'
import { useAuthStore } from '@/stores/auth'
import BookWorkView from '@/views/books/BookWorkView.vue'
import BookEditionView from '@/views/books/BookEditionView.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  useAuthStore().isAuthenticated = true
  vi.spyOn(booksApi, 'getMyBookReview').mockRejectedValue(new Error('No review'))
  vi.spyOn(booksApi, 'listPublishedBookAssets').mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 })
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
    expect(wrapper.find('.rating-control__clear').exists()).toBe(true)
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
    expect(booksApi.getMyBookReview).not.toHaveBeenCalled()

    authStore.isAuthenticated = true
    await flushPromises()

    expect(ratingSpy).toHaveBeenCalledWith('work-1')
    expect(wrapper.find('.rating-control__clear').exists()).toBe(true)
    wrapper.unmount()
  })

  it('saves shelf status through saveBookShelf', async () => {
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
    const shelfSpy = vi.spyOn(booksApi, 'saveBookShelf').mockResolvedValue({
      id: 'shelf-1',
      user_id: 'user-1',
      work_id: 'work-1',
      status: 'reading',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/work/:workId', component: BookWorkView }],
    })
    await router.push('/books/work/work-1')
    await router.isReady()
    const wrapper = mount(BookWorkView, { global: { plugins: [router], stubs: { CommentSection: true } } })
    await flushPromises()

    const shelfSelect = wrapper.find('#shelf-status')
    expect(shelfSelect.exists()).toBe(true)
    await shelfSelect.find('.p-select-trigger').trigger('click')
    await flushPromises()

    const readingOption = shelfSelect.findAll('.p-select-option').find(opt => opt.text().includes('在读'))
    expect(readingOption).toBeDefined()
    await readingOption!.trigger('click')
    await flushPromises()

    const shelfButton = wrapper.findAll('button').find(b => b.text().includes('加入书架'))
    expect(shelfButton).toBeDefined()
    await shelfButton!.trigger('click')
    await flushPromises()

    expect(shelfSpy).toHaveBeenCalledWith('work-1', 'reading')
    expect(wrapper.text()).toContain('书架状态已保存')
    wrapper.unmount()
  })

  it('submits short review through saveBookReview', async () => {
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
    const reviewSpy = vi.spyOn(booksApi, 'saveBookReview').mockResolvedValue({
      id: 'review-new',
      user_id: 'user-1',
      work_id: 'work-1',
      content: '很棒的一本书',
      spoiler: false,
      visibility: 'public',
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/work/:workId', component: BookWorkView }],
    })
    await router.push('/books/work/work-1')
    await router.isReady()
    const wrapper = mount(BookWorkView, { global: { plugins: [router], stubs: { CommentSection: true } } })
    await flushPromises()

    const reviewTextarea = wrapper.find('#book-review')
    expect(reviewTextarea.exists()).toBe(true)
    await reviewTextarea.setValue('很棒的一本书')

    await wrapper.find('form.books-review-editor').trigger('submit')
    await flushPromises()

    expect(reviewSpy).toHaveBeenCalledWith('work-1', {
      content: '很棒的一本书',
      spoiler: false,
      visibility: 'public',
    })
    expect(wrapper.text()).toContain('书评已发布')
    wrapper.unmount()
  })
})

describe('BookEditionView', () => {
  it('renders edition metadata facts and sources', async () => {
    vi.spyOn(booksApi, 'getPublicBookEdition').mockResolvedValue({
      edition: {
        id: 'edition-1',
        work_id: 'work-1',
        title: 'Edition Title',
        publisher: 'Test Press',
        isbn10: '1234567890',
        isbn13: '9781234567890',
        language: 'chi',
        page_count: 320,
        binding: '平装',
      },
      work: {
        id: 'work-1',
        title: 'Work Title',
        lifecycle_status: 'active',
      },
      sources: [
        { url: 'https://example.com/source', title: 'Example Source' },
      ],
    })

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/edition/:editionId', component: BookEditionView }],
    })
    await router.push('/books/edition/edition-1')
    await router.isReady()
    const wrapper = mount(BookEditionView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Edition Title')
    expect(wrapper.text()).toContain('Work Title')
    expect(wrapper.text()).toContain('Test Press')
    expect(wrapper.text()).toContain('9781234567890')
    expect(wrapper.text()).toContain('中文')
    expect(wrapper.text()).toContain('320 页')
    expect(wrapper.text()).toContain('平装')
    expect(wrapper.find('a[href="https://example.com/source"]').exists()).toBe(true)
    expect(wrapper.find('.books-detail__back').exists()).toBe(true)
    wrapper.unmount()
  })
})
