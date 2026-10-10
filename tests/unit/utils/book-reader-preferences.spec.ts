import { describe, expect, it } from 'vitest'

import { parseBookReaderBookmarks } from '@/utils/bookReaderPreferences'

describe('book reader preferences', () => {
  it('keeps valid bookmarks and clamps unsafe positions', () => {
    expect(parseBookReaderBookmarks([
      { id: 'bookmark-1', label: '第 3 页', reading_percent: 2, pdf_page: 3, created_at: '2026-10-10' },
      { id: 'invalid', reading_percent: 0.4 },
    ])).toEqual([{
      id: 'bookmark-1',
      label: '第 3 页',
      reading_percent: 1,
      epub_cfi: '',
      pdf_page: 3,
      txt_offset: undefined,
      comic_page: undefined,
      created_at: '2026-10-10',
    }])
  })
})
