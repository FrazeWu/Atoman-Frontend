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
})
