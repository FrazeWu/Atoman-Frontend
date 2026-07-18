import { describe, expect, it } from 'vitest'

import {
  createMusicLyricDraftRow,
  parseBilingualLrcDraft,
  parseMusicLyricDraft,
  serializeBilingualLrcDraft,
  serializeMusicLyricDraft,
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

  it('provides empty typed placeholders for bilingual LRC support', () => {
    expect(parseBilingualLrcDraft()).toEqual({ rows: [], issues: [] })
    expect(parseMusicLyricDraft('[00:01.00]Alpha', '', 'lrc')).toEqual([])
    expect(serializeBilingualLrcDraft([])).toEqual({ content: '', translation: '' })
  })
})
