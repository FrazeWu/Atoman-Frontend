import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookReaderSidebar from '@/components/books/BookReaderSidebar.vue'

describe('BookReaderSidebar', () => {
  it('renders tabs and switches between thumbnails, outline, and bookmarks', async () => {
    const wrapper = mount(BookReaderSidebar, {
      props: {
        totalPages: 3,
        currentPage: 2,
        toc: [
          { href: '#ch1', label: '第 1 章 序言', depth: 0 },
          { href: '#ch2', label: '第 2 章 开端', depth: 1 },
        ],
        bookmarks: [
          { id: 'b-1', label: '第 2 页标记', reading_percent: 0.5, created_at: '2026-10-13' },
        ],
      },
    })

    const tabs = wrapper.findAll('.book-reader-sidebar__tab')
    expect(tabs.length).toBe(4)

    // Initially thumbnails tab is active
    expect(wrapper.find('.book-reader-sidebar__pane--thumbnails').isVisible()).toBe(true)
    const thumbnailItems = wrapper.findAll('.book-thumbnail-item')
    expect(thumbnailItems.length).toBe(3)
    expect(thumbnailItems[1].classes()).toContain('is-active')

    // Switch to Outline tab
    await tabs[1].trigger('click')
    expect(wrapper.find('.book-reader-sidebar__pane--outline').isVisible()).toBe(true)
    const tocItems = wrapper.findAll('.book-reader-sidebar__toc-item')
    expect(tocItems.length).toBe(2)
    expect(tocItems[0].text()).toContain('第 1 章 序言')

    // Click TOC item
    await tocItems[0].trigger('click')
    expect(wrapper.emitted('toc-select')?.[0]).toEqual(['#ch1'])

    // Switch to Bookmarks tab
    await tabs[2].trigger('click')
    expect(wrapper.find('.book-reader-sidebar__pane--bookmarks').isVisible()).toBe(true)
    expect(wrapper.text()).toContain('第 2 页标记')

    // Switch to Annotations tab
    await tabs[3].trigger('click')
    expect(wrapper.find('.book-reader-sidebar__pane--annotations').isVisible()).toBe(true)

    // Trigger bookmark jump and remove
    await wrapper.find('.book-reader-sidebar__bookmark-jump').trigger('click')
    expect(wrapper.emitted('bookmark-jump')?.[0]).toBeDefined()

    await wrapper.find('.book-reader-sidebar__bookmark-remove').trigger('click')
    expect(wrapper.emitted('bookmark-remove')?.[0]).toEqual(['b-1'])
  })
})
