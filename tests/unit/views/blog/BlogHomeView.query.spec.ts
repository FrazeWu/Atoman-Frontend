import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BlogHomeView from '@/views/blog/BlogHomeView.vue'

const route = reactive({ query: {} as Record<string, string> })

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const postResponse = (id: string) => new Response(JSON.stringify({
  data: [{ id, title: id, summary: `${id} summary` }],
  meta: { page: 1, page_size: 20, total: 1, has_more: false },
}), { status: 200 })

const mountedWrappers: ReturnType<typeof mount>[] = []
const mountHome = () => {
  const wrapper = mount(BlogHomeView, {
    global: {
      stubs: {
        BookmarkFolderModal: true,
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
  mountedWrappers.push(wrapper)
  return wrapper
}

vi.mock('vue-router', () => ({
  useRoute: () => route,
  RouterLink: { template: '<a><slot /></a>' },
}))

describe('BlogHomeView query search', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    route.query = {}
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('passes route query q to the paged blog post list', async () => {
    route.query = { q: 'atom' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    )

    mountHome()

    await flushPromises()

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedUrls).toContain('/api/v1/blog/posts?page=1&page_size=20&sort=latest&q=atom')
  })

  it('keeps an active search on the post list when recommendation sort state is stale', async () => {
    route.query = { q: 'atom' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(postResponse('initial'))
    const wrapper = mountHome()
    await flushPromises()
    fetchMock.mockReset().mockResolvedValue(postResponse('search-result'))

    wrapper.vm.$.setupState.sortBy = 'recommended'
    await wrapper.vm.$.setupState.fetchPosts()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/posts?page=1&page_size=20&sort=latest&q=atom',
    ])
  })

  it.each(['popular', 'recommended'])('keeps the visible sort on latest when selecting %s during a search', async (sort) => {
    route.query = { q: 'atom' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(postResponse('initial'))
    const wrapper = mountHome()
    await flushPromises()
    fetchMock.mockReset().mockResolvedValue(postResponse('search-result'))

    wrapper.vm.$.setupState.selectSort(sort)
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/posts?page=1&page_size=20&sort=latest&q=atom',
    ])
    expect(wrapper.vm.$.setupState.sortBy).toBe('latest')
  })

  it('makes a route search the latest request while an older recommendation is pending', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(postResponse('initial'))
    const wrapper = mountHome()
    await flushPromises()
    const oldRecommendation = deferred<Response>()
    fetchMock.mockReset()
      .mockReturnValueOnce(oldRecommendation.promise)
      .mockResolvedValueOnce(postResponse('search-result'))

    wrapper.vm.$.setupState.sortBy = 'popular'
    const oldLoad = wrapper.vm.$.setupState.fetchPosts()
    route.query = { q: 'atom search' }
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await flushPromises()
    oldRecommendation.resolve(postResponse('old-recommendation'))
    await oldLoad

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/recommend/posts?mode=hot&page=1&page_size=20',
      '/api/v1/blog/posts?page=1&page_size=20&sort=latest&q=atom+search',
    ])
    expect(wrapper.vm.$.setupState.sortBy).toBe('latest')
    expect(wrapper.text()).toContain('search-result')
    expect(wrapper.text()).not.toContain('old-recommendation')
  })

  it('reloads the latest post list once when route search is cleared', async () => {
    route.query = { q: 'atom' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(postResponse('search-result'))
    const wrapper = mountHome()
    await flushPromises()
    fetchMock.mockReset().mockResolvedValue(postResponse('latest-result'))

    route.query = {}
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/posts?page=1&page_size=20&sort=latest',
    ])
    expect(wrapper.vm.$.setupState.sortBy).toBe('latest')
    expect(wrapper.text()).toContain('latest-result')
  })
})
