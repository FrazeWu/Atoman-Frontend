import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import * as booksApi from '@/api/books'
import { useDraftStagingStore } from '@/stores/draftStaging'
import { useToast } from '@/composables/useToast'
import BookNotesView from '@/views/books/BookNotesView.vue'
import type { BookAnnotation } from '@/api/books'

const mockNotes: BookAnnotation[] = [
  {
    id: 'ann-1',
    asset_id: 'asset-1',
    book_title: '百年孤独',
    book_author: '加西亚·马尔克斯',
    format: 'epub',
    epub_cfi: 'epubcfi(/6/4[chap01]!/4/2/10/1:0)',
    text: '多年以后，面对行刑队，奥雷里亚诺·布恩迪亚上校将会回想起父亲带他去见识冰块的那个遥远的下午。',
    color: 'yellow',
    style: 'highlight',
    note: '开篇名作之壁',
    chapter_title: '第一章',
    created_at: '2026-10-14T10:00:00Z',
    updated_at: '2026-10-14T10:00:00Z',
  },
  {
    id: 'ann-2',
    asset_id: 'asset-2',
    book_title: '三体',
    book_author: '刘慈欣',
    format: 'txt',
    text: '给岁月以文明，而不是给文明以岁月。',
    color: 'blue',
    style: 'highlight',
    created_at: '2026-10-14T11:00:00Z',
    updated_at: '2026-10-14T11:00:00Z',
  },
]

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="typeof to === \'string\' ? to : to?.path"><slot /></a>',
}

