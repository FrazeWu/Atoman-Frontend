import type { MusicLyricsFormat } from '@/api/musicV1'

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
  source?: 'original' | 'translation'
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
  partial: Partial<Omit<MusicLyricDraftRow, 'id'>> = {},
): MusicLyricDraftRow {
  nextLocalRowId += 1

  return {
    id: `music-lyric-row-${nextLocalRowId}`,
    timeMs: partial.timeMs ?? null,
    original: partial.original ?? '',
    translation: partial.translation ?? '',
  }
}

function splitPhysicalLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.endsWith('\r') ? line.slice(0, -1) : line)
}

export function parseMusicLyricDraft(
  content: string,
  translation: string,
  format: MusicLyricsFormat,
): MusicLyricDraftRow[] {
  if (format === 'lrc') return parseBilingualLrcDraft(content, translation).rows

  const originalLines = splitPhysicalLines(content)
  const translationLines = splitPhysicalLines(translation)
  const lineCount = Math.max(originalLines.length, translationLines.length)

  return Array.from({ length: lineCount }, (_, index) => createMusicLyricDraftRow({
    original: originalLines[index] ?? '',
    translation: translationLines[index] ?? '',
  }))
}

export function serializeMusicLyricDraft(
  rows: readonly MusicLyricDraftRow[],
  format: MusicLyricsFormat,
): MusicLyricDraftSerialized {
  if (format === 'lrc') return serializeBilingualLrcDraft(rows)

  return {
    content: rows.map((row) => row.original).join('\n'),
    translation: rows.map((row) => row.translation).join('\n'),
  }
}

export function parseBilingualLrcDraft(
  content = '',
  translation = '',
): MusicLyricDraftParseResult {
  const original = parseLrcDraftLines(content, 'original')
  const translated = parseLrcDraftLines(translation, 'translation')
  const translationOccurrences = new Map<number, number>()
  const translationByOccurrence = new Map<string, ParsedLrcLine>()

  for (const line of translated.lines) {
    const occurrence = translationOccurrences.get(line.timeMs) ?? 0
    translationOccurrences.set(line.timeMs, occurrence + 1)
    translationByOccurrence.set(`${line.timeMs}:${occurrence}`, line)
  }

  const originalOccurrences = new Map<number, number>()
  const rows = original.lines.map((line) => {
    const occurrence = originalOccurrences.get(line.timeMs) ?? 0
    originalOccurrences.set(line.timeMs, occurrence + 1)
    const occurrenceKey = `${line.timeMs}:${occurrence}`
    const matched = translationByOccurrence.get(occurrenceKey)
    translationByOccurrence.delete(occurrenceKey)

    return createMusicLyricDraftRow({
      timeMs: line.timeMs,
      original: line.text,
      translation: matched?.text ?? '',
    })
  })
  const unmatchedTranslationIssues = new Map<string, MusicLyricDraftIssue>()
  for (const line of translationByOccurrence.values()) {
    const issue: MusicLyricDraftIssue = {
      severity: 'error',
      code: 'unmatched_translation_time',
      message: '翻译时间无法与原文匹配',
      sourceLine: line.sourceLine,
      source: 'translation',
    }
    unmatchedTranslationIssues.set(`translation:${line.sourceLine}:${issue.code}`, issue)
  }

  return {
    rows,
    issues: [...original.issues, ...translated.issues, ...unmatchedTranslationIssues.values()],
  }
}

export function serializeBilingualLrcDraft(
  rows: readonly MusicLyricDraftRow[],
): MusicLyricDraftSerialized {
  const translationOccurrences = new Map<number, number>()
  const lastTranslatedOccurrence = new Map<number, number>()

  for (const row of rows) {
    const timeMs = row.timeMs ?? 0
    const occurrence = translationOccurrences.get(timeMs) ?? 0
    translationOccurrences.set(timeMs, occurrence + 1)
    if (row.translation !== '') lastTranslatedOccurrence.set(timeMs, occurrence)
  }

  translationOccurrences.clear()
  const translationLines: string[] = []
  for (const row of rows) {
    const timeMs = row.timeMs ?? 0
    const occurrence = translationOccurrences.get(timeMs) ?? 0
    translationOccurrences.set(timeMs, occurrence + 1)
    const lastOccurrence = lastTranslatedOccurrence.get(timeMs)
    if (lastOccurrence === undefined || occurrence > lastOccurrence) continue
    translationLines.push(`[${formatMusicLyricTime(timeMs)}]${row.translation}`)
  }

  return {
    content: rows
      .map((row) => `[${formatMusicLyricTime(row.timeMs ?? 0)}]${row.original}`)
      .join('\n'),
    translation: translationLines.join('\n'),
  }
}

