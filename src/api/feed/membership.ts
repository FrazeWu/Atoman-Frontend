import { apiGetRaw } from '@/api/client'

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

const MAX_MEMBERSHIP_PAGES = 50

async function loadPagedMembershipIds(
  urlForPage: (page: number, pageSize: number) => string,
  token: string | null | undefined,
  idOf: (item: FeedMembershipEntry) => string,
) {
  const pageSize = 100
  const entries: FeedMembershipEntry[] = []
  let previousPageKey = ''
  for (let page = 1; page <= MAX_MEMBERSHIP_PAGES; page += 1) {
    const payload = await apiGetRaw<FeedMembershipPayload>(urlForPage(page, pageSize), authInit(token))
    const pageEntries = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.data?.items)
        ? payload.data.items
        : payload.items || []
    const pageKey = pageEntries.map(idOf).join('\n')
    if (page > 1 && pageKey === previousPageKey) break
    previousPageKey = pageKey
    entries.push(...pageEntries)
    const total = Number(payload.meta?.total ?? (Array.isArray(payload.data) ? undefined : payload.data?.total) ?? payload.total)
    if ((Number.isFinite(total) && entries.length >= total) || pageEntries.length < pageSize) break
  }
  return entries.map(idOf).filter(Boolean)
}

export async function loadStarredFeedItemIds(baseURL: string, token: string | null | undefined): Promise<string[]> {
  return loadPagedMembershipIds(
    (page, pageSize) => `${baseURL}/feed/stars?page=${page}&limit=${pageSize}`,
    token,
    item => item.id || item.target_id || item.feed_item_id || '',
  )
}

export async function loadReadingListFeedItemIds(baseURL: string, token: string | null | undefined): Promise<string[]> {
  return loadPagedMembershipIds(
    (page, pageSize) => `${baseURL}/feed/reading-list?page=${page}&limit=${pageSize}`,
    token,
    item => item.target_id || item.feed_item_id || '',
  )
}
