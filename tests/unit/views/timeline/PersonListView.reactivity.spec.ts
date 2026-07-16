import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PersonListView from '@/views/timeline/PersonListView.vue'
import { useAuthStore } from '@/stores/auth'
import { useTimelineStore } from '@/stores/timeline'
import type { TimelinePerson } from '@/types'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

const stubs = {
  PPageHeader: { template: '<header><slot name="action" /></header>' },
  PButton: {
    props: ['loading', 'disabled', 'label', 'loadingText'],
    template: '<button :disabled="disabled || loading" :data-loading="String(Boolean(loading))">{{ loading ? loadingText : label }}<slot /></button>',
  },
  PInput: { props: ['disabled'], template: '<input :disabled="disabled" />' },
  PTextarea: { template: '<textarea />' },
  PModal: { template: '<div><slot /><slot name="footer" /></div>' },
  PConfirm: {
    props: ['show', 'loading'],
    emits: ['confirm', 'cancel'],
    template: '<button data-test="confirm-delete" :disabled="loading" :data-loading="String(Boolean(loading))" @click="$emit(\'confirm\')">确认删除</button>',
  },
  PEmpty: { props: ['text'], template: '<div class="empty">{{ text }}</div>' },
  PEntry: { template: '<article><slot name="meta" /><slot name="title" /><slot name="summary" /><slot name="actions" /></article>' },
}

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

const person = (id: string, name: string) => ({
  id,
  user_id: 'user-1',
  name,
  bio: `${name} biography`,
  tags: [],
})

const listResponse = (data: ReturnType<typeof person>[], total: number, page = 1, limit = 20) => new Response(JSON.stringify({
  data,
  total,
  page,
  limit,
}), { status: 200 })

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

const mountView = () => mount(PersonListView, {
  global: {
    plugins: [pinia, router],
    stubs,
  },
})

