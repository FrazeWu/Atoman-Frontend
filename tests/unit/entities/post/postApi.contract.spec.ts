import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPostList, getPostById } from '@/entities/post/api/postApi'
import { apiGetEnvelope } from '@/api/client'

vi.mock('@/composables/useApiUrl', () => ({
  useApiUrl: () => 'https://api.atoman.org/api/v1',
}))
vi.mock('@/api/client', () => ({
  apiGetEnvelope: vi.fn(),
}))

const fetchEnvelope = vi.mocked(apiGetEnvelope)

describe('canonical blog posts API', () => {
  beforeEach(() => fetchEnvelope.mockReset())

  it('reads the actual /blog/posts envelope and page_size metadata', async () => {
    fetchEnvelope.mockResolvedValueOnce({
      data: [{ id: 'real-uuid', title: '真实文章' }],
      meta: { total: 23, page: 2, page_size: 5, has_more: true },
    } as never)
    const result = await fetchPostList({ page: 2, limit: 5 })
    expect(fetchEnvelope).toHaveBeenCalledWith('https://api.atoman.org/api/v1/blog/posts?page=2&page_size=5')
    expect(result).toEqual({ posts: [{ id: 'real-uuid', title: '真实文章' }], total: 23 })
  })

  it('unwraps actual detail response and encodes identifier', async () => {
    fetchEnvelope.mockResolvedValueOnce({ data: { id: 'real-id', title: '真实详情' } } as never)
    await expect(getPostById('real/id')).resolves.toEqual({ id: 'real-id', title: '真实详情' })
    expect(fetchEnvelope).toHaveBeenCalledWith('https://api.atoman.org/api/v1/blog/posts/real%2Fid')
  })

  it('propagates network and HTTP errors; never synthesizes fake posts', async () => {
    fetchEnvelope.mockRejectedValueOnce(new Error('network down'))
    await expect(fetchPostList()).rejects.toThrow('network down')
  })
})
