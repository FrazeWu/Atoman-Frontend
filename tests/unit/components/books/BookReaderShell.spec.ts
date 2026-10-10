import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import BookReaderShell from '@/components/books/BookReaderShell.vue'

describe('BookReaderShell', () => {
  it('统一渲染格式、进度、目录和分页操作', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/books/library', component: { template: '<div />' } }],
    })
    await router.push('/books/library')
    await router.isReady()

    const wrapper = mount(BookReaderShell, {
      global: { plugins: [router] },
      props: {
        title: '测试书籍',
        subtitle: 'test.pdf · 可以阅读',
        format: 'pdf',
        progress: 0.42,
        pageLabel: '第 1 / 2 页',
        backTo: '/books/library',
        backLabel: '返回我的书库',
        showPagination: true,
        toc: [{ href: 'chapter-1', label: '第一章', depth: 0 }],
      },
      slots: {
        actions: '<button type="button">保存</button>',
        default: '<div data-reader-content>正文</div>',
      },
    })

    expect(wrapper.text()).toContain('PDF')
    expect(wrapper.text()).toContain('42%')
    expect(wrapper.text()).toContain('第 1 / 2 页')
    expect(wrapper.text()).toContain('第一章')
    expect(wrapper.find('[aria-label="返回我的书库"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="上一页"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="下一页"]').exists()).toBe(true)

    await wrapper.find('[aria-label="上一页"]').trigger('click')
    await wrapper.find('[aria-label="下一页"]').trigger('click')
    await wrapper.find('.book-reader-shell__toc button').trigger('click')

    expect(wrapper.emitted('previous')).toHaveLength(1)
    expect(wrapper.emitted('next')).toHaveLength(1)
    expect(wrapper.emitted('toc-select')).toEqual([['chapter-1']])
  })
})
