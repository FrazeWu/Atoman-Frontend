import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import BookAcademicReaderView from '@/views/books/BookAcademicReaderView.vue'

describe('BookAcademicReaderView 学术沉浸阅读器', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/books/read/sample', component: BookAcademicReaderView },
        { path: '/books', component: { template: '<div>书库</div>' } },
      ],
    })
    await router.push('/books/read/sample')
    await router.isReady()
  })

  it('成功渲染《Analyzing Quantitative Data》书籍标题、作者与章节', async () => {
    const wrapper = mount(BookAcademicReaderView, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('Analyzing Quantitative Data')
    expect(wrapper.text()).toContain('Norman Blaikie')
    expect(wrapper.text()).toContain('Introduction: About the Book')
    expect(wrapper.text()).toContain('Why was it Written?')
  })

  it('支持上一节/下一节翻页切换', async () => {
    const wrapper = mount(BookAcademicReaderView, {
      global: { plugins: [router] },
    })

    // 默认在第 1 节（Introduction）
    expect(wrapper.text()).toContain('Introduction: About the Book')

    // 点击下一节
    const nextBtn = wrapper.find('button[title="下一章 / 下一页"]')
    expect(nextBtn.exists()).toBe(true)
    await nextBtn.trigger('click')
    await flushPromises()

    // 切换到第 2 节（Chapter 1）
    expect(wrapper.text()).toContain('Social Research and Data Analysis')
    expect(wrapper.text()).toContain('What is the Purpose of Social Research?')
  })

  it('支持切换纸张底色主题', async () => {
    const wrapper = mount(BookAcademicReaderView, {
      global: { plugins: [router] },
    })

    // 打开排版弹窗
    const aaBtn = wrapper.findAll('.academic-reader__btn').find(b => b.text().includes('Aa'))
    expect(aaBtn).toBeDefined()
    await aaBtn!.trigger('click')

    // 切换到羊皮纸主题
    const warmBtn = wrapper.findAll('.academic-reader__theme-btn').find(b => b.text().includes('羊皮纸'))
    expect(warmBtn).toBeDefined()
    await warmBtn!.trigger('click')

    expect(wrapper.classes()).toContain('theme-paper-warm')
  })

  it('支持书签添加与移除', async () => {
    const wrapper = mount(BookAcademicReaderView, {
      global: { plugins: [router] },
    })

    const bookmarkBtn = wrapper.find('button[title*="书签"]')
    expect(bookmarkBtn.exists()).toBe(true)

    // 添加/切换书签
    await bookmarkBtn.trigger('click')
    await flushPromises()

    // 再次点击移除
    await bookmarkBtn.trigger('click')
    await flushPromises()
  })

  it('支持目录项跳转指定章节', async () => {
    const wrapper = mount(BookAcademicReaderView, {
      global: { plugins: [router] },
    })

    const tocItem = wrapper.findAll('.academic-reader__toc-item').find(b => b.text().includes('What are data?'))
    expect(tocItem).toBeDefined()
    await tocItem!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Social Research and Data Analysis')
  })
})
