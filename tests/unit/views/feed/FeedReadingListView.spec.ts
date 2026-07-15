import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import FeedReadingListView from '@/views/feed/FeedReadingListView.vue'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'

const { routeQuery, routerPush, routerReplace } = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string | undefined>,
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  useRoute: () => ({ query: routeQuery }),
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
}))

const emptyStateStubs = {
  PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
  PEmpty: { props: ['text'], template: '<div>{{ text }}</div>' },
  PEntry: true,
  PBadge: true,
  PClip: true,
  PPress: true,
  FeedTimelineFooter: true,
  FeedArticleSheet: true,
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const readingListResponse = (targetId: string, total: number) => new Response(JSON.stringify({
  data: [{
    target_type: 'feed_item',
    target_id: targetId,
    created_at: '2026-07-15T00:00:00Z',
  }],
  meta: { page: 1, page_size: 20, total, has_more: total > 1 },
}), { status: 200 })

const emptyReadingListResponse = () => new Response(JSON.stringify({
  data: [],
  meta: { page: 1, page_size: 20, total: 0, has_more: false },
}), { status: 200 })

describe('FeedReadingListView', () => {
  beforeEach(() => {
    routerPush.mockReset()
    routerReplace.mockReset()
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
    setActivePinia(createPinia())
    window.history.replaceState(null, '', '/reading-list?site=feed')

    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.user = { username: 'fafa', email: 'fafa@example.com' }
    authStore.isAuthenticated = true
  })

  it('renders entries from nested reading-list response data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: {
        items: [{
          target_type: 'feed_item',
          target_id: 'feed-item-1',
          created_at: '2026-06-16T00:00:00Z',
          feed_item: {
            id: 'feed-item-1',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-1',
            title: '稍后读条目',
            link: 'https://example.com/item',
            summary: '摘要',
            author: '作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
        }],
        page: 1,
        total: 1,
      },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('稍后读条目')
    expect(wrapper.text()).not.toContain('阅读列表为空')
  })

  it('renders entries from unified reading-list response data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{
        target_type: 'feed_item',
        target_id: 'feed-item-1',
        created_at: '2026-06-16T00:00:00Z',
        feed_item: {
          id: 'feed-item-1',
          feed_source_id: 'source-1',
          feed_source: { id: 'source-1', title: '来源' },
          guid: 'feed-item-1',
          title: '统一分页待读条目',
          link: 'https://example.com/item',
          summary: '摘要',
          author: '作者',
          published_at: '2026-06-16T00:00:00Z',
          fetched_at: '2026-06-16T00:00:00Z',
        },
      }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('统一分页待读条目')
    expect(wrapper.text()).not.toContain('阅读列表为空')
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feed/reading-list?page=1&limit=20', {
      headers: { Authorization: 'Bearer token' },
    })
  })

  it('shows the normal empty state for a successful empty list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [],
      meta: { page: 1, page_size: 20, total: 0, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('阅读列表为空')
    expect(wrapper.text()).not.toContain('稍后阅读加载失败')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it.each([
    ['non-2xx response', () => Promise.resolve(new Response(null, { status: 500 }))],
    ['network failure', () => Promise.reject(new Error('offline'))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('shows a failure state and settles loading for %s', async (_case, response) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(response)

    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()

    expect(wrapper.text()).toContain('稍后阅读加载失败')
    expect(wrapper.text()).not.toContain('阅读列表为空')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it('ignores an older success after the latest page succeeds', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(emptyReadingListResponse())
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()
    const oldResponse = deferred<Response>()
    const latestResponse = deferred<Response>()
    fetchMock.mockReset()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(latestResponse.promise)

    wrapper.vm.$.setupState.page = 1
    const oldLoad = wrapper.vm.$.setupState.fetchItems()
    wrapper.vm.$.setupState.page = 2
    const latestLoad = wrapper.vm.$.setupState.fetchItems()
    latestResponse.resolve(readingListResponse('latest-item', 40))
    await latestLoad
    oldResponse.resolve(readingListResponse('old-item', 99))
    await oldLoad

    expect(wrapper.vm.$.setupState.items.map((item: { target_id: string }) => item.target_id)).toEqual(['latest-item'])
    expect(wrapper.vm.$.setupState.totalItems).toBe(40)
    expect(wrapper.vm.$.setupState.errorMessage).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it('ignores an older failure and finally while the latest page is loading', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(emptyReadingListResponse())
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()
    const oldResponse = deferred<Response>()
    const latestResponse = deferred<Response>()
    fetchMock.mockReset()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(latestResponse.promise)

    wrapper.vm.$.setupState.page = 1
    const oldLoad = wrapper.vm.$.setupState.fetchItems()
    wrapper.vm.$.setupState.page = 2
    const latestLoad = wrapper.vm.$.setupState.fetchItems()
    oldResponse.reject(new Error('old failure'))
    let oldRejected = false
    await oldLoad.catch(() => { oldRejected = true })
    const loadingAfterOldFailure = wrapper.vm.$.setupState.loading
    const errorAfterOldFailure = wrapper.vm.$.setupState.errorMessage

    latestResponse.resolve(readingListResponse('latest-item', 40))
    await latestLoad

    expect(oldRejected).toBe(false)
    expect(loadingAfterOldFailure).toBe(true)
    expect(errorAfterOldFailure).toBe('')
    expect(wrapper.vm.$.setupState.items.map((item: { target_id: string }) => item.target_id)).toEqual(['latest-item'])
  })

  it('ignores older JSON that resolves after the latest page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(emptyReadingListResponse())
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()
    const oldData = deferred<unknown>()
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(oldData.promise)
    fetchMock.mockReset()
      .mockResolvedValueOnce(oldResponse)
      .mockResolvedValueOnce(readingListResponse('latest-item', 40))

    wrapper.vm.$.setupState.page = 1
    const oldLoad = wrapper.vm.$.setupState.fetchItems()
    await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())
    wrapper.vm.$.setupState.page = 2
    await wrapper.vm.$.setupState.fetchItems()
    oldData.resolve({
      data: [{ target_type: 'feed_item', target_id: 'old-item', created_at: '2026-07-15T00:00:00Z' }],
      meta: { total: 99 },
    })
    await oldLoad

    expect(wrapper.vm.$.setupState.items.map((item: { target_id: string }) => item.target_id)).toEqual(['latest-item'])
    expect(wrapper.vm.$.setupState.totalItems).toBe(40)
  })

  it('does not apply page correction from an older response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(emptyReadingListResponse())
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()
    const oldResponse = deferred<Response>()
    const latestResponse = deferred<Response>()
    fetchMock.mockReset()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(latestResponse.promise)

    wrapper.vm.$.setupState.page = 3
    const oldLoad = wrapper.vm.$.setupState.fetchItems()
    wrapper.vm.$.setupState.page = 2
    const latestLoad = wrapper.vm.$.setupState.fetchItems()
    latestResponse.resolve(readingListResponse('latest-item', 40))
    await latestLoad
    oldResponse.resolve(readingListResponse('old-item', 1))
    await oldLoad

    expect(routerReplace).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.items.map((item: { target_id: string }) => item.target_id)).toEqual(['latest-item'])
  })

  it('replaces an out-of-range current page with the last page without committing its response', async () => {
    routeQuery.page = '3'
    routeQuery.site = 'feed'
    routeQuery.view = 'compact'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{
        target_type: 'feed_item',
        target_id: 'out-of-range-item',
        created_at: '2026-07-15T00:00:00Z',
      }],
      meta: { page: 3, page_size: 20, total: 21, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()

    expect(routerReplace).toHaveBeenCalledOnce()
    expect(routerReplace).toHaveBeenCalledWith({
      query: { page: '2', site: 'feed', view: 'compact' },
    })
    expect(wrapper.vm.$.setupState.items).toEqual([])
    expect(wrapper.vm.$.setupState.totalItems).toBe(0)
    expect(wrapper.vm.$.setupState.errorMessage).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it('keeps ids seen on page 1 when page 2 succeeds', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(readingListResponse('page-1-item', 40))
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()
    const feedStore = useFeedStore()
    expect(feedStore.readingListItemIds).toEqual(new Set(['page-1-item']))

    fetchMock.mockResolvedValueOnce(readingListResponse('page-2-item', 40))
    wrapper.vm.$.setupState.page = 2
    await wrapper.vm.$.setupState.fetchItems()

    expect(feedStore.readingListItemIds).toEqual(new Set(['page-1-item', 'page-2-item']))
  })

  it('invalidates a pending fetch success on unmount and removes the key listener', async () => {
    const response = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise)
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()
    const state = wrapper.vm.$.setupState
    const feedStore = useFeedStore()
    const loadingBeforeUnmount = state.loading

    wrapper.unmount()
    response.resolve(readingListResponse('late-item', 1))
    await flushPromises()

    expect(state.items).toEqual([])
    expect(state.totalItems).toBe(0)
    expect(state.errorMessage).toBe('')
    expect(state.loading).toBe(loadingBeforeUnmount)
    expect(feedStore.readingListItemIds).toEqual(new Set())
    expect(routerReplace).not.toHaveBeenCalled()
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('invalidates a pending fetch failure on unmount', async () => {
    const response = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise)
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()
    const state = wrapper.vm.$.setupState
    const loadingBeforeUnmount = state.loading

    wrapper.unmount()
    response.reject(new Error('late failure'))
    await flushPromises()

    expect(state.items).toEqual([])
    expect(state.totalItems).toBe(0)
    expect(state.errorMessage).toBe('')
    expect(state.loading).toBe(loadingBeforeUnmount)
  })

  it('invalidates delayed JSON on unmount', async () => {
    const data = deferred<unknown>()
    const response = new Response(null, { status: 200 })
    const json = vi.spyOn(response, 'json').mockReturnValue(data.promise)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await vi.waitFor(() => expect(json).toHaveBeenCalledOnce())
    const state = wrapper.vm.$.setupState
    const loadingBeforeUnmount = state.loading

    wrapper.unmount()
    data.resolve({
      data: [{ target_type: 'feed_item', target_id: 'late-json-item', created_at: '2026-07-15T00:00:00Z' }],
      meta: { total: 1 },
    })
    await flushPromises()

    expect(state.items).toEqual([])
    expect(state.totalItems).toBe(0)
    expect(state.errorMessage).toBe('')
    expect(state.loading).toBe(loadingBeforeUnmount)
    expect(useFeedStore().readingListItemIds).toEqual(new Set())
  })

  it('does not correct an out-of-range page after unmount', async () => {
    routeQuery.page = '3'
    routeQuery.site = 'feed'
    const response = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(response.promise)
    const wrapper = mount(FeedReadingListView, { global: { stubs: emptyStateStubs } })
    await flushPromises()

    wrapper.unmount()
    response.resolve(readingListResponse('late-out-of-range-item', 1))
    await flushPromises()

    expect(routerReplace).not.toHaveBeenCalled()
    expect(useFeedStore().readingListItemIds).toEqual(new Set())
  })

  it('renders internal posts from the unified reading list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{
        target_type: 'post',
        target_id: 'post-1',
        created_at: '2026-07-14T00:00:00Z',
        post: {
          id: 'post-1',
          user_id: 'user-1',
          title: '站内稍后读文章',
          content: '正文',
          summary: '文章摘要',
          status: 'published',
          visibility: 'public',
          allow_comments: true,
          pinned: false,
          created_at: '2026-07-13T00:00:00Z',
          updated_at: '2026-07-14T00:00:00Z',
        },
      }],
      meta: { page: 1, page_size: 20, total: 1, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: { props: ['title', 'summary'], template: '<article><h3>{{ title }}</h3><slot name="actions" /></article>' },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('站内稍后读文章')
    expect(wrapper.find('a[href="/posts/post/post-1"]').exists()).toBe(true)
  })

  it('supports previous and next navigation inside the reading list article sheet', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        {
          target_type: 'feed_item',
          target_id: 'feed-item-nav-1',
          created_at: '2026-06-16T00:00:00Z',
          feed_item: {
            id: 'feed-item-nav-1',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-nav-1',
            title: '列表第一篇',
            link: 'https://example.com/1',
            summary: '摘要 1',
            author: '作者',
            published_at: '2026-06-16T00:00:00Z',
            fetched_at: '2026-06-16T00:00:00Z',
          },
        },
        {
          target_type: 'feed_item',
          target_id: 'feed-item-nav-2',
          created_at: '2026-06-15T00:00:00Z',
          feed_item: {
            id: 'feed-item-nav-2',
            feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '来源' },
            guid: 'feed-item-nav-2',
            title: '列表第二篇',
            link: 'https://example.com/2',
            summary: '摘要 2',
            author: '作者',
            published_at: '2026-06-15T00:00:00Z',
            fetched_at: '2026-06-15T00:00:00Z',
          },
        },
      ],
      meta: { page: 1, page_size: 20, total: 2, has_more: false },
    }), { status: 200 }))

    const wrapper = mount(FeedReadingListView, {
      global: {
        stubs: {
          PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
          PEmpty: true,
          PEntry: {
            props: ['title', 'summary'],
            template: '<article class="p-entry" @click="$emit(\'click\')"><h3>{{ title }}</h3><slot name="actions" /></article>',
          },
          PBadge: true,
          PClip: true,
          PPress: true,
          PShortcutHints: true,
          FeedArticleSheet: {
            name: 'FeedArticleSheet',
            props: ['show', 'article', 'hasPrevious', 'hasNext'],
            template: `
              <section v-if="show" data-test="sheet-probe">
                <h2 data-test="sheet-title">{{ article?.feed_item?.title }}</h2>
                <button v-if="hasPrevious" data-test="sheet-prev" @click="$emit('previous')">prev</button>
                <button v-if="hasNext" data-test="sheet-next" @click="$emit('next')">next</button>
              </section>
            `,
          },
        },
      },
    })

    await flushPromises()

    await wrapper.findAll('.p-entry')[0]?.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="sheet-title"]').text()).toBe('列表第一篇')
    expect(wrapper.find('[data-test="sheet-next"]').exists()).toBe(true)

    await wrapper.get('[data-test="sheet-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="sheet-title"]').text()).toBe('列表第二篇')
    expect(wrapper.find('[data-test="sheet-prev"]').exists()).toBe(true)
  })
})
