import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useDefaultChannelsStore } from '@/stores/defaultChannels'

describe('default channels store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetch).mockReset()

    const authStore = useAuthStore()
    authStore.user = { id: 1, username: 'alice', email: 'alice@example.com', role: 'user' }
    authStore.isAuthenticated = true
  })

  it('loads default channels for blog, podcast, and video modules', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      data: {
        blog: { id: 'blog-channel-1', name: '博客默认频道', slug: 'blog-default' },
        podcast: { id: 'podcast-channel-1', name: '播客默认频道', slug: 'podcast-default' },
        video: { id: 'video-channel-1', name: '视频默认频道', slug: 'video-default' },
      },
    }), { status: 200 }))

    const store = useDefaultChannelsStore()
    await store.load()

    expect(fetch).toHaveBeenCalledWith('/api/v1/users/me/default-channels', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    expect(store.channels.blog?.name).toBe('博客默认频道')
    expect(store.channels.podcast?.slug).toBe('podcast-default')
    expect(store.channels.video?.id).toBe('video-channel-1')
  })

  it('updates local state after setting a module default channel', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          blog: null,
          podcast: null,
          video: null,
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'blog-channel-2', name: '新博客频道', slug: 'new-blog' },
      }), { status: 200 }))

    const store = useDefaultChannelsStore()
    await store.load()
    await store.setDefaultChannel('blog', 'blog-channel-2')

    expect(fetch).toHaveBeenLastCalledWith('/api/v1/users/me/default-channels/blog', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel_id: 'blog-channel-2' }),
    })
    expect(store.channels.blog).toEqual({
      id: 'blog-channel-2',
      name: '新博客频道',
      slug: 'new-blog',
    })
  })
})
