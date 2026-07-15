import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import ChannelManageView from '@/views/blog/ChannelManageView.vue'

const fetchMock = vi.fn()
let pinia: ReturnType<typeof createPinia>

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const blogChannel = (id: string, name: string, isDefault = false) => ({
  id,
  name,
  content_type: 'blog',
  is_default: isDefault,
})

const mountedWrappers: ReturnType<typeof mount>[] = []
const mountView = () => {
  const wrapper = mount(ChannelManageView, {
    global: {
      plugins: [pinia],
      stubs: {
        PCard: { template: '<article><slot /></article>' },
        PClip: { props: ['label'], template: '<button>{{ label }}</button>' },
        PEmpty: { props: ['title', 'description'], template: '<section>{{ title }} {{ description }}<slot name="action" /></section>' },
        PModal: { template: '<section><slot /><slot name="footer" /></section>' },
        PPageHeader: true,
        PPress: { props: ['label'], template: '<button>{{ label }}<slot /></button>' },
        PReject: { props: ['label'], template: '<button @click="$emit(\'click\')">{{ label }}<slot /></button>' },
      },
    },
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('ChannelManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) {
        return new Response(JSON.stringify({
          data: [
            { id: 'channel-1', name: '真实频道', content_type: 'blog', is_default: false },
            { id: 'channel-video', name: '视频频道', content_type: 'video', is_default: false },
          ],
        }), { status: 200 })
      }
      if (url.endsWith('/blog/channels/channel-1') && init?.method === 'DELETE') {
        return new Response(JSON.stringify({ data: { message: 'Channel deleted' } }), { status: 200 })
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

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => {
      if (wrapper.exists()) wrapper.unmount()
    })
  })

  it('deletes through the real endpoint without asking for a password or showing fake counts', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/channels?user_id=user-1', {
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.text()).toContain('真实频道')
    expect(wrapper.text()).not.toContain('视频频道')
    expect(wrapper.text()).not.toContain('0 个合集')
    expect(wrapper.text()).not.toContain('0篇文章')

    await wrapper.findAll('button').find((button) => button.text() === '删除')!.trigger('click')
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
    await wrapper.findAll('button').find((button) => button.text() === '确认删除')!.trigger('click')
    await flushPromises()

    const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
    expect(deleteCall?.[0]).toBe('/api/v1/blog/channels/channel-1')
    expect(deleteCall?.[1]?.body).toBeUndefined()
  })

  it('成功空列表时通过 ensure-default 展示真实默认频道', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) return response({ data: [] })
      if (url.endsWith('/blog/channels/ensure-default') && init?.method === 'POST') {
        return response({ data: {
          id: 'default-channel',
          name: '默认频道',
          content_type: 'blog',
          is_default: true,
        } })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/channels?user_id=user-1',
      '/api/v1/blog/channels/ensure-default',
    ])
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.text()).toContain('默认频道')
    expect(wrapper.text()).not.toContain('频道加载失败')
  })

  it.each([
    ['非 2xx', () => Promise.resolve(response({ error: { message: 'database unavailable' } }, 500))],
    ['网络失败', () => Promise.reject(new Error('offline'))],
    ['错误 JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('频道列表%s时显示失败且绝不调用 ensure-default', async (_label, fetchResult) => {
    fetchMock.mockImplementation(fetchResult)

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/v1/blog/channels?user_id=user-1')
    expect(wrapper.text()).toContain('频道加载失败')
    expect(wrapper.text()).not.toContain('暂无频道')
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(false)
  })

  it.each([
    ['非 2xx', () => Promise.resolve(response({ error: { message: 'ensure failed' } }, 500))],
    ['网络失败', () => Promise.reject(new Error('offline'))],
    ['错误 JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('ensure-default %s时显示失败且不显示假空态', async (_label, ensureResult) => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => (
      String(input).includes('/blog/channels?')
        ? Promise.resolve(response({ data: [] }))
        : ensureResult()
    ))

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('频道加载失败')
    expect(wrapper.text()).not.toContain('暂无频道')
    expect(wrapper.vm.$.setupState.channels).toEqual([])
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(false)
  })

  it('旧频道列表响应迟到时不解析 JSON、调用 ensure 或覆盖最新频道', async () => {
    const oldList = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(oldList.promise)
      .mockResolvedValueOnce(response({ data: [blogChannel('new-channel', '最新频道')] }))
    const wrapper = mountView()
    const latestLoad = wrapper.vm.$.setupState.loadChannels()
    await latestLoad
    const oldResponse = response({ data: [] })
    const oldJSON = vi.spyOn(oldResponse, 'json')

    oldList.resolve(oldResponse)
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/channels?user_id=user-1',
      '/api/v1/blog/channels?user_id=user-1',
    ])
    expect(oldJSON).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('最新频道')
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(false)
  })

  it('旧频道列表 JSON 迟到为空时不调用 ensure 或覆盖最新频道', async () => {
    const oldData = deferred<unknown>()
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(oldData.promise)
    fetchMock
      .mockResolvedValueOnce(oldResponse)
      .mockResolvedValueOnce(response({ data: [blogChannel('new-channel', '最新频道')] }))
    const wrapper = mountView()
    await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())

    const latestLoad = wrapper.vm.$.setupState.loadChannels()
    await latestLoad
    oldData.resolve({ data: [] })
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/channels?user_id=user-1',
      '/api/v1/blog/channels?user_id=user-1',
    ])
    expect(wrapper.text()).toContain('最新频道')
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(false)
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('旧 ensure-default 迟到%s时不污染最新频道列表', async (_label, shouldReject) => {
    const oldEnsure = deferred<Response>()
    let listRequests = 0
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/blog/channels?')) {
        listRequests += 1
        return Promise.resolve(response({ data: listRequests === 1 ? [] : [blogChannel('new-channel', '最新频道')] }))
      }
      if (url.endsWith('/blog/channels/ensure-default') && init?.method === 'POST') return oldEnsure.promise
      throw new Error(`unexpected fetch: ${url}`)
    })
    const wrapper = mountView()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const latestLoad = wrapper.vm.$.setupState.loadChannels()
    await latestLoad
    const oldResponse = response({ data: blogChannel('old-default', '旧默认频道', true) })
    const oldJSON = vi.spyOn(oldResponse, 'json')
    if (shouldReject) oldEnsure.reject(new Error('old ensure failure'))
    else oldEnsure.resolve(oldResponse)
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/blog/channels?user_id=user-1',
      '/api/v1/blog/channels/ensure-default',
      '/api/v1/blog/channels?user_id=user-1',
    ])
    expect(oldJSON).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('最新频道')
    expect(wrapper.text()).not.toContain('旧默认频道')
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(false)
  })

  it('旧加载失败和 finally 不污染仍在等待的最新加载', async () => {
    const oldList = deferred<Response>()
    const latestList = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(oldList.promise)
      .mockReturnValueOnce(latestList.promise)
    const wrapper = mountView()
    const latestLoad = wrapper.vm.$.setupState.loadChannels()

    oldList.reject(new Error('old failure'))
    await flushPromises()

    expect(wrapper.vm.$.setupState.loadingChannels).toBe(true)
    expect(wrapper.vm.$.setupState.loadError).toBe('')

    latestList.resolve(response({ data: [{
      id: 'latest-channel',
      name: '当前频道',
      content_type: 'blog',
      is_default: false,
    }] }))
    await latestLoad
    expect(wrapper.text()).toContain('当前频道')
  })

  it('卸载后不解析或写入迟到的频道列表', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValue(pending.promise)
    const wrapper = mountView()
    const lateResponse = response({ data: [{
      id: 'late-channel',
      name: '迟到频道',
      content_type: 'blog',
      is_default: false,
    }] })
    const lateJSON = vi.spyOn(lateResponse, 'json')

    wrapper.unmount()
    pending.resolve(lateResponse)
    await flushPromises()

    expect(lateJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.channels).toEqual([])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(true)
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('频道列表 JSON 已开始后卸载，迟到%s不写状态', async (_label, shouldReject) => {
    const data = deferred<unknown>()
    const listResponse = new Response(null, { status: 200 })
    const listJSON = vi.spyOn(listResponse, 'json').mockReturnValue(data.promise)
    fetchMock.mockResolvedValue(listResponse)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountView()
    await vi.waitFor(() => expect(listJSON).toHaveBeenCalledOnce())

    wrapper.unmount()
    if (shouldReject) data.reject(new Error('late list JSON failure'))
    else data.resolve({ data: [blogChannel('late-channel', '迟到频道')] })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(wrapper.vm.$.setupState.channels).toEqual([])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('ensure-default 请求未完成时卸载，迟到%s不写状态', async (_label, shouldReject) => {
    const ensure = deferred<Response>()
    fetchMock.mockImplementation((input: RequestInfo | URL) => (
      String(input).includes('/blog/channels?')
        ? Promise.resolve(response({ data: [] }))
        : ensure.promise
    ))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountView()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const ensureResponse = response({ data: blogChannel('late-default', '迟到默认频道', true) })
    const ensureJSON = vi.spyOn(ensureResponse, 'json')

    wrapper.unmount()
    if (shouldReject) ensure.reject(new Error('late ensure failure'))
    else ensure.resolve(ensureResponse)
    await flushPromises()

    expect(ensureJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.channels).toEqual([])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('ensure-default JSON 已开始后卸载，迟到%s不写状态', async (_label, shouldReject) => {
    const ensureData = deferred<unknown>()
    const ensureResponse = new Response(null, { status: 200 })
    const ensureJSON = vi.spyOn(ensureResponse, 'json').mockReturnValue(ensureData.promise)
    fetchMock.mockImplementation((input: RequestInfo | URL) => (
      String(input).includes('/blog/channels?')
        ? Promise.resolve(response({ data: [] }))
        : Promise.resolve(ensureResponse)
    ))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountView()
    await vi.waitFor(() => expect(ensureJSON).toHaveBeenCalledOnce())

    wrapper.unmount()
    if (shouldReject) ensureData.reject(new Error('late ensure JSON failure'))
    else ensureData.resolve({ data: blogChannel('late-default', '迟到默认频道', true) })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.vm.$.setupState.channels).toEqual([])
    expect(wrapper.vm.$.setupState.loadError).toBe('')
    expect(wrapper.vm.$.setupState.loadingChannels).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
