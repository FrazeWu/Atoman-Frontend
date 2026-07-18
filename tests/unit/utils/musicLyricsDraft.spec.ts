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

  it('parses trimmed timestamps with one to three minute digits and optional fractions', () => {
    expect(parseMusicLyricTime('01:02.34')).toBe(62_340)
    expect(parseMusicLyricTime('01:02.345')).toBe(62_345)
    expect(parseMusicLyricTime('1:02.34')).toBe(62_340)
    expect(parseMusicLyricTime('  1:02  ')).toBe(62_000)
    expect(parseMusicLyricTime('123:02')).toBe(7_382_000)
    expect(parseMusicLyricTime('1234:02')).toBeNull()
  })

  it('formats timestamps with rounded centiseconds', () => {
    expect(formatMusicLyricTime(62_344)).toBe('01:02.34')
    expect(formatMusicLyricTime(62_345)).toBe('01:02.35')
    expect(formatMusicLyricTime(59_999)).toBe('01:00.00')
  })

  it('keeps formatted timestamps parseable at numeric boundaries', () => {
    expect(formatMusicLyricTime(parseMusicLyricTime('999:59.999')!)).toBe('999:59.99')
    expect(parseMusicLyricTime(formatMusicLyricTime(parseMusicLyricTime('999:59.999')!))).toBe(59_999_990)
    expect(formatMusicLyricTime(-1000)).toBe('00:00.00')
    expect(formatMusicLyricTime(Number.NaN)).toBe('00:00.00')
    expect(formatMusicLyricTime(Number.POSITIVE_INFINITY)).toBe('00:00.00')
    expect(parseMusicLyricTime('-1:00')).toBeNull()
  })

  it('expands multiple timestamps on one LRC line in tag order', () => {
    const result = parseBilingualLrcDraft(
      '[1:02][00:03.456]Echo\n[ar:Artist]\n\n[00:05.00]End',
      '',
    )

    expect(result.issues).toEqual([])
    expect(result.rows.map(({ timeMs, original }) => ({ timeMs, original }))).toEqual([
      { timeMs: 62_000, original: 'Echo' },
      { timeMs: 3456, original: 'Echo' },
      { timeMs: 5000, original: 'End' },
    ])
  })

  it('pairs repeated translation timestamps by occurrence across expanded original tags', () => {
    const result = parseBilingualLrcDraft(
      '[00:01.00][00:02.00]First\n[00:01.00]Second',
      '[00:01.00]甲\n[00:01.00]乙',
    )

    expect(result.issues).toEqual([])
    expect(result.rows.map(({ original, translation }) => ({ original, translation }))).toEqual([
      { original: 'First', translation: '甲' },
      { original: 'First', translation: '' },
      { original: 'Second', translation: '乙' },
    ])
  })

  it('pairs many repeated timestamps in the original occurrence order', () => {
    const lineCount = 2000
    const content = Array.from({ length: lineCount }, (_, index) => `[00:01.00]Original ${index}`).join('\n')
    const translation = Array.from({ length: lineCount }, (_, index) => `[00:01.00]Translation ${index}`).join('\n')

    const result = parseBilingualLrcDraft(content, translation)

    expect(result.issues).toEqual([])
    expect(result.rows).toHaveLength(lineCount)
    expect(result.rows.map((row) => row.translation)).toEqual(
      Array.from({ length: lineCount }, (_, index) => `Translation ${index}`),
    )
  })

  it('reports invalid LRC lines with their physical source line', () => {
    const result = parseBilingualLrcDraft('[00:01.00]Valid\nnot timed', '')

    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'invalid_lrc_line',
      sourceLine: 2,
      source: 'original',
    }))
  })

  it('distinguishes original and translation parse issues on the same source line', () => {
    const result = parseBilingualLrcDraft('invalid original', 'invalid translation')

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_lrc_line', sourceLine: 1, source: 'original' }),
      expect.objectContaining({ code: 'invalid_lrc_line', sourceLine: 1, source: 'translation' }),
    ]))
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
      source: 'translation',
    }))
  })

  it('reports one unmatched issue for multiple translation tags on one physical line', () => {
    const result = parseBilingualLrcDraft('', '[00:01.00][00:02.00]多余')

    expect(result.issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'unmatched_translation_time',
        sourceLine: 1,
        source: 'translation',
      }),
    ])
  })

  it('validates empty originals and missing LRC times', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: null, original: '' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'OK' }),
    ]

    expect(validateMusicLyricDraft(rows, 'lrc')).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', code: 'empty_original', rowIndex: 0 }),
      expect.objectContaining({ severity: 'error', code: 'missing_time', rowIndex: 0 }),
    ]))
    expect(validateMusicLyricDraft(rows, 'plain')).not.toContainEqual(
      expect.objectContaining({ code: 'missing_time' }),
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
      code: 'descending_time',
      rowIndex: 1,
    }))
    expect(issues.filter((issue) => issue.code === 'duplicate_time')).toHaveLength(1)
  })

  it('does not validate any time rules for plain rows', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: null, original: 'Untimed' }),
      createMusicLyricDraftRow({ timeMs: 2000, original: 'Later' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'Earlier' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'Duplicate' }),
    ]

    const timeIssueCodes = new Set(['missing_time', 'descending_time', 'duplicate_time'])
    expect(validateMusicLyricDraft(rows, 'plain').filter((issue) => timeIssueCodes.has(issue.code))).toEqual([])
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

  it('preserves sparse repeated-time translations across an LRC round trip', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: 1000, original: 'One A', translation: '' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'One B', translation: '乙' }),
      createMusicLyricDraftRow({ timeMs: 1000, original: 'One C', translation: '' }),
      createMusicLyricDraftRow({ timeMs: 2000, original: 'Two', translation: '' }),
    ]

    const serialized = serializeBilingualLrcDraft(rows)

    expect(serialized.translation).toBe('[00:01.00]\n[00:01.00]乙')
    expect(parseBilingualLrcDraft(serialized.content, serialized.translation).rows.map((row) => row.translation))
      .toEqual(['', '乙', '', ''])
  })

  it('serializes null times with a zero timestamp fallback', () => {
    const rows = [
      createMusicLyricDraftRow({ timeMs: null, original: 'Untimed', translation: '未计时' }),
    ]

    expect(serializeBilingualLrcDraft(rows)).toEqual({
      content: '[00:00.00]Untimed',
      translation: '[00:00.00]未计时',
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
