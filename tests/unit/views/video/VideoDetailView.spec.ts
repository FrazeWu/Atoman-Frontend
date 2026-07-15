import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import VideoDetailView from '@/views/video/VideoDetailView.vue'

// stub fetch globally
beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [] }),
  }))
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const makeJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const makeVideo = (id: string, title: string, viewCount = 0) => ({
  id,
  title,
  user_id: 'user-1',
  channel_id: 'channel-1',
  video_url: `https://example.com/${id}.mp4`,
  storage_type: 'external',
  view_count: viewCount,
  created_at: '2026-06-30T00:00:00Z',
})

describe('VideoDetailView', () => {
  it('mounts without crashing with loading state', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/:id', component: { template: '<div/>' } }],
    })
    await router.push('/videos/test-id')

    // Just test that PVideoPlayerShell is defined and importable
    const { default: PVideoPlayerShell } = await import('@/components/shared/PVideoPlayerShell.vue')
    expect(PVideoPlayerShell).toBeDefined()
  })

  it('忽略路由 id 快速切换后的过期详情响应', async () => {
    const firstVideo = deferred<Response>()
    const firstRecommended = deferred<Response>()
    const secondVideo = deferred<Response>()
    const secondRecommended = deferred<Response>()

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return Promise.resolve(makeJsonResponse({}))
      if (url.endsWith('/videos/first')) return firstVideo.promise
      if (url.endsWith('/videos/first/recommended')) return firstRecommended.promise
      if (url.endsWith('/videos/second')) return secondVideo.promise
      if (url.endsWith('/videos/second/recommended')) return secondRecommended.promise
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/:id', component: VideoDetailView }],
    })
    await router.push('/videos/first')

    const wrapper = mount(VideoDetailView, {
      global: {
        plugins: [router],
        stubs: {
          PVideoPlayerShell: { template: '<section><slot name="player" /><slot /></section>' },
          VideoCommentSection: { template: '<section />' },
          VideoContinueList: {
            props: ['videos'],
            template: '<aside>{{ videos.map((video) => video.title).join(",") }}</aside>',
          },
        },
      },
    })

    await router.push('/videos/second')

    secondVideo.resolve(makeJsonResponse(makeVideo('second', '当前视频')))
    secondRecommended.resolve(makeJsonResponse([makeVideo('second-rec', '当前推荐')]))
    await flushPromises()
    expect(wrapper.text()).toContain('当前视频')
    expect(wrapper.text()).toContain('当前推荐')

    firstVideo.resolve(makeJsonResponse(makeVideo('first', '过期视频')))
    firstRecommended.resolve(makeJsonResponse([makeVideo('first-rec', '过期推荐')]))
    await flushPromises()

    expect(wrapper.text()).toContain('当前视频')
    expect(wrapper.text()).toContain('当前推荐')
    expect(wrapper.text()).not.toContain('过期视频')
    expect(wrapper.text()).not.toContain('过期推荐')
  })
})

describe('VideoDetailView layout', () => {
  it('PVideoPlayerShell component is importable', async () => {
    const { default: PVideoPlayerShell } = await import('@/components/shared/PVideoPlayerShell.vue')
    expect(PVideoPlayerShell).toBeDefined()
  })

  it('VideoCommentSection component is importable', async () => {
    const { default: VideoCommentSection } = await import('@/components/video/VideoCommentSection.vue')
    expect(VideoCommentSection).toBeDefined()
  })
})

describe('VideoDetailView view count', () => {
  const mountDetail = async (id: string) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/videos/:id', component: VideoDetailView }],
    })
    await router.push(`/videos/${id}`)
    const wrapper = mount(VideoDetailView, {
      global: {
        plugins: [router],
        stubs: {
          PVideoPlayerShell: { template: '<section><slot name="player" /><slot /></section>' },
          VideoCommentSection: { template: '<section />' },
          VideoContinueList: { template: '<aside />' },
        },
      },
    })
    return { router, wrapper }
  }

  it('shows the updated count returned by the increment endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return Promise.resolve(makeJsonResponse({ ok: true, view_count: 8 }))
      if (url.endsWith('/recommended')) return Promise.resolve(makeJsonResponse([]))
      return Promise.resolve(makeJsonResponse(makeVideo('video-1', '计数视频', 7)))
    }))

    const { wrapper } = await mountDetail('video-1')
    await flushPromises()

    expect(wrapper.text()).toContain('8 次播放')
  })

  it.each([
    ['non-2xx', () => Promise.resolve(new Response('', { status: 500 }))],
    ['network error', () => Promise.reject(new Error('network failed'))],
    ['invalid JSON', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('keeps the detail count when increment fails with %s', async (_case, incrementResponse) => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return incrementResponse()
      if (url.endsWith('/recommended')) return Promise.resolve(makeJsonResponse([]))
      return Promise.resolve(makeJsonResponse(makeVideo('video-1', '计数视频', 7)))
    }))

    const { wrapper } = await mountDetail('video-1')
    await flushPromises()

    expect(wrapper.text()).toContain('7 次播放')
  })

  it('does not let an old increment response overwrite the current video', async () => {
    const firstIncrement = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.includes('/videos/first/view')) return firstIncrement.promise
      if (init?.method === 'POST' && url.includes('/videos/second/view')) return Promise.resolve(makeJsonResponse({ ok: true, view_count: 21 }))
      if (url.endsWith('/recommended')) return Promise.resolve(makeJsonResponse([]))
      if (url.endsWith('/videos/first')) return Promise.resolve(makeJsonResponse(makeVideo('first', '第一个视频', 7)))
      if (url.endsWith('/videos/second')) return Promise.resolve(makeJsonResponse(makeVideo('second', '第二个视频', 20)))
      throw new Error(`unexpected fetch: ${url}`)
    }))

    const { router, wrapper } = await mountDetail('first')
    await flushPromises()
    await router.push('/videos/second')
    await flushPromises()
    expect(wrapper.text()).toContain('21 次播放')

    firstIncrement.resolve(makeJsonResponse({ ok: true, view_count: 8 }))
    await flushPromises()

    expect(wrapper.text()).toContain('21 次播放')
    expect(wrapper.text()).not.toContain('8 次播放')
  })

  it('does not update loaded state after unmount', async () => {
    const increment = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/view')) return increment.promise
      if (url.endsWith('/recommended')) return Promise.resolve(makeJsonResponse([]))
      return Promise.resolve(makeJsonResponse(makeVideo('video-1', '计数视频', 7)))
    }))

    const { wrapper } = await mountDetail('video-1')
    await flushPromises()
    const loadedVideo = wrapper.vm.$.setupState.video as { view_count: number }
    wrapper.unmount()

    increment.resolve(makeJsonResponse({ ok: true, view_count: 8 }))
    await flushPromises()

    expect(loadedVideo.view_count).toBe(7)
  })
})
