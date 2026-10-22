import { describe, expect, it } from 'vitest'
import { readSearchQuery, writeSearchQuery, searchLocation, safeSearchHref, unifiedSearchEnabled } from '@/utils/searchUrl'
import { searchParams } from '@/api/search'

describe('统一搜索 URL', () => {
  it('默认不切换现有入口', () => expect(unifiedSearchEnabled).toBe(false))
  it('重复类型和筛选往返不丢失', () => {
    const query = { q: '三体 世界', scope: 'mine', module: 'books', type: ['note', 'book_list'], page: '3', sort: 'recent', 'filter[language]': ['zh', 'en'] }
    expect(writeSearchQuery(readSearchQuery(query))).toEqual(query)
    const params = searchParams(readSearchQuery(query))
    expect(params.getAll('type')).toEqual(['note', 'book_list'])
    expect(params.getAll('filter[language]')).toEqual(['zh', 'en'])
    expect(params.get('view')).toBe('grouped')
  })
  it('单类型使用列表和页码，预览强制 preview', () => {
    const state = readSearchQuery({ module: 'books', type: 'work', page: '2' })
    expect(searchParams(state).get('view')).toBe('list')
    expect(searchParams(state).get('page')).toBe('2')
    expect(searchParams(state, true).get('view')).toBe('preview')
    expect(searchParams(state, true).has('page')).toBe(false)
  })
  it('处理缺失值与非法页码', () => {
    expect(readSearchQuery({ page: '-3', type: ['work', 'work', null] })).toMatchObject({ q: '', scope: 'public', page: 1, types: ['work'] })
    expect(searchLocation('  科幻  ', 'books', ['work'])).toEqual({ path: '/search', query: { q: '科幻', module: 'books', type: ['work'] } })
  })
  it('仅允许站内结果地址', () => {
    for (const href of ['https://evil.test', '//evil.test', '/\\evil', '/\ninvalid']) expect(safeSearchHref(href)).toBe('/search')
    expect(safeSearchHref('/books/work/1?tab=info')).toBe('/books/work/1?tab=info')
  })
})