export function parseMusicLyricTime(value: string): number | null {
  const match = /^(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?$/.exec(value.trim())
  if (!match) return null

  const minutes = Number(match[1])
  const seconds = Number(match[2])
  if (seconds >= 60) return null

  const fraction = match[3]
  const milliseconds = fraction === undefined
    ? 0
    : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction)

  return (minutes * 60 + seconds) * 1000 + milliseconds
}

export function formatMusicLyricTime(timeMs: number): string {
  const maxCentiseconds = 999 * 60 * 100 + 59 * 100 + 99
  const roundedCentiseconds = Number.isFinite(timeMs)
    ? Math.min(maxCentiseconds, Math.max(0, Math.round(timeMs / 10)))
    : 0
  const minutes = Math.floor(roundedCentiseconds / 6000)
  const seconds = Math.floor((roundedCentiseconds % 6000) / 100)
  const centiseconds = roundedCentiseconds % 100

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

export function validateMusicLyricDraft(
  rows: readonly MusicLyricDraftRow[],
  format: MusicLyricsFormat,
): MusicLyricDraftIssue[] {
  const issues: MusicLyricDraftIssue[] = []

  rows.forEach((row, rowIndex) => {
    if (row.original.trim() === '') {
      issues.push({
        severity: 'error',
        code: 'empty_original',
        message: '原文不能为空',
        rowIndex,
      })
    }

    if (format === 'lrc' && row.timeMs === null) {
      issues.push({
        severity: 'error',
        code: 'missing_time',
        message: 'LRC 歌词需要时间',
        rowIndex,
      })
    }
  })

  if (format === 'plain') return issues

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const previousTime = rows[rowIndex - 1].timeMs
    const currentTime = rows[rowIndex].timeMs
    if (previousTime !== null && currentTime !== null && currentTime < previousTime) {
      issues.push({
        severity: 'error',
        code: 'descending_time',
        message: '时间不能早于上一行',
        rowIndex,
      })
    }
  }

  const firstIndexByTime = new Map<number, number>()
  const warnedTimes = new Set<number>()
  rows.forEach((row, rowIndex) => {
    if (row.timeMs === null) return

    const firstIndex = firstIndexByTime.get(row.timeMs)
    if (firstIndex === undefined) {
      firstIndexByTime.set(row.timeMs, rowIndex)
    } else if (!warnedTimes.has(row.timeMs)) {
      warnedTimes.add(row.timeMs)
      issues.push({
        severity: 'warning',
        code: 'duplicate_time',
        message: '存在重复时间',
        rowIndex: firstIndex,
      })
    }
  })

  return issues
}

export function sortMusicLyricDraftRows(
  rows: readonly MusicLyricDraftRow[],
): MusicLyricDraftRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      if (left.row.timeMs === null) return right.row.timeMs === null ? left.index - right.index : 1
      if (right.row.timeMs === null) return -1
      return left.row.timeMs - right.row.timeMs || left.index - right.index
    })
    .map(({ row }) => row)
}

type ParsedLrcLine = {
  timeMs: number
  text: string
  sourceLine: number
}

const metadataPattern = /^\[(?:ar|al|ti|by|re|ve):.*\]$/i
const timestampPattern = /\[(\d{1,3}:\d{2}(?:\.\d{2,3})?)\]/g

function parseLrcDraftLines(
  value: string,
  source: 'original' | 'translation',
): {
  lines: ParsedLrcLine[]
  issues: MusicLyricDraftIssue[]
} {
  const lines: ParsedLrcLine[] = []
  const issues: MusicLyricDraftIssue[] = []

  splitPhysicalLines(value).forEach((line, index) => {
    const sourceLine = index + 1
    if (line.trim() === '' || metadataPattern.test(line.trim())) return

    const tagPrefix = /^((?:\[\d{1,3}:\d{2}(?:\.\d{2,3})?\])+)(.*)$/.exec(line)
    if (!tagPrefix) {
      issues.push({
        severity: 'error',
        code: 'invalid_lrc_line',
        message: '无法识别 LRC 行',
        sourceLine,
        source,
      })
      return
    }

    const text = tagPrefix[2]
    for (const match of tagPrefix[1].matchAll(timestampPattern)) {
      const timeMs = parseMusicLyricTime(match[1])
      if (timeMs === null) {
        issues.push({
          severity: 'error',
          code: 'invalid_lrc_line',
          message: '无法识别 LRC 行',
          sourceLine,
          source,
        })
        return
      }
      lines.push({ timeMs, text, sourceLine })
    }
  })

  return { lines, issues }
}
