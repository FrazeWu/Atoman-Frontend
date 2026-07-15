import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import VideoHomeView from '@/views/video/VideoHomeView.vue'

const route = reactive({ query: {} as Record<string, string> })

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => route,
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const mountedWrappers: ReturnType<typeof mount>[] = []
const mountHome = () => {
  const wrapper = mount(VideoHomeView, {
    global: {
      stubs: {
        PButton: { template: '<button><slot /></button>' },
        PPageHeader: { template: '<header />' },
        PVideoCard: {
          props: ['video'],
          template: '<article data-testid="video-card">{{ video.title }}</article>',
        },
      },
    },
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('VideoHomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    route.query = {}
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => {
      if (wrapper.exists()) wrapper.unmount()
    })
  })

  it('忽略 sort 快速切换后的过期视频列表响应', async () => {
    const latest = deferred<Response>()
    const popular = deferred<Response>()

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/videos?sort=latest')) return latest.promise
      if (url.endsWith('/videos?sort=popular')) return popular.promise
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const wrapper = mountHome()

    await wrapper.findAll('button').find(button => button.text() === '最热播放')!.trigger('click')

    popular.resolve(makeJsonResponse([{ id: 'popular-1', title: '最热视频' }]))
    await flushPromises()
    expect(wrapper.text()).toContain('最热视频')

    const oldResponse = makeJsonResponse([{ id: 'latest-1', title: '旧的最新视频' }])
    const oldJSON = vi.spyOn(oldResponse, 'json')
    latest.resolve(oldResponse)
    await flushPromises()

    expect(oldJSON).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('最热视频')
    expect(wrapper.text()).not.toContain('旧的最新视频')
  })

  it('渲染 GET /videos 返回的原始视频数组', async () => {
    const fetchMock = vi.fn(async () => makeJsonResponse([{ id: 'video-1', title: '真实视频' }]))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountHome()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/videos?sort=latest')
    expect(wrapper.text()).toContain('真实视频')
    expect(wrapper.text()).not.toContain('视频加载失败')
  })

  it('保留 200 空数组的正常空态', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeJsonResponse([])))

    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无视频')
    expect(wrapper.text()).not.toContain('视频加载失败')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it.each([
    ['非 2xx', () => Promise.resolve(new Response(null, { status: 500 }))],
    ['网络失败', () => Promise.reject(new Error('offline'))],
    ['错误 JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('%s 时显示失败态并结束加载', async (_label, fetchResult) => {
    vi.stubGlobal('fetch', vi.fn(fetchResult))

    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('视频加载失败')
    expect(wrapper.text()).not.toContain('暂无视频')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it('忽略旧请求延迟返回的 JSON', async () => {
    const oldData = deferred<unknown>()
    const oldResponse = new Response(null, { status: 200 })
    const oldJSON = vi.spyOn(oldResponse, 'json').mockReturnValue(oldData.promise)
    const fetchMock = vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/videos?sort=latest')
        ? Promise.resolve(oldResponse)
        : Promise.resolve(makeJsonResponse([{ id: 'popular-1', title: '最新热门视频' }]))
    ))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mountHome()
    await vi.waitFor(() => expect(oldJSON).toHaveBeenCalledOnce())

    await wrapper.findAll('button').find(button => button.text() === '最热播放')!.trigger('click')
    await flushPromises()
    oldData.resolve([{ id: 'old-1', title: '旧 JSON 视频' }])
    await flushPromises()

    expect(wrapper.text()).toContain('最新热门视频')
    expect(wrapper.text()).not.toContain('旧 JSON 视频')
  })

  it('忽略旧请求的失败和 finally，保持最新请求加载状态', async () => {
    const oldRequest = deferred<Response>()
    const currentRequest = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => (
      String(input).endsWith('/videos?sort=latest') ? oldRequest.promise : currentRequest.promise
    )))
    const wrapper = mountHome()

    await wrapper.findAll('button').find(button => button.text() === '最热播放')!.trigger('click')
    oldRequest.reject(new Error('old failure'))
    await flushPromises()

    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(wrapper.vm.$.setupState.errorMessage).toBe('')

    currentRequest.resolve(makeJsonResponse([{ id: 'popular-1', title: '当前热门视频' }]))
    await flushPromises()
    expect(wrapper.text()).toContain('当前热门视频')
    expect(wrapper.vm.$.setupState.loading).toBe(false)
  })

  it('卸载后忽略迟到的成功响应和 finally', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    const wrapper = mountHome()
    const response = makeJsonResponse([{ id: 'late-1', title: '迟到视频' }])
    const responseJSON = vi.spyOn(response, 'json')

    wrapper.unmount()
    pending.resolve(response)
    await flushPromises()

    expect(responseJSON).not.toHaveBeenCalled()
    expect(wrapper.vm.$.setupState.videos).toEqual([])
    expect(wrapper.vm.$.setupState.loading).toBe(true)
  })

  it('卸载后忽略迟到失败且不产生未处理拒绝', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    const wrapper = mountHome()

    wrapper.unmount()
    pending.reject(new Error('late failure'))
    await flushPromises()

    expect(wrapper.vm.$.setupState.errorMessage).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(true)
  })

  it.each([
    ['成功', false],
    ['失败', true],
  ])('响应 JSON 已开始后卸载，迟到%s不写状态', async (_label, shouldReject) => {
    const data = deferred<unknown>()
    const response = new Response(null, { status: 200 })
    const responseJSON = vi.spyOn(response, 'json').mockReturnValue(data.promise)
    vi.stubGlobal('fetch', vi.fn(async () => response))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountHome()
    await vi.waitFor(() => expect(responseJSON).toHaveBeenCalledOnce())

    wrapper.unmount()
    if (shouldReject) data.reject(new Error('late JSON failure'))
    else data.resolve([{ id: 'late-json', title: '迟到 JSON 视频' }])
    await flushPromises()

    expect(wrapper.vm.$.setupState.videos).toEqual([])
    expect(wrapper.vm.$.setupState.errorMessage).toBe('')
    expect(wrapper.vm.$.setupState.loading).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('channel 查询变化时只保留最新频道响应', async () => {
    route.query = { channel_id: 'channel-a' }
    const channelA = deferred<Response>()
    const channelB = deferred<Response>()
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/videos?sort=latest&channel_id=channel-a')) return channelA.promise
      if (url.endsWith('/videos?sort=latest&channel_id=channel-b')) return channelB.promise
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mountHome()

    route.query = { channel_id: 'channel-b' }
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    channelB.resolve(makeJsonResponse([{ id: 'video-b', title: '频道 B 视频' }]))
    await flushPromises()
    channelA.resolve(makeJsonResponse([{ id: 'video-a', title: '频道 A 旧视频' }]))
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      '/api/v1/videos?sort=latest&channel_id=channel-a',
      '/api/v1/videos?sort=latest&channel_id=channel-b',
    ])
    expect(wrapper.text()).toContain('频道 B 视频')
    expect(wrapper.text()).not.toContain('频道 A 旧视频')
  })

  it('按收藏的视频频道请求真实筛选结果', async () => {
    route.query = { channel_id: 'channel-video-1' }
    const fetchMock = vi.fn(async () => makeJsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    mountHome()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/videos?sort=latest&channel_id=channel-video-1')
  })
})
