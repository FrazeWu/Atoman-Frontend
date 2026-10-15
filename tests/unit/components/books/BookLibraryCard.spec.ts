import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BookLibraryCard from '@/components/books/BookLibraryCard.vue'
import type { BookShelfItem, BookImportSession } from '@/api/books'

describe('BookLibraryCard', () => {
  const mockWorkItem: BookShelfItem = {
    id: 'shelf-1',
    work_id: 'work-100',
    status: 'reading',
    updated_at: '2026-10-15T12:00:00Z',
    work: {
      id: 'work-100',
      title: '百年孤独',
      lifecycle_status: 'published',
      rating_score: 9.3,
      rating_count: 1420,
      authors: [{ id: 'author-1', name: '加西亚·马尔克斯', role: 'author' }],
      editions: [{ id: 'ed-1', work_id: 'work-100', title: '百年孤独', publisher: '南海出版公司', cover_url: 'https://example.com/cover.jpg' }],
    },
  }

  const mockImportItem: BookImportSession = {
    id: 'import-1',
    title: '三体全集',
    author: '刘慈欣',
    file_name: 'three-body.epub',
    format: 'epub',
    content_type: 'application/epub+zip',
    size: 2048576,
    status: 'uploaded',
    processing_status: 'private_available',
    asset_id: 'asset-three-body',
    completed_parts: [],
    expires_at: '2026-11-01T00:00:00Z',
    part_size: 1024,
  }

  it('renders a public shelf work item in grid view', () => {
    const wrapper = mount(BookLibraryCard, {
      props: {
        item: mockWorkItem,
        viewMode: 'grid',
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          BookCover: {
            template: '<div class="book-cover-stub">{{ title }}</div>',
            props: ['title', 'src'],
          },
        },
      },
    })

    expect(wrapper.text()).toContain('百年孤独')
    expect(wrapper.text()).toContain('加西亚·马尔克斯')
    expect(wrapper.text()).toContain('在读')
  })

  it('renders a public shelf work item in list view', () => {
    const wrapper = mount(BookLibraryCard, {
      props: {
        item: mockWorkItem,
        viewMode: 'list',
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          BookCover: {
            template: '<div class="book-cover-stub">{{ title }}</div>',
            props: ['title', 'src'],
          },
        },
      },
    })

    expect(wrapper.classes()).toContain('book-library-card--list')
    expect(wrapper.text()).toContain('百年孤独')
    expect(wrapper.text()).toContain('9.3')
  })

  it('renders a local import item with format and availability badge', () => {
    const wrapper = mount(BookLibraryCard, {
      props: {
        item: mockImportItem,
        viewMode: 'grid',
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          BookCover: {
            template: '<div class="book-cover-stub">{{ title }}</div>',
            props: ['title'],
          },
        },
      },
    })

    expect(wrapper.text()).toContain('三体全集')
    expect(wrapper.text()).toContain('EPUB')
    expect(wrapper.text()).toContain('刘慈欣')
  })

  it('emits read when clicking read button', async () => {
    const wrapper = mount(BookLibraryCard, {
      props: {
        item: mockImportItem,
        viewMode: 'list',
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          BookCover: true,
        },
      },
    })

    const readBtn = wrapper.find('[data-action="read"]')
    expect(readBtn.exists()).toBe(true)
    await readBtn.trigger('click')

    expect(wrapper.emitted('read')).toBeTruthy()
    expect(wrapper.emitted('read')![0]).toEqual(['asset-three-body'])
  })

  it('emits delete when clicking remove button', async () => {
    const wrapper = mount(BookLibraryCard, {
      props: {
        item: mockWorkItem,
        viewMode: 'grid',
      },
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
          BookCover: true,
        },
      },
    })

    const deleteBtn = wrapper.find('[data-action="delete"]')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0]).toEqual(['work-100'])
  })
})
