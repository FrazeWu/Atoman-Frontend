import { describe, expect, it } from 'vitest'

import { findSubscriptionByTimelineItem } from '@/utils/feedSubscriptions'
import type { Subscription, TimelineItem } from '@/types'

const subscription = (overrides: Partial<Subscription>): Subscription => ({
  id: 'subscription-1',
  user_id: 'user-1',
  feed_source_id: 'source-1',
  created_at: '2026-07-30T00:00:00Z',
  ...overrides,
})

describe('findSubscriptionByTimelineItem', () => {
  it('matches external feed items by source id and RSS URL fallback', () => {
    const subscriptions = [
      subscription({
        id: 'by-id',
        feed_source: { id: 'source-1', rss_url: 'https://example.com/one.xml' } as Subscription['feed_source'],
      }),
      subscription({
        id: 'by-url',
        feed_source_id: 'source-2',
        feed_source: { id: 'source-2', rss_url: 'https://example.com/two.xml' } as Subscription['feed_source'],
      }),
    ]

    const byId = {
      type: 'feed_item',
      feed_item: { id: 'item-1', feed_source_id: 'source-1' },
    } as TimelineItem
    const byURL = {
      type: 'feed_item',
      feed_item: {
        id: 'item-2',
        feed_source_id: 'unknown',
        feed_source: { id: 'unknown', rss_url: 'https://example.com/two.xml' },
      },
    } as TimelineItem

    expect(findSubscriptionByTimelineItem(byId, subscriptions)?.id).toBe('by-id')
    expect(findSubscriptionByTimelineItem(byURL, subscriptions)?.id).toBe('by-url')
  })

  it('matches internal posts by channel id and returns undefined otherwise', () => {
    const subscriptions = [subscription({
      id: 'internal',
      feed_source: {
        id: 'source-internal',
        source_type: 'internal_channel',
        source_id: 'channel-1',
      } as Subscription['feed_source'],
    })]
    const post = {
      type: 'post',
      post: { id: 'post-1', channel_id: 'channel-1' },
    } as TimelineItem
    const unmatched = {
      type: 'post',
      post: { id: 'post-2', channel_id: 'channel-2' },
    } as TimelineItem

    expect(findSubscriptionByTimelineItem(post, subscriptions)?.id).toBe('internal')
    expect(findSubscriptionByTimelineItem(unmatched, subscriptions)).toBeUndefined()
  })
})
