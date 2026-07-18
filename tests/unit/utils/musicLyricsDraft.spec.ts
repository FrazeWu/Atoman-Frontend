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
    const result = parseMusicLyricDraft(
      'Alpha\nBeta\nGamma',
      '甲\n\n丙',
      'plain',
    )

    expect(result.rows.map(({ original, translation }) => ({ original, translation }))).toEqual([
      { original: 'Alpha', translation: '甲' },
      { original: 'Beta', translation: '' },
      { original: 'Gamma', translation: '丙' },
    ])
  })

  it('creates a unique local id for each row', () => {
    const first = createMusicLyricDraftRow()
    const second = createMusicLyricDraftRow()

    expect(first.id).not.toBe(second.id)
    expect(first.id).not.toBe('')
    expect(second.id).not.toBe('')
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
    expect(serializeBilingualLrcDraft([])).toEqual({ content: '', translation: '' })
  })
})
