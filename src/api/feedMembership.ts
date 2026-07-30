import { apiGetRaw } from './client'

type FeedMembershipEntry = { id?: string; target_id?: string; feed_item_id?: string }
type FeedMembershipPayload = {
  data?: FeedMembershipEntry[] | { items?: FeedMembershipEntry[]; total?: number }
  items?: FeedMembershipEntry[]
  meta?: { total?: number }
  total?: number
}

const authInit = (token: string | null | undefined): RequestInit => ({
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
})

export async function loadUnreadFeedItemCount(baseURL: string, token: string | null | undefined): Promise<number | null> {
  const payload = await apiGetRaw<{ meta?: { total?: number } }>(
    `${baseURL}/feed/timeline?source_type=external_rss&unread_only=true&limit=1`,
    authInit(token),
  )
  const total = payload.meta?.total
  return typeof total === 'number' && Number.isFinite(total) && total >= 0 ? total : null
}

export async function loadStarredFeedItemIds(baseURL: string, token: string | null | undefined): Promise<string[]> {
  const payload = await apiGetRaw<FeedMembershipPayload>(`${baseURL}/feed/stars?limit=500`, authInit(token))
  return (payload.items || []).map(item => item.id || '').filter(Boolean)
}

export async function loadReadingListFeedItemIds(baseURL: string, token: string | null | undefined): Promise<string[]> {
  const pageSize = 100
  const entries: FeedMembershipEntry[] = []
  for (let page = 1; ; page += 1) {
    const payload = await apiGetRaw<FeedMembershipPayload>(
      `${baseURL}/feed/reading-list?page=${page}&limit=${pageSize}`,
      authInit(token),
    )
    const pageEntries = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.data?.items)
        ? payload.data.items
        : payload.items || []
    entries.push(...pageEntries)
    const total = Number(payload.meta?.total ?? (Array.isArray(payload.data) ? undefined : payload.data?.total) ?? payload.total)
    if ((Number.isFinite(total) && entries.length >= total) || pageEntries.length < pageSize) break
  }
  return entries.map(item => item.target_id || item.feed_item_id || '').filter(Boolean)
}
