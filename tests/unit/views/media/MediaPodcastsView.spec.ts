import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MediaPodcastsView from '@/views/media/MediaPodcastsView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

const mountView = () => mount(MediaPodcastsView, {
  global: {
    config: { errorHandler: vi.fn() },
    stubs: {
      PBadge: { template: '<span><slot /></span>' },
      PButton: true,
      PEmpty: { props: ['text'], template: '<div>{{ text }}</div>' },
      PEntry: { props: ['title'], template: '<article>{{ title }}</article>' },
      PPageHeader: { template: '<header><slot name="action" /></header>' },
    },
  },
})

describe('MediaPodcastsView', () => {
  beforeEach(() => {
    push.mockReset()
  })

  it('显示后端返回的真实播客单集数组', async () => {
    const fetchMock = vi.fn(async () => response([{
      id: 'episode-1',
      post: { title: '真实播客单集' },
      created_at: '2026-07-16T00:00:00Z',
    }]))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/podcast/episodes?sort=latest&limit=40')
    expect(wrapper.text()).toContain('真实播客单集')
    expect(wrapper.text()).not.toContain('暂无播客')
    expect(wrapper.text()).not.toContain('播客加载失败')
  })

  it('200 空数组显示真实空态', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([])))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无播客')
    expect(wrapper.text()).not.toContain('播客加载失败')
  })

  it.each([
    ['非 2xx', () => Promise.resolve(response({ error: 'database unavailable' }, 500))],
    ['网络异常', () => Promise.reject(new Error('offline'))],
    ['JSON 解析失败', () => Promise.resolve(new Response('not-json', { status: 200 }))],
  ])('%s 时显示失败态而非空态', async (_label, fetchResult) => {
    vi.stubGlobal('fetch', vi.fn(fetchResult))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('播客加载失败')
    expect(wrapper.text()).not.toContain('暂无播客')
  })
})
