import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BookmarkView from '@/views/blog/BookmarkView.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useRoute: () => ({
    query: {},
  }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}))

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('BookmarkView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.token = 'token'
    auth.user = { uuid: 'user-1', username: 'demo' } as never
    auth.isAuthenticated = true
  })

  it('默认按最新请求收藏，并可切换到最热', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/bookmark-folders')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/bookmarks')) {
        return makeJsonResponse({ data: [] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(BookmarkView)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/blog/bookmarks?sort=latest'),
      expect.anything(),
    )

    const popularButton = wrapper.findAll('button').find((button) => button.text() === '最热')
    expect(popularButton).toBeTruthy()
    await popularButton!.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/blog/bookmarks?sort=popular'),
      expect.anything(),
    )
  })

  it('支持在收藏中切换到合集分栏并加载专栏合集', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/bookmark-folders')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/bookmarks')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/blog/channels/ch-1/collections')) {
        return makeJsonResponse({
          data: [
            {
              id: 'col-1',
              name: 'Vue 3 与 Cupertino 架构探索',
              description: '深入前端与客户端设计体系',
              channel_id: 'ch-1',
              is_default: false,
            },
          ],
        })
      }
      if (url.includes('/blog/channels')) {
        return makeJsonResponse({
          data: [{ id: 'ch-1', name: '深度技术专栏', slug: 'tech' }],
        })
      }
      if (url.includes('/blog/collections')) {
        return makeJsonResponse({ data: [] })
      }
      if (url.includes('/feed/subscriptions')) {
        return makeJsonResponse({ data: [] })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(BookmarkView)
    await flushPromises()

    const collectionTabButton = wrapper.findAll('button').find((button) => button.text() === '合集')
    expect(collectionTabButton).toBeTruthy()
    await collectionTabButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Vue 3 与 Cupertino 架构探索')
    expect(wrapper.text()).toContain('深度技术专栏')
  })
})
