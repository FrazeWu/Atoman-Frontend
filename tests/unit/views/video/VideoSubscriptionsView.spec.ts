import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import VideoSubscriptionsView from '@/views/video/VideoSubscriptionsView.vue'

describe('VideoSubscriptionsView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.token = 'token'
    auth.isAuthenticated = true
  })

  it('loads real videos from subscribed channels', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      {
        id: 'video-1',
        title: 'Subscribed video',
        description: 'Description',
        thumbnail_url: '',
        video_url: 'https://example.com/video.mp4',
        storage_type: 'external',
        status: 'published',
        visibility: 'public',
        created_at: '2026-07-14T00:00:00Z',
      },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const wrapper = mount(VideoSubscriptionsView, { global: { plugins: [pinia] } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/videos?subscribed=true&sort=latest', {
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.text()).toContain('Subscribed video')
    expect(wrapper.text()).not.toContain('尚未开放')
  })

  it('shows the empty state for a successful empty subscription', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))

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
