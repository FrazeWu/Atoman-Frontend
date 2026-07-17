import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BookmarkView from '@/views/blog/BookmarkView.vue'
import { useAuthStore } from '@/stores/auth'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
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
})
