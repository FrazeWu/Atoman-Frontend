import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useAuthStore } from '@/stores/auth'
import CollectionManageView from '@/views/blog/CollectionManageView.vue'

const fetchMock = vi.fn()
const push = vi.fn()
let pinia: ReturnType<typeof createPinia>

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const modelStub = (tag: 'input' | 'textarea' | 'select') => defineComponent({
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template: tag === 'select'
    ? '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>'
    : `<${tag} :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`,
})

const mountView = () => mount(CollectionManageView, {
  global: {
    plugins: [pinia],
    stubs: {
      PButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
      PEmpty: { props: ['title'], template: '<div>{{ title }}</div>' },
      PInput: modelStub('input'),
      PModal: { template: '<section><slot /><slot name="footer" /></section>' },
      PPageHeader: true,
      PSelect: modelStub('select'),
      PTextarea: modelStub('textarea'),
    },
  },
})

describe('CollectionManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockReset()
    push.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) {
        return new Response(JSON.stringify({ data: [
          { id: 'channel-1', name: '文章频道', content_type: 'blog' },
          { id: 'channel-video', name: '视频频道', content_type: 'video' },
        ] }), { status: 200 })
      }
      if (url.endsWith('/blog/collections') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { id: 'collection-1' } }), { status: 201 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    pinia = createPinia()
    setActivePinia(pinia)
    const authStore = useAuthStore()
    authStore.token = 'token'
    authStore.isAuthenticated = true
    authStore.user = { uuid: 'user-1', username: 'user', email: 'user@example.com' }
  })

  it('creates a collection through its selected channel endpoint', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.a-fab').trigger('click')
    await wrapper.get('input').setValue('新合集')
    await wrapper.get('select').setValue('channel-1')
    await wrapper.findAll('button').find((button) => button.text() === '确定')!.trigger('click')
    await flushPromises()

    const createCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(createCall?.[0]).toBe('/api/v1/blog/channels/channel-1/collections')
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({ name: '新合集', description: '' })
  })

  it('loads the authenticated collection envelope and resolves the real channel name', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) {
        return new Response(JSON.stringify({ data: [
          { id: 'channel-1', name: '文章频道', content_type: 'blog' },
          { id: 'channel-video', name: '视频频道', content_type: 'video' },
        ] }), { status: 200 })
      }
      if (url.endsWith('/blog/collections')) {
        return new Response(JSON.stringify({ data: [
          { id: 'collection-1', channel_id: 'channel-1', name: '真实合集' },
          { id: 'collection-video', channel_id: 'channel-video', name: '视频合集' },
        ] }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(1,
      '/api/v1/blog/channels?user_id=user-1',
      { headers: { Authorization: 'Bearer token' } },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      '/api/v1/blog/collections',
      { headers: { Authorization: 'Bearer token' } },
    )

    expect(wrapper.text()).toContain('真实合集')
    expect(wrapper.text()).toContain('文章频道')
    expect(wrapper.text()).not.toContain('视频合集')
    expect(wrapper.text()).not.toContain('0篇文章')

    await wrapper.get('.a-card').trigger('click')
    expect(push).toHaveBeenCalledWith('/posts/collection/collection-1')
  })

  it('shows the real empty state for an authenticated 200 empty collection list', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无合集')
    expect(wrapper.text()).not.toContain('合集加载失败')
    expect(wrapper.vm.$.setupState.loadingCollections).toBe(false)
  })

  it.each([
    ['401', () => Promise.resolve(new Response(JSON.stringify({ error: { message: 'Login required' } }), { status: 401 }))],
    ['500', () => Promise.resolve(new Response(JSON.stringify({ error: { message: 'database unavailable' } }), { status: 500 }))],
    ['网络错误', () => Promise.reject(new Error('offline'))],
    ['错误 JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('频道列表%s时显示合集加载失败且不请求合集', async (_label, channelResult) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation(channelResult)

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/blog/channels?user_id=user-1',
      { headers: { Authorization: 'Bearer token' } },
    )
    expect(wrapper.text()).toContain('合集加载失败')
    expect(wrapper.text()).not.toContain('暂无合集')
    expect(wrapper.vm.$.setupState.channels).toEqual([])
    expect(wrapper.vm.$.setupState.collections).toEqual([])
    expect(wrapper.vm.$.setupState.loadingCollections).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('频道列表请求未完成时卸载，迟到%s不写状态或请求合集', async (_label, shouldReject) => {
    const channelResponse = deferred<Response>()
    const lateResponse = new Response(JSON.stringify({ data: [
      { id: 'late-channel', name: '迟到频道', content_type: 'blog' },
    ] }), { status: 200 })
    const lateJSON = vi.spyOn(lateResponse, 'json')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockReturnValue(channelResponse.promise)

    const wrapper = mountView()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    wrapper.unmount()
    if (shouldReject) channelResponse.reject(new Error('late channel failure'))
    else channelResponse.resolve(lateResponse)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(lateJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.channels).toEqual([])
    expect(wrapper.vm.$.setupState.collections).toEqual([])
    expect(wrapper.vm.$.setupState.collectionsLoadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingCollections).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('频道列表 JSON 已开始后卸载，迟到%s不写状态或请求合集', async (_label, shouldReject) => {
    const channelData = deferred<unknown>()
    const channelResponse = new Response(null, { status: 200 })
    const channelJSON = vi.spyOn(channelResponse, 'json').mockReturnValue(channelData.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValue(channelResponse)

    const wrapper = mountView()
    await vi.waitFor(() => expect(channelJSON).toHaveBeenCalledOnce())
    wrapper.unmount()
    if (shouldReject) channelData.reject(new Error('late channel JSON failure'))
    else channelData.resolve({ data: [
      { id: 'late-channel', name: '迟到频道', content_type: 'blog' },
    ] })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(wrapper.vm.$.setupState.channels).toEqual([])
    expect(wrapper.vm.$.setupState.collections).toEqual([])
    expect(wrapper.vm.$.setupState.collectionsLoadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingCollections).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['401', () => Promise.resolve(new Response(JSON.stringify({ error: { message: 'Login required' } }), { status: 401 }))],
    ['500', () => Promise.resolve(new Response(JSON.stringify({ error: { message: 'database unavailable' } }), { status: 500 }))],
    ['网络错误', () => Promise.reject(new Error('offline'))],
    ['错误 JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('合集列表%s时显示失败且不显示假空态', async (_label, collectionResult) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation((input: RequestInfo | URL) => (
      String(input).includes('/blog/channels?')
        ? Promise.resolve(new Response(JSON.stringify({ data: [
          { id: 'channel-1', name: '文章频道', content_type: 'blog' },
        ] }), { status: 200 }))
        : collectionResult()
    ))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('合集加载失败')
    expect(wrapper.text()).not.toContain('暂无合集')
    expect(wrapper.vm.$.setupState.collections).toEqual([])
    expect(wrapper.vm.$.setupState.loadingCollections).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('合集列表请求未完成时卸载，迟到%s不写状态', async (_label, shouldReject) => {
    const collectionResponse = deferred<Response>()
    const lateResponse = new Response(JSON.stringify({ data: [
      { id: 'late-collection', channel_id: 'channel-1', name: '迟到合集' },
    ] }), { status: 200 })
    const lateJSON = vi.spyOn(lateResponse, 'json')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation((input: RequestInfo | URL) => (
      String(input).includes('/blog/channels?')
        ? Promise.resolve(new Response(JSON.stringify({ data: [
          { id: 'channel-1', name: '文章频道', content_type: 'blog' },
        ] }), { status: 200 }))
        : collectionResponse.promise
    ))

    const wrapper = mountView()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    wrapper.unmount()
    if (shouldReject) collectionResponse.reject(new Error('late collection failure'))
    else collectionResponse.resolve(lateResponse)
    await flushPromises()

    expect(lateJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.collections).toEqual([])
    expect(wrapper.vm.$.setupState.collectionsLoadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingCollections).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('合集列表 JSON 已开始后卸载，迟到%s不写状态', async (_label, shouldReject) => {
    const collectionData = deferred<unknown>()
    const collectionResponse = new Response(null, { status: 200 })
    const collectionJSON = vi.spyOn(collectionResponse, 'json').mockReturnValue(collectionData.promise)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation((input: RequestInfo | URL) => (
      String(input).includes('/blog/channels?')
        ? Promise.resolve(new Response(JSON.stringify({ data: [
          { id: 'channel-1', name: '文章频道', content_type: 'blog' },
        ] }), { status: 200 }))
        : Promise.resolve(collectionResponse)
    ))

    const wrapper = mountView()
    await vi.waitFor(() => expect(collectionJSON).toHaveBeenCalledOnce())
    wrapper.unmount()
    if (shouldReject) collectionData.reject(new Error('late collection JSON failure'))
    else collectionData.resolve({ data: [
      { id: 'late-collection', channel_id: 'channel-1', name: '迟到合集' },
    ] })
    await flushPromises()

    expect(wrapper.vm.$.setupState.collections).toEqual([])
    expect(wrapper.vm.$.setupState.collectionsLoadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingCollections).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
