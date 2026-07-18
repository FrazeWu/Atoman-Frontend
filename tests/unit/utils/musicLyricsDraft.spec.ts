import { describe, expect, it } from 'vitest'

import {
  createMusicLyricDraftRow,
  formatMusicLyricTime,
  parseBilingualLrcDraft,
  parseMusicLyricDraft,
  parseMusicLyricTime,
  serializeBilingualLrcDraft,
  serializeMusicLyricDraft,
  sortMusicLyricDraftRows,
  validateMusicLyricDraft,
  type MusicLyricDraftRow,
} from '@/utils/musicLyricsDraft'

describe('musicLyricsDraft', () => {
  it('aligns plain original and translation by physical line', () => {
    const rows = parseMusicLyricDraft(
      'Alpha\nBeta\nGamma',
      '甲\n\n丙',
      'plain',
    )

    expect(rows.map(({ original, translation }) => ({ original, translation }))).toEqual([
      { original: 'Alpha', translation: '甲' },
      { original: 'Beta', translation: '' },
      { original: 'Gamma', translation: '丙' },
    ])
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
  })

  it('creates a unique local id for each row', () => {
    const first = createMusicLyricDraftRow()
    const second = createMusicLyricDraftRow()

    expect(first.id).not.toBe(second.id)
    expect(first.id).not.toBe('')
    expect(second.id).not.toBe('')
  })

  it('always creates the row id internally', () => {
    // @ts-expect-error id is generated internally and is not accepted as input
    const row = createMusicLyricDraftRow({ id: 'external-id' })

    expect(row.id).not.toBe('external-id')
  })

  it('parses empty plain strings as one physical row', () => {
    const rows = parseMusicLyricDraft('', '', 'plain')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      timeMs: null,
      original: '',
      translation: '',
    })
  })

  it('keeps a trailing empty translation line when serializing plain rows', () => {
    const rows: MusicLyricDraftRow[] = [
      createMusicLyricDraftRow({ original: 'Alpha', translation: '甲' }),
      createMusicLyricDraftRow({ original: 'Beta', translation: '' }),
    ]

    expect(serializeMusicLyricDraft(rows, 'plain')).toEqual({
      content: 'Alpha\nBeta',
      translation: '甲\n',
    })
  })

  it('does not mutate rows while serializing', () => {
    const rows: MusicLyricDraftRow[] = [
      createMusicLyricDraftRow({ timeMs: 1200, original: 'Alpha', translation: '甲' }),
    ]
    const snapshot = structuredClone(rows)

    serializeMusicLyricDraft(rows, 'plain')

    expect(rows).toEqual(snapshot)
  })

  it('parses two- and three-decimal timestamps', () => {
    expect(parseMusicLyricTime('01:02.34')).toBe(62_340)
    expect(parseMusicLyricTime('01:02.345')).toBe(62_345)
    expect(parseMusicLyricTime('1:02.34')).toBeNull()
  })

  it('formats timestamps with rounded centiseconds', () => {
    expect(formatMusicLyricTime(62_344)).toBe('01:02.34')
    expect(formatMusicLyricTime(62_345)).toBe('01:02.35')
    expect(formatMusicLyricTime(59_999)).toBe('01:00.00')
  })

  it('expands multiple timestamps on one LRC line in tag order', () => {
    const result = parseBilingualLrcDraft(
      '[00:01.20][00:03.456]Echo\n[ar:Artist]\n\n[00:05.00]End',
      '',
    )

    expect(result.issues).toEqual([])
    expect(result.rows.map(({ timeMs, original }) => ({ timeMs, original }))).toEqual([
      { timeMs: 1200, original: 'Echo' },
      { timeMs: 3456, original: 'Echo' },
      { timeMs: 5000, original: 'End' },
    ])
  })

  it('pairs repeated translation timestamps by occurrence order', () => {
    const result = parseBilingualLrcDraft(
      '[00:01.00]First\n[00:01.00]Second',
      '[00:01.00]甲\n[00:01.00]乙',
    )

    expect(result.issues).toEqual([])
    expect(result.rows.map(({ original, translation }) => ({ original, translation }))).toEqual([
      { original: 'First', translation: '甲' },
      { original: 'Second', translation: '乙' },
    ])
  })

  it('reports invalid LRC lines with their physical source line', () => {
    const result = parseBilingualLrcDraft('[00:01.00]Valid\nnot timed', '')

    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'invalid_lrc_line',
      sourceLine: 2,
    }))
  })

  it('reports unmatched translation timestamps with their source line', () => {
    const result = parseBilingualLrcDraft(
      '[00:01.00]Original',
      '[00:01.00]已配对\n[00:02.00]多余',
    )

    expect(result.rows[0]?.translation).toBe('已配对')
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'unmatched_translation_time',
      sourceLine: 2,
    }))
  })

  it('validates empty originals and missing LRC times', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: null, original: '' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'OK' }),
    ]

    expect(validateMusicLyricDraft(rows, 'lrc')).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', code: 'empty_original', rowIndex: 0 }),
      expect.objectContaining({ severity: 'error', code: 'missing_lrc_time', rowIndex: 0 }),
    ]))
    expect(validateMusicLyricDraft(rows, 'plain')).not.toContainEqual(
      expect.objectContaining({ code: 'missing_lrc_time' }),
    )
  })

  it('validates descending adjacent times and warns once per duplicate time', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: 2000, original: 'Later' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'Earlier' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'Same A' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'Same B' }),
    ]
    const issues = validateMusicLyricDraft(rows, 'lrc')

    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'descending_lrc_time',
      rowIndex: 1,
    }))
    expect(issues.filter((issue) => issue.code === 'duplicate_lrc_time')).toHaveLength(1)
  })

  it('sorts by time stably with null last without mutating input', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: null, original: 'Untimed' }),
      createMusicLyricDraftRow({ timeMs: 2000, original: 'Later' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'First equal' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'Second equal' }),
    ]
    const snapshot = structuredClone(rows)

    const sorted = sortMusicLyricDraftRows(rows)

    expect(sorted.map((row) => row.original)).toEqual([
      'First equal',
      'Second equal',
      'Later',
      'Untimed',
    ])
    expect(rows).toEqual(snapshot)
    expect(sorted).not.toBe(rows)
  })

  it('serializes original and non-empty translations into separate LRC strings', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: 1234, original: 'Alpha', translation: '甲' }),
      createMusicLyricDraftRow({ timeMs: 2500, original: 'Beta', translation: '' }),
    ]

    expect(serializeBilingualLrcDraft(rows)).toEqual({
      content: '[00:01.23]Alpha\n[00:02.50]Beta',
      translation: '[00:01.23]甲',
    })
    expect(serializeMusicLyricDraft(rows, 'lrc')).toEqual({
      content: '[00:01.23]Alpha\n[00:02.50]Beta',
      translation: '[00:01.23]甲',
    })
  })

  it('does not mutate rows while sorting or serializing LRC', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: 2500, original: 'Beta', translation: '' }),
      createMusicLyricDraftRow({ timeMs: 1234, original: 'Alpha', translation: '甲' }),
    ]
    const snapshot = structuredClone(rows)

    sortMusicLyricDraftRows(rows)
    serializeBilingualLrcDraft(rows)
    serializeMusicLyricDraft(rows, 'lrc')

    expect(rows).toEqual(snapshot)
  })

  it('serializes no LRC rows as empty strings', () => {
    expect(serializeBilingualLrcDraft([])).toEqual({ content: '', translation: '' })
  })
})
