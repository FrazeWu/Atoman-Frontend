export type MusicLyricDraftFormat = 'plain' | 'lrc'

export type MusicLyricDraftRow = {
  id: string
  timeMs: number | null
  original: string
  translation: string
}

export type MusicLyricDraftIssue = {
  severity: 'error' | 'warning'
  code: string
  message: string
  rowIndex?: number
  sourceLine?: number
}

export type MusicLyricDraftParseResult = {
  rows: MusicLyricDraftRow[]
  issues: MusicLyricDraftIssue[]
}

export type MusicLyricDraftSerialized = {
  content: string
  translation: string
}

let nextLocalRowId = 0

export function createMusicLyricDraftRow(
  partial: Partial<MusicLyricDraftRow> = {},
): MusicLyricDraftRow {
  nextLocalRowId += 1

  return {
    id: partial.id ?? `music-lyric-row-${nextLocalRowId}`,
    timeMs: partial.timeMs ?? null,
    original: partial.original ?? '',
    translation: partial.translation ?? '',
  }
}

function splitPhysicalLines(value: string): string[] {
  if (value === '') return []

  return value
    .split('\n')
    .map((line) => line.endsWith('\r') ? line.slice(0, -1) : line)
}

export function parseMusicLyricDraft(
  content: string,
  translation: string,
  format: MusicLyricDraftFormat,
): MusicLyricDraftParseResult {
  if (format === 'lrc') return parseBilingualLrcDraft(content, translation)

  const originalLines = splitPhysicalLines(content)
  const translationLines = splitPhysicalLines(translation)
  const lineCount = Math.max(originalLines.length, translationLines.length)

  return {
    rows: Array.from({ length: lineCount }, (_, index) => createMusicLyricDraftRow({
      original: originalLines[index] ?? '',
      translation: translationLines[index] ?? '',
    })),
    issues: [],
  }
}

export function serializeMusicLyricDraft(
  rows: readonly MusicLyricDraftRow[],
  format: MusicLyricDraftFormat,
): MusicLyricDraftSerialized {
  if (format === 'lrc') return serializeBilingualLrcDraft(rows)

  return {
    content: rows.map((row) => row.original).join('\n'),
    translation: rows.map((row) => row.translation).join('\n'),
  }
}

export function parseBilingualLrcDraft(
  _content = '',
  _translation = '',
): MusicLyricDraftParseResult {
  return { rows: [], issues: [] }
}

export function serializeBilingualLrcDraft(
  _rows: readonly MusicLyricDraftRow[],
): MusicLyricDraftSerialized {
  return { content: '', translation: '' }
}
