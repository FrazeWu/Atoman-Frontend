import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import BookTagsView from '@/views/books/BookTagsView.vue'

describe('BookTagsView 书库标签与分类视图', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/books/tags', component: BookTagsView },
        { path: '/books', component: { template: '<div>发现书库</div>' } },
      ],
    })
    await router.push('/books/tags')
    await router.isReady()
  })

  it('正确渲染学科领域大类与精细流派标签', () => {
    const wrapper = mount(BookTagsView, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('哲学与思想')
    expect(wrapper.text()).toContain('历史与文明')
    expect(wrapper.text()).toContain('文学经典')
    expect(wrapper.text()).toContain('斯多葛哲学')
    expect(wrapper.text()).toContain('古希腊先哲')
  })

  it('支持即时检索过滤标签', async () => {
    const wrapper = mount(BookTagsView, {
      global: { plugins: [router] },
    })

    const input = wrapper.find('#tag-search')
    expect(input.exists()).toBe(true)

    await input.setValue('科幻')
    expect(wrapper.text()).toContain('硬科幻')
    expect(wrapper.text()).not.toContain('古希腊先哲')
  })

  it('点击标签可联动跳转到发现页进行筛选', async () => {
    const wrapper = mount(BookTagsView, {
      global: { plugins: [router] },
    })

    const tagBtn = wrapper.findAll('.book-tags__chip').find(b => b.text().includes('斯多葛哲学'))
    expect(tagBtn).toBeDefined()
    await tagBtn!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/books')
    expect(router.currentRoute.value.query.q).toBe('斯多葛哲学')
  })
})
