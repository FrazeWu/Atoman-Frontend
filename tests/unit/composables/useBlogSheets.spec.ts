import { beforeEach, describe, expect, it } from 'vitest'

import { useBlogSheets } from '@/composables/useBlogSheets'

describe('useBlogSheets', () => {
  beforeEach(() => {
    useBlogSheets().closeAll()
  })

  it('opens a collection and then a post as two ordered layers', () => {
    const sheets = useBlogSheets()

    sheets.openCollection('collection-1', '合集一', 'channel-1')
    sheets.openPost('post-1', '文章一', 'collection-1')

    expect(sheets.layers.value.map(layer => layer.kind)).toEqual(['collection', 'post'])
    expect(sheets.top.value?.key).toBe('post:post-1')
  })

  it('returns to the collection when the post layer closes', () => {
    const sheets = useBlogSheets()
    sheets.openCollection('collection-1', '合集一', 'channel-1')
    sheets.openPost('post-1', '文章一', 'collection-1')

    sheets.closeTop()

    expect(sheets.layers.value).toHaveLength(1)
    expect(sheets.top.value?.key).toBe('collection:collection-1')
  })

  it('keeps at most two layers', () => {
    const sheets = useBlogSheets()
    sheets.openCollection('collection-1', '合集一', 'channel-1')
    sheets.openPost('post-1', '文章一', 'collection-1')
    sheets.openPost('post-2', '文章二', 'collection-1')

    expect(sheets.layers.value).toHaveLength(2)
    expect(sheets.top.value?.key).toBe('post:post-2')
  })
})
