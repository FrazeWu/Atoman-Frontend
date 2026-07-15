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

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/videos?subscribed=true&sort=latest')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer token' },
    })
    expect(wrapper.text()).toContain('Subscribed video')
    expect(wrapper.text()).not.toContain('尚未开放')
  })
})
