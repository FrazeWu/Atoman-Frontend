import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useForumStore } from '@/stores/forum'
import ForumHomeView from '@/views/forum/ForumHomeView.vue'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const topic = (id: string, title: string) => ({
  id,
  title,
  tags: [],
  pinned: false,
  closed: false,
  reply_count: 0,
  view_count: 0,
  created_at: '2026-07-01T00:00:00Z',
})

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

const response = (data: unknown[], total = 2, page = 2) => jsonResponse({
  data,
  meta: { page, page_size: 20, total, has_more: page * 20 < total },
})

const PButtonStub = defineComponent({
  props: ['loading'],
  template: '<button :disabled="loading" :data-loading="String(Boolean(loading))"><slot /></button>',
})

const mountedWrappers = new Set<VueWrapper>()

afterEach(() => {
  mountedWrappers.forEach(wrapper => wrapper.unmount())
  mountedWrappers.clear()
})

const mountView = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useForumStore()
  store.topics = [topic('topic-1', '第一页') as never]
  store.topicsTotal = 2
  vi.spyOn(store, 'fetchCategories').mockResolvedValue(undefined)
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
    data: [topic('topic-1', '第一页')],
    meta: { page: 1, page_size: 20, total: 2, has_more: true },
  }))

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/forum', component: { template: '<div />' } }],
  })
  await router.push('/forum')
  await router.isReady()

  const wrapper = mount(ForumHomeView, {
    global: {
      plugins: [pinia, router],
      stubs: {
        ForumTopicFilters: true,
        PButton: PButtonStub,
        PPageHeader: true,
        PEmpty: true,
        PInput: true,
        PSelect: true,
        PTextarea: true,
        PModal: true,
        PEntry: { template: '<article><slot name="title" /></article>' },
      },
    },
  })
  mountedWrappers.add(wrapper)
  await flushPromises()
  fetchMock.mockClear()
  return { wrapper, store, router }
}

