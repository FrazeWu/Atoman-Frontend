import { buildFeedTimelineQuery, type FeedTimelineQueryOptions } from '@/utils/feedTimelineQuery'

export type FeedSearchRank = 'relevance' | 'recent'

export function normalizeFeedSearchRank(value: unknown): FeedSearchRank {
  return value === 'recent' ? 'recent' : 'relevance'
}

export function shouldFallbackFeedSearch(status: number) {
  return status === 404 || status === 405 || status === 501 || status >= 500
}

export function buildFeedSearchQuery(options: FeedTimelineQueryOptions & { rank?: FeedSearchRank }) {
  const params = buildFeedTimelineQuery(options)
  params.delete('sort')
  params.set('rank', options.rank === 'recent' ? 'recent' : 'relevance')
  return params
}

export function feedSearchMatchLabel(field?: string) {
  switch (field) {
    case 'title':
      return '匹配标题'
    case 'summary':
      return '匹配摘要'
    case 'author':
      return '匹配作者'
    case 'source':
      return '匹配来源'
    case 'body':
    case 'content':
      return '匹配正文'
    default:
      return ''
  }
}
