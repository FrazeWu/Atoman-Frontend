import { afterEach, expect, it, vi } from 'vitest'
import axios from 'axios'

import { apiRequestEnvelope } from '@/api/client'

vi.mock('axios', () => ({ default: { request: vi.fn() } }))

const axiosRequest = vi.mocked(axios.request)

afterEach(() => vi.restoreAllMocks())

it('sends custom request options and returns the response envelope', async () => {
  axiosRequest.mockResolvedValue({
    status: 200,
    statusText: '',
    headers: {},
    data: { data: { liked: true }, meta: { source: 'test' } },
  } as never)

  const result = await apiRequestEnvelope<{ liked: boolean }, { source: string }>('/api/v1/likes', {
    method: 'POST',
    body: JSON.stringify({ target_id: 'one' }),
  })

  expect(axiosRequest).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/v1/likes', method: 'POST' }))
  expect(result.data.liked).toBe(true)
  expect(result.meta?.source).toBe('test')
})
