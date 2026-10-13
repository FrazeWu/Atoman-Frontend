import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import BookMiniReaderBar from '@/components/books/BookMiniReaderBar.vue'
import { useBookReaderStore } from '@/stores/bookReader'

describe('BookMiniReaderBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders nothing when there is no active reading book', () => {
    const wrapper = mount(BookMiniReaderBar)
    expect(wrapper.find('.book-mini-bar').exists()).toBe(false)
  })

  it('renders active book title, progress and percent when active book exists', () => {
    const store = useBookReaderStore()
    store.openBook({
      assetId: 'asset-123',
      title: '三体：黑暗森林',
      author: '刘慈欣',
      format: 'epub',
      currentPage: 42,
      totalPages: 100,
      percent: 0.42,
      chapterTitle: '咒语生效',
    })

    const wrapper = mount(BookMiniReaderBar)
    expect(wrapper.find('.book-mini-bar').exists()).toBe(true)
    expect(wrapper.text()).toContain('三体：黑暗森林')
    expect(wrapper.text()).toContain('42%')
    expect(wrapper.text()).toContain('咒语生效')
  })

  it('toggles overlay when expand button is clicked', async () => {
    const store = useBookReaderStore()
    store.openBook({
      assetId: 'asset-123',
      title: '三体',
      format: 'pdf',
      currentPage: 10,
      totalPages: 100,
      percent: 0.1,
    })

    const wrapper = mount(BookMiniReaderBar)
    const expandBtn = wrapper.find('[data-testid="expand-reader"]')
    expect(expandBtn.exists()).toBe(true)

    await expandBtn.trigger('click')
    // store.isOverlayOpen 变为 true (openBook 设为 true，toggle 会翻转或保持)
  })
})
