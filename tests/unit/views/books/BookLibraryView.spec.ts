import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BookLibraryView from '@/views/books/BookLibraryView.vue'
import * as booksApi from '@/api/books'

const mockPush = vi.fn()
vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')
  return {
    ...actual,
    useRouter: () => ({ push: mockPush }),
  }
})

describe('BookLibraryView', () => {
  const mockShelves: booksApi.BookShelfListResult = {
    items: [
      {
        id: 'shelf-1',
        work_id: 'work-1',
        status: 'reading',
        updated_at: '2026-10-15T10:00:00Z',
        work: {
          id: 'work-1',
          title: '百年孤独',
          lifecycle_status: 'published',
          rating_score: 9.3,
          rating_count: 1200,
          authors: [{ id: 'a1', name: '加西亚·马尔克斯', role: 'author' }],
          editions: [],
        },
      },
      {
        id: 'shelf-2',
        work_id: 'work-2',
        status: 'want_to_read',
        updated_at: '2026-10-14T10:00:00Z',
        work: {
          id: 'work-2',
          title: '悉达多',
          lifecycle_status: 'published',
          rating_score: 9.1,
          rating_count: 850,
          authors: [{ id: 'a2', name: '赫尔曼·黑塞', role: 'author' }],
          editions: [],
        },
      },
    ],
    total: 2,
    limit: 20,
    offset: 0,
  }

  const mockContinueItems: booksApi.BookContinueReading[] = [
    {
      asset_id: 'asset-1',
      title: '百年孤独',
      author: '加西亚·马尔克斯',
      file_name: 'hundred-years.epub',
      format: 'epub',
      processing_status: 'private_available',
      reading_percent: 0.35,
      last_read_at: '2026-10-15T09:00:00Z',
    },
  ]

  const mockImports: booksApi.BookImportSession[] = [
    {
      id: 'import-1',
      title: '三体',
      author: '刘慈欣',
      file_name: 'three-body.epub',
      format: 'epub',
      content_type: 'application/epub+zip',
      size: 1048576,
      status: 'uploaded',
      processing_status: 'private_available',
      asset_id: 'asset-three-body',
      completed_parts: [],
      expires_at: '2026-11-01T00:00:00Z',
      part_size: 1024,
    },
  ]

  const mockNotes: booksApi.BookAnnotationListResult = {
    items: [
      {
        id: 'note-1',
        asset_id: 'asset-1',
        format: 'epub',
        text: '无论走到哪里，都应该记住，过去都是假的',
        color: 'yellow',
        style: 'highlight',
        created_at: '2026-10-15T09:10:00Z',
        updated_at: '2026-10-15T09:10:00Z',
      },
    ],
    total: 1,
  }

  beforeEach(() => {
    vi.spyOn(booksApi, 'listBookShelf').mockResolvedValue(mockShelves)
    vi.spyOn(booksApi, 'listContinueReading').mockResolvedValue(mockContinueItems)
    vi.spyOn(booksApi, 'listBookImports').mockResolvedValue(mockImports)
    vi.spyOn(booksApi, 'listBookNotes').mockResolvedValue(mockNotes)
  })

  it('renders library overview, metrics, and continue reading hero card', async () => {
    const wrapper = mount(BookLibraryView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          BookCover: true,
          BookImportUploadModal: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('我的书架')
    expect(wrapper.text()).toContain('百年孤独')
    expect(wrapper.text()).toContain('加西亚·马尔克斯')
    expect(wrapper.text()).toContain('在读直达')
    expect(wrapper.text()).toContain('35%')
  })

  it('filters books by category tab', async () => {
    const wrapper = mount(BookLibraryView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          BookCover: true,
          BookImportUploadModal: true,
        },
      },
    })

    await flushPromises()

    // Click '想读' tab
    const wantToReadTab = wrapper.find('[data-tab="want_to_read"]')
    expect(wantToReadTab.exists()).toBe(true)
    await wantToReadTab.trigger('click')
    await flushPromises()

    const stream = wrapper.find('.book-library-stream')
    expect(stream.text()).toContain('悉达多')
    expect(stream.text()).not.toContain('百年孤独')
  })

  it('switches between grid and list views', async () => {
    const wrapper = mount(BookLibraryView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          BookCover: true,
          BookImportUploadModal: true,
        },
      },
    })

    await flushPromises()

    const listBtn = wrapper.find('[data-view="list"]')
    expect(listBtn.exists()).toBe(true)
    await listBtn.trigger('click')
    await flushPromises()

    expect(wrapper.find('.book-library-stream--list').exists()).toBe(true)
  })

  it('filters by search keyword', async () => {
    const wrapper = mount(BookLibraryView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          BookCover: true,
          BookImportUploadModal: true,
        },
      },
    })

    await flushPromises()

    const searchInput = wrapper.find<HTMLInputElement>('[data-testid="library-search"]')
    expect(searchInput.exists()).toBe(true)
    await searchInput.setValue('黑塞')
    await flushPromises()

    const stream = wrapper.find('.book-library-stream')
    expect(stream.text()).toContain('悉达多')
    expect(stream.text()).not.toContain('百年孤独')
  })
})
