import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PodcastHomeView from '@/views/podcast/PodcastHomeView.vue'

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

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
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/podcast/episodes')
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
})
