export interface ExploreSubscriptionTarget {
  id: string
  subscribed?: boolean
  source_type?: string
  source_id?: string
  target_path?: string
}

export function partitionUnsubscribedRecommendations(items: ExploreSubscriptionTarget[]) {
  const externalIds: string[] = []
  const internalChannelIds: string[] = []
  for (const item of items) {
    if (item.subscribed) continue
    const id = item.source_id || item.id
    if (!id) continue
    if (item.source_type === 'internal_channel' || item.target_path?.startsWith('/channels/')) {
      internalChannelIds.push(id)
    } else {
      externalIds.push(id)
    }
  }
  return { externalIds, internalChannelIds }
}

export function feedExploreScrollKey(query: {
  mode?: unknown
  category?: unknown
  theme?: unknown
  language?: unknown
  page?: unknown
}) {
  const part = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
  return [
    'atoman:feed-explore-scroll',
    part(query.mode),
    part(query.category),
    part(query.theme),
    part(query.language),
    part(query.page),
  ].join(':')
}

export function rememberExploreScroll(storage: Pick<Storage, 'setItem' | 'removeItem'>, key: string, y: number) {
  if (!Number.isFinite(y) || y <= 0) {
    storage.removeItem(key)
    return
  }
  storage.setItem(key, String(Math.round(y)))
}

export function readExploreScroll(storage: Pick<Storage, 'getItem'>, key: string) {
  const value = Number(storage.getItem(key))
  return Number.isFinite(value) && value > 0 ? value : 0
}
