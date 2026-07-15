import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import VideoHomeView from '@/views/video/VideoHomeView.vue'

const { routeQuery } = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string>,
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ query: routeQuery }),
  }
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

describe('VideoHomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key])
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

    await wrapper.findAll('button').find(button => button.text() === '最热播放')!.trigger('click')

    popular.resolve(makeJsonResponse([{ id: 'popular-1', title: '最热视频' }]))
    await flushPromises()
    expect(wrapper.text()).toContain('最热视频')

    latest.resolve(makeJsonResponse([{ id: 'latest-1', title: '旧的最新视频' }]))
    await flushPromises()

    expect(wrapper.text()).toContain('最热视频')
    expect(wrapper.text()).not.toContain('旧的最新视频')
  })

  it('按收藏的视频频道请求真实筛选结果', async () => {
    routeQuery.channel_id = 'channel-video-1'
    const fetchMock = vi.fn(async () => makeJsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    mount(VideoHomeView, {
      global: {
        stubs: {
          PButton: true,
          PPageHeader: true,
          PVideoCard: true,
        },
      },
    })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/videos?sort=latest&channel_id=channel-video-1')
  })
})
