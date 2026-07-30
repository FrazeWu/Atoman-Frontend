import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadReadingListFeedItemIds, loadStarredFeedItemIds, loadUnreadFeedItemCount } from '@/api/feedMembership'

afterEach(() => vi.restoreAllMocks())

describe('feed membership API', () => {
  it('loads the external unread count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [], meta: { total: 4 } }), { status: 200 }))

    await expect(loadUnreadFeedItemCount('/api/v1', 'token')).resolves.toBe(4)
  })

  it('loads starred feed item ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'one' }, { id: 'two' }] }), { status: 200 }))

    await expect(loadStarredFeedItemIds('/api/v1', 'token')).resolves.toEqual(['one', 'two'])
  })

  it('loads paginated reading-list ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [{ target_id: 'one' }, { feed_item_id: 'two' }],
      meta: { total: 2 },
    }), { status: 200 }))

    await expect(loadReadingListFeedItemIds('/api/v1', 'token')).resolves.toEqual(['one', 'two'])
  })
})
