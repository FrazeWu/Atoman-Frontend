export type RecommendationItem = {
  id: string
  title: string
  summary?: string
  description?: string
  content_type?: string
  source_type?: string
  source_category?: string
  source_title?: string
  image_url?: string
  last_published_at?: string
  subscribed?: boolean
  recent_items?: Array<{ id: string; title: string }>
}

function normalizeRecommendationContentFingerprint(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() || ''
}

function recommendationDisplayKey(item: RecommendationItem) {
  if (item.source_type !== 'external_rss') return `id:${item.id}`

  const fingerprint = [
    item.source_title,
    item.title,
    item.summary || item.description,
    item.image_url,
    item.last_published_at,
  ].map(normalizeRecommendationContentFingerprint)
  if (!fingerprint[0] || !fingerprint[1]) return `id:${item.id}`
  return `external:${fingerprint.join('\x1f')}`
}

export function deduplicateRecommendationItems<T extends RecommendationItem>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = recommendationDisplayKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function recommendationChannelIdentity(item: RecommendationItem) {
  const title = normalizeRecommendationContentFingerprint(item.title)
  if (!title) return ''
  return `${item.source_category || item.content_type || 'blog'}\x1f${title}`
}

function recommendationChannelsShareRecentItems(first: RecommendationItem, second: RecommendationItem) {
  const firstTitles = new Set(
    (first.recent_items || [])
      .map((item) => normalizeRecommendationContentFingerprint(item.title))
      .filter(Boolean),
  )
  if (firstTitles.size < 2) return false

  const matchingTitles = new Set(
    (second.recent_items || [])
      .map((item) => normalizeRecommendationContentFingerprint(item.title))
      .filter((title) => firstTitles.has(title)),
  )
  return matchingTitles.size >= 2
}

export function deduplicateRecommendedChannels<T extends RecommendationItem>(items: T[]): T[] {
  const deduplicated: T[] = []
  const candidateIndexesByIdentity = new Map<string, number[]>()
  for (const item of items) {
    const identity = recommendationChannelIdentity(item)
    if (!identity) {
      deduplicated.push(item)
      continue
    }

    const candidateIndexes = candidateIndexesByIdentity.get(identity) || []
    const duplicateIndex = candidateIndexes.find((index) => (
      recommendationChannelsShareRecentItems(deduplicated[index], item)
    ))
    if (duplicateIndex === undefined) {
      candidateIndexes.push(deduplicated.length)
      candidateIndexesByIdentity.set(identity, candidateIndexes)
      deduplicated.push(item)
      continue
    }
    if (item.subscribed && !deduplicated[duplicateIndex].subscribed) {
      deduplicated[duplicateIndex] = item
    }
  }
  return deduplicated
}
