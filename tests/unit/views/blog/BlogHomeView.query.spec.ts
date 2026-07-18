import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogHomeView from '@/views/blog/BlogHomeView.vue'

const mocks = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string>,
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mocks.routeQuery,
  }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { template: '<a><slot /></a>' },
}))

describe('BlogHomeView query search', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.routeQuery = {}
  })

  it('passes route query q to blog posts requests', async () => {
    mocks.routeQuery = { q: 'atom' }
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
          PSegmentedControl: true,
        },
      },
    })

    await flushPromises()

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedUrls).toContain('/api/v1/blog/posts?page=1&page_size=20&q=atom')
    expect(requestedUrls.some((url) => url.includes('/blog/explore'))).toBe(false)
  })
})
