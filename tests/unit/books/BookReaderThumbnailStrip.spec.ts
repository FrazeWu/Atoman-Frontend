import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookReaderThumbnailStrip from '@/components/books/BookReaderThumbnailStrip.vue'

describe('BookReaderThumbnailStrip', () => {
  it('renders page thumbnails properly', () => {
    const wrapper = mount(BookReaderThumbnailStrip, {
      props: {
        totalPages: 5,
        currentPage: 2,
      },
    })

    const items = wrapper.findAll('.book-thumbnail-item')
    expect(items.length).toBe(5)
    expect(items[1].classes()).toContain('is-active')
  })

  it('emits select-page when page is clicked', async () => {
    const wrapper = mount(BookReaderThumbnailStrip, {
      props: {
        totalPages: 5,
        currentPage: 1,
      },
    })

    const items = wrapper.findAll('.book-thumbnail-item')
    await items[3].trigger('click')

    expect(wrapper.emitted('select-page')).toBeTruthy()
    expect(wrapper.emitted('select-page')?.[0]).toEqual([4])
  })
})
