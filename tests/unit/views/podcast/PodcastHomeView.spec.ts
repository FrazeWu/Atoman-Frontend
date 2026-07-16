import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PodcastHomeView from '@/views/podcast/PodcastHomeView.vue'

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

const episode = (id: string) => ({
  id,
  post_id: `post-${id}`,
  channel_id: 'channel-1',
  post: { id: `post-${id}`, title: id },
  channel: { id: 'channel-1', name: '真实节目' },
  audio_url: `https://cdn.example.com/${id}.mp3`,
  duration_sec: 125,
  created_at: '2026-07-15T00:00:00Z',
  updated_at: '2026-07-15T00:00:00Z',
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/podcasts', component: PodcastHomeView }],
  })
  await router.push('/podcasts')
  await router.isReady()

  return mount(PodcastHomeView, {
    global: { plugins: [router] },
  })
}

describe('PodcastHomeView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
  })

  it('loads the published episode array from the podcast endpoint', async () => {
    const fetchMock = vi.fn(async () => response([{
      id: 'episode-1',
      post_id: 'post-1',
      channel_id: 'channel-1',
      post: { id: 'post-1', title: '真实单集' },
      channel: { id: 'channel-1', name: '真实节目' },
      audio_url: 'https://cdn.example.com/episode-1.mp3',
      duration_sec: 125,
      created_at: '2026-07-15T00:00:00Z',
      updated_at: '2026-07-15T00:00:00Z',
    }]))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = await mountHome()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/podcast/episodes?sort=latest&page=1&limit=20')
    expect(wrapper.text()).toContain('真实单集')
    expect(wrapper.text()).toContain('真实节目')
    expect(wrapper.text()).not.toContain('暂无节目')
  })

  it('keeps an empty successful response as the empty state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([])))

    const wrapper = await mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无节目')
    expect(wrapper.text()).not.toContain('加载失败')
  })

  it('shows a failure state for a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: 'database unavailable' }, 500)))

    const wrapper = await mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败，请重试')
    expect(wrapper.text()).not.toContain('暂无节目')
  })

  it.each([
    ['network error', () => Promise.reject(new Error('offline'))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('shows a failure state for %s', async (_label, fetchResult) => {
    vi.stubGlobal('fetch', vi.fn(fetchResult))

    const wrapper = await mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败，请重试')
    expect(wrapper.text()).not.toContain('暂无节目')
  })

  it('treats a non-array JSON response as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ data: [] })))

    const wrapper = await mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('加载失败，请重试')
    expect(wrapper.text()).not.toContain('暂无节目')
  })

  it('keeps initial loading separate from empty and failure states', async () => {
    const firstPage = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => firstPage.promise))

    const wrapper = await mountHome()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.a-skeleton')).toHaveLength(3)
    expect(wrapper.text()).not.toContain('暂无节目')
    expect(wrapper.text()).not.toContain('加载失败，请重试')

    firstPage.resolve(response([]))
    await flushPromises()
  })

  it('appends and deduplicates the next page', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => episode(`episode-${index + 1}`))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(firstPage))
      .mockResolvedValueOnce(response([episode('episode-20'), episode('episode-21')]))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = await mountHome()
    await flushPromises()
    expect(wrapper.text()).toContain('加载更多')

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/podcast/episodes?sort=latest&page=2&limit=20')
    expect(wrapper.findAllComponents({ name: 'PEntry' })).toHaveLength(21)
    expect(wrapper.text()).toContain('episode-21')
    expect(wrapper.text()).not.toContain('加载更多')
  })

  it('preserves episodes and retries the same page after a later failure', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => episode(`episode-${index + 1}`))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(firstPage))
      .mockResolvedValueOnce(response({ error: 'offline' }, 500))
      .mockResolvedValueOnce(response([episode('episode-21')]))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = await mountHome()
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.findAllComponents({ name: 'PEntry' })).toHaveLength(20)
    expect(wrapper.text()).toContain('加载失败，请重试')

    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(fetchMock.mock.calls[1]?.[0]).toContain('page=2')
    expect(fetchMock.mock.calls[2]?.[0]).toContain('page=2')
    expect(wrapper.findAllComponents({ name: 'PEntry' })).toHaveLength(21)
  })

  it('prevents duplicate later-page requests and hides the button after an empty page', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => episode(`episode-${index + 1}`))
    const nextPage = deferred<Response>()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(firstPage))
      .mockReturnValueOnce(nextPage.promise)
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = await mountHome()
    await flushPromises()
    const loadMore = wrapper.get('button')
    await Promise.all([loadMore.trigger('click'), loadMore.trigger('click')])
    await wrapper.vm.$nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('加载中...')
    expect(wrapper.findAllComponents({ name: 'PEntry' })).toHaveLength(20)

    nextPage.resolve(response([]))
    await flushPromises()
    expect(wrapper.text()).not.toContain('加载更多')
  })

  it('ignores a response that resolves after unmount', async () => {
    const firstPage = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => firstPage.promise))
    const wrapper = await mountHome()
    const setupState = wrapper.vm.$.setupState

    wrapper.unmount()
    firstPage.resolve(response([episode('late-episode')]))
    await flushPromises()

    expect(setupState.episodes).toEqual([])
    expect(setupState.loading).toBe(false)
    expect(setupState.error).toBe('')
  })
})
