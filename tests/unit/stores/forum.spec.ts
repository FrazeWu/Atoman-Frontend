import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useForumStore } from '@/stores/forum'

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
})

const authenticate = (uuid: string) => {
  const authStore = useAuthStore()
  authStore.isAuthenticated = true
  authStore.token = `token-${uuid}`
  authStore.user = { uuid, username: uuid, email: `${uuid}@example.com` }
  return authStore
}

describe('forum store HTTP contracts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reads list totals from meta and sends page_size', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      data: [{ id: 'topic-1', title: 'Topic' }],
      meta: { page: 1, page_size: 7, total: 42 },
    }))
    const store = useForumStore()

    await store.fetchTopics({ page: 1, limit: 7 })

    expect(store.topics).toHaveLength(1)
    expect(store.topicsTotal).toBe(42)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/forum/topics?page=1&page_size=7')
  })

  it('sends category credentials only for authenticated users', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: [] }))
    const store = useForumStore()

    await store.fetchCategories()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/forum/categories', { headers: {} })

    authenticate('user-1')
    await store.fetchCategories()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/forum/categories', {
      headers: { Authorization: 'Bearer token-user-1' },
    })
  })

  it('keeps existing categories when the category request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'))
    const store = useForumStore()
    const existing = { id: 'category-1', name: 'Existing' }
    store.categories = [existing as never]

    await store.fetchCategories()

    expect(store.categories).toEqual([existing])
    expect(store.categoriesLoaded).toBe(true)
  })

  it('reads search totals from meta and sends page_size', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({
      data: [{ id: 'topic-search', title: 'Search result' }],
      meta: { page: 2, page_size: 5, total: 11 },
    }))
    const store = useForumStore()

    await store.searchTopics('sqlite', 2, 5)

    expect(store.searchResults).toHaveLength(1)
    expect(store.searchTotal).toBe(11)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/forum/search?q=sqlite&page=2&page_size=5')
  })

  it('appends later search pages and resets results for a new first page', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'topic-1', title: 'First page' }],
        meta: { page: 1, page_size: 1, total: 2 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'topic-2', title: 'Second page' }],
        meta: { page: 2, page_size: 1, total: 2 },
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'topic-new', title: 'New search' }],
        meta: { page: 1, page_size: 1, total: 1 },
      }))
    const store = useForumStore()

    await store.searchTopics('sqlite', 1, 1)
    expect(store.searchResults.map((topic) => topic.id)).toEqual(['topic-1'])

    await store.searchTopics('sqlite', 2, 1)
    expect(store.searchResults.map((topic) => topic.id)).toEqual(['topic-1', 'topic-2'])

    await store.searchTopics('go', 1, 1)
    expect(store.searchResults.map((topic) => topic.id)).toEqual(['topic-new'])
  })

  it('reads topic like and bookmark state from response data', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: { liked: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { bookmarked: true } }))
    const store = useForumStore()
    store.topics = [{ id: 'topic-1', like_count: 3, is_liked: false, is_bookmarked: false } as never]

    await store.toggleTopicLike('topic-1')
    await store.toggleTopicBookmark('topic-1')

    expect(store.topics[0]).toMatchObject({ like_count: 4, is_liked: true, is_bookmarked: true })
  })

  it('reads follow envelope and switches follow state', async () => {
    const follow = { id: 'follow-1', user_id: 'user-1', target_type: 'tag', target_key: 'Go 语言' }
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: [follow] }))
      .mockResolvedValueOnce(jsonResponse({ data: { ...follow, id: 'follow-2', target_key: 'Vue' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))
    const store = useForumStore()
    authenticate('user-1')

    await store.fetchFollows()
    expect(store.follows).toEqual([follow])
    expect(store.isFollowing('tag', 'Go 语言')).toBe(true)

    await store.toggleFollow('tag', 'Vue')
    expect(store.isFollowing('tag', 'Vue')).toBe(true)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/forum/follows/tag?target_key=Vue')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT' })

    await store.toggleFollow('tag', 'Vue')
    expect(store.isFollowing('tag', 'Vue')).toBe(false)
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' })
  })

  it('keeps existing follows and resolves when fetching follows fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'))
    const store = useForumStore()
    authenticate('user-1')
    const existing = { id: 'follow-1', user_id: 'user-1', target_type: 'tag', target_key: 'Go' }
    expect(store.isFollowing('tag', 'Go')).toBe(false)
    store.follows = [existing as never]

    await expect(store.fetchFollows()).resolves.toBeUndefined()
    expect(store.follows).toEqual([existing])
  })

  it('clears cached follows when the authenticated user changes or logs out', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: [
        { id: 'follow-a', user_id: 'user-a', target_type: 'tag', target_key: 'Go' },
      ] }))
      .mockResolvedValueOnce(jsonResponse({ data: [
        { id: 'follow-b', user_id: 'user-b', target_type: 'tag', target_key: 'Rust' },
      ] }))
    const store = useForumStore()
    const authStore = authenticate('user-a')

    await store.fetchFollows()
    expect(store.isFollowing('tag', 'Go')).toBe(true)

    authenticate('user-b')
    expect(store.isFollowing('tag', 'Go')).toBe(false)
    expect(store.follows).toEqual([])
    await store.fetchFollows()
    expect(store.isFollowing('tag', 'Rust')).toBe(true)

    authStore.isAuthenticated = false
    authStore.user = null
    expect(store.isFollowing('tag', 'Rust')).toBe(false)
    await store.fetchFollows()
    await store.follow('tag', 'Vue')
    await store.unfollow('tag', 'Rust')
    expect(store.follows).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not let a slow follows GET overwrite a successful follow', async () => {
    let resolveGet!: (response: Response) => void
    const slowGet = new Promise<Response>((resolve) => { resolveGet = resolve })
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(slowGet)
      .mockResolvedValueOnce(jsonResponse({ data: {
        id: 'follow-vue', user_id: 'user-1', target_type: 'tag', target_key: 'Vue',
      } }))
    const store = useForumStore()
    authenticate('user-1')

    const pendingFetch = store.fetchFollows()
    await store.follow('tag', 'Vue')
    resolveGet(jsonResponse({ data: [] }))
    await pendingFetch

    expect(store.isFollowing('tag', 'Vue')).toBe(true)
  })

  it('does not let a slow follows GET restore a successful unfollow', async () => {
    let resolveGet!: (response: Response) => void
    const slowGet = new Promise<Response>((resolve) => { resolveGet = resolve })
    const existing = { id: 'follow-go', user_id: 'user-1', target_type: 'tag', target_key: 'Go' }
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ data: [existing] }))
      .mockReturnValueOnce(slowGet)
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }))
    const store = useForumStore()
    authenticate('user-1')

    await store.fetchFollows()
    const pendingFetch = store.fetchFollows()
    await store.unfollow('tag', 'Go')
    resolveGet(jsonResponse({ data: [existing] }))
    await pendingFetch

    expect(store.isFollowing('tag', 'Go')).toBe(false)
  })
})
