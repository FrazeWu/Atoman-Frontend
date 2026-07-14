import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogHomeView from '@/views/blog/BlogHomeView.vue'

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

describe('BlogHomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads latest posts from blog explore', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )

    mount(BlogHomeView, {
      global: {
        stubs: {
          PAvatar: true,
          PBadge: true,
          PButton: true,
          PClip: true,
          PEmpty: true,
          PEntry: true,
          PPageHeader: true,
          PTab: true,
        },
      },
    })

    await flushPromises()

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedUrls).toContain('/api/v1/blog/posts?page=1&page_size=20&sort=latest')
  })

  it('renders flat post DTOs returned by the blog list endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({
        data: [{ id: 'post-1', title: '真实文章', summary: '摘要', likes_count: 3, comments_count: 2 }],
        meta: { page: 1, page_size: 20, total: 1, has_more: false },
      }), { status: 200 }),
    )

    const wrapper = mount(BlogHomeView, {
      global: {
        stubs: {
          PAvatar: true,
          PBadge: true,
          PButton: true,
          PClip: true,
          PEmpty: true,
          PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
          PPageHeader: true,
          PSegmentedControl: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('真实文章')
  })

  it('loads hot posts from blog recommendation endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )

    const wrapper = mount(BlogHomeView, {
      global: {
        stubs: {
          PAvatar: true,
          PBadge: true,
          PButton: true,
          PClip: true,
          PEmpty: true,
          PEntry: true,
          PPageHeader: true,
          PTab: {
            props: ['label', 'active'],
            template: '<button class="p-tab" @click="$emit(\'click\')">{{ label }}</button>',
          },
        },
      },
    })

    await flushPromises()

    const hotTab = wrapper.findAll('.p-tab').find((tab) => tab.text() === '最热')
    expect(hotTab).toBeDefined()
    await hotTab?.trigger('click')
    await flushPromises()

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedUrls).toContain('/api/v1/blog/recommend/posts?mode=hot&page=1&page_size=20')
  })
})
