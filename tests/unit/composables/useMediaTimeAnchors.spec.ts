import { describe, expect, it, vi } from 'vitest'

import { formatTimeAnchor, seekToAnchor, tokenizeTimeAnchors } from '@/composables/useMediaTimeAnchors'

describe('media time anchors', () => {
  it('tokenizes every server anchor using Unicode offsets', () => {
    const content = '😀 1:02 再看 1:02'
    expect(tokenizeTimeAnchors(content, [
      { start: 2, end: 6, seconds: 62 },
      { start: 10, end: 14, seconds: 62 },
    ])).toEqual([
      { type: 'text', text: '😀 ' },
      { type: 'anchor', text: '1:02', anchor: { start: 2, end: 6, seconds: 62 } },
      { type: 'text', text: ' 再看 ' },
      { type: 'anchor', text: '1:02', anchor: { start: 10, end: 14, seconds: 62 } },
    ])
  })

  it('ignores invalid or overlapping anchors without throwing', () => {
    expect(tokenizeTimeAnchors('abc', [{ start: 2, end: 9, seconds: 1 }])).toEqual([{ type: 'text', text: 'abc' }])
    expect(tokenizeTimeAnchors('1:00', [
      { start: 0, end: 4, seconds: 60 }, { start: 1, end: 3, seconds: 1 },
    ])).toHaveLength(1)
    expect(tokenizeTimeAnchors('1:00', [
      { start: -1, end: 2, seconds: 1 }, { start: 0, end: 4, seconds: 60 },
    ])).toEqual([{ type: 'anchor', text: '1:00', anchor: { start: 0, end: 4, seconds: 60 } }])
  })

  it('formats and seeks anchors', () => {
    expect(formatTimeAnchor(62)).toBe('1:02')
    expect(formatTimeAnchor(3662)).toBe('1:01:02')
    const seek = vi.fn()
    seekToAnchor({ start: 0, end: 4, seconds: 62 }, seek)
    expect(seek).toHaveBeenCalledWith(62)
  })
})
