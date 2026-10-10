import { describe, expect, it } from 'vitest'

import { mergeBookReadingProgress, pickLatestMediaProgress } from '@/utils/mediaProgressConflict'

describe('media progress conflict resolution', () => {
  it('keeps the furthest book position and unions bookmarks', () => {
    const merged = mergeBookReadingProgress({
      reading_percent: 0.35,
      txt_offset: 35,
      preferences: { bookmarks: [{ id: 'local', label: '本地' }] },
    }, {
      asset_id: 'asset-1',
      pdf_page: 4,
      txt_offset: 80,
      reading_percent: 0.8,
      preferences: { bookmarks: [{ id: 'remote', label: '远端' }] },
    })

    expect(merged.reading_percent).toBe(0.8)
    expect(merged.txt_offset).toBe(80)
    expect(merged.preferences?.bookmarks).toEqual([
      { id: 'remote', label: '远端' },
      { id: 'local', label: '本地' },
    ])
  })

  it('uses the newest timestamp and falls back to furthest progress', () => {
    expect(pickLatestMediaProgress(
      { progress: 0.8, updated_at: '2026-10-10T10:00:00Z' },
      { progress: 0.2, updated_at: '2026-10-10T09:00:00Z' },
    )?.progress).toBe(0.8)
    expect(pickLatestMediaProgress(
      { progress: 0.2 },
      { progress: 0.8 },
    )?.progress).toBe(0.8)
  })
})
