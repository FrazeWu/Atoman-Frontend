import { describe, expect, it } from 'vitest'
import {
  buildLyricsAnnotationIndex,
  computeCurrentLyricLine,
  mergeLyricsWithTranslation,
  parseLrcLyrics,
  parsePlainLyrics,
} from '@/utils/musicLyrics'

describe('musicLyrics utils', () => {
  it('parses plain lyrics into ordered lines', () => {
    const lines = parsePlainLyrics('Hello\n\nWorld ')

    expect(lines).toEqual([
      {
        id: 'plain-0',
        text: 'Hello',
        translation: '',
        startTimeMs: null,
        endTimeMs: null,
        lineNumber: 0,
      },
      {
        id: 'plain-1',
        text: 'World',
        translation: '',
        startTimeMs: null,
        endTimeMs: null,
        lineNumber: 1,
      },
    ])
  })

  it('parses lrc lyrics and computes line end times', () => {
    const lines = parseLrcLyrics('[00:01.50]Hello\n[00:03.00]World')

    expect(lines).toEqual([
      {
        id: 'lrc-1500-0',
        text: 'Hello',
        translation: '',
        startTimeMs: 1500,
        endTimeMs: 3000,
        lineNumber: 0,
      },
      {
        id: 'lrc-3000-1',
        text: 'World',
        translation: '',
        startTimeMs: 3000,
        endTimeMs: null,
        lineNumber: 1,
      },
    ])
  })

  it('merges original and translation lines by order for plain lyrics', () => {
    const merged = mergeLyricsWithTranslation(
      parsePlainLyrics('Hello\nWorld'),
      parsePlainLyrics('你好\n世界'),
    )

    expect(merged.map((line) => ({ text: line.text, translation: line.translation }))).toEqual([
      { text: 'Hello', translation: '你好' },
      { text: 'World', translation: '世界' },
    ])
  })

  it('merges translation lines by timestamp for lrc lyrics', () => {
    const merged = mergeLyricsWithTranslation(
      parseLrcLyrics('[00:01.00]Hello\n[00:03.00]World'),
      parseLrcLyrics('[00:01.00]你好\n[00:03.00]世界'),
    )

    expect(merged.map((line) => ({ text: line.text, translation: line.translation, startTimeMs: line.startTimeMs }))).toEqual([
      { text: 'Hello', translation: '你好', startTimeMs: 1000 },
      { text: 'World', translation: '世界', startTimeMs: 3000 },
    ])
  })

  it('builds annotation index and highlight ranges by line', () => {
    const index = buildLyricsAnnotationIndex([
      {
        id: 'ann-1',
        line_id: 'line-1',
        body: 'note',
        selected_text: 'Hello',
        start_offset: 0,
        end_offset: 5,
        upvotes: 2,
        downvotes: 0,
        net_score: 2,
        status: 'active',
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
      },
      {
        id: 'ann-2',
        line_id: 'line-1',
        body: 'later',
        selected_text: 'lo',
        start_offset: 3,
        end_offset: 5,
        upvotes: 1,
        downvotes: 0,
        net_score: 1,
        status: 'active',
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
      },
      {
        id: 'ann-3',
        line_id: 'line-2',
        body: 'gone',
        selected_text: 'skip',
        start_offset: 0,
        end_offset: 4,
        upvotes: 0,
        downvotes: 0,
        net_score: 0,
        status: 'deleted',
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
      },
    ])

    expect(index.annotationsByLine.get('line-1')?.map((annotation) => annotation.id)).toEqual(['ann-1', 'ann-2'])
    expect(index.annotationsByLine.has('line-2')).toBe(false)
    expect(index.rangesByLine.get('line-1')).toEqual([
      { annotationId: 'ann-1', startOffset: 0, endOffset: 5 },
      { annotationId: 'ann-2', startOffset: 3, endOffset: 5 },
    ])
  })

  it('excludes needs_rebind annotations from line indexes and highlight ranges', () => {
    const index = buildLyricsAnnotationIndex([
      {
        id: 'ann-1',
        line_id: 'line-1',
        body: 'active note',
        selected_text: 'Hello',
        start_offset: 0,
        end_offset: 5,
        upvotes: 2,
        downvotes: 0,
        net_score: 2,
        status: 'active',
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
      },
      {
        id: 'ann-2',
        line_id: 'line-1',
        body: 'stale anchor',
        selected_text: 'Hello',
        start_offset: 0,
        end_offset: 5,
        upvotes: 9,
        downvotes: 0,
        net_score: 9,
        status: 'needs_rebind',
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
      },
    ])

    expect(index.annotationsByLine.get('line-1')?.map((annotation) => annotation.id)).toEqual(['ann-1'])
    expect(index.rangesByLine.get('line-1')).toEqual([
      { annotationId: 'ann-1', startOffset: 0, endOffset: 5 },
    ])
  })

  it('computes current lyric line from current time in seconds', () => {
    const lines = parseLrcLyrics('[00:01.00]Hello\n[00:03.00]World')

    expect(computeCurrentLyricLine(lines, 0.5)?.text).toBeUndefined()
    expect(computeCurrentLyricLine(lines, 1.2)?.text).toBe('Hello')
    expect(computeCurrentLyricLine(lines, 3.4)?.text).toBe('World')
  })
})
