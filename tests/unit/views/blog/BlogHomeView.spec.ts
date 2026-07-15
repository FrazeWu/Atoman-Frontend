import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BlogHomeView from '@/views/blog/BlogHomeView.vue'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const postResponse = (id: string, hasMore = false) => new Response(JSON.stringify({
  data: [{ id, title: id, summary: `${id} summary`, likes_count: 1, comments_count: 1 }],
  meta: { page: 1, page_size: 20, total: hasMore ? 21 : 1, has_more: hasMore },
}), { status: 200 })

const homeStubs = {
  BookmarkFolderModal: true,
  PAvatar: true,
  PBadge: true,
  PButton: {
    props: ['label', 'loading', 'disabled'],
    template: '<button :data-loading="String(Boolean(loading))" :disabled="disabled || loading" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  PClip: true,
  PEmpty: { props: ['title', 'description'], template: '<div>{{ title }} {{ description }}</div>' },
  PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
  PPageHeader: true,
  PSegmentedControl: true,
}

const mountHome = () => mount(BlogHomeView, { global: { stubs: homeStubs } })

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

  it('uses response pagination metadata for the latest post list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(postResponse('post-with-next-page', true))

    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.vm.$.setupState.hasMore).toBe(true)
    expect(wrapper.text()).toContain('加载更多')
  })

  it('keeps the normal empty state for a successful empty list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [],
      meta: { page: 1, page_size: 20, total: 0, has_more: false },
    }), { status: 200 }))

    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无内容')
    expect(wrapper.text()).not.toContain('内容加载失败')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it.each([
    ['non-2xx response', () => Promise.resolve(new Response(null, { status: 500 }))],
    ['network failure', () => Promise.reject(new Error('offline'))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('shows a failure state and settles loading for %s', async (_case, response) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(response)

    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('内容加载失败')
    expect(wrapper.text()).not.toContain('暂无内容')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it('ignores an older recommendation response after the latest mode succeeds', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { has_more: false } }), { status: 200 }))
    const wrapper = mountHome()
    await flushPromises()
    const oldResponse = deferred<Response>()
    const latestResponse = deferred<Response>()
    fetchMock.mockReset()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(latestResponse.promise)

    wrapper.vm.$.setupState.sortBy = 'popular'
    const oldLoad = wrapper.vm.$.setupState.fetchPosts()
    wrapper.vm.$.setupState.sortBy = 'recommended'
    const latestLoad = wrapper.vm.$.setupState.fetchPosts()
    latestResponse.resolve(postResponse('latest-featured'))
    await latestLoad
    oldResponse.resolve(postResponse('old-hot', true))
    await oldLoad

    expect(fetchMock.mock.calls.map(call => String(call[0]))).toEqual([
      '/api/v1/blog/recommend/posts?mode=hot&page=1&page_size=20',
      '/api/v1/blog/recommend/posts?mode=featured&page=1&page_size=20',
    ])
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['latest-featured'])
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.errorMessage).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it('ignores an older failure and finally while the latest mode is loading', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { has_more: false } }), { status: 200 }))
    const wrapper = mountHome()
    await flushPromises()
    const oldResponse = deferred<Response>()
    const latestResponse = deferred<Response>()
    fetchMock.mockReset()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(latestResponse.promise)

    wrapper.vm.$.setupState.sortBy = 'popular'
    const oldLoad = wrapper.vm.$.setupState.fetchPosts()
    wrapper.vm.$.setupState.sortBy = 'recommended'
    const latestLoad = wrapper.vm.$.setupState.fetchPosts()
    oldResponse.reject(new Error('old failure'))
    await oldLoad
    const loadingAfterOldFailure = wrapper.vm.$.setupState.loading
    const errorAfterOldFailure = wrapper.vm.$.setupState.errorMessage

    latestResponse.resolve(postResponse('latest-featured'))
    await latestLoad

    expect(loadingAfterOldFailure).toBe(true)
    expect(errorAfterOldFailure).toBe('')
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['latest-featured'])
  })

  it('ignores older JSON that resolves after the latest mode', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { has_more: false } }), { status: 200 }))
    const wrapper = mountHome()
    await flushPromises()
    const oldData = deferred<unknown>()
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(oldData.promise)
    fetchMock.mockReset()
      .mockResolvedValueOnce(oldResponse)
      .mockResolvedValueOnce(postResponse('latest-featured'))

    wrapper.vm.$.setupState.sortBy = 'popular'
    const oldLoad = wrapper.vm.$.setupState.fetchPosts()
    await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())
    wrapper.vm.$.setupState.sortBy = 'recommended'
    await wrapper.vm.$.setupState.fetchPosts()
    oldData.resolve({
      data: [{ id: 'old-hot', title: 'Old hot', summary: 'old' }],
      meta: { has_more: true },
    })
    await oldLoad

    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['latest-featured'])
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
  })

  it('keeps the current page and retries the same append page after failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(postResponse('page-1', true))
    const wrapper = mountHome()
    await flushPromises()
    fetchMock.mockReset()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(postResponse('page-2'))

    const failed = await wrapper.vm.$.setupState.loadMore()

    expect(failed).toBe(false)
    expect(wrapper.vm.$.setupState.page).toBe(1)
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['page-1'])
    expect(wrapper.vm.$.setupState.hasMore).toBe(true)
    expect(wrapper.vm.$.setupState.errorMessage).toBe('')
    expect(wrapper.vm.$.setupState.loadingMore).toBe(false)
    expect(wrapper.text()).toContain('page-1')
    expect(wrapper.text()).not.toContain('内容加载失败')

    const succeeded = await wrapper.vm.$.setupState.loadMore()

    expect(succeeded).toBe(true)
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/posts?page=2&page_size=20&sort=latest',
      '/api/v1/blog/posts?page=2&page_size=20&sort=latest',
    ])
    expect(wrapper.vm.$.setupState.page).toBe(2)
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['page-1', 'page-2'])
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
  })

  it('prevents duplicate load-more requests while an append is pending', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(postResponse('page-1', true))
    const wrapper = mountHome()
    await flushPromises()
    const nextPage = deferred<Response>()
    fetchMock.mockReset().mockReturnValue(nextPage.promise)

    const firstLoad = wrapper.vm.$.setupState.loadMore()
    const duplicateLoad = wrapper.vm.$.setupState.loadMore()
    await wrapper.vm.$nextTick()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(wrapper.vm.$.setupState.loadingMore).toBe(true)
    const loadMoreButton = wrapper.findAll('button').find(button => button.text().includes('加载更多'))
    expect(loadMoreButton?.attributes('data-loading')).toBe('true')
    expect(await duplicateLoad).toBe(false)

    nextPage.resolve(postResponse('page-2'))
    expect(await firstLoad).toBe(true)
    expect(wrapper.vm.$.setupState.page).toBe(2)
  })

  it('does not append or commit an older page after a refresh replaces it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(postResponse('page-1', true))
    const wrapper = mountHome()
    await flushPromises()
    const oldPage = deferred<Response>()
    const refreshed = deferred<Response>()
    fetchMock.mockReset()
      .mockReturnValueOnce(oldPage.promise)
      .mockReturnValueOnce(refreshed.promise)

    const oldLoad = wrapper.vm.$.setupState.loadMore()
    wrapper.vm.$.setupState.sortBy = 'popular'
    const refresh = wrapper.vm.$.setupState.fetchPosts()
    refreshed.resolve(postResponse('refreshed'))
    expect(await refresh).toBe(true)
    oldPage.resolve(postResponse('old-page-2', true))
    expect(await oldLoad).toBe(false)

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/posts?page=2&page_size=20&sort=latest',
      '/api/v1/blog/recommend/posts?mode=hot&page=1&page_size=20',
    ])
    expect(wrapper.vm.$.setupState.posts.map((post: { id: string }) => post.id)).toEqual(['refreshed'])
    expect(wrapper.vm.$.setupState.page).toBe(1)
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.loadingMore).toBe(false)
  })

  it('invalidates a pending success when the view unmounts', async () => {
    const pending = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pending.promise)
    const wrapper = mountHome()

    wrapper.unmount()
    pending.resolve(postResponse('late-post', true))
    await flushPromises()

    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.loading).toBe(true)
  })

  it('invalidates pending JSON when the view unmounts', async () => {
    const data = deferred<unknown>()
    const response = new Response(null, { status: 200 })
    const responseJSON = vi.spyOn(response, 'json').mockReturnValue(data.promise)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
    const wrapper = mountHome()
    await vi.waitFor(() => expect(responseJSON).toHaveBeenCalledOnce())

    wrapper.unmount()
    data.resolve({ data: [{ id: 'late-json', title: 'late' }], meta: { has_more: true } })
    await flushPromises()

    expect(wrapper.vm.$.setupState.posts).toEqual([])
    expect(wrapper.vm.$.setupState.hasMore).toBe(false)
    expect(wrapper.vm.$.setupState.loading).toBe(true)
  })

  it('does not report or settle a pending failure after the view unmounts', async () => {
    const pending = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(pending.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountHome()

    wrapper.unmount()
    pending.reject(new Error('late failure'))
    await flushPromises()

    expect(consoleError).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.errorMessage).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(true)
    consoleError.mockRestore()
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

  it.each([
    ['最热', 'hot'],
    ['推荐', 'featured'],
  ])('renders real engagement counts for %s recommendations', async (label, mode) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/blog/recommend/posts')) {
        return new Response(JSON.stringify({
          data: [{
            id: `post-${mode}`,
            title: `${label}真实统计`,
            summary: '摘要',
            likes_count: 7,
            comments_count: 4,
          }],
          meta: { page: 1, page_size: 20, total: 1, has_more: false },
        }), { status: 200 })
      }
      return new Response(JSON.stringify({ data: [], meta: { has_more: false } }), { status: 200 })
    })

    const wrapper = mount(BlogHomeView, {
      global: {
        stubs: {
          PAvatar: true,
          PBadge: true,
          PButton: true,
          PClip: true,
          PEmpty: true,
          PEntry: {
            props: ['title'],
            template: '<article>{{ title }}<slot name="actions" /></article>',
          },
          PPageHeader: true,
          PTab: {
            props: ['label', 'active'],
            template: '<button class="p-tab" @click="$emit(\'click\')">{{ label }}</button>',
          },
        },
      },
    })
    await flushPromises()

    await wrapper.findAll('.p-tab').find(tab => tab.text() === label)!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain(`${label}真实统计`)
    expect(wrapper.text()).toContain('♥ 7')
    expect(wrapper.text()).toContain('💬 4')
  })
})
