import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiGet } from '@/api/client'
import { searchApi } from '@/api/search'
import { readSearchQuery } from '@/utils/searchUrl'

vi.mock('@/api/client', () => ({ apiGet: vi.fn() }))
vi.mock('@/composables/useApi', () => ({ useApiUrl: () => 'https://api.atoman.org/api/v1' }))
beforeEach(() => vi.clearAllMocks())
describe('统一搜索 API', () => {
  it('复用 API client、基址、重复参数与取消信号', async () => {
    const signal = new AbortController().signal
    await searchApi.search(readSearchQuery({ q: '三体', module: 'books', type: ['work', 'author'], 'filter[language]': ['zh', 'en'] }), signal, true)
    const [path, options] = vi.mocked(apiGet).mock.calls[0]!
    const url = new URL(path)
    expect(url.pathname).toBe('/api/v1/search')
    expect(url.searchParams.getAll('type')).toEqual(['work', 'author'])
    expect(url.searchParams.getAll('filter[language]')).toEqual(['zh', 'en'])
    expect(url.searchParams.get('view')).toBe('preview')
    expect(options).toEqual({ signal })
  })
  it('能力请求只传 scope，错误保持 client 语义', async () => {
    const signal = new AbortController().signal
    vi.mocked(apiGet).mockRejectedValue(new Error('offline'))
    await expect(searchApi.capabilities('mine', signal)).rejects.toThrow('offline')
    expect(apiGet).toHaveBeenCalledWith('https://api.atoman.org/api/v1/search/capabilities?scope=mine', { signal })
  })
})
