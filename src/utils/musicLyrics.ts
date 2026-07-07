import type { MusicLyricsAnnotation, MusicSongLyricsLine } from '@/api/musicV1'

export type MusicLyricsAnnotationRange = {
  annotationId: string
  startOffset: number
  endOffset: number
}

export type MusicLyricsAnnotationIndex = {
  annotationsByLine: Map<string, MusicLyricsAnnotation[]>
  rangesByLine: Map<string, MusicLyricsAnnotationRange[]>
}

function buildPlainLineId(index: number) {
  return `plain-${index}`
}

function buildLrcLineId(startTimeMs: number, index: number) {
  return `lrc-${startTimeMs}-${index}`
}

function parseLrcTimestamp(token: string): number | null {
  const match = token.match(/^(\d{2,}):(\d{2})(?:\.(\d{1,3}))?$/)
  if (!match) return null
  const minutes = Number(match[1])
  const seconds = Number(match[2])
  const fraction = (match[3] ?? '').padEnd(3, '0').slice(0, 3)
  return (minutes * 60 * 1000) + (seconds * 1000) + Number(fraction || '0')
}

export function parsePlainLyrics(content: string): MusicSongLyricsLine[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: buildPlainLineId(index),
      text,
      translation: '',
      startTimeMs: null,
      endTimeMs: null,
      lineNumber: index,
    }))
}

export function parseLrcLyrics(content: string): MusicSongLyricsLine[] {
  const parsed = content
    .split(/\r?\n/)
    .flatMap((rawLine) => {
      const matches = [...rawLine.matchAll(/\[([^\]]+)\]/g)]
      if (matches.length === 0) return []
      const text = rawLine.replace(/\[[^\]]+\]/g, '').trim()
      return matches
        .map((match) => parseLrcTimestamp(match[1]))
        .filter((value): value is number => value !== null)
        .map((startTimeMs) => ({ startTimeMs, text }))
    })
    .sort((left, right) => left.startTimeMs - right.startTimeMs)

  return parsed.map((item, index) => ({
    id: buildLrcLineId(item.startTimeMs, index),
    text: item.text,
    translation: '',
    startTimeMs: item.startTimeMs,
    endTimeMs: parsed[index + 1]?.startTimeMs ?? null,
    lineNumber: index,
  }))
}

export function mergeLyricsWithTranslation(
  lines: MusicSongLyricsLine[],
  translationLines: MusicSongLyricsLine[],
): MusicSongLyricsLine[] {
  const timed = lines.some((line) => line.startTimeMs !== null) && translationLines.some((line) => line.startTimeMs !== null)
  if (timed) {
    const translationByTime = new Map(
      translationLines
        .filter((line) => line.startTimeMs !== null)
        .map((line) => [line.startTimeMs as number, line.text]),
    )
    return lines.map((line) => ({
      ...line,
      translation: line.startTimeMs === null ? '' : (translationByTime.get(line.startTimeMs) ?? ''),
    }))
  }

  return lines.map((line, index) => ({
    ...line,
    translation: translationLines[index]?.text ?? '',
  }))
}

export function buildLyricsAnnotationIndex(annotations: MusicLyricsAnnotation[]): MusicLyricsAnnotationIndex {
  const activeAnnotations = annotations.filter((annotation) => annotation.status !== 'deleted')
  const annotationsByLine = new Map<string, MusicLyricsAnnotation[]>()
  const rangesByLine = new Map<string, MusicLyricsAnnotationRange[]>()

  for (const annotation of activeAnnotations) {
    const lineAnnotations = annotationsByLine.get(annotation.line_id) ?? []
    lineAnnotations.push(annotation)
    annotationsByLine.set(annotation.line_id, lineAnnotations)

    if (annotation.start_offset >= 0 && annotation.end_offset > annotation.start_offset) {
      const ranges = rangesByLine.get(annotation.line_id) ?? []
      ranges.push({
        annotationId: annotation.id,
        startOffset: annotation.start_offset,
        endOffset: annotation.end_offset,
      })
      rangesByLine.set(annotation.line_id, ranges)
    }
  }

  for (const list of annotationsByLine.values()) {
    list.sort((left, right) => (
      right.net_score - left.net_score
      || right.upvotes - left.upvotes
      || left.id.localeCompare(right.id)
    ))
  }

  for (const ranges of rangesByLine.values()) {
    ranges.sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset)
  }

  return {
    annotationsByLine,
    rangesByLine,
  }
}

export function computeCurrentLyricLine(lines: MusicSongLyricsLine[], currentTimeSeconds: number): MusicSongLyricsLine | null {
  const currentTimeMs = Math.max(0, Math.floor(currentTimeSeconds * 1000))
  let activeLine: MusicSongLyricsLine | null = null

  for (const line of lines) {
    if (line.startTimeMs === null) continue
    if (line.startTimeMs > currentTimeMs) break
    if (line.endTimeMs !== null && currentTimeMs >= line.endTimeMs) continue
    activeLine = line
  }

  return activeLine
}
