import { describe, expect, it } from 'vitest'

import { buildFeedTimelineQuery } from '@/utils/feedTimelineQuery'

describe('buildFeedTimelineQuery', () => {
  it('builds paged feed view timeline params with filters and unread flag', () => {
    const query = buildFeedTimelineQuery({
      page: 2,
      limit: 20,
      sourceId: 'source-1',
      groupId: 'group-1',
      unreadOnly: true,
    })

    expect(query.toString()).toBe('page=2&limit=20&source_id=source-1&group_id=group-1&unread_only=true')
  })

  it('builds store timeline params with source type and source id', () => {
    const query = buildFeedTimelineQuery({
      sourceType: 'channel',
      sourceId: 42,
      unreadOnly: true,
    })

    expect(query.toString()).toBe('source_type=channel&source_id=42&unread_only=true')
  })

  it('builds timeline params with trimmed search query and filters', () => {
    const query = buildFeedTimelineQuery({
      page: 3,
      limit: 10,
      q: '  citrus notes  ',
      sourceType: 'external_rss',
      sourceId: 'source-1',
      unreadOnly: true,
    })

    expect(query.toString()).toBe('page=3&limit=10&source_type=external_rss&source_id=source-1&unread_only=true&q=citrus+notes')
  })
})
