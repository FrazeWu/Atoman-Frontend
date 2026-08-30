import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInteractions } from '@/composables/useInteractions'

const fetchMock = vi.fn()
const response = (payload: unknown) => new Response(JSON.stringify(payload), { status: 200 })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

beforeEach(() => {
  setActivePinia(createPinia())
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)

  const authStore = useAuthStore()
  authStore.token = 'token-1'
})

describe('useInteractions', () => {
  it('calls module-prefixed like endpoint with target body', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { Liked: true, LikeCount: 2 } }))

    const interactions = useInteractions('blog', 'post', 'post-1')
    await interactions.like()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/likes', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ target_type: 'post', target_id: 'post-1' }),
    }))
    expect(interactions.liked.value).toBe(true)
    expect(interactions.likeCount.value).toBe(2)
  })

  it('reads comments from data.items and counts replies', async () => {
    fetchMock.mockResolvedValueOnce(response({
        data: {
          items: [{
            id: 'c1',
            content: 'hello',
            created_at: '2026-07-07T00:00:00Z',
            replies: [
              { id: 'c2', content: 'reply', created_at: '2026-07-07T00:01:00Z' },
              { id: 'c3', content: 'reply 2', created_at: '2026-07-07T00:02:00Z' },
            ],
          }],
          target: { comment_count: 1, like_count: 3, viewer_liked: true },
        },
      }))

    const interactions = useInteractions('forum', 'forum_topic', 'topic-1')
    await interactions.fetchComments()

    expect(interactions.comments.value).toHaveLength(1)
    expect(interactions.comments.value[0].id).toBe('c1')
    expect(interactions.commentCount.value).toBe(3)
    expect(interactions.likeCount.value).toBe(3)
    expect(interactions.liked.value).toBe(true)
  })

  it('uses the unified blog discussion endpoints', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { items: [] } }))

    const interactions = useInteractions('blog', 'post', 'post-1')
    await interactions.fetchComments()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/discussions/blog_post/post-1/comments', expect.anything())
  })

  it('uses unified Forum discussion comments and topic like endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ data: { items: [], target: { comment_count: 0 } } }))
      .mockResolvedValueOnce(response({ data: { liked: true } }))
      .mockResolvedValueOnce(response({ data: { ok: true } }))
      .mockResolvedValueOnce(response({ data: { items: [], target: { comment_count: 1 } } }))

    const interactions = useInteractions('forum', 'forum_topic', 'topic-1')
    await interactions.fetchComments()
    await interactions.like()
    await interactions.createComment('reply', 'comment-1')

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/discussions/forum_topic/topic-1/comments', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/forum/topics/topic-1/like', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/discussions/forum_topic/topic-1/comments', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ content: 'reply', reply_to_id: 'comment-1' }),
    }))
  })

  it('adds a short-note reply from the create response without refetching the thread', async () => {
    fetchMock
      .mockResolvedValueOnce(response({
        data: {
          items: [{ id: 'root-1', content: 'root', created_at: '2026-08-30T00:00:00Z', replies: [] }],
        },
      }))
      .mockResolvedValueOnce(response({
        data: {
          id: 'reply-1',
          content: 'reply',
          created_at: '2026-08-30T00:01:00Z',
          reply_to_id: 'root-1',
        },
      }))

    const interactions = useInteractions('blog', 'short_note', 'note-1')
    await interactions.fetchComments()
    await interactions.createComment('reply', 'root-1')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(interactions.comments.value[0]?.replies).toMatchObject([{ id: 'reply-1', content: 'reply' }])
    expect(interactions.commentCount.value).toBe(2)
  })

  it('uses the latest reactive target id', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { Liked: true, LikeCount: 1 } }))
    const targetId = ref('post-1')
    const interactions = useInteractions('blog', 'post', targetId)
    targetId.value = 'post-2'

    await interactions.like()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/likes', expect.objectContaining({
      body: JSON.stringify({ target_type: 'post', target_id: 'post-2' }),
    }))
  })

  it.each([
    ['like', 'POST'],
    ['unlike', 'DELETE'],
  ] as const)('does not apply a late %s response after the target changes from A to B', async (action, method) => {
    const lateResponse = deferred<Response>()
    fetchMock.mockReturnValueOnce(lateResponse.promise)
    const targetId = ref('post-a')
    const interactions = useInteractions('blog', 'post', targetId)
    interactions.liked.value = false
    interactions.likeCount.value = 9

    const pendingAction = interactions[action]()
    targetId.value = 'post-b'
    lateResponse.resolve(response({ data: { liked: true, like_count: 1 } }))
    await pendingAction

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/blog/likes', expect.objectContaining({
      method,
      body: JSON.stringify({ target_type: 'post', target_id: 'post-a' }),
    }))
    expect(interactions.liked.value).toBe(false)
    expect(interactions.likeCount.value).toBe(9)
  })

  it.each([
    ['blog', 'post', 'like', 'POST', '/api/v1/blog/likes', false, true, 7],
    ['blog', 'post', 'unlike', 'DELETE', '/api/v1/blog/likes', true, false, 7],
    ['forum', 'forum_topic', 'like', 'POST', '/api/v1/forum/topics/topic-a/like', false, true, 7],
    ['forum', 'forum_topic', 'unlike', 'POST', '/api/v1/forum/topics/topic-a/like', true, false, 7],
  ] as const)('does not apply a late %s %s response after the target changes from A to B and back to A', async (moduleName, targetType, action, method, endpoint, initialLiked, responseLiked, initialLikeCount) => {
    const lateResponse = deferred<Response>()
    fetchMock.mockReturnValueOnce(lateResponse.promise)
    const targetId = ref('topic-a')
    const interactions = useInteractions(moduleName, targetType, targetId)

    const pendingAction = interactions[action]()
    targetId.value = 'topic-b'
    targetId.value = 'topic-a'
    interactions.liked.value = initialLiked
    interactions.likeCount.value = initialLikeCount

    lateResponse.resolve(response({ data: moduleName === 'forum'
      ? { liked: responseLiked }
      : { liked: responseLiked, like_count: 1 } }))
    await pendingAction

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      method,
      ...(moduleName === 'blog'
        ? { body: JSON.stringify({ target_type: targetType, target_id: 'topic-a' }) }
        : {}),
    }))
    expect(interactions.liked.value).toBe(initialLiked)
    expect(interactions.likeCount.value).toBe(initialLikeCount)
  })

  it.each([
    ['blog', 'post', '/api/v1/blog/likes'],
    ['forum', 'forum_topic', '/api/v1/forum/topics/topic-a/like'],
  ] as const)('does not apply an old %s like response after targets cycle from A to B to A', async (moduleName, targetType, endpoint) => {
    const firstResponse = deferred<Response>()
    const secondResponse = deferred<Response>()
    const thirdResponse = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise)
      .mockReturnValueOnce(thirdResponse.promise)

    const targetId = ref('topic-a')
    const interactions = useInteractions(moduleName, targetType, targetId)
    interactions.liked.value = true
    interactions.likeCount.value = 8

    const firstAction = interactions.like()
    targetId.value = 'topic-b'
    const secondAction = interactions.like()
    targetId.value = 'topic-a'
    const thirdAction = interactions.unlike()

    thirdResponse.resolve(response({ data: moduleName === 'forum'
      ? { liked: false }
      : { liked: false, like_count: 3 } }))
    await thirdAction
    firstResponse.resolve(response({ data: moduleName === 'forum'
      ? { liked: true }
      : { liked: true, like_count: 9 } }))
    await firstAction
    secondResponse.resolve(response({ data: moduleName === 'forum'
      ? { liked: true }
      : { liked: true, like_count: 7 } }))
    await secondAction

    expect(fetchMock).toHaveBeenCalledWith(endpoint, expect.anything())
    expect(interactions.liked.value).toBe(false)
    expect(interactions.likeCount.value).toBe(moduleName === 'forum' ? 7 : 3)
  })

  it.each([
    ['blog', 'post'],
    ['forum', 'forum_topic'],
  ] as const)('keeps the latest %s like operation when like and unlike responses finish in reverse order', async (moduleName, targetType) => {
    const likeResponse = deferred<Response>()
    const unlikeResponse = deferred<Response>()
    fetchMock
      .mockReturnValueOnce(likeResponse.promise)
      .mockReturnValueOnce(unlikeResponse.promise)

    const interactions = useInteractions(moduleName, targetType, 'topic-a')
    interactions.liked.value = false
    interactions.likeCount.value = 4

    const likeAction = interactions.like()
    const unlikeAction = interactions.unlike()

    unlikeResponse.resolve(response({ data: moduleName === 'forum'
      ? { liked: false }
      : { liked: false, like_count: 2 } }))
    await unlikeAction
    likeResponse.resolve(response({ data: moduleName === 'forum'
      ? { liked: true }
      : { liked: true, like_count: 9 } }))
    await likeAction

    expect(interactions.liked.value).toBe(false)
    expect(interactions.likeCount.value).toBe(moduleName === 'forum' ? 3 : 2)
  })

  it('keeps comments from the latest target when stale requests finish later', async () => {
    const firstResponse = deferred<unknown>()
    const secondResponse = deferred<unknown>()
    fetchMock
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise)

    const targetId = ref('video-a')
    const interactions = useInteractions('videos', 'video', targetId)

    const firstFetch = interactions.fetchComments()
    targetId.value = 'video-b'
    const secondFetch = interactions.fetchComments()

    secondResponse.resolve(response({
        data: { items: [{ id: 'comment-b', content: 'new', created_at: '2026-07-08T00:00:00Z' }] },
      }))
    await secondFetch

    firstResponse.resolve(response({
        data: { items: [{ id: 'comment-a', content: 'old', created_at: '2026-07-07T00:00:00Z' }] },
      }))
    await firstFetch

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/discussions/video/video-a/comments', expect.anything())
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/discussions/video/video-b/comments', expect.anything())
    expect(interactions.comments.value.map((comment) => comment.id)).toEqual(['comment-b'])
    expect(interactions.commentCount.value).toBe(1)
  })

  it('uses unified video comment endpoints and does not call the removed video like endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ data: {} }))
      .mockResolvedValueOnce(response({ data: [] }))

    const interactions = useInteractions('videos', 'video', 'video-1')
    await interactions.deleteComment('comment-1')
    await interactions.like()

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/comments/comment-1', expect.objectContaining({
      method: 'DELETE',
      credentials: 'include',
    }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/videos/likes', expect.anything())
  })
})