describe('ForumHomeView pagination', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('失败后保留当前页，并在重试时再次请求同一页', async () => {
    const { wrapper, store } = await mountView()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(response([topic('topic-2', '第二页')]))

    await expect(wrapper.vm.$.setupState.loadMore()).resolves.toBeUndefined()
    expect(store.topics.map(item => item.id)).toEqual(['topic-1'])
    expect(wrapper.vm.$.setupState.loadingMore).toBe(false)

    await wrapper.vm.$.setupState.loadMore()

    const pages = fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost').searchParams.get('page'))
    expect(pages).toEqual(['2', '2'])
    expect(new URL(String(fetchMock.mock.calls[1]?.[0]), 'http://localhost').searchParams.get('page_size')).toBe('20')
    expect(store.topics.map(item => item.id)).toEqual(['topic-1', 'topic-2'])
  })

  it('点击加载更多后请求第二页并渲染新增话题', async () => {
    const { wrapper, store } = await mountView()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response([topic('topic-2', '按钮加载的第二页')]))

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost').searchParams.get('page')).toBe('2')
    expect(store.topics.map(item => item.id)).toEqual(['topic-1', 'topic-2'])
    expect(wrapper.text()).toContain('按钮加载的第二页')
  })

  it('分页追加按话题 ID 去重，只渲染一次重复话题', async () => {
    const { wrapper, store } = await mountView()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response([
      topic('topic-1', '重复第一页'),
      topic('topic-2', '第二页'),
      topic('topic-2', '重复第二页'),
    ]))

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    expect(store.topics.map(item => item.id)).toEqual(['topic-1', 'topic-2'])
    expect(wrapper.findAll('article')).toHaveLength(2)
  })

  it('服务端返回 has_more=false 时隐藏按钮且不再请求，即使唯一话题数小于 total', async () => {
    const { wrapper, store } = await mountView()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({
      data: [topic('topic-2', '最后一页')],
      meta: { page: 2, page_size: 20, total: 99, has_more: false },
    }))

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    expect(store.topics.map(item => item.id)).toEqual(['topic-1', 'topic-2'])
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.vm.$.setupState.loadMore()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('拒绝与固定请求值不一致的 page_size，并允许重试同一页', async () => {
    const { wrapper, store } = await mountView()
    const mismatchedPageSize = jsonResponse({
      data: [topic('wrong', '错误页大小')],
      meta: { page: 2, page_size: 21, total: 42, has_more: false },
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mismatchedPageSize)
      .mockResolvedValueOnce(response([topic('topic-2', '第二页')]))

    await wrapper.vm.$.setupState.loadMore()

    expect(store.topics.map(item => item.id)).toEqual(['topic-1'])
    expect(store.topicsTotal).toBe(2)
    expect(wrapper.vm.$.setupState.page).toBe(1)

    await wrapper.vm.$.setupState.loadMore()

    expect(fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost').searchParams.get('page')))
      .toEqual(['2', '2'])
    expect(store.topics.map(item => item.id)).toEqual(['topic-1', 'topic-2'])
    expect(wrapper.vm.$.setupState.page).toBe(2)
  })

  it('分页请求进行中阻止重复请求，并暴露按钮 loading 状态', async () => {
    const nextPage = deferred<Response>()
    const { wrapper } = await mountView()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(nextPage.promise)

    const firstLoad = wrapper.vm.$.setupState.loadMore()
    const duplicateLoad = wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('button').attributes('data-loading')).toBe('true')
    expect(wrapper.get('button').attributes()).toHaveProperty('disabled')

    nextPage.resolve(response([topic('topic-2', '第二页')]))
    await Promise.all([firstLoad, duplicateLoad])
  })

  it('切换筛选会释放旧分页 loading，且旧请求不能清除新分页 loading 或污染新列表', async () => {
    const oldPage = deferred<Response>()
    const newPage = deferred<Response>()
    const { wrapper, store, router } = await mountView()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(oldPage.promise)
      .mockResolvedValueOnce(jsonResponse({
        data: [topic('filtered', '新筛选结果')],
        meta: { page: 1, page_size: 20, total: 2, has_more: true },
      }))
      .mockReturnValueOnce(newPage.promise)

    const oldLoad = wrapper.vm.$.setupState.loadMore()
    await flushPromises()
    expect(wrapper.vm.$.setupState.loadingMore).toBe(true)

    await router.push({ path: '/forum', query: { category_id: 'filtered' } })
    await flushPromises()

    const filterURL = new URL(String(fetchMock.mock.calls[1]?.[0]), 'http://localhost')
    expect(filterURL.searchParams.get('category_id')).toBe('filtered')
    expect(filterURL.searchParams.get('page')).toBe('1')
    expect(wrapper.vm.$.setupState.loadingMore).toBe(false)

    const newLoad = wrapper.vm.$.setupState.loadMore()
    await flushPromises()
    expect(wrapper.vm.$.setupState.loadingMore).toBe(true)

    oldPage.resolve(response([topic('stale', '过期第二页')]))
    await oldLoad

    expect(wrapper.vm.$.setupState.loadingMore).toBe(true)
    expect(wrapper.vm.$.setupState.hasMore).toBe(true)
    expect(store.topics.map(item => item.id)).toEqual(['filtered'])

    newPage.resolve(response([topic('filtered-2', '新筛选第二页')]))
    await newLoad

    expect(wrapper.vm.$.setupState.loadingMore).toBe(false)
    expect(store.topics.map(item => item.id)).toEqual(['filtered', 'filtered-2'])
  })

  it('旧的首屏请求迟到时不能覆盖新筛选列表', async () => {
    const oldRequest = deferred<Response>()
    const filteredRequest = deferred<Response>()
    const { wrapper, store, router } = await mountView()
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(filteredRequest.promise)

    const oldLoad = wrapper.vm.$.setupState.loadTopics()
    await flushPromises()
    await router.push({ path: '/forum', query: { category_id: 'filtered' } })
    await flushPromises()

    filteredRequest.resolve(response([topic('filtered', '新筛选结果')], 1, 1))
    await flushPromises()
    expect(store.topics.map(item => item.id)).toEqual(['filtered'])
    expect(store.topicsTotal).toBe(1)

    oldRequest.resolve(response([topic('stale', '过期首屏结果')], 99, 1))
    await oldLoad

    expect(store.topics.map(item => item.id)).toEqual(['filtered'])
    expect(store.topicsTotal).toBe(1)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('首屏请求固定 page_size=20，并使用 meta.has_more 决定是否继续分页', async () => {
    const { wrapper, store } = await mountView()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({
      data: [topic('only', '唯一结果')],
      meta: { page: 1, page_size: 20, total: 99, has_more: false },
    }))

    await wrapper.vm.$.setupState.loadTopics()
    await flushPromises()

    const requestURL = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost')
    expect(requestURL.searchParams.get('page_size')).toBe('20')
    expect(store.topics.map(item => item.id)).toEqual(['only'])
    expect(store.topicsTotal).toBe(99)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('首屏请求拒绝与请求页码不一致的 envelope', async () => {
    const { wrapper, store } = await mountView()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response([
      topic('wrong-page', '错误页码'),
    ], 99, 2))

    await wrapper.vm.$.setupState.loadTopics()

    expect(store.topics.map(item => item.id)).toEqual(['topic-1'])
    expect(store.topicsTotal).toBe(2)
  })

  it('旧首屏请求先失败时，不能结束新请求的 loading 或写入 error', async () => {
    const oldRequest = deferred<Response>()
    const filteredRequest = deferred<Response>()
    const { wrapper, store, router } = await mountView()
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(filteredRequest.promise)

    const oldLoad = wrapper.vm.$.setupState.loadTopics()
    await flushPromises()
    await router.push({ path: '/forum', query: { category_id: 'filtered' } })
    await flushPromises()

    oldRequest.reject(new Error('stale request failed'))
    await oldLoad

    expect(store.loading).toBe(true)
    expect(store.error).toBeNull()

    filteredRequest.resolve(response([topic('filtered', '新筛选结果')], 1, 1))
    await flushPromises()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('卸载后忽略迟到分页，不写 topics、total、page 或 loading', async () => {
    const latePage = deferred<Response>()
    const { wrapper, store } = await mountView()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(latePage.promise)

    const load = wrapper.vm.$.setupState.loadMore()
    await flushPromises()
    wrapper.unmount()
    mountedWrappers.delete(wrapper)

    expect(wrapper.vm.$.setupState.loadingMore).toBe(false)
    latePage.resolve(response([topic('late', '迟到结果')], 99))
    await load

    expect(store.topics.map(item => item.id)).toEqual(['topic-1'])
    expect(store.topicsTotal).toBe(2)
    expect(wrapper.vm.$.setupState.page).toBe(1)
    expect(wrapper.vm.$.setupState.loadingMore).toBe(false)
  })

  it('首屏请求等待时卸载会释放 loading，并忽略迟到结果且不注册键盘监听', async () => {
    const initialRequest = deferred<Response>()
    const addListener = vi.spyOn(window, 'addEventListener')
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useForumStore()
    store.topics = [topic('existing', '原有话题') as never]
    store.topicsTotal = 1
    vi.spyOn(store, 'fetchCategories').mockResolvedValue(undefined)
    vi.spyOn(globalThis, 'fetch').mockReturnValue(initialRequest.promise)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/forum', component: { template: '<div />' } }],
    })
    await router.push('/forum')
    await router.isReady()

    const wrapper = mount(ForumHomeView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ForumTopicFilters: true,
          PButton: PButtonStub,
          PPageHeader: true,
          PEmpty: true,
          PInput: true,
          PSelect: true,
          PTextarea: true,
          PModal: true,
          PEntry: { template: '<article><slot name="title" /></article>' },
        },
      },
    })
    await flushPromises()
    expect(store.loading).toBe(true)
    const keydownRegistrationsBeforeUnmount = addListener.mock.calls
      .filter(([event]) => event === 'keydown').length

    wrapper.unmount()
    expect(store.loading).toBe(false)

    initialRequest.resolve(response([topic('late', '迟到话题')], 99, 1))
    await flushPromises()

    expect(store.topics.map(item => item.id)).toEqual(['existing'])
    expect(store.topicsTotal).toBe(1)
    expect(store.error).toBeNull()
    expect(addListener.mock.calls.filter(([event]) => event === 'keydown')).toHaveLength(keydownRegistrationsBeforeUnmount)
  })

  it('首屏请求等待时卸载会忽略迟到失败，不写入 error', async () => {
    const initialRequest = deferred<Response>()
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useForumStore()
    vi.spyOn(store, 'fetchCategories').mockResolvedValue(undefined)
    vi.spyOn(globalThis, 'fetch').mockReturnValue(initialRequest.promise)

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/forum', component: { template: '<div />' } }],
    })
    await router.push('/forum')
    await router.isReady()

    const wrapper = mount(ForumHomeView, {
      global: {
        plugins: [pinia, router],
        stubs: {
          ForumTopicFilters: true,
          PButton: PButtonStub,
          PPageHeader: true,
          PEmpty: true,
          PInput: true,
          PSelect: true,
          PTextarea: true,
          PModal: true,
          PEntry: { template: '<article><slot name="title" /></article>' },
        },
      },
    })
    await flushPromises()
    expect(store.loading).toBe(true)

    wrapper.unmount()
    initialRequest.reject(new Error('late request failed'))
    await flushPromises()

    expect(store.error).toBeNull()
  })

  it('卸载时移除当前实例的键盘监听器', async () => {
    const addListener = vi.spyOn(window, 'addEventListener')
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const { wrapper } = await mountView()
    const keydownRegistration = addListener.mock.calls.find(([event]) => event === 'keydown')

    expect(keydownRegistration).toBeDefined()
    wrapper.unmount()
    mountedWrappers.delete(wrapper)

    expect(removeListener).toHaveBeenCalledWith('keydown', keydownRegistration?.[1])
  })

  it('非法成功 envelope 不推进页码，并始终允许重试同一页', async () => {
    const invalidBodies = [
      { data: {}, meta: { page: 2, page_size: 20, total: 2, has_more: false } },
      { data: [], meta: null },
      { data: [], meta: { page: 1, page_size: 20, total: 2, has_more: false } },
      { data: [], meta: { page: 2.5, page_size: 20, total: 2, has_more: false } },
      { data: [], meta: { page: 2, page_size: 0, total: 2, has_more: false } },
      { data: [], meta: { page: 2, page_size: 20.5, total: 2, has_more: false } },
      { data: [], meta: { page: 2, page_size: 20, total: -1, has_more: false } },
      { data: [], meta: { page: 2, page_size: 20, total: 2.5, has_more: false } },
      { data: [], meta: { page: 2, page_size: 20, total: 2 } },
      { data: [], meta: { page: 2, page_size: 20, total: 2, has_more: 'false' } },
    ]
    const { wrapper, store } = await mountView()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    invalidBodies.forEach(body => fetchMock.mockResolvedValueOnce(jsonResponse(body)))
    fetchMock.mockResolvedValueOnce(response([topic('topic-2', '第二页')]))

    for (const _body of invalidBodies) {
      await wrapper.vm.$.setupState.loadMore()
      expect(store.topics.map(item => item.id)).toEqual(['topic-1'])
      expect(store.topicsTotal).toBe(2)
      expect(wrapper.vm.$.setupState.page).toBe(1)
      expect(wrapper.vm.$.setupState.loadingMore).toBe(false)
    }

    await wrapper.vm.$.setupState.loadMore()

    expect(fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost').searchParams.get('page')))
      .toEqual(Array(invalidBodies.length + 1).fill('2'))
    expect(store.topics.map(item => item.id)).toEqual(['topic-1', 'topic-2'])
    expect(wrapper.vm.$.setupState.page).toBe(2)
  })
})
