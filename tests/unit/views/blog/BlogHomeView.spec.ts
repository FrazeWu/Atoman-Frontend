import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogHomeView from '@/views/blog/BlogHomeView.vue'

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
}))

describe('BlogHomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads latest posts from feed explore instead of the removed timeline explore endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
    expect(requestedUrls).toContain('/api/v1/feed/explore?page=1&limit=12')
    expect(requestedUrls.some((url) => url.includes('/feed/explore/timeline'))).toBe(false)
  })
})
