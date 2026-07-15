import { beforeEach, describe, expect, it, vi } from 'vitest'

import { timelineRevisionProposalApi } from '@/api/timelineRevisionProposals'

const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status })

describe('timeline revision proposal API', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  it('uses typed target and decision routes', async () => {
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ items: [] }))
	await timelineRevisionProposalApi.list('event', 'event 1')
	expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/timeline/events/event%201/revision-proposals?page=1')
	fetchMock.mockResolvedValueOnce(ok({ status: 'accepted' }))
	await timelineRevisionProposalApi.decide('comment-1', 'accept')
	expect(fetchMock.mock.calls[1]).toEqual(['/api/v1/timeline/revision-proposals/comment-1/decision', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ decision: 'accept' }) })])
  })
})
