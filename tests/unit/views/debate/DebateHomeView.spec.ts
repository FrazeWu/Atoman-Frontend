import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DebateHomeView from '@/views/debate/DebateHomeView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const debateRow = (id: string, title: string) => ({
  id,
  user: { username: 'alice' },
  title,
  description: `${title}简介`,
  status: 'open',
  tags: [],
  created_at: '2026-07-01T00:00:00Z',
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mountView = () => mount(DebateHomeView, {
  global: {
    plugins: [pinia],
    stubs: {
      PPageHeader: { template: '<div><slot /><slot name="action" /></div>' },
      PButton: {
        props: ['loading', 'disabled', 'label', 'loadingText'],
        template: '<button :disabled="disabled || loading" :data-loading="String(Boolean(loading))">{{ loading ? loadingText : label }}<slot /></button>',
      },
      PSelect: true,
      PInput: true,
      PModal: true,
    },
  },
})

describe('DebateHomeView', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [{
        id: 'debate-1',
        user_id: 'user-1',
        user: { uuid: 'user-1', username: 'alice' },
        title: '真实投票辩题',
        description: '辩题简介',
        content: '辩题内容',
        status: 'open',
        tags: ['科技'],
        view_count: 9,
        argument_count: 2,
        vote_count: 4,
        created_at: '2026-07-01T00:00:00Z',
        updated_at: '2026-07-01T00:00:00Z',
      }],
      meta: { page: 1, page_size: 12, total: 1, has_more: false },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders the real vote count from the list response', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('真实投票辩题')
    expect(wrapper.text()).toContain('投票 4')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/debate/topics?page=1&limit=12'))
  })

  it('shows a loading failure instead of an empty list for a non-2xx response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('辩题加载失败')
    expect(wrapper.text()).not.toContain('暂无辩论')
  })

  it('keeps the normal empty state for a successful empty response', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [],
      meta: { page: 1, page_size: 12, total: 0, has_more: false },
    }), { status: 200 }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无辩论')
    expect(wrapper.text()).not.toContain('辩题加载失败')
  })

  it('keeps existing debates visible when loading more fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          id: 'debate-1',
          user: { username: 'alice' },
          title: '保留的辩题',
          description: '辩题简介',
          status: 'open',
          tags: [],
          created_at: '2026-07-01T00:00:00Z',
        }],
        meta: { page: 1, page_size: 12, total: 2, has_more: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          id: 'debate-2',
          user: { username: 'bob' },
          title: '重试得到的辩题',
          description: '重试成功',
          status: 'open',
          tags: [],
          created_at: '2026-07-02T00:00:00Z',
        }],
        meta: { page: 2, page_size: 12, total: 2, has_more: false },
      }), { status: 200 }))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    expect(wrapper.text()).toContain('保留的辩题')
    expect(wrapper.text()).not.toContain('辩题加载失败')
    expect(wrapper.text()).not.toContain('暂无辩论')

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    const requestedPages = fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost').searchParams.get('page'))
    expect(requestedPages).toEqual(['1', '2', '2'])
    expect(wrapper.text()).toContain('重试得到的辩题')
  })

  it('blocks duplicate load-more requests and exposes the loading button state', async () => {
    const nextPage = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          id: 'debate-1',
          user: { username: 'alice' },
          title: '第一页辩题',
          description: '辩题简介',
          status: 'open',
          tags: [],
          created_at: '2026-07-01T00:00:00Z',
        }],
        meta: { page: 1, page_size: 12, total: 2, has_more: true },
      }), { status: 200 }))
      .mockReturnValueOnce(nextPage.promise)
    const wrapper = mountView()
    await flushPromises()

    const firstLoad = wrapper.vm.$.setupState.loadMore()
    const duplicateLoad = wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const loadMoreButton = wrapper.findAll('button').find(button => button.text().includes('加载'))
    expect(loadMoreButton?.attributes('data-loading')).toBe('true')
    expect(loadMoreButton?.attributes()).toHaveProperty('disabled')

    nextPage.resolve(new Response(JSON.stringify({
      data: [{
        id: 'debate-2',
        user: { username: 'bob' },
        title: '第二页辩题',
        description: '第二页',
        status: 'open',
        tags: [],
        created_at: '2026-07-02T00:00:00Z',
      }],
      meta: { page: 2, page_size: 12, total: 2, has_more: false },
    }), { status: 200 }))
    await Promise.all([firstLoad, duplicateLoad])
  })

  it('allows a new filter request to replace an in-flight load-more request', async () => {
    const nextPage = deferred<Response>()
    const filteredPage = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          id: 'debate-1',
          user: { username: 'alice' },
          title: '旧筛选辩题',
          description: '辩题简介',
          status: 'open',
          tags: [],
          created_at: '2026-07-01T00:00:00Z',
        }],
        meta: { page: 1, page_size: 12, total: 2, has_more: true },
      }), { status: 200 }))
      .mockReturnValueOnce(nextPage.promise)
      .mockReturnValueOnce(filteredPage.promise)
    const wrapper = mountView()
    await flushPromises()

    const oldLoad = wrapper.vm.$.setupState.loadMore()
    wrapper.vm.$.setupState.filterTag = '新标签'
    const filterLoad = wrapper.vm.$.setupState.loadDebates()
    filteredPage.resolve(new Response(JSON.stringify({
      data: [{
        id: 'filtered',
        user: { username: 'carol' },
        title: '新筛选辩题',
        description: '筛选结果',
        status: 'open',
        tags: ['新标签'],
        created_at: '2026-07-03T00:00:00Z',
      }],
      meta: { page: 1, page_size: 12, total: 1, has_more: false },
    }), { status: 200 }))
    await filterLoad
    nextPage.resolve(new Response(JSON.stringify({
      data: [{
        id: 'stale',
        user: { username: 'bob' },
        title: '过期第二页',
        description: '不应显示',
        status: 'open',
        tags: [],
        created_at: '2026-07-02T00:00:00Z',
      }],
      meta: { page: 2, page_size: 12, total: 2, has_more: false },
    }), { status: 200 }))
    await oldLoad
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('tag=%E6%96%B0%E6%A0%87%E7%AD%BE')
    expect(wrapper.text()).toContain('新筛选辩题')
    expect(wrapper.text()).not.toContain('过期第二页')
    expect(wrapper.vm.$.setupState.currentPage).toBe(1)
  })

  it('keeps page 2 after a page 1 filter failure and loads page 3 next', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('debate-1', '第一页')],
        meta: { page: 1, page_size: 12, total: 3, has_more: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('debate-2', '第二页')],
        meta: { page: 2, page_size: 12, total: 3, has_more: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('debate-3', '第三页')],
        meta: { page: 3, page_size: 12, total: 3, has_more: false },
      }), { status: 200 }))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.vm.$.setupState.loadMore()
    wrapper.vm.$.setupState.filterTag = '失败筛选'
    await wrapper.vm.$.setupState.loadDebates()

    expect(wrapper.vm.$.setupState.currentPage).toBe(2)
    expect(wrapper.text()).toContain('第一页')
    expect(wrapper.text()).toContain('第二页')

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    const requestedPages = fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost').searchParams.get('page'))
    expect(requestedPages).toEqual(['1', '2', '1', '3'])
    const requestedTags = fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost').searchParams.get('tag'))
    expect(requestedTags).toEqual([null, null, '失败筛选', null])
    expect(wrapper.text()).toContain('第三页')
  })

  it('commits page 1 only for the current successful filter request', async () => {
    const replacedFilter = deferred<Response>()
    const currentFilter = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('debate-1', '已有列表')],
        meta: { page: 1, page_size: 12, total: 3, has_more: true },
      }), { status: 200 }))
      .mockReturnValueOnce(replacedFilter.promise)
      .mockReturnValueOnce(currentFilter.promise)
    const wrapper = mountView()
    await flushPromises()
    wrapper.vm.$.setupState.currentPage = 2

    wrapper.vm.$.setupState.filterTag = '旧筛选'
    const replacedLoad = wrapper.vm.$.setupState.loadDebates()
    wrapper.vm.$.setupState.filterTag = '新筛选'
    const currentLoad = wrapper.vm.$.setupState.loadDebates()
    replacedFilter.resolve(new Response(JSON.stringify({
      data: [debateRow('replaced', '被取代结果')],
      meta: { page: 1, page_size: 12, total: 1, has_more: false },
    }), { status: 200 }))

    await replacedLoad
    expect(wrapper.vm.$.setupState.currentPage).toBe(2)

    currentFilter.resolve(new Response(JSON.stringify({
      data: [debateRow('current', '当前结果')],
      meta: { page: 1, page_size: 12, total: 1, has_more: false },
    }), { status: 200 }))
    await currentLoad

    expect(wrapper.vm.$.setupState.currentPage).toBe(1)
    expect(wrapper.text()).toContain('当前结果')
    expect(wrapper.text()).not.toContain('被取代结果')
  })

  it('loads more with the last successfully applied filters', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('default', '默认结果')],
        meta: { page: 1, page_size: 12, total: 3, has_more: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('filtered-1', '筛选第一页')],
        meta: { page: 1, page_size: 12, total: 2, has_more: true },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('filtered-2', '筛选第二页')],
        meta: { page: 2, page_size: 12, total: 2, has_more: false },
      }), { status: 200 }))
    const wrapper = mountView()
    await flushPromises()

    wrapper.vm.$.setupState.filterStatus = 'concluded'
    wrapper.vm.$.setupState.filterTag = '已应用标签'
    await wrapper.vm.$.setupState.loadDebates()
    wrapper.vm.$.setupState.filterStatus = 'open'
    wrapper.vm.$.setupState.filterTag = '尚未应用标签'
    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    const filterQueries = fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost').searchParams)
    expect(filterQueries[2]?.get('page')).toBe('2')
    expect(filterQueries[2]?.get('status')).toBe('concluded')
    expect(filterQueries[2]?.get('tag')).toBe('已应用标签')
    expect(wrapper.text()).toContain('筛选第二页')
  })

  it('keeps the previous applied filters when replaced and current filters both fail', async () => {
    const replacedFilter = deferred<Response>()
    const currentFilter = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('default', '默认结果')],
        meta: { page: 1, page_size: 12, total: 3, has_more: true },
      }), { status: 200 }))
      .mockReturnValueOnce(replacedFilter.promise)
      .mockReturnValueOnce(currentFilter.promise)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [debateRow('default-3', '默认第三页')],
        meta: { page: 3, page_size: 12, total: 3, has_more: false },
      }), { status: 200 }))
    const wrapper = mountView()
    await flushPromises()
    wrapper.vm.$.setupState.currentPage = 2

    wrapper.vm.$.setupState.filterTag = '被取代标签'
    const replacedLoad = wrapper.vm.$.setupState.loadDebates()
    wrapper.vm.$.setupState.filterTag = '失败标签'
    const currentLoad = wrapper.vm.$.setupState.loadDebates()
    replacedFilter.resolve(new Response(JSON.stringify({
      data: [debateRow('replaced', '被取代结果')],
      meta: { page: 1, page_size: 12, total: 1, has_more: false },
    }), { status: 200 }))
    await replacedLoad
    currentFilter.resolve(new Response(null, { status: 500 }))
    await currentLoad

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    const loadMoreQuery = new URL(String(fetchMock.mock.calls[3]?.[0]), 'http://localhost').searchParams
    expect(loadMoreQuery.get('page')).toBe('3')
    expect(loadMoreQuery.get('tag')).toBeNull()
    expect(wrapper.text()).toContain('默认第三页')
    expect(wrapper.text()).not.toContain('被取代结果')
  })
})
