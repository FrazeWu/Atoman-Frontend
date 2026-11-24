import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogCollectionsView from '@/views/blog/BlogCollectionsView.vue'
import { useAuthStore } from '@/stores/auth'

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

async function mountCollectionsView(initialPath = '/posts/collections') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/posts/collections', component: BlogCollectionsView },
      { path: '/posts/collection/:id', component: { template: '<div>Collection Detail</div>' } },
      { path: '/posts/channel/:slug', component: { template: '<div>Channel Detail</div>' } },
    ],
  })
  await router.push(initialPath)
  await router.isReady()

  const wrapper = mount(BlogCollectionsView, {
    global: {
      plugins: [router],
      stubs: {
        PPageHeader: { props: ['title', 'sub'], template: '<header><h1>{{ title }}</h1><p>{{ sub }}</p></header>' },
        PButton: { props: ['to'], template: '<button><slot /></button>' },
        PEmpty: { props: ['title', 'description'], template: '<div>{{ title }} - {{ description }}</div>' },
        PInput: {
          props: ['modelValue', 'placeholder'],
          emits: ['update:modelValue'],
          template: '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        PSelect: { props: ['modelValue', 'options'], template: '<select />' },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

describe('BlogCollectionsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.isAuthenticated = false
  })

  it('renders collections fetched from channels and supports navigating to detail', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/blog/channels/ch-1/collections')) {
        return makeJsonResponse({
          data: [
            {
              id: 'col-1',
              channel_id: 'ch-1',
              name: '分布式架构演进与实践',
              description: '深度复盘架构设计',
              is_default: false,
            },
          ],
        })
      }

      if (url.includes('/blog/channels')) {
        return makeJsonResponse({
          data: [
            {
              id: 'ch-1',
              name: '技术架构专栏',
              slug: 'tech-arch',
            },
          ],
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { wrapper, router } = await mountCollectionsView()

    expect(wrapper.text()).toContain('合集')
    expect(wrapper.text()).toContain('探索专题专栏与深度系列内容')
    expect(wrapper.text()).toContain('分布式架构演进与实践')
    expect(wrapper.text()).toContain('技术架构专栏')

    // Click on collection entry card
    const card = wrapper.find('.collection-entry-card')
    expect(card.exists()).toBe(true)
    await card.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/posts/collection/col-1')
  })

  it('supports filtering collections by search keyword', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/blog/channels/ch-1/collections')) {
        return makeJsonResponse({
          data: [
            { id: 'col-1', channel_id: 'ch-1', name: 'Vue 3 原理剖析', description: '响应式源码解析' },
            { id: 'col-2', channel_id: 'ch-1', name: 'Go 并发模型', description: '深入 GMP 调度器' },
          ],
        })
      }

      if (url.includes('/blog/channels')) {
        return makeJsonResponse({
          data: [{ id: 'ch-1', name: '核心开发', slug: 'core-dev' }],
        })
      }

      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { wrapper } = await mountCollectionsView()

    expect(wrapper.text()).toContain('Vue 3 原理剖析')
    expect(wrapper.text()).toContain('Go 并发模型')

    const input = wrapper.find('input')
    await input.setValue('Vue')
    await flushPromises()

    expect(wrapper.text()).toContain('Vue 3 原理剖析')
    expect(wrapper.text()).not.toContain('Go 并发模型')
  })
})
