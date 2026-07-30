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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

function contentFilters(overrides: Partial<Parameters<ReturnType<typeof useStudioStore>['loadContents']>[1]> = {}) {
  return { q: '', status: '', visibility: '', collection_id: '', page: 1, ...overrides }
}

function interactionFilters(overrides: Partial<Parameters<ReturnType<typeof useStudioStore>['loadInteractions']>[1]> = {}) {
  return { unreplied: false, anchored: false, page: 1, ...overrides }
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

  it('only applies the latest forced state response when requests finish out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    const firstLoad = store.loadState(true)
    const secondLoad = store.loadState(true)

    second.resolve(ok({ current_channel: channelB, channels: [channelB] }))
    await secondLoad
    first.resolve(ok({ current_channel: channelA, channels: [channelA] }))
    await firstLoad

    expect(store.currentChannel).toEqual(channelB)
    expect(store.channels).toEqual([channelB])
  })

  it('does not let an invalidated state request close a newer request loading state', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    const firstLoad = store.loadState(true)
    store.reset()
    const secondLoad = store.loadState()

    first.resolve(ok({ current_channel: channelA, channels: [channelA] }))
    await firstLoad

    expect(store.loading).toBe(true)
    void store.loadState()
    expect(fetch).toHaveBeenCalledTimes(2)

    second.resolve(ok({ current_channel: channelB, channels: [channelB] }))
    await secondLoad
  })

  it('does not apply state or errors from a request that finishes after reset', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch).mockReturnValueOnce(pending.promise)

    const store = useStudioStore()
    const load = store.loadState(true)
    store.reset()
    pending.resolve(new Response(JSON.stringify({ message: '旧请求失败' }), { status: 500 }))

    await expect(load).rejects.toThrow('旧请求失败')
    expect(store.currentChannel).toBeNull()
    expect(store.channels).toEqual([])
    expect(store.error).toBe('')
    expect(store.loading).toBe(false)
  })

  it('does not apply state errors from a request that finishes after logout', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const store = useStudioStore()
    const load = store.loadState(true)
    await useAuthStore().logout()
    await nextTick()
    pending.resolve(new Response(JSON.stringify({ message: '旧请求失败' }), { status: 500 }))

    await expect(load).rejects.toThrow('旧请求失败')
    expect(store.currentChannel).toBeNull()
    expect(store.channels).toEqual([])
    expect(store.error).toBe('')
    expect(store.loading).toBe(false)
  })

  it('does not let a state request started before a successful channel switch overwrite it', async () => {
    const pendingState = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(pendingState.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))

    const store = useStudioStore()
    const stateLoad = store.loadState(true)
    await store.selectChannel(channelB.id)
    pendingState.resolve(ok({ current_channel: channelA, channels: [channelA, channelB] }))
    await stateLoad

    expect(store.currentChannel).toEqual(channelB)
    expect(store.channels).toEqual([channelA, channelB])
  })

  it('stops tracking an invalidated state load after a successful channel switch', async () => {
    const staleState = deferred<Response>()
    const refreshedState = deferred<Response>()
    vi.mocked(fetch)
      .mockReturnValueOnce(staleState.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
      .mockReturnValueOnce(refreshedState.promise)

    const store = useStudioStore()
    const staleLoad = store.loadState(true)
    await store.selectChannel(channelB.id)

    expect(store.loading).toBe(false)

    store.loaded = false
    const refreshedLoad = store.loadState()
    expect(fetch).toHaveBeenCalledTimes(3)

    staleState.resolve(ok({ current_channel: channelA, channels: [channelA, channelB] }))
    await staleLoad
    expect(store.loading).toBe(true)

    refreshedState.resolve(ok({ current_channel: channelB, channels: [channelA, channelB] }))
    await refreshedLoad
    expect(store.loading).toBe(false)
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

  it('switches channel with the reload registered while the channel update is pending', async () => {
    const channelUpdate = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockResolvedValueOnce(ok({ channel_subscriber_count: 2, sections: [] }))
      .mockReturnValueOnce(channelUpdate.promise)
      .mockResolvedValueOnce(ok({ title: 'A settings' }))
      .mockResolvedValueOnce(ok({ title: 'B settings' }))

    const store = useStudioStore()
    await store.loadState()
    await store.loadDashboard()
    const channelSwitch = store.selectChannel(channelB.id)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3))
    await store.loadSettings('blog')

    channelUpdate.resolve(ok({ current_channel: channelB, channels: [channelA, channelB] }))
    await channelSwitch

    expect(String(vi.mocked(fetch).mock.calls[4]?.[0])).toContain('/api/v1/studio/blog/settings?channel_id=channel-b')
    expect(store.settings.blog).toEqual({ title: 'B settings' })
  })

  it('ignores a channel switch response that finishes after reset', async () => {
    const channelUpdate = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockResolvedValueOnce(ok({ channel_subscriber_count: 2, sections: [] }))
      .mockReturnValueOnce(channelUpdate.promise)

    const store = useStudioStore()
    await store.loadState()
    await store.loadDashboard()
    const channelSwitch = store.selectChannel(channelB.id)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3))
    store.reset()

    channelUpdate.resolve(ok({ current_channel: channelB, channels: [channelA, channelB] }))
    await channelSwitch

    expect(store.currentChannel).toBeNull()
    expect(store.channels).toEqual([])
    expect(store.dashboard).toBeNull()
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  it('does not let a stale dashboard response overwrite the reloaded channel dashboard', async () => {
    const channelADashboard = deferred<Response>()
    const channelBDashboard = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelADashboard.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelBDashboard.promise)

    const store = useStudioStore()
    await store.loadState()
    const channelALoad = store.loadDashboard()
    const channelSwitch = store.selectChannel(channelB.id)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4))

    channelBDashboard.resolve(ok({ channel_subscriber_count: 4, sections: [] }))
    await channelSwitch
    channelADashboard.resolve(ok({ channel_subscriber_count: 2, sections: [] }))
    await channelALoad

    expect(store.currentChannel?.id).toBe(channelB.id)
    expect(store.dashboard?.channel_subscriber_count).toBe(4)
  })

  it('keeps the newest same-channel dashboard response when requests finish out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstLoad = store.loadDashboard()
    const secondLoad = store.loadDashboard()

    second.resolve(ok({ channel_subscriber_count: 4, sections: [] }))
    await secondLoad
    first.resolve(ok({ channel_subscriber_count: 2, sections: [] }))
    await firstLoad

    expect(store.dashboard?.channel_subscriber_count).toBe(4)
  })

  it('does not restore a dashboard from a request that finishes after reset', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)

    const store = useStudioStore()
    await store.loadState()
    const load = store.loadDashboard()
    store.reset()
    pending.resolve(ok({ channel_subscriber_count: 2, sections: [] }))
    await load

    expect(store.dashboard).toBeNull()
  })

  it('does not restore a dashboard from a request that finishes after logout', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const studio = useStudioStore()
    await studio.loadState()
    const load = studio.loadDashboard()
    await useAuthStore().logout()
    await nextTick()
    pending.resolve(ok({ channel_subscriber_count: 2, sections: [] }))
    await load

    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toContain('/auth/logout')
    expect(studio.currentChannel).toBeNull()
    expect(studio.dashboard).toBeNull()
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

  it('keeps the newest same-module content response when requests finish out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstLoad = store.loadContents('blog', { q: 'A', status: '', visibility: '', collection_id: '', page: 1 })
    const secondLoad = store.loadContents('blog', { q: 'B', status: '', visibility: '', collection_id: '', page: 2 })

    second.resolve(ok([{ id: 'newest' }], { page: 2, page_size: 20, total: 1 }))
    await secondLoad
    first.resolve(ok([{ id: 'stale' }], { page: 1, page_size: 20, total: 1 }))
    await firstLoad

    expect(store.contents.blog).toEqual([{ id: 'newest' }])
    expect(store.contentPagination.blog?.page).toBe(2)
  })

  it('keeps concurrent content responses for different modules independent', async () => {
    const firstBlog = deferred<Response>()
    const podcast = deferred<Response>()
    const latestBlog = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(firstBlog.promise)
      .mockReturnValueOnce(podcast.promise)
      .mockReturnValueOnce(latestBlog.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstBlogLoad = store.loadContents('blog', contentFilters({ q: 'first' }))
    const podcastLoad = store.loadContents('podcast', contentFilters({ q: 'episode' }))
    const latestBlogLoad = store.loadContents('blog', contentFilters({ q: 'latest', page: 2 }))

    podcast.resolve(ok([{ id: 'podcast-item' }], { page: 1, page_size: 20, total: 1 }))
    await podcastLoad
    latestBlog.resolve(ok([{ id: 'blog-item' }], { page: 2, page_size: 20, total: 1 }))
    await latestBlogLoad
    firstBlog.resolve(ok([{ id: 'stale-blog-item' }], { page: 1, page_size: 20, total: 1 }))
    await firstBlogLoad

    expect(store.contents.blog).toEqual([{ id: 'blog-item' }])
    expect(store.contents.podcast).toEqual([{ id: 'podcast-item' }])
  })

  it('reloads a switched channel with the tracked filter snapshot and ignores the old channel response', async () => {
    const channelAResponse = deferred<Response>()
    const channelBResponse = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelAResponse.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelBResponse.promise)

    const filters = contentFilters({ q: 'original query', page: 3 })
    const store = useStudioStore()
    await store.loadState()
    const channelALoad = store.loadContents('blog', filters)
    filters.q = 'mutated query'
    filters.page = 9

    const channelSwitch = store.selectChannel(channelB.id)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4))

    const channelAURL = String(vi.mocked(fetch).mock.calls[1]?.[0])
    const channelBURL = String(vi.mocked(fetch).mock.calls[3]?.[0])
    expect(channelAURL).toContain('channel_id=channel-a')
    expect(channelBURL).toContain('channel_id=channel-b')
    expect(channelBURL).toContain('q=original+query')
    expect(channelBURL).toContain('page=3')

    channelBResponse.resolve(ok([{ id: 'channel-b-item' }], { page: 3, page_size: 20, total: 1 }))
    await channelSwitch
    channelAResponse.resolve(ok([{ id: 'channel-a-stale-item' }], { page: 3, page_size: 20, total: 1 }))
    await channelALoad

    expect(store.currentChannel?.id).toBe(channelB.id)
    expect(store.contents.blog).toEqual([{ id: 'channel-b-item' }])
  })

  it('does not restore content from a request that finishes after reset', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)

    const store = useStudioStore()
    await store.loadState()
    const load = store.loadContents('blog', { q: '', status: '', visibility: '', collection_id: '', page: 1 })
    store.reset()
    pending.resolve(ok([{ id: 'stale' }], { page: 1, page_size: 20, total: 1 }))
    await load

    expect(store.contents.blog).toEqual([])
    expect(store.contentPagination.blog).toBeNull()
  })

  it('does not restore content from a request that finishes after logout', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const studio = useStudioStore()
    await studio.loadState()
    const load = studio.loadContents('blog', contentFilters())
    await useAuthStore().logout()
    await nextTick()
    pending.resolve(ok([{ id: 'stale' }], { page: 1, page_size: 20, total: 1 }))
    await load

    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toContain('/auth/logout')
    expect(studio.currentChannel).toBeNull()
    expect(studio.contents.blog).toEqual([])
    expect(studio.contentPagination.blog).toBeNull()
  })

  it('keeps the newest same-module collection response when requests finish out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstLoad = store.loadCollections('blog')
    const secondLoad = store.loadCollections('blog')

    second.resolve(ok([{ id: 'newest-collection' }]))
    await secondLoad
    first.resolve(ok([{ id: 'stale-collection' }]))
    await firstLoad

    expect(store.collections.blog).toEqual([{ id: 'newest-collection' }])
  })

  it('keeps collection request versions independent between modules', async () => {
    const firstBlog = deferred<Response>()
    const podcast = deferred<Response>()
    const latestBlog = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(firstBlog.promise)
      .mockReturnValueOnce(podcast.promise)
      .mockReturnValueOnce(latestBlog.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstBlogLoad = store.loadCollections('blog')
    const podcastLoad = store.loadCollections('podcast')
    const latestBlogLoad = store.loadCollections('blog')

    podcast.resolve(ok([{ id: 'podcast-collection' }]))
    await podcastLoad
    latestBlog.resolve(ok([{ id: 'blog-collection' }]))
    await latestBlogLoad
    firstBlog.resolve(ok([{ id: 'stale-blog-collection' }]))
    await firstBlogLoad

    expect(store.collections.blog).toEqual([{ id: 'blog-collection' }])
    expect(store.collections.podcast).toEqual([{ id: 'podcast-collection' }])
  })

  it('reloads the tracked collection module after switching channels and ignores the old channel response', async () => {
    const channelAResponse = deferred<Response>()
    const channelBResponse = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelAResponse.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelBResponse.promise)

    const store = useStudioStore()
    await store.loadState()
    const channelALoad = store.loadCollections('podcast')
    const channelSwitch = store.selectChannel(channelB.id)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4))

    expect(String(vi.mocked(fetch).mock.calls[3]?.[0])).toContain('/studio/podcast/collections?channel_id=channel-b')
    channelBResponse.resolve(ok([{ id: 'channel-b-collection' }]))
    await channelSwitch
    channelAResponse.resolve(ok([{ id: 'channel-a-stale-collection' }]))
    await channelALoad

    expect(store.currentChannel?.id).toBe(channelB.id)
    expect(store.collections.podcast).toEqual([{ id: 'channel-b-collection' }])
  })

  it.each(['create', 'update', 'delete'] as const)(
    'does not replace the active content reload after a collection %s mutation',
    async (action) => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
        .mockResolvedValueOnce(ok([{ id: 'channel-a-item' }], { page: 1, page_size: 20, total: 1 }))
        .mockResolvedValueOnce(ok(action === 'delete' ? { message: 'deleted' } : { id: 'collection-1' }))
        .mockResolvedValueOnce(ok([{ id: 'collection-1' }]))
        .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
        .mockResolvedValueOnce(ok([{ id: 'channel-b-item' }], { page: 1, page_size: 20, total: 1 }))

      const store = useStudioStore()
      await store.loadState()
      await store.loadContents('blog', contentFilters())
      if (action === 'create') {
        await store.createCollection('blog', { name: '合集' })
      } else if (action === 'update') {
        await store.updateCollection('blog', 'collection-1', { name: '合集' })
      } else {
        await store.deleteCollection('blog', 'collection-1')
      }
      await store.selectChannel(channelB.id)

      expect(String(vi.mocked(fetch).mock.calls[5]?.[0])).toContain('/studio/blog/contents?channel_id=channel-b')
      expect(store.contents.blog).toEqual([{ id: 'channel-b-item' }])
    },
  )

  it('does not restore collections from a request that finishes after reset', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)

    const store = useStudioStore()
    await store.loadState()
    const load = store.loadCollections('video')
    store.reset()
    pending.resolve(ok([{ id: 'stale-collection' }]))
    await load

    expect(store.collections.video).toEqual([])
  })

  it('does not restore collections from a request that finishes after logout', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const studio = useStudioStore()
    await studio.loadState()
    const load = studio.loadCollections('blog')
    await useAuthStore().logout()
    await nextTick()
    pending.resolve(ok([{ id: 'stale-collection' }]))
    await load

    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toContain('/auth/logout')
    expect(studio.currentChannel).toBeNull()
    expect(studio.collections.blog).toEqual([])
  })

  it('keeps the latest analytics range when same-module requests finish out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstLoad = store.loadAnalytics('blog', 7)
    const secondLoad = store.loadAnalytics('blog', 28)

    second.resolve(ok({ range: 28, totals: {}, trend: [], top: [] }))
    await secondLoad
    first.resolve(ok({ range: 7, totals: {}, trend: [], top: [] }))
    await firstLoad

    expect(store.analytics.blog?.range).toBe(28)
  })

  it('keeps analytics request versions independent between modules', async () => {
    const firstBlog = deferred<Response>()
    const podcast = deferred<Response>()
    const latestBlog = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(firstBlog.promise)
      .mockReturnValueOnce(podcast.promise)
      .mockReturnValueOnce(latestBlog.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstBlogLoad = store.loadAnalytics('blog', 7)
    const podcastLoad = store.loadAnalytics('podcast', 90)
    const latestBlogLoad = store.loadAnalytics('blog', 28)

    podcast.resolve(ok({ range: 90, totals: { module: 'podcast' }, trend: [], top: [] }))
    await podcastLoad
    latestBlog.resolve(ok({ range: 28, totals: { module: 'blog' }, trend: [], top: [] }))
    await latestBlogLoad
    firstBlog.resolve(ok({ range: 7, totals: { module: 'stale' }, trend: [], top: [] }))
    await firstBlogLoad

    expect(store.analytics.blog?.range).toBe(28)
    expect(store.analytics.podcast?.range).toBe(90)
  })

  it('reloads switched-channel analytics with the tracked module and range, then ignores the old response', async () => {
    const channelAResponse = deferred<Response>()
    const channelBResponse = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelAResponse.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelBResponse.promise)

    const store = useStudioStore()
    await store.loadState()
    const channelALoad = store.loadAnalytics('podcast', 28)
    const channelSwitch = store.selectChannel(channelB.id)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4))

    expect(String(vi.mocked(fetch).mock.calls[3]?.[0])).toContain('/studio/podcast/analytics?channel_id=channel-b&range=28')
    channelBResponse.resolve(ok({ range: 28, totals: { channel: 'b' }, trend: [], top: [] }))
    await channelSwitch
    channelAResponse.resolve(ok({ range: 28, totals: { channel: 'a' }, trend: [], top: [] }))
    await channelALoad

    expect(store.currentChannel?.id).toBe(channelB.id)
    expect(store.analytics.podcast?.totals).toEqual({ channel: 'b' })
  })

  it('does not restore analytics from a request that finishes after reset', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)

    const store = useStudioStore()
    await store.loadState()
    const load = store.loadAnalytics('video', 7)
    store.reset()
    pending.resolve(ok({ range: 7, totals: {}, trend: [], top: [] }))
    await load

    expect(store.analytics.video).toBeNull()
  })

  it('does not restore analytics from a request that finishes after logout', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const studio = useStudioStore()
    await studio.loadState()
    const load = studio.loadAnalytics('blog', 90)
    await useAuthStore().logout()
    await nextTick()
    pending.resolve(ok({ range: 90, totals: {}, trend: [], top: [] }))
    await load

    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toContain('/auth/logout')
    expect(studio.currentChannel).toBeNull()
    expect(studio.analytics.blog).toBeNull()
  })

  it('keeps the newest same-module interaction filters and page when responses finish out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstLoad = store.loadInteractions('blog', interactionFilters({ unreplied: true, page: 1 }))
    const secondLoad = store.loadInteractions('blog', interactionFilters({ anchored: true, page: 2 }))

    second.resolve(ok([{ id: 'newest' }], { page: 2, page_size: 20, total: 1 }))
    await secondLoad
    first.resolve(ok([{ id: 'stale' }], { page: 1, page_size: 20, total: 1 }))
    await firstLoad

    expect(store.interactions.blog).toEqual([{ id: 'newest' }])
    expect(store.interactionPagination.blog?.page).toBe(2)
  })

  it('keeps concurrent interaction responses for different modules independent', async () => {
    const firstBlog = deferred<Response>()
    const podcast = deferred<Response>()
    const latestBlog = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(firstBlog.promise)
      .mockReturnValueOnce(podcast.promise)
      .mockReturnValueOnce(latestBlog.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstBlogLoad = store.loadInteractions('blog', interactionFilters({ unreplied: true }))
    const podcastLoad = store.loadInteractions('podcast', interactionFilters({ anchored: true }))
    const latestBlogLoad = store.loadInteractions('blog', interactionFilters({ page: 2 }))

    podcast.resolve(ok([{ id: 'podcast-item' }], { page: 1, page_size: 20, total: 1 }))
    await podcastLoad
    latestBlog.resolve(ok([{ id: 'blog-item' }], { page: 2, page_size: 20, total: 1 }))
    await latestBlogLoad
    firstBlog.resolve(ok([{ id: 'stale-blog-item' }], { page: 1, page_size: 20, total: 1 }))
    await firstBlogLoad

    expect(store.interactions.blog).toEqual([{ id: 'blog-item' }])
    expect(store.interactions.podcast).toEqual([{ id: 'podcast-item' }])
  })

  it('reloads a switched channel with the tracked interaction filter snapshot and ignores the old response', async () => {
    const channelAResponse = deferred<Response>()
    const channelBResponse = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelAResponse.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelBResponse.promise)

    const filters = interactionFilters({ unreplied: true, page: 3 })
    const store = useStudioStore()
    await store.loadState()
    const channelALoad = store.loadInteractions('video', filters)
    filters.unreplied = false
    filters.anchored = true
    filters.page = 9

    const channelSwitch = store.selectChannel(channelB.id)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4))

    const channelAURL = String(vi.mocked(fetch).mock.calls[1]?.[0])
    const channelBURL = String(vi.mocked(fetch).mock.calls[3]?.[0])
    expect(channelAURL).toContain('channel_id=channel-a')
    expect(channelBURL).toContain('channel_id=channel-b')
    expect(channelBURL).toContain('unreplied=true')
    expect(channelBURL).toContain('anchored=false')
    expect(channelBURL).toContain('page=3')

    channelBResponse.resolve(ok([{ id: 'channel-b-item' }], { page: 3, page_size: 20, total: 1 }))
    await channelSwitch
    channelAResponse.resolve(ok([{ id: 'channel-a-stale-item' }], { page: 3, page_size: 20, total: 1 }))
    await channelALoad

    expect(store.currentChannel?.id).toBe(channelB.id)
    expect(store.interactions.video).toEqual([{ id: 'channel-b-item' }])
  })

  it('does not restore interactions from a request that finishes after reset', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)

    const store = useStudioStore()
    await store.loadState()
    const load = store.loadInteractions('blog', interactionFilters())
    store.reset()
    pending.resolve(ok([{ id: 'stale' }], { page: 1, page_size: 20, total: 1 }))
    await load

    expect(store.interactions.blog).toEqual([])
    expect(store.interactionPagination.blog).toBeNull()
  })

  it('does not restore interactions from a request that finishes after logout', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const studio = useStudioStore()
    await studio.loadState()
    const load = studio.loadInteractions('blog', interactionFilters())
    await useAuthStore().logout()
    await nextTick()
    pending.resolve(ok([{ id: 'stale' }], { page: 1, page_size: 20, total: 1 }))
    await load

    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toContain('/auth/logout')
    expect(studio.currentChannel).toBeNull()
    expect(studio.interactions.blog).toEqual([])
    expect(studio.interactionPagination.blog).toBeNull()
  })

  it('keeps the newest same-module settings response when requests finish out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstLoad = store.loadSettings('blog')
    const secondLoad = store.loadSettings('blog')

    second.resolve(ok({ title: 'newest settings' }))
    await secondLoad
    first.resolve(ok({ title: 'stale settings' }))
    await firstLoad

    expect(store.settings.blog).toEqual({ title: 'newest settings' })
  })

  it('keeps the last-started same-module settings save when PATCH responses finish out of order', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstSave = store.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'public', default_publish_status: 'draft', autoplay_enabled: false,
    })
    const secondSave = store.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'private', default_publish_status: 'published', autoplay_enabled: false,
    })

    second.resolve(ok({ title: 'last save' }))
    await expect(secondSave).resolves.toBe(true)
    first.resolve(ok({ title: 'stale save' }))
    await expect(firstSave).resolves.toBe(false)

    expect(store.settings.blog).toEqual({ title: 'last save' })
  })

  it('prevents an earlier settings GET from overwriting a later save', async () => {
    const load = deferred<Response>()
    const save = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(load.promise)
      .mockReturnValueOnce(save.promise)

    const store = useStudioStore()
    await store.loadState()
    const settingsLoad = store.loadSettings('blog')
    const settingsSave = store.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'private', default_publish_status: 'draft', autoplay_enabled: false,
    })

    save.resolve(ok({ title: 'saved settings' }))
    await settingsSave
    load.resolve(ok({ title: 'stale settings' }))
    await settingsLoad

    expect(store.settings.blog).toEqual({ title: 'saved settings' })
  })

  it('keeps a successful settings PATCH when a later GET returns an old value first', async () => {
    const save = deferred<Response>()
    const load = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(save.promise)
      .mockReturnValueOnce(load.promise)

    const store = useStudioStore()
    await store.loadState()
    const settingsSave = store.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'private', default_publish_status: 'draft', autoplay_enabled: false,
    })
    const settingsLoad = store.loadSettings('blog')

    load.resolve(ok({ title: 'old settings' }))
    await settingsLoad
    save.resolve(ok({ title: 'saved settings' }))
    await settingsSave

    expect(store.settings.blog).toEqual({ title: 'saved settings' })
  })

  it('keeps a successful settings PATCH when a later GET returns an old value after it', async () => {
    const save = deferred<Response>()
    const load = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(save.promise)
      .mockReturnValueOnce(load.promise)

    const store = useStudioStore()
    await store.loadState()
    const settingsSave = store.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'private', default_publish_status: 'draft', autoplay_enabled: false,
    })
    const settingsLoad = store.loadSettings('blog')

    save.resolve(ok({ title: 'saved settings' }))
    await settingsSave
    load.resolve(ok({ title: 'old settings' }))
    await settingsLoad

    expect(store.settings.blog).toEqual({ title: 'saved settings' })
  })

  it('keeps concurrent settings saves for different modules independent', async () => {
    const blog = deferred<Response>()
    const podcast = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(blog.promise)
      .mockReturnValueOnce(podcast.promise)

    const store = useStudioStore()
    await store.loadState()
    const blogSave = store.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'public', default_publish_status: 'draft', autoplay_enabled: false,
    })
    const podcastSave = store.saveSettings('podcast', {
      default_collection_id: null, default_visibility: 'subscribers', default_publish_status: 'published', autoplay_enabled: true,
    })

    podcast.resolve(ok({ title: 'podcast save' }))
    await podcastSave
    blog.resolve(ok({ title: 'blog save' }))
    await blogSave

    expect(store.settings.blog).toEqual({ title: 'blog save' })
    expect(store.settings.podcast).toEqual({ title: 'podcast save' })
  })

  it('keeps settings request versions independent between modules', async () => {
    const firstBlog = deferred<Response>()
    const podcast = deferred<Response>()
    const latestBlog = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(firstBlog.promise)
      .mockReturnValueOnce(podcast.promise)
      .mockReturnValueOnce(latestBlog.promise)

    const store = useStudioStore()
    await store.loadState()
    const firstBlogLoad = store.loadSettings('blog')
    const podcastLoad = store.loadSettings('podcast')
    const latestBlogLoad = store.loadSettings('blog')

    podcast.resolve(ok({ title: 'podcast settings' }))
    await podcastLoad
    latestBlog.resolve(ok({ title: 'blog settings' }))
    await latestBlogLoad
    firstBlog.resolve(ok({ title: 'stale blog settings' }))
    await firstBlogLoad

    expect(store.settings.blog).toEqual({ title: 'blog settings' })
    expect(store.settings.podcast).toEqual({ title: 'podcast settings' })
  })

  it('reloads tracked settings after switching channels and ignores the old channel response', async () => {
    const channelAResponse = deferred<Response>()
    const channelBResponse = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelAResponse.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))
      .mockReturnValueOnce(channelBResponse.promise)

    const store = useStudioStore()
    await store.loadState()
    const channelALoad = store.loadSettings('video')
    const channelSwitch = store.selectChannel(channelB.id)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4))

    expect(String(vi.mocked(fetch).mock.calls[3]?.[0])).toContain('/studio/video/settings?channel_id=channel-b')
    channelBResponse.resolve(ok({ title: 'channel B settings' }))
    await channelSwitch
    channelAResponse.resolve(ok({ title: 'channel A settings' }))
    await channelALoad

    expect(store.currentChannel?.id).toBe(channelB.id)
    expect(store.settings.video).toEqual({ title: 'channel B settings' })
  })

  it('does not restore settings from a request that finishes after reset', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)

    const store = useStudioStore()
    await store.loadState()
    const load = store.loadSettings('blog')
    store.reset()
    pending.resolve(ok({ title: 'stale settings' }))
    await load

    expect(store.settings.blog).toBeNull()
  })

  it('does not restore settings from a request that finishes after logout', async () => {
    const pending = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const studio = useStudioStore()
    await studio.loadState()
    const load = studio.loadSettings('blog')
    await useAuthStore().logout()
    await nextTick()
    pending.resolve(ok({ title: 'stale settings' }))
    await load

    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toContain('/auth/logout')
    expect(studio.currentChannel).toBeNull()
    expect(studio.settings.blog).toBeNull()
  })

  it('does not restore settings from a save that finishes after a channel switch', async () => {
    const save = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA, channelB] }))
      .mockReturnValueOnce(save.promise)
      .mockResolvedValueOnce(ok({ current_channel: channelB, channels: [channelA, channelB] }))

    const store = useStudioStore()
    await store.loadState()
    const settingsSave = store.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'public', default_publish_status: 'draft', autoplay_enabled: false,
    })
    await store.selectChannel(channelB.id)
    save.resolve(ok({ title: 'channel A save' }))
    await expect(settingsSave).resolves.toBe(false)

    expect(store.currentChannel?.id).toBe(channelB.id)
    expect(store.settings.blog).toBeNull()
  })

  it('does not restore settings from a save that finishes after reset', async () => {
    const save = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(save.promise)

    const store = useStudioStore()
    await store.loadState()
    const settingsSave = store.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'public', default_publish_status: 'draft', autoplay_enabled: false,
    })
    store.reset()
    save.resolve(ok({ title: 'stale save' }))
    await expect(settingsSave).resolves.toBe(false)

    expect(store.settings.blog).toBeNull()
  })

  it('does not restore settings from a save that finishes after logout', async () => {
    const save = deferred<Response>()
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok({ current_channel: channelA, channels: [channelA] }))
      .mockReturnValueOnce(save.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const studio = useStudioStore()
    await studio.loadState()
    const settingsSave = studio.saveSettings('blog', {
      default_collection_id: null, default_visibility: 'public', default_publish_status: 'draft', autoplay_enabled: false,
    })
    await useAuthStore().logout()
    await nextTick()
    save.resolve(ok({ title: 'stale save' }))
    await expect(settingsSave).resolves.toBe(false)

    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toContain('/auth/logout')
    expect(studio.currentChannel).toBeNull()
    expect(studio.settings.blog).toBeNull()
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
