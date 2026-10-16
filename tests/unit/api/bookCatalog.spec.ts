import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '@/api/bookCatalog'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
function respond(data: unknown) {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data }), { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
describe('新版公开图书接口', () => {
  it('搜索新版公开作品，不依赖文件或旧 catalog 接口', async () => {
    const fetch = respond({ items: [], total: 0, limit: 24, offset: 24 })
    await api.searchCatalogWorks('历史 & 中国', 24, 24)
    expect(fetch).toHaveBeenCalledWith('/api/v1/books/works?q=%E5%8E%86%E5%8F%B2%20%26%20%E4%B8%AD%E5%9B%BD&limit=24&offset=24', expect.objectContaining({ credentials: 'include' }))
  })
  it('只用书名和作者创建公开作品，成功后通知发现页更新', async () => {
    const fetch = respond({ id: 'work-1', revision_id: 'revision-1' })
    const before = api.catalogRevision.value
    await expect(api.createCatalogWork({ title: '中国大历史', authors: ['黄仁宇'] })).resolves.toMatchObject({ id: 'work-1' })
    expect(fetch).toHaveBeenCalledWith('/api/v1/books/works', expect.objectContaining({ method: 'POST', body: '{"title":"中国大历史","authors":["黄仁宇"]}' }))
    expect(api.catalogRevision.value).toBe(before + 1)
  })
  it('出版版本独立创建，无需 import_id 或审核参数', async () => {
    const fetch = respond({ id: 'edition-1', work_id: 'work-1' })
    await api.createCatalogEdition('work-1', { publisher: '出版社', isbn13: '9787511575920' })
    expect(fetch).toHaveBeenCalledWith('/api/v1/books/works/work-1/editions', expect.objectContaining({ method: 'POST', body: '{"publisher":"出版社","isbn13":"9787511575920"}' }))
  })
  it('失败时不触发刷新，详情和文件分别请求', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const before = api.catalogRevision.value
    await expect(api.createCatalogWork({ title: '书', authors: ['作者'] })).rejects.toThrow()
    expect(api.catalogRevision.value).toBe(before)
    const fetch = respond({ id: 'work-1' })
    await api.getCatalogWork('work-1')
    await api.listCatalogResources('work-1')
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/v1/books/works/work-1', '/api/v1/books/works/work-1/assets'])
  })
})
