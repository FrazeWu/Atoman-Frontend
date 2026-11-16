import { describe, expect, it } from 'vitest'
import { buildFeedSearchQuery, feedSearchMatchLabel, normalizeFeedSearchRank, shouldFallbackFeedSearch } from '@/utils/feedSearch'

describe('feed search contract', () => {
  it('asks the ranked search endpoint for relevance without the timeline sort', () => {
    const params = buildFeedSearchQuery({
      page: 2,
      limit: 20,
      q: ' 正文酶 ',
      unreadOnly: true,
      sort: 'priority',
      rank: 'relevance',
    })
    expect(params.get('q')).toBe('正文酶')
    expect(params.get('rank')).toBe('relevance')
    expect(params.get('unread_only')).toBe('true')
    expect(params.get('page')).toBe('2')
    expect(params.has('sort')).toBe(false)
  })

  it('keeps recent rank and falls back only when the endpoint is absent', () => {
    expect(normalizeFeedSearchRank('recent')).toBe('recent')
    expect(normalizeFeedSearchRank('nope')).toBe('relevance')
    expect(buildFeedSearchQuery({ q: 'a', rank: 'recent' }).get('rank')).toBe('recent')
    expect(shouldFallbackFeedSearch(404)).toBe(true)
    expect(shouldFallbackFeedSearch(500)).toBe(true)
    expect(shouldFallbackFeedSearch(401)).toBe(false)
    expect(shouldFallbackFeedSearch(400)).toBe(false)
    expect(feedSearchMatchLabel('body')).toBe('匹配正文')
    expect(feedSearchMatchLabel('content')).toBe('匹配正文')
    expect(feedSearchMatchLabel('title')).toBe('匹配标题')
  })
})