describe('PersonListView timeline store reactivity', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(listResponse([], 0))
    vi.stubGlobal('fetch', fetchMock)
  })

  it('updates rendered persons when the setup store state changes after mount', async () => {
    const wrapper = mountView()

    await flushPromises()
    expect(wrapper.text()).toContain('暂无历史人物')

    const store = useTimelineStore()
    store.persons = [{
      id: 'person-1',
      user_id: 'user-1',
      name: 'Ada Lovelace',
      bio: 'Mathematician',
      tags: ['math'],
    } as TimelinePerson]
    await nextTick()

    expect(wrapper.text()).toContain('Ada Lovelace')
  })

  it('requests the first real page and distinguishes a loading failure from an empty result', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }))

    const wrapper = mountView()
    await flushPromises()

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost')
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', limit: '20' })
    expect(wrapper.text()).toContain('人物加载失败')
    expect(wrapper.text()).not.toContain('暂无历史人物')
  })

  it('keeps the first page in loading state until a successful empty response arrives', async () => {
    const firstPage = deferred<Response>()
    fetchMock.mockReturnValue(firstPage.promise)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('加载中...')
    expect(wrapper.text()).not.toContain('暂无历史人物')
    expect(wrapper.text()).not.toContain('人物加载失败')

    firstPage.resolve(listResponse([], 0))
    await flushPromises()

    expect(wrapper.text()).toContain('暂无历史人物')
    expect(wrapper.text()).not.toContain('加载中...')
  })

  it('keeps the first page visible while loading the next page and blocks duplicate requests', async () => {
    const nextPage = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(listResponse([person('person-1', 'Ada')], 2))
      .mockReturnValueOnce(nextPage.promise)
    const wrapper = mountView()
    await flushPromises()

    const firstLoad = wrapper.vm.$.setupState.loadMore()
    const duplicateLoad = wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Ada')
    expect(wrapper.text()).toContain('加载中...')

    nextPage.resolve(listResponse([person('person-2', 'Grace')], 2, 2))
    await Promise.all([firstLoad, duplicateLoad])
    await flushPromises()

    expect(wrapper.text()).toContain('Grace')
    expect(wrapper.text()).not.toContain('加载更多')
  })

  it('keeps the current page after a later-page failure and retries that page', async () => {
    fetchMock
      .mockResolvedValueOnce(listResponse([person('person-1', 'Ada')], 2))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(listResponse([person('person-2', 'Grace')], 2, 2))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    expect(wrapper.text()).toContain('Ada')
    expect(wrapper.text()).toContain('加载失败，请重试')
    expect(wrapper.vm.$.setupState.currentPage).toBe(1)

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    const requestedPages = fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost').searchParams.get('page'))
    expect(requestedPages).toEqual(['1', '2', '2'])
    expect(wrapper.text()).toContain('Grace')
    expect(wrapper.vm.$.setupState.currentPage).toBe(2)
  })

  it('lets a new search replace an in-flight later page without stale rows or page state', async () => {
    const oldNextPage = deferred<Response>()
    const filteredPage = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(listResponse([person('person-1', 'Ada')], 2))
      .mockReturnValueOnce(oldNextPage.promise)
      .mockReturnValueOnce(filteredPage.promise)
    const wrapper = mountView()
    await flushPromises()

    const oldLoad = wrapper.vm.$.setupState.loadMore()
    wrapper.vm.$.setupState.searchText = 'Grace'
    const searchLoad = wrapper.vm.$.setupState.doSearch()
    filteredPage.resolve(listResponse([person('person-filtered', 'Grace')], 1))
    await searchLoad
    oldNextPage.resolve(listResponse([person('person-stale', 'Stale')], 2, 2))
    await oldLoad
    await flushPromises()

    const urls = fetchMock.mock.calls.map(call => new URL(String(call[0]), 'http://localhost'))
    expect(urls.map(url => url.searchParams.get('page'))).toEqual(['1', '2', '1'])
    expect(urls[2]?.searchParams.get('search')).toBe('Grace')
    expect(wrapper.text()).toContain('Grace')
    expect(wrapper.text()).not.toContain('Stale')
    expect(wrapper.vm.$.setupState.currentPage).toBe(1)
    expect(wrapper.vm.$.setupState.appliedSearch).toBe('Grace')
  })

  it('reloads from page one after deletion so the shifted boundary row is not skipped', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => person(`person-${index + 1}`, `Person ${index + 1}`))
    const shiftedFirstPage = Array.from({ length: 20 }, (_, index) => person(`person-${index + 2}`, `Person ${index + 2}`))
    fetchMock
      .mockResolvedValueOnce(listResponse(firstPage, 22, 1))
      .mockResolvedValueOnce(listResponse([person('person-21', 'Person 21'), person('person-22', 'Person 22')], 22, 2))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(listResponse(shiftedFirstPage, 21, 1))
      .mockResolvedValueOnce(listResponse([person('person-22', 'Person 22')], 21, 2))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.vm.$.setupState.loadMore()
    wrapper.vm.$.setupState.deletingPerson = firstPage[0]
    await wrapper.vm.$.setupState.doDelete()
    await flushPromises()

    expect(wrapper.vm.$.setupState.currentPage).toBe(1)
    expect(useTimelineStore().personsTotal).toBe(21)
    expect(useTimelineStore().persons.map(item => item.id)).toContain('person-21')

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    const requests = fetchMock.mock.calls.map(([input, init]) => ({
      method: init?.method || 'GET',
      page: new URL(String(input), 'http://localhost').searchParams.get('page'),
    }))
    expect(requests).toEqual([
      { method: 'GET', page: '1' },
      { method: 'GET', page: '2' },
      { method: 'DELETE', page: null },
      { method: 'GET', page: '1' },
      { method: 'GET', page: '2' },
    ])
    expect(useTimelineStore().persons.map(item => item.id)).toEqual(
      Array.from({ length: 21 }, (_, index) => `person-${index + 2}`),
    )
    expect(wrapper.text()).not.toContain('加载更多')
  })

  it('retries page one when the post-delete realignment fails', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => person(`person-${index + 1}`, `Person ${index + 1}`))
    const shiftedFirstPage = Array.from({ length: 20 }, (_, index) => person(`person-${index + 2}`, `Person ${index + 2}`))
    fetchMock
      .mockResolvedValueOnce(listResponse(firstPage, 21, 1))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(listResponse(shiftedFirstPage, 20, 1))
    const wrapper = mountView()
    await flushPromises()

    wrapper.vm.$.setupState.deletingPerson = firstPage[0]
    await wrapper.vm.$.setupState.doDelete()
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败，请重试')
    expect(wrapper.vm.$.setupState.paginationInvalidated).toBe(true)

    await wrapper.vm.$.setupState.loadMore()
    await flushPromises()

    const pages = fetchMock.mock.calls.map(([input]) => new URL(String(input), 'http://localhost').searchParams.get('page'))
    expect(pages).toEqual(['1', null, '1', '1'])
    expect(wrapper.vm.$.setupState.currentPage).toBe(1)
    expect(wrapper.vm.$.setupState.paginationInvalidated).toBe(false)
    expect(useTimelineStore().persons.map(item => item.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `person-${index + 2}`),
    )
  })

  it('allows only one delete and blocks search and pagination until the captured search is reloaded', async () => {
    const deleteResponse = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(listResponse([person('person-1', 'Ada')], 2))
      .mockReturnValueOnce(deleteResponse.promise)
      .mockResolvedValueOnce(listResponse([person('person-2', 'Grace')], 1))
    const wrapper = mountView()
    await flushPromises()
    wrapper.vm.$.setupState.appliedSearch = 'before-delete'
    wrapper.vm.$.setupState.searchText = 'during-delete'
    wrapper.vm.$.setupState.deletingPerson = person('person-1', 'Ada')
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason)
    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const firstDelete = wrapper.vm.$.setupState.doDelete()
      const duplicateDelete = wrapper.vm.$.setupState.doDelete()
      const blockedSearch = wrapper.vm.$.setupState.doSearch()
      const blockedLoadMore = wrapper.vm.$.setupState.loadMore()
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
      expect(wrapper.vm.$.setupState.deleting).toBe(true)
      expect(wrapper.vm.$.setupState.appliedSearch).toBe('before-delete')
      expect(wrapper.vm.$.setupState.currentPage).toBe(1)
      expect(wrapper.get('input').attributes()).toHaveProperty('disabled')
      expect(wrapper.findAll('button').find(button => button.text().includes('搜索'))?.attributes()).toHaveProperty('disabled')
      expect(wrapper.findAll('button').find(button => button.text().includes('加载更多'))?.attributes()).toHaveProperty('disabled')
      expect(wrapper.get('[data-test="confirm-delete"]').attributes()).toHaveProperty('disabled')
      expect(wrapper.get('[data-test="confirm-delete"]').attributes('data-loading')).toBe('true')

      deleteResponse.resolve(new Response('', { status: 200 }))
      await Promise.all([firstDelete, duplicateDelete, blockedSearch, blockedLoadMore])
      await flushPromises()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(fetchMock).toHaveBeenCalledTimes(3)
      const reloadUrl = new URL(String(fetchMock.mock.calls[2]?.[0]), 'http://localhost')
      expect(Object.fromEntries(reloadUrl.searchParams)).toEqual({ search: 'before-delete', page: '1', limit: '20' })
      expect(wrapper.vm.$.setupState.appliedSearch).toBe('before-delete')
      expect(wrapper.vm.$.setupState.currentPage).toBe(1)
      expect(wrapper.vm.$.setupState.deleting).toBe(false)
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('resets deleting and keeps the confirmation open when deletion fails', async () => {
    fetchMock
      .mockResolvedValueOnce(listResponse([person('person-1', 'Ada')], 1))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'failed' }), { status: 500 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(listResponse([], 0))
    const wrapper = mountView()
    await flushPromises()
    wrapper.vm.$.setupState.deletingPerson = person('person-1', 'Ada')

    await expect(wrapper.vm.$.setupState.doDelete()).resolves.toBeUndefined()

    expect(wrapper.vm.$.setupState.deleting).toBe(false)
    expect(wrapper.vm.$.setupState.deletingPerson?.id).toBe('person-1')
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)

    await expect(wrapper.vm.$.setupState.doDelete()).resolves.toBeUndefined()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(2)
    expect(wrapper.vm.$.setupState.deleting).toBe(false)
    expect(wrapper.vm.$.setupState.deletingPerson).toBeNull()
  })

  it('blocks deletion while a search is pending and allows it after the search settles', async () => {
    const searchResponse = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(listResponse([person('person-old', 'Old')], 1))
      .mockReturnValueOnce(searchResponse.promise)
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(listResponse([], 0))
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.user = { uuid: 'user-1' } as never
    const wrapper = mountView()
    await flushPromises()
    wrapper.vm.$.setupState.searchText = 'current'
    const searchLoad = wrapper.vm.$.setupState.doSearch()
    wrapper.vm.$.setupState.startDelete(person('person-old', 'Old'))
    const blockedDelete = wrapper.vm.$.setupState.doDelete()

    try {
      await flushPromises()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0)
      expect(wrapper.vm.$.setupState.deletingPerson).toBeNull()
      expect(wrapper.findAll('button').find(button => button.text().includes('删除'))?.attributes()).toHaveProperty('disabled')
    } finally {
      searchResponse.resolve(listResponse([person('person-current', 'Current')], 1))
      await Promise.all([searchLoad, blockedDelete])
      await flushPromises()
    }

    wrapper.vm.$.setupState.startDelete(person('person-current', 'Current'))
    await wrapper.vm.$.setupState.doDelete()
    await flushPromises()

    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
    const reloadUrl = new URL(String(fetchMock.mock.calls[3]?.[0]), 'http://localhost')
    expect(Object.fromEntries(reloadUrl.searchParams)).toEqual({ search: 'current', page: '1', limit: '20' })
  })

  it('blocks search and pagination as soon as the delete modal opens', async () => {
    fetchMock
      .mockResolvedValueOnce(listResponse([person('person-1', 'Ada')], 2))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(listResponse([person('person-2', 'Grace')], 1))
    const wrapper = mountView()
    await flushPromises()
    wrapper.vm.$.setupState.startDelete(person('person-1', 'Ada'))
    wrapper.vm.$.setupState.searchText = 'blocked'

    await Promise.all([
      wrapper.vm.$.setupState.doSearch(),
      wrapper.vm.$.setupState.loadMore(),
    ])
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.$.setupState.appliedSearch).toBe('')
    expect(wrapper.vm.$.setupState.currentPage).toBe(1)
    expect(wrapper.get('input').attributes()).toHaveProperty('disabled')
    expect(wrapper.findAll('button').find(button => button.text().includes('搜索'))?.attributes()).toHaveProperty('disabled')
    expect(wrapper.findAll('button').find(button => button.text().includes('加载更多'))?.attributes()).toHaveProperty('disabled')

    await wrapper.vm.$.setupState.doDelete()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const reloadUrl = new URL(String(fetchMock.mock.calls[2]?.[0]), 'http://localhost')
    expect(Object.fromEntries(reloadUrl.searchParams)).toEqual({ page: '1', limit: '20' })
  })
})
