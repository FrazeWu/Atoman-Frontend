import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import VideoHomeView from '@/views/video/VideoHomeView.vue'

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
  })

  it('忽略 sort 快速切换后的过期视频列表响应', async () => {
    const latest = deferred<Response>()
    const popular = deferred<Response>()

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/videos?sort=latest')) return latest.promise
      if (url.endsWith('/videos?sort=popular')) return popular.promise
      if (url.includes('/videos/recommend/items?mode=hot&page=1&page_size=8')) {
        return Promise.resolve(makeJsonResponse({ data: [], meta: { page: 1, page_size: 8, total: 0, has_more: false } }))
      }
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

  it('加载推荐视频并在模式切换时请求对应接口', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/videos?sort=latest')) {
        return makeJsonResponse([{ id: 'latest-1', title: '最新视频' }])
      }
      if (url.includes('/videos/recommend/items?mode=hot&page=1&page_size=8')) {
        return makeJsonResponse({
          data: [{
            id: 'rec-1', title: '推荐视频', target_path: '/videos/watch/rec-1', content_type: 'video', score_label: '热度 92',
            video: { id: 'rec-1', title: '推荐视频', created_at: '2026-08-12T00:00:00Z', view_count: 3, channel: { name: '视频频道' } },
          }],
          meta: { page: 1, page_size: 8, total: 1, has_more: false },
        })
      }
      if (url.includes('/videos/recommend/items?mode=featured&page=1&page_size=8')) {
        return makeJsonResponse({
          data: [{
            id: 'rec-2', title: '精选视频', target_path: '/videos/watch/rec-2', content_type: 'video', score_label: '精选 88',
            video: { id: 'rec-2', title: '精选视频', created_at: '2026-08-11T00:00:00Z', view_count: 2, channel: { name: '精选频道' } },
          }],
          meta: { page: 1, page_size: 8, total: 1, has_more: false },
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

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

    await flushPromises()

    const requestedUrls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedUrls).toContain('/api/v1/videos/recommend/items?mode=hot&page=1&page_size=8')
    expect(requestedUrls).not.toContain('/api/v1/videos/rec-1')

    await wrapper.findAll('button').find(button => button.text() === '精选')!.trigger('click')
    await flushPromises()

    const requestedAfterSwitch = fetchMock.mock.calls.map(([input]) => String(input))
    expect(requestedAfterSwitch).toContain('/api/v1/videos/recommend/items?mode=featured&page=1&page_size=8')
  })

  it('推荐列表翻页时请求下一页', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/videos?sort=latest')) return makeJsonResponse([])
      if (url.includes('/videos/recommend/items?mode=hot&page=1&page_size=8')) {
        return makeJsonResponse({
          data: [{ id: 'rec-1', title: '第一页', video: { id: 'rec-1', title: '第一页' } }],
          meta: { page: 1, page_size: 8, total: 9, has_more: true },
        })
      }
      if (url.includes('/videos/recommend/items?mode=hot&page=2&page_size=8')) {
        return makeJsonResponse({
          data: [{ id: 'rec-9', title: '第二页', video: { id: 'rec-9', title: '第二页' } }],
          meta: { page: 2, page_size: 8, total: 9, has_more: false },
        })
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

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

    await flushPromises()
    await wrapper.find('button[aria-label="下一页"]').trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
      '/api/v1/videos/recommend/items?mode=hot&page=2&page_size=8',
    )
    expect(wrapper.text()).toContain('第二页')
  })
})
