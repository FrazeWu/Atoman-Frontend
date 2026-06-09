export interface FeedTimelineQueryOptions {
  page?: number
  limit?: number
  sourceType?: string
  sourceId?: string | number | null
  groupId?: string | null
  unreadOnly?: boolean
}

export const buildFeedTimelineQuery = ({
  page,
  limit,
  sourceType,
  sourceId,
  groupId,
  unreadOnly = false,
}: FeedTimelineQueryOptions) => {
  const params = new URLSearchParams()

  if (page !== undefined) {
    params.set('page', String(page))
  }

  if (limit !== undefined) {
    params.set('limit', String(limit))
  }

  if (sourceType && sourceId) {
    params.set('source_type', sourceType)
    params.set('source_id', String(sourceId))
  } else if (sourceId) {
    params.set('source_id', String(sourceId))
  }

  if (groupId) {
    params.set('group_id', groupId)
  }

  if (unreadOnly) {
    params.set('unread_only', 'true')
  }

  return params
}
