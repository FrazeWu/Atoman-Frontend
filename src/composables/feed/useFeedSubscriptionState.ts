import { useAuthStore } from '@/stores/auth'
import { useFeedStore } from '@/stores/feed'
import type { FeedArticleSource, Subscription } from '@/types'

type SourceIdentity = Pick<FeedArticleSource, 'type' | 'id' | 'rssUrl' | 'subscribed'>
const normalizeRssUrl = (url: string) => url.trim().replace(/\/+$/, '')

export function useFeedSubscriptionState() {
  const feedStore = useFeedStore()
  const authStore = useAuthStore()

  function matches(source: SourceIdentity, entry: Pick<Subscription, 'feed_source_id' | 'feed_source'>) {
    const feedSource = entry.feed_source
    if (source.type === 'internal_channel') {
      return feedSource?.source_type === 'internal_channel'
        && (feedSource.source_id === source.id || feedSource.id === source.id)
    }
    return entry.feed_source_id === source.id || feedSource?.id === source.id
      || Boolean(source.rssUrl && feedSource?.rss_url
        && normalizeRssUrl(feedSource.rss_url) === normalizeRssUrl(source.rssUrl))
  }

  function findSubscription(source: SourceIdentity, subscriptions = feedStore.subscriptions) {
    return subscriptions.find(entry => matches(source, entry))
  }

  function findHubMembership(source: SourceIdentity) {
    return feedStore.subscriptionHubTree.types.flatMap(node => node.groups)
      .flatMap(group => group.memberships).find(entry => matches(source, entry))
  }

  function resolveSubscriptionState<T extends SourceIdentity>(source: T, subscriptions = feedStore.subscriptions): T & {
    subscriptionId?: string
    subscriptionStateKnown: boolean
  } {
    const subscription = findSubscription(source, subscriptions)
    const membership = findHubMembership(source)
    const loaded = feedStore.subscriptionsLoaded && feedStore.subscriptionHubTreeLoaded
    // 路由和推荐只提供来源信息；订阅状态始终来自当前关系。
    const subscribed = Boolean(subscription || membership)
    return {
      ...source,
      subscribed,
      subscriptionId: subscription?.id,
      subscriptionStateKnown: subscribed || loaded || !authStore.isAuthenticated,
    }
  }

  async function ensureSubscriptionState() {
    if (!authStore.isAuthenticated) return true
    await Promise.all([
      feedStore.subscriptionsLoaded || feedStore.fetchSubscriptions(),
      feedStore.subscriptionHubTreeLoaded || feedStore.fetchSubscriptionHubTree(),
    ])
    return feedStore.subscriptionsLoaded && feedStore.subscriptionHubTreeLoaded
  }

  return { resolveSubscriptionState, findSubscription, findHubMembership, ensureSubscriptionState }
}
