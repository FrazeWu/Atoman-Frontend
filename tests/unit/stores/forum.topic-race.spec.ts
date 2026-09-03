import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiFetch } from '@/api/transport'
import { useAuthStore } from '@/stores/auth'
import { useForumStore } from '@/stores/forum'
import type { ForumTopic } from '@/types'

vi.mock('@/api/transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/transport')>()),
  apiFetch: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function topic(id: string): ForumTopic {
  return {
    id,
    user_id: 'user-1',
    category_id: 'category-1',
    title: id,
    content: `${id} content`,
    tags: [],
    pinned: false,
    featured: false,
    closed: false,
    reply_count: 1,
    like_count: 2,
    view_count: 3,
    is_liked: false,
    is_bookmarked: false,
    created_at: '2026-07-07T00:00:00Z',
    updated_at: '2026-07-07T00:00:00Z',
  }
}

function topicResponse(value: ForumTopic) {
  return new Response(JSON.stringify({ data: value }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('forum topic request race', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(apiFetch).mockReset()
  })

  it('旧成功响应不能覆盖新请求的状态', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(apiFetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const store = useForumStore()
    store.currentTopic = topic('topic-before')

    const firstLoad = store.fetchTopic('topic-a')
    const secondLoad = store.fetchTopic('topic-b')

    expect(store.currentTopic).toBeNull()
    first.resolve(topicResponse(topic('topic-a')))
    await firstLoad
    expect(store.currentTopic).toBeNull()
    expect(store.error).toBeNull()
    expect(store.loading).toBe(true)

    second.resolve(topicResponse(topic('topic-b')))
    await secondLoad
    expect(store.currentTopic?.id).toBe('topic-b')
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('旧失败响应不能覆盖新请求的成功状态', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(apiFetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const store = useForumStore()

    const firstLoad = store.fetchTopic('topic-a')
    const secondLoad = store.fetchTopic('topic-b')
    second.resolve(topicResponse(topic('topic-b')))
    await secondLoad

    first.reject(new Error('late topic-a failure'))
    await firstLoad

    expect(store.currentTopic?.id).toBe('topic-b')
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('登出后不会保留或恢复旧用户的论坛状态', async () => {
    const pendingTopics = deferred<Response>()
    vi.mocked(apiFetch)
      .mockReturnValueOnce(pendingTopics.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const auth = useAuthStore()
    auth.user = { uuid: 'user-1', username: 'alice', email: 'alice@example.com', role: 'user' }
    auth.isAuthenticated = true

    const store = useForumStore()
    store.currentTopic = topic('current-topic')
    store.topics = [topic('old-topic')]
    store.follows = [{ id: 'follow-1', target_type: 'topic', target_key: 'old-topic' } as never]
    store.error = '旧错误'

    const request = store.fetchTopics()
    await auth.logout()
    pendingTopics.resolve(new Response(JSON.stringify({ data: [topic('stale-topic')] }), { status: 200 }))
    await request

    expect(store.currentTopic).toBeNull()
    expect(store.topics).toEqual([])
    expect(store.follows).toEqual([])
    expect(store.error).toBeNull()
  })
})
