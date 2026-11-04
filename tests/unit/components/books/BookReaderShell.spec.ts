import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BookReaderShell from '@/components/books/BookReaderShell.vue'

describe('BookReaderShell', () => {
  beforeEach(() => { vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280) })
  afterEach(() => vi.restoreAllMocks())

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
        backLabel: '返回书架',
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
    expect(wrapper.find('[aria-label="返回书架"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="上一页"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="下一页"]').exists()).toBe(true)

    await wrapper.find('[aria-label="上一页"]').trigger('click')
    await wrapper.find('[aria-label="下一页"]').trigger('click')
    await wrapper.find('.book-reader-shell__toc button').trigger('click')

    expect(wrapper.emitted('previous')).toHaveLength(1)
    expect(wrapper.emitted('next')).toHaveLength(1)
    expect(wrapper.emitted('toc-select')).toEqual([['chapter-1']])
  })

  it('窄桌面默认收起设置而仍能随时打开', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/books', component: { template: '<div />' } }] })
    await router.push('/books')
    await router.isReady()
    const wrapper = mount(BookReaderShell, {
      global: { plugins: [router] },
      props: { title: '适配宽度', backTo: '/books', format: 'pdf' },
      slots: { settings: '<div>显示设置面板</div>', sidebar: '<div>章节目录</div>' },
    })
    expect(wrapper.find('aside[aria-label="显示设置"]').exists()).toBe(false)
    await wrapper.find('button[aria-label="切换导览侧栏"]').trigger('click')
    expect(wrapper.find('.book-reader-shell__sidebar-wrapper').exists()).toBe(false)
    await wrapper.find('button[aria-label="切换导览侧栏"]').trigger('click')
    expect(wrapper.find('.book-reader-shell__sidebar-wrapper').exists()).toBe(true)
    const setting = wrapper.findAll('.book-reader-shell__panel-tabs button').find(item => item.text().includes('显示设置'))
    expect(setting).toBeDefined()
    await setting!.trigger('click')
    expect(wrapper.find('aside[aria-label="显示设置"]').exists()).toBe(true)
    await wrapper.find('button[aria-label="关闭阅读工具"]').trigger('click')
    expect(wrapper.find('aside[aria-label="显示设置"]').exists()).toBe(false)
  })

  it('将显示设置和目录工具放入可切换侧栏', async () => {
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
        format: 'epub',
        backTo: '/books/library',
        backLabel: '返回书架',
        toc: [{ href: 'chapter-1', label: '第一章', depth: 0 }],
      },
      slots: {
        settings: '<div data-reader-settings>字号与主题</div>',
        tools: '<div data-reader-tools>书签列表</div>',
      },
    })

    expect(wrapper.find('[data-reader-settings]').isVisible()).toBe(true)
    await wrapper.find('button[aria-pressed="false"]').trigger('click')
    expect(wrapper.find('[data-reader-tools]').isVisible()).toBe(true)
    expect(wrapper.find('.book-reader-shell__toc button').text()).toBe('第一章')
    await wrapper.find('button[aria-pressed="false"]').trigger('click')
    expect(wrapper.find('[data-reader-settings]').isVisible()).toBe(true)
  })
})
