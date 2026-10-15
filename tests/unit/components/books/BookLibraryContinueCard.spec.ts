import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BookLibraryContinueCard from '@/components/books/BookLibraryContinueCard.vue'
import type { BookContinueReading } from '@/api/books'

describe('BookLibraryContinueCard', () => {
  const mockContinueItem: BookContinueReading = {
    asset_id: 'asset-123',
    title: '悉达多',
    author: '赫尔曼·黑塞',
    file_name: 'siddhartha.epub',
    format: 'epub',
    processing_status: 'private_available',
    reading_percent: 0.42,
    last_read_at: '2026-10-15T10:30:00Z',
  }

  it('renders continue reading book with title, author, and progress percent', () => {
    const wrapper = mount(BookLibraryContinueCard, {
      props: {
        item: mockContinueItem,
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

    expect(wrapper.text()).toContain('悉达多')
    expect(wrapper.text()).toContain('赫尔曼·黑塞')
    expect(wrapper.text()).toContain('42%')
    expect(wrapper.text()).toContain('继续阅读')
  })

  it('emits read event when clicking continue reading button', async () => {
    const wrapper = mount(BookLibraryContinueCard, {
      props: {
        item: mockContinueItem,
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

    const readBtn = wrapper.find('[data-action="continue-read"]')
    expect(readBtn.exists()).toBe(true)
    await readBtn.trigger('click')

    expect(wrapper.emitted('read')).toBeTruthy()
    expect(wrapper.emitted('read')![0]).toEqual(['asset-123'])
  })
})
