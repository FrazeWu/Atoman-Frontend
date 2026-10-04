import { describe, expect, it } from 'vitest'

import {
  deduplicateRecommendationItems,
  deduplicateRecommendedChannels,
} from '@/utils/recommendationItems'

describe('recommendation item helpers', () => {
  it('deduplicates external items by normalized content fingerprint', () => {
    const items = deduplicateRecommendationItems([
      { id: 'one', source_type: 'external_rss', source_title: 'Source', title: '  Same title  ', summary: 'Summary' },
      { id: 'two', source_type: 'external_rss', source_title: 'source', title: 'same   title', summary: 'Summary' },
    ])

    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('one')
  })

  it('keeps the subscribed copy when channels share recent items', () => {
    const channels = deduplicateRecommendedChannels([
      { id: 'one', title: 'Channel', source_category: 'blog', recent_items: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] },
      { id: 'two', title: ' channel ', source_category: 'blog', subscribed: true, recent_items: [{ id: 'c', title: 'A' }, { id: 'd', title: 'B' }] },
    ])

    expect(channels).toHaveLength(1)
    expect(channels[0].id).toBe('two')
  })
})
