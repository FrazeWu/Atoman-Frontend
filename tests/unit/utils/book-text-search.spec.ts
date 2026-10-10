import { describe, expect, it } from 'vitest'

import { findBookTextMatches } from '@/utils/bookTextSearch'

describe('book text search', () => {
  it('finds case-insensitive matches with readable previews', () => {
    expect(findBookTextMatches('前言\nThe River flows quietly.\nThe river turns east.', 'RIVER')).toEqual([
      { index: 7, preview: '前言 The River flows quietly. The river turns east.' },
      { index: 32, preview: '前言 The River flows quietly. The river turns east.' },
    ])
  })

  it('returns no matches for empty queries and respects the limit', () => {
    expect(findBookTextMatches('abc abc abc', '   ')).toEqual([])
    expect(findBookTextMatches('abc abc abc', 'abc', 2)).toHaveLength(2)
  })
})
