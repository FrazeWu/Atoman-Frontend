import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useInteractions } from '@/composables/useInteractions'

const fetchMock = vi.fn()

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)

  const authStore = useAuthStore()
  authStore.token = 'token-1'
})

describe('useInteractions', () => {
  it('calls module-prefixed like endpoint with target body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { liked: true, like_count: 2 } }),
    })

    const interactions = useInteractions('blog', 'post', 'post-1')
    await interactions.like()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/likes', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ target_type: 'post', target_id: 'post-1' }),
    }))
  })

  it('reads comments from data.items', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          items: [{ id: 'c1', content: 'hello', created_at: '2026-07-07T00:00:00Z' }],
          target: { comment_count: 1, like_count: 3, viewer_liked: true },
        },
      }),
    })

    const interactions = useInteractions('forum', 'forum_topic', 'topic-1')
    await interactions.fetchComments()

    expect(interactions.comments.value).toHaveLength(1)
    expect(interactions.comments.value[0].id).toBe('c1')
    expect(interactions.commentCount.value).toBe(1)
    expect(interactions.likeCount.value).toBe(3)
    expect(interactions.liked.value).toBe(true)
  })

  it('deletes comments through module delete endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })

    const interactions = useInteractions('videos', 'video', 'video-1')
    await interactions.deleteComment('comment-1')

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/videos/comments/comment-1', expect.objectContaining({
      method: 'DELETE',
      credentials: 'include',
    }))
  })
})
