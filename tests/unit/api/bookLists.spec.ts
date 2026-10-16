import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/bookLists'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
function mockResponse(data: unknown) {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data }), { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('新版书单 API', () => {
  it('搜索公开发布内容，编码关键词并传递分页', async () => {
    const fetch = mockResponse({ items: [], total: 0 })
    await api.searchBookLists('中国 & 历史', 20)
    expect(fetch).toHaveBeenCalledWith('/api/v1/books/booklists?q=%E4%B8%AD%E5%9B%BD%20%26%20%E5%8E%86%E5%8F%B2&limit=20&offset=20', expect.objectContaining({ credentials: 'include' }))
  })

  it('保存完整草稿时保留原作品 ID、顺序、推荐语和并发版本', async () => {
    const fetch = mockResponse({ id: 'list', version: 3 })
    const input = { base_version: 2, title: '书单', description: '', items: [{ work_id: 'old-work', recommendation: '原推荐语' }] }
    await expect(api.saveBookListDraft('list', input)).resolves.toMatchObject({ version: 3 })
    expect(fetch).toHaveBeenCalledWith('/api/v1/books/me/booklists/list/draft', expect.objectContaining({ method: 'PUT', credentials: 'include', body: JSON.stringify(input) }))
  })

  it('发布与撤下使用明确版本，不与保存草稿混合', async () => {
    const fetch = mockResponse({ version: 4 })
    await api.publishBookList('list', 3, 'public')
    expect(fetch.mock.calls[0]).toEqual(['/api/v1/books/me/booklists/list/publish', expect.objectContaining({ method: 'POST', body: JSON.stringify({ base_version: 3, visibility: 'public' }) })])
    await api.unpublishBookList('list', 4)
    expect(fetch.mock.calls[1]).toEqual(['/api/v1/books/me/booklists/list/unpublish', expect.objectContaining({ method: 'POST', body: JSON.stringify({ base_version: 4 }) })])
  })

  it('普通收藏不确认已读，显式确认只传实际看到的发布版本', async () => {
    const fetch = mockResponse({ seen_version: 0 })
    await api.saveBookListBookmark('list')
    await api.saveBookListBookmark('list', 5)
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', body: '{}' })
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT', body: '{"seen_version":5}' })
  })

  it('作品选择调用新版作品接口，不访问旧书库', async () => {
    const fetch = mockResponse({ items: [] })
    await api.searchBookListWorks('历史')
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/v1/books/works?q=%E5%8E%86%E5%8F%B2&limit=20&offset=0')
    await api.deleteBookList('list', 7)
    expect(fetch.mock.calls[1]).toEqual(['/api/v1/books/me/booklists/list?base_version=7', expect.objectContaining({ method: 'DELETE' })])
  })
})