describe('BookNotesView', () => {
  let router: ReturnType<typeof createRouter>
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/books/notes', component: BookNotesView },
        { path: '/books', component: { template: '<div>Books</div>' } },
        { path: '/books/read/:assetId', component: { template: '<div>Reader</div>' } },
        { path: '/studio/blog/new', component: { template: '<div>Editor</div>' } },
        { path: '/posts/notes/new', component: { template: '<div>ShortNote</div>' } },
      ],
    })
  })

  const mountView = () => {
    return mount(BookNotesView, {
      global: {
        plugins: [router, pinia],
        stubs: {
          RouterLink: RouterLinkStub,
          Teleport: true,
        },
      },
    })
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls listBookNotes() on mount', async () => {
    const listSpy = vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: mockNotes,
      total: 2,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    expect(listSpy).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders note cards with quote text, personal note, book title, and color indicator', async () => {
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: mockNotes,
      total: 2,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const cards = wrapper.findAll('.book-note-card')
    expect(cards).toHaveLength(2)

    // First card details
    const firstCard = cards[0]
    expect(firstCard.text()).toContain('百年孤独')
    expect(firstCard.text()).toContain('加西亚·马尔克斯')
    expect(firstCard.text()).toContain('多年以后，面对行刑队，奥雷里亚诺·布恩迪亚上校将会回想起父亲带他去见识冰块的那个遥远的下午。')
    expect(firstCard.text()).toContain('开篇名作之壁')
    expect(firstCard.text()).toContain('第一章')

    // Color indicator
    const stripe = firstCard.find('.book-note-card__stripe')
    expect(stripe.exists()).toBe(true)
    expect(stripe.attributes('data-color')).toBe('yellow')

    // Second card details
    const secondCard = cards[1]
    expect(secondCard.text()).toContain('三体')
    expect(secondCard.text()).toContain('刘慈欣')
    expect(secondCard.text()).toContain('给岁月以文明，而不是给文明以岁月。')
    expect(secondCard.find('.book-note-card__stripe').attributes('data-color')).toBe('blue')

    wrapper.unmount()
  })

  it('search triggers search query filter', async () => {
    const listSpy = vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: mockNotes,
      total: 2,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const searchInput = wrapper.find('[data-testid="notes-search-input"]')
    expect(searchInput.exists()).toBe(true)

    await searchInput.setValue('三体')
    await searchInput.trigger('keydown.enter')
    await flushPromises()

    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        q: '三体',
      }),
    )

    wrapper.unmount()
  })

  it('filters by has_note when "仅看有想法" toggle is activated', async () => {
    const listSpy = vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: [mockNotes[0]],
      total: 1,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const toggle = wrapper.find('[data-testid="notes-has-note-toggle"]')
    expect(toggle.exists()).toBe(true)

    await toggle.trigger('click')
    await flushPromises()

    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        has_note: true,
      }),
    )

    wrapper.unmount()
  })

  it('copies formatted citation to clipboard when clicking "复制引用"', async () => {
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: mockNotes,
      total: 2,
    })

    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const copyBtn = wrapper.find('[data-testid="copy-citation-ann-1"]')
    expect(copyBtn.exists()).toBe(true)

    await copyBtn.trigger('click')

    const expectedCitation = '“多年以后，面对行刑队，奥雷里亚诺·布恩迪亚上校将会回想起父亲带他去见识冰块的那个遥远的下午。” —— 《百年孤独》'
    expect(writeTextMock).toHaveBeenCalledWith(expectedCitation)
    const toast = useToast()
    expect(toast.toasts.value.some((t) => t.message === '引用已复制' && t.type === 'success')).toBe(true)

    wrapper.unmount()
  })

  it('formats all notes into markdown download when clicking "批量导出"', async () => {
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: mockNotes,
      total: 2,
    })

    let createdBlob: Blob | null = null
    const createObjectURLMock = vi.fn((blob: Blob) => {
      createdBlob = blob
      return 'blob:http://localhost/mock-notes.md'
    })
    const revokeObjectURLMock = vi.fn()
    window.URL.createObjectURL = createObjectURLMock
    window.URL.revokeObjectURL = revokeObjectURLMock

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const exportBtn = wrapper.find('[data-testid="notes-batch-export"]')
    expect(exportBtn.exists()).toBe(true)

    await exportBtn.trigger('click')

    expect(createObjectURLMock).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()

    // Verify blob content contains markdown notes
    expect(createdBlob).not.toBeNull()
    if (createdBlob) {
      const text = await (createdBlob as Blob).text()
      expect(text).toContain('百年孤独')
      expect(text).toContain('开篇名作之壁')
      expect(text).toContain('三体')
      expect(text).toContain('给岁月以文明，而不是给文明以岁月。')
    }

    clickSpy.mockRestore()
    wrapper.unmount()
  })

  it('"阅读原文" link points to /books/read/:assetId?annotationId=...', async () => {
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: mockNotes,
      total: 2,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const readLink = wrapper.find('[data-testid="read-original-ann-1"]')
    expect(readLink.exists()).toBe(true)
    expect(readLink.attributes('href')).toBe('/books/read/asset-1?annotationId=ann-1')

    wrapper.unmount()
  })

  it('calls deleteBookAnnotation and updates list when clicking "删除"', async () => {
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: [...mockNotes],
      total: 2,
    })
    const deleteSpy = vi.spyOn(booksApi, 'deleteBookAnnotation').mockResolvedValue({
      deleted: true,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const deleteBtn = wrapper.find('[data-testid="delete-note-ann-1"]')
    expect(deleteBtn.exists()).toBe(true)

    await deleteBtn.trigger('click')
    await flushPromises()

    const confirmBtn = wrapper.findAll('button').find(b => b.text().trim() === '删除' && b.classes().includes('p-button--danger'))
    expect(confirmBtn).toBeDefined()
    await confirmBtn!.trigger('click')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith('ann-1')
    expect(wrapper.findAll('.book-note-card')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('百年孤独')
    expect(wrapper.text()).toContain('三体')

    wrapper.unmount()
  })

  it('does not delete note when clicking "取消" in confirmation dialog', async () => {
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: [...mockNotes],
      total: 2,
    })
    const deleteSpy = vi.spyOn(booksApi, 'deleteBookAnnotation').mockResolvedValue({
      deleted: true,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const deleteBtn = wrapper.find('[data-testid="delete-note-ann-1"]')
    await deleteBtn.trigger('click')
    await flushPromises()

    const cancelBtn = wrapper.findAll('button').find(b => b.text().trim() === '取消' && b.classes().includes('p-button--secondary'))
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')
    await flushPromises()

    expect(deleteSpy).not.toHaveBeenCalled()
    expect(wrapper.findAll('.book-note-card')).toHaveLength(2)
    wrapper.unmount()
  })

  it('renders empty state when list is empty', async () => {
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: [],
      total: 0,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const empty = wrapper.find('.books-notes-empty')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toContain('暂无读书笔记，前往书架或阅读器开始划线 →')

    const link = empty.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/books')

    wrapper.unmount()
  })

  it('opens quote modal and stores pending quote in draftStagingStore upon selection', async () => {
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: mockNotes,
      total: 2,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const quoteBtn = wrapper.find('[data-testid="quote-action-ann-1"]')
    expect(quoteBtn.exists()).toBe(true)
    await quoteBtn.trigger('click')

    const modal = wrapper.findComponent({ name: 'BookQuoteActionModal' })
    expect(modal.exists()).toBe(true)
    expect(modal.props('open')).toBe(true)
    expect(modal.props('item')).toEqual(mockNotes[0])

    modal.vm.$emit('select', { target: 'blog_post', mode: 'append' })
    await flushPromises()

    const draftStore = useDraftStagingStore()
    expect(draftStore.pendingQuote?.quoteText).toBe(mockNotes[0].text)
    expect(draftStore.pendingQuote?.target).toBe('blog_post')
    expect(draftStore.pendingQuote?.mode).toBe('append')
    expect(router.currentRoute.value.path).toBe('/studio/blog/new')

    wrapper.unmount()
  })

  it('shows error toast when copy citation fails', async () => {
    const toast = useToast()
    toast.clear()

    const writeTextSpy = vi.fn().mockRejectedValue(new Error('Permission denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextSpy },
    })

    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue({
      items: mockNotes,
      total: 2,
    })

    await router.push('/books/notes')
    await router.isReady()
    const wrapper = mountView()
    await flushPromises()

    const copyBtn = wrapper.find('[data-testid="copy-citation-ann-1"]')
    expect(copyBtn.exists()).toBe(true)
    await copyBtn.trigger('click')
    await flushPromises()

    expect(toast.toasts.value.some((t) => t.message === '复制失败，请手动选中复制' && t.type === 'error')).toBe(true)

    wrapper.unmount()
  })
})
