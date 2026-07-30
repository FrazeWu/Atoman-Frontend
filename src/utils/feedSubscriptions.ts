import type { Subscription, TimelineItem } from '@/types'

export function findSubscriptionByTimelineItem(
  item: TimelineItem,
  subscriptions: readonly Subscription[],
): Subscription | undefined {
  if (item.type === 'feed_item' && item.feed_item) {
    const sourceId = item.feed_item.feed_source?.id || item.feed_item.feed_source_id
    if (!sourceId) return undefined
    return subscriptions.find((subscription) => (
      subscription.feed_source_id === sourceId
      || subscription.feed_source?.id === sourceId
      || (
        Boolean(item.feed_item?.feed_source?.rss_url)
        && subscription.feed_source?.rss_url === item.feed_item?.feed_source?.rss_url
      )
    ))
  }

  if (item.type === 'post' && item.post) {
    const channelId = item.post.channel_id || item.post.channel?.id
    if (!channelId) return undefined
    return subscriptions.find((subscription) => (
      subscription.feed_source?.source_type === 'internal_channel'
      && subscription.feed_source.source_id === channelId
    ))
  }

  return undefined
}
