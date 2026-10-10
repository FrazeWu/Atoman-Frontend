import { afterEach, describe, expect, it } from 'vitest'

import { getLocalBookReadingProgress, saveLocalBookReadingProgress } from '@/utils/bookReadingProgress'

afterEach(() => localStorage.clear())

describe('book reading progress', () => {
  it('persists and restores bounded anonymous reading progress', () => {
    saveLocalBookReadingProgress('asset-1', { reading_percent: 1.4, epub_cfi: 'epubcfi(/6/2)' })

    expect(getLocalBookReadingProgress('asset-1')).toMatchObject({
      reading_percent: 1,
      epub_cfi: 'epubcfi(/6/2)',
    })
  })

  it('ignores malformed local state', () => {
    localStorage.setItem('atoman:book-reading-progress:asset-1', '{bad')
    expect(getLocalBookReadingProgress('asset-1')).toBeNull()
  })

  it('在更新阅读位置时保留本地书签', () => {
    const bookmark = {
      id: 'bookmark-1',
      label: '第 1 页',
      reading_percent: 0,
      txt_offset: 0,
      created_at: '2026-10-10',
    }
    saveLocalBookReadingProgress('asset-1', { reading_percent: 0, bookmarks: [bookmark] })
    saveLocalBookReadingProgress('asset-1', { reading_percent: 0.5 })

    expect(getLocalBookReadingProgress('asset-1')).toMatchObject({
      reading_percent: 0.5,
      bookmarks: [bookmark],
    })
  })
})
