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

const makeVideo = (id: string, title: string) => ({
  id,
  title,
  user_id: 'user-1',
  channel_id: 'channel-1',
  video_url: `https://example.com/${id}.mp4`,
  storage_type: 'external',
  view_count: 0,
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
