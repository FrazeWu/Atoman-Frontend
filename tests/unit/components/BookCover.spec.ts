import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BookCover from '@/components/books/BookCover.vue'

afterEach(() => vi.unstubAllEnvs())

describe('BookCover', () => {
  it('uses the shared proxy, retries the original image, then shows a fallback', async () => {
    vi.stubEnv('PROD', 'true')
    const source = 'https://covers.openlibrary.org/b/id/123-M.jpg'
    const wrapper = mount(BookCover, { props: { src: source, title: '书籍' } })
    expect(wrapper.get('img').attributes('src')).toContain('/media/image?')
    expect(wrapper.get('img').attributes('loading')).toBe('lazy')
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toBe(source)
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    await wrapper.setProps({ src: 'https://covers.openlibrary.org/b/id/456-M.jpg' })
    expect(wrapper.get('img').attributes('src')).toContain('/media/image?')
    wrapper.unmount()
  })

  it('loads visible covers immediately without waiting for lazy loading', () => {
    const wrapper = mount(BookCover, { props: { src: 'https://example.test/cover.jpg', title: '书籍', eager: true } })
    expect(wrapper.get('img').attributes('loading')).toBe('eager')
    expect(wrapper.get('img').attributes('decoding')).toBe('async')
    wrapper.unmount()
  })

  it('renders designed typography cover for abstract books (variant="work")', () => {
    const wrapper = mount(BookCover, {
      props: {
        variant: 'work',
        title: '理想国',
        subtitle: '国家篇',
        author: '柏拉图',
      },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.book-cover__work-canvas').exists()).toBe(true)
    expect(wrapper.text()).toContain('理想国')
    expect(wrapper.text()).toContain('国家篇')
    expect(wrapper.text()).toContain('柏拉图')
    wrapper.unmount()
  })

  it('renders 2B modern minimalist fallback when concrete book has no cover image', () => {
    const wrapper = mount(BookCover, {
      props: {
        variant: 'edition',
        title: 'Analyzing Quantitative Data',
        author: 'Norman Blaikie',
        category: 'METHODOLOGY',
      },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.book-cover__fallback-modern').exists()).toBe(true)
    expect(wrapper.text()).toContain('Analyzing Quantitative Data')
    expect(wrapper.text()).toContain('Norman Blaikie')
    expect(wrapper.text()).toContain('METHODOLOGY')
    wrapper.unmount()
  })
})
