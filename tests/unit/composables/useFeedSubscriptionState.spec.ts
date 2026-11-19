import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeedSubscriptionState } from '@/composables/feed/useFeedSubscriptionState'
import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import type { FeedArticleSource, Subscription, SubscriptionHubMembership } from '@/types'

const source: FeedArticleSource = {
  type: 'external_rss', id: 'rss-source', title: '订阅源',
  rssUrl: 'https://example.test/feed/', subscribed: false,
}
const subscription = {
  id: 'subscription-1', feed_source_id: source.id, is_paused: true,
  feed_source: { id: source.id, source_type: 'external_rss', rss_url: source.rssUrl },
} as Subscription
const membership = {
  id: 'membership-1', feed_source_id: source.id, feed_source: subscription.feed_source,
} as SubscriptionHubMembership

function setMembership(entry = membership) {
  useFeedStore().subscriptionHubTree = { types: [{ subscription_type: 'rss', groups: [{
    id: 'group-1', user_id: 'user-1', name: '默认', subscription_type: 'rss', memberships: [entry],
  }] }] }
}

describe('统一订阅状态', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.isAuthenticated = true
    auth.token = 'token'
  })

  it('订阅列表未加载和加载失败都保留未知状态，重试成功后再确认未订阅', async () => {
    const state = useFeedSubscriptionState()
    expect(state.resolveSubscriptionState(source)).toMatchObject({ subscribed: false, subscriptionStateKnown: false })
    const request = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }))
    expect(await state.ensureSubscriptionState()).toBe(false)
    expect(state.resolveSubscriptionState(source).subscriptionStateKnown).toBe(false)
    request.mockImplementation(async input => new Response(JSON.stringify({
      data: String(input).includes('/subscription-hub/tree') ? { types: [] } : [],
    }), { status: 200 }))
    expect(await state.ensureSubscriptionState()).toBe(true)
    expect(state.resolveSubscriptionState(source)).toMatchObject({ subscribed: false, subscriptionStateKnown: true })
  })

  it('已暂停的订阅仍是已订阅，并支持 RSS 地址尾斜线差异', () => {
    useFeedStore().subscriptions = [subscription]
    expect(useFeedSubscriptionState().resolveSubscriptionState({ ...source, id: 'old-source', rssUrl: 'https://example.test/feed' }))
      .toMatchObject({ subscribed: true, subscriptionId: subscription.id, subscriptionStateKnown: true })
  })

  it('订阅树独有的关系也算订阅，加载后的实时状态覆盖旧快照', () => {
    const feed = useFeedStore()
    const state = useFeedSubscriptionState()
    setMembership()
    expect(state.resolveSubscriptionState(source).subscribed).toBe(true)
    feed.subscriptionsLoaded = true
    feed.subscriptionHubTreeLoaded = true
    feed.subscriptionHubTree = { types: [] }
    expect(state.resolveSubscriptionState({ ...source, subscribed: true }))
      .toMatchObject({ subscribed: false, subscriptionId: undefined, subscriptionStateKnown: true })
  })

  it('内置频道支持频道 ID 与来源 ID，不能把同名来源当作已订阅', () => {
    const feed = useFeedStore()
    feed.subscriptions = [{ ...subscription, feed_source: {
      ...subscription.feed_source!, source_type: 'internal_channel', source_id: 'channel-1',
    } }]
    const state = useFeedSubscriptionState()
    expect(state.resolveSubscriptionState({ ...source, type: 'internal_channel', id: 'channel-1' }).subscribed).toBe(true)
    expect(state.resolveSubscriptionState({ ...source, type: 'internal_channel', id: source.id }).subscribed).toBe(true)
    expect(state.resolveSubscriptionState({ ...source, id: 'different', rssUrl: 'https://other.test/feed' }).subscribed).toBe(false)
  })

  it.each(['single', 'batch', 'rss', 'hub', 'channel'] as const)('取消订阅（%s）后即使刷新失败，也同时移除两份本地关系', async action => {
    const feed = useFeedStore()
    feed.subscriptions = [subscription]
    setMembership()
    feed.subscriptionsLoaded = true
    feed.subscriptionHubTreeLoaded = true
    if (action === 'channel') {
      const feedSource = { ...subscription.feed_source!, source_type: 'internal_channel' as const, source_id: 'channel-1' }
      feed.subscriptions = [{ ...subscription, feed_source: feedSource }]
      setMembership({ ...membership, feed_source: feedSource })
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, options) => new Response(null, {
      status: options?.method === 'DELETE' || options?.method === 'POST' ? 204 : 500,
    }))
    const success = action === 'single' ? await feed.unsubscribe(subscription.id)
      : action === 'batch' ? await feed.batchDeleteSubscriptions([subscription.id])
      : action === 'rss' ? await feed.unsubscribeFromRSS(source.rssUrl!)
      : action === 'channel' ? await feed.unsubscribeFromChannel('channel-1')
      : await feed.unsubscribeSubscriptionHubSource(source.id)
    expect(success).toBe(true)
    expect(feed.subscriptions).toEqual([])
    expect(useFeedSubscriptionState().resolveSubscriptionState({ ...source, subscribed: true }).subscribed).toBe(false)
  })

  it('订阅树请求失败时保留已确认的订阅关系', async () => {
    const feed = useFeedStore()
    setMembership()
    feed.subscriptionHubTreeLoaded = true
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    expect(await feed.fetchSubscriptionHubTree()).toBe(false)
    expect(useFeedSubscriptionState().resolveSubscriptionState(source).subscribed).toBe(true)
  })

  it('取消订阅后，先前发出的订阅列表请求不能恢复旧关系', async () => {
    const feed = useFeedStore()
    feed.subscriptions = [subscription]
    feed.subscriptionsLoaded = true
    feed.subscriptionHubTreeLoaded = true
    setMembership()
    let complete!: (response: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, options) => {
      if (options?.method === 'DELETE') return new Response(null, { status: 204 })
      return new Promise<Response>(resolve => { complete = resolve })
    })
    const pending = feed.fetchSubscriptions()
    expect(await feed.unsubscribeSubscriptionHubSource(source.id)).toBe(true)
    complete(new Response(JSON.stringify({ data: [subscription] }), { status: 200 }))
    expect(await pending).toBe(false)
    expect(useFeedSubscriptionState().resolveSubscriptionState({ ...source, subscribed: true }).subscribed).toBe(false)
  })

  it('退出登录后不沿用路由中的已订阅快照', () => {
    useAuthStore().isAuthenticated = false
    expect(useFeedSubscriptionState().resolveSubscriptionState({ ...source, subscribed: true }))
      .toMatchObject({ subscribed: false, subscriptionStateKnown: true })
  })
})
