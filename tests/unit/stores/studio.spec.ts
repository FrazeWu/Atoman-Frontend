import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useStudioStore } from '@/stores/studio'

const channelA = { id: 'channel-a', name: '频道 A', slug: 'channel-a', cover_url: '' }
const channelB = { id: 'channel-b', name: '频道 B', slug: 'channel-b', cover_url: '' }

function ok(data: unknown, meta?: unknown) {
  return new Response(JSON.stringify({ data, ...(meta ? { meta } : {}) }), { status: 200 })
}

describe('studio store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetch).mockReset()
    localStorage.clear()

    const auth = useAuthStore()
    auth.user = { id: 1, uuid: 'user-1', username: 'alice', email: 'alice@example.com', role: 'user' }
    auth.isAuthenticated = true
  })

  it('loads one current channel for all creator modules', async () => {
    vi.mocked(fetch).mockResolvedValue(ok({ current_channel: channelA, channels: [channelA, channelB] }))

    const store = useStudioStore()
    await store.loadState()

    expect(store.currentChannel).toEqual(channelA)
    expect(store.channels).toEqual([channelA, channelB])
    expect(fetch).toHaveBeenCalledWith('/api/v1/studio/state', expect.objectContaining({ credentials: 'include' }))
  })

  it('switches channel and reloads the active studio resource', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockResolvedValueOnce(ok({ channel_subscriber_count: 2, sections: [] }))
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
      .mockResolvedValueOnce(ok({ channel_subscriber_count: 4, sections: [] }))

    const store = useStudioStore()
    await store.loadState()
    await store.loadDashboard()
    await store.selectChannel(channelB.id)

    expect(store.currentChannel?.id).toBe(channelB.id)
    expect(store.dashboard?.channel_subscriber_count).toBe(4)
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/studio/dashboard?channel_id=channel-b', expect.any(Object))
  })

  it('keeps dashboard section failures isolated', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockResolvedValueOnce(ok({
        channel_subscriber_count: 3,
        sections: [
          { module: 'blog', metrics: { published: 2 }, recent: [], issues: [] },
          { module: 'podcast', metrics: {}, recent: [], issues: [], error: '加载失败' },
          { module: 'video', metrics: { published: 1 }, recent: [], issues: [] },
        ],
      }))

    const store = useStudioStore()
    await store.loadState()
    await store.loadDashboard()

    expect(store.dashboard?.sections).toHaveLength(3)
    expect(store.dashboard?.sections[0]?.metrics.published).toBe(2)
    expect(store.dashboard?.sections[1]?.error).toBe('加载失败')
    expect(store.dashboard?.sections[2]?.metrics.published).toBe(1)
  })

  it('passes collection filters to content requests', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockResolvedValueOnce(ok([], { page: 2, page_size: 20, total: 0 }))

    const store = useStudioStore()
    await store.loadState()
    await store.loadContents('blog', {
      q: '研究',
      status: 'draft',
      visibility: 'subscribers',
      collection_id: 'collection-1',
      page: 2,
    })

    const requested = String(vi.mocked(fetch).mock.calls[1]?.[0])
    expect(requested).toContain('/api/v1/studio/blog/contents?')
    expect(requested).toContain('channel_id=channel-a')
    expect(requested).toContain('collection_id=collection-1')
    expect(requested).toContain('status=draft')
    expect(requested).toContain('visibility=subscribers')
    expect(requested).toContain('q=%E7%A0%94%E7%A9%B6')
    expect(requested).toContain('page=2')
  })

  it('resets studio state after logout', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const studio = useStudioStore()
    await studio.loadState()
    await useAuthStore().logout()
    await nextTick()

    expect(studio.currentChannel).toBeNull()
    expect(studio.channels).toEqual([])
    expect(studio.loaded).toBe(false)
  })
})
