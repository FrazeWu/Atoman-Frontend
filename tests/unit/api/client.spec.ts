import { afterEach, expect, it, vi } from 'vitest'

import { apiRequestEnvelope } from '@/api/client'

afterEach(() => vi.restoreAllMocks())

it('sends custom request options and returns the response envelope', async () => {
  vi.stubGlobal('fetch', vi.fn())
  const fetchMock = vi.mocked(fetch)
  fetchMock.mockResolvedValue(new Response(JSON.stringify({
    data: { liked: true },
    meta: { source: 'test' },
  }), { status: 200 }))

  const result = await apiRequestEnvelope<{ liked: boolean }, { source: string }>('/api/v1/likes', {
    method: 'POST',
    body: JSON.stringify({ target_id: 'one' }),
  })

  expect(fetchMock).toHaveBeenCalledWith('/api/v1/likes', expect.objectContaining({ method: 'POST' }))
  expect(result.data.liked).toBe(true)
  expect(result.meta?.source).toBe('test')
})
