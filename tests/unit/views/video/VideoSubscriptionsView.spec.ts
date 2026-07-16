import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import VideoSubscriptionsView from '@/views/video/VideoSubscriptionsView.vue'

const makeVideo = (id: string) => ({
  id,
  title: id,
  description: '',
  thumbnail_url: '',
  video_url: `https://example.com/${id}.mp4`,
  storage_type: 'external',
  status: 'published',
  visibility: 'public',
  created_at: '2026-07-14T00:00:00Z',
})

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('VideoSubscriptionsView', () => {
  let pinia: Pinia

  beforeEach(() => {
    vi.restoreAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
  })

  it('loads real videos from subscribed channels', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      { ...makeVideo('video-1'), title: 'Subscribed video' },
    ]))

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/videos?subscribed=true&sort=latest&page=1&limit=20', {
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.text()).toContain('Subscribed video')
    expect(wrapper.text()).not.toContain('尚未开放')
  })

  it('shows the empty state for a successful empty subscription', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]))

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.text()).toContain('暂无订阅更新')
    expect(wrapper.text()).not.toContain('订阅内容加载失败')
  })

  it('handles invalid JSON as a load failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not-json', { status: 200 }))

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.text()).toContain('订阅内容加载失败')
    expect(wrapper.text()).not.toContain('暂无订阅更新')
  })

  it('treats a non-array JSON response as a load failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: [] }))

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.text()).toContain('订阅内容加载失败')
    expect(wrapper.text()).not.toContain('暂无订阅更新')
  })

  it('shows initial loading separately from empty and error states', async () => {
    const firstPage = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(firstPage.promise)

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.video-subscriptions-skeleton')).toHaveLength(8)
    expect(wrapper.text()).not.toContain('暂无订阅更新')
    expect(wrapper.text()).not.toContain('订阅内容加载失败')

    firstPage.resolve(jsonResponse([]))
    await flushPromises()
  })

  it('appends and deduplicates the next page', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => makeVideo(`video-${index + 1}`))
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse([makeVideo('video-20'), makeVideo('video-21')]))

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()
    expect(wrapper.text()).toContain('加载更多')

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/videos?subscribed=true&sort=latest&page=2&limit=20', {
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.findAllComponents({ name: 'PVideoCard' })).toHaveLength(21)
    expect(wrapper.text()).toContain('video-21')
    expect(wrapper.text()).not.toContain('加载更多')
  })

  it('keeps the current page and retries the same next page after a failure', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => makeVideo(`video-${index + 1}`))
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(jsonResponse([makeVideo('video-21')]))

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.findAllComponents({ name: 'PVideoCard' })).toHaveLength(20)
    expect(wrapper.text()).toContain('加载失败，请重试')

    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(fetchMock.mock.calls[1]?.[0]).toContain('page=2')
    expect(fetchMock.mock.calls[2]?.[0]).toContain('page=2')
    expect(wrapper.findAllComponents({ name: 'PVideoCard' })).toHaveLength(21)
  })

  it('prevents repeated next-page requests while loading', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => makeVideo(`video-${index + 1}`))
    const nextPage = deferred<Response>()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockReturnValueOnce(nextPage.promise)

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()
    const loadMore = wrapper.get('button')
    await Promise.all([loadMore.trigger('click'), loadMore.trigger('click')])
    await wrapper.vm.$nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('加载中...')
    expect(wrapper.findAllComponents({ name: 'PVideoCard' })).toHaveLength(20)

    nextPage.resolve(jsonResponse([]))
    await flushPromises()
    expect(wrapper.text()).not.toContain('加载更多')
  })

  it('ignores a response that resolves after unmount', async () => {
    const firstPage = deferred<Response>()
    vi.spyOn(globalThis, 'fetch').mockReturnValue(firstPage.promise)
    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    const setupState = wrapper.vm.$.setupState

    wrapper.unmount()
    firstPage.resolve(jsonResponse([makeVideo('late-video')]))
    await flushPromises()

    expect(setupState.videos).toEqual([])
    expect(setupState.loading).toBe(false)
    expect(setupState.error).toBe('')
  })

  it.each([
    ['401 response', () => Promise.resolve(new Response(null, { status: 401 }))],
    ['500 response', () => Promise.resolve(new Response(null, { status: 500 }))],
    ['network rejection', () => Promise.reject(new Error('offline'))],
  ])('shows a failure state instead of an empty subscription for %s', async (_label, fetchResult) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchResult)

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.text()).toContain('订阅内容加载失败')
    expect(wrapper.text()).not.toContain('暂无订阅更新')
  })
})
