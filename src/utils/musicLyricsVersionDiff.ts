import type { MusicLyricsFormat, MusicSongLyrics, MusicSongLyricsLine, MusicSongLyricsVersion } from '@/api/musicV1'

export type MusicLyricsVersionDiffKind = 'unchanged' | 'added' | 'removed' | 'modified'

export type MusicLyricsVersionDiffLine = {
  kind: MusicLyricsVersionDiffKind
  current?: MusicSongLyricsLine
  target?: MusicSongLyricsLine
  currentIndex?: number
  targetIndex?: number
}

export type MusicLyricsVersionPreview = {
  lines: MusicLyricsVersionDiffLine[]
  affectedActiveAnnotationCount: number
  affectedActiveAnnotationIds: string[]
}

function parsePlainVersionLines(content: string): MusicSongLyricsLine[] {
  if (content === '') return []
  const lines = content.replace(/\r\n|\r/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.map((line, index) => ({
    id: `plain-${index}`,
    lineNumber: index,
    text: line.trim(),
    translation: '',
    startTimeMs: null,
    endTimeMs: null,
  }))
}

function parseLrcTimestamp(value: string) {
  const match = value.match(/^(\d+):(\d{2})(?:\.(\d{1,3}))?$/)
  if (!match || Number(match[2]) >= 60) return null
  const milliseconds = Number((match[3] ?? '').padEnd(3, '0') || '0')
  return (Number(match[1]) * 60_000) + (Number(match[2]) * 1_000) + milliseconds
}

function parseLrcVersionLines(content: string): MusicSongLyricsLine[] {
  const normalized = content.replace(/\r\n|\r/g, '\n')
  const lines: MusicSongLyricsLine[] = []
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const match = line.match(/^\[([^\]]+)\](.*)$/)
    const timeMs = match ? parseLrcTimestamp(match[1]) : null
    if (timeMs === null) continue
    lines.push({
      id: `lrc-${timeMs}-${lines.length}`,
      lineNumber: lines.length,
      startTimeMs: timeMs,
      endTimeMs: null,
      text: match[2].trim(),
      translation: '',
    })
  }
  return lines
}

function parseVersionLines(version: Pick<MusicSongLyricsVersion, 'content' | 'translation' | 'format'>) {
  if (version.format === 'lrc') {
    const contentLines = parseLrcVersionLines(version.content)
    const translationByTime = new Map<number, string[]>()
    for (const line of parseLrcVersionLines(version.translation)) {
      const timeMs = lineTimeMs(line)
      if (timeMs === null) continue
      const values = translationByTime.get(timeMs) ?? []
      values.push(line.text)
      translationByTime.set(timeMs, values)
    }
    const translationOccurrences = new Map<number, number>()
    return contentLines.map((line) => {
      const timeMs = lineTimeMs(line)
      if (timeMs === null) return line
      const occurrence = translationOccurrences.get(timeMs) ?? 0
      translationOccurrences.set(timeMs, occurrence + 1)
      return { ...line, translation: translationByTime.get(timeMs)?.[occurrence] ?? '' }
    })
  }

  const contentLines = parsePlainVersionLines(version.content)
  const translationLines = parsePlainVersionLines(version.translation)
  return contentLines.map((line, index) => ({ ...line, translation: translationLines[index]?.text ?? '' }))
}

function lineTimeMs(line: MusicSongLyricsLine) {
  return line.time_ms ?? line.startTimeMs ?? null
}

function normalizePlainLineText(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).join(' ')
}

function buildLineIdentities(lines: MusicSongLyricsLine[], format: MusicLyricsFormat) {
  const occurrences = new Map<string, number>()
  return lines.map((line) => {
    const timestamp = format === 'lrc' ? `${lineTimeMs(line) ?? ''}\u0000` : ''
    const base = `${timestamp}${normalizePlainLineText(line.text)}`
    const occurrence = occurrences.get(base) ?? 0
    occurrences.set(base, occurrence + 1)
    return `${base}\u0000${occurrence}`
  })
}

function linesHaveSamePresentation(current: MusicSongLyricsLine, target: MusicSongLyricsLine) {
  return current.text === target.text
    && current.translation === target.translation
    && lineTimeMs(current) === lineTimeMs(target)
}

function buildLcsLengths(currentIdentities: string[], targetIdentities: string[]) {
  const lengths = Array.from({ length: currentIdentities.length + 1 }, () => Array<number>(targetIdentities.length + 1).fill(0))
  for (let currentIndex = currentIdentities.length - 1; currentIndex >= 0; currentIndex -= 1) {
    for (let targetIndex = targetIdentities.length - 1; targetIndex >= 0; targetIndex -= 1) {
      lengths[currentIndex][targetIndex] = currentIdentities[currentIndex] === targetIdentities[targetIndex]
        ? lengths[currentIndex + 1][targetIndex + 1] + 1
        : Math.max(lengths[currentIndex + 1][targetIndex], lengths[currentIndex][targetIndex + 1])
    }
  }
  return lengths
}

function appendChangedSegment(
  result: MusicLyricsVersionDiffLine[],
  removed: Array<{ line: MusicSongLyricsLine; index: number }>,
  added: Array<{ line: MusicSongLyricsLine; index: number }>,
) {
  const modifiedCount = Math.min(removed.length, added.length)
  for (let index = 0; index < modifiedCount; index += 1) {
    result.push({
      kind: 'modified',
      current: removed[index].line,
      currentIndex: removed[index].index,
      target: added[index].line,
      targetIndex: added[index].index,
    })
  }
  for (const item of removed.slice(modifiedCount)) {
    result.push({ kind: 'removed', current: item.line, currentIndex: item.index })
  }
  for (const item of added.slice(modifiedCount)) {
    result.push({ kind: 'added', target: item.line, targetIndex: item.index })
  }
}

function buildLineDiff(
  current: MusicSongLyricsLine[],
  target: MusicSongLyricsLine[],
  currentFormat: MusicLyricsFormat,
  targetFormat: MusicLyricsFormat,
): MusicLyricsVersionDiffLine[] {
  if (currentFormat !== targetFormat) {
    return [
      ...current.map((line, currentIndex) => ({ kind: 'removed' as const, current: line, currentIndex })),
      ...target.map((line, targetIndex) => ({ kind: 'added' as const, target: line, targetIndex })),
    ]
  }
  const currentIdentities = buildLineIdentities(current, currentFormat)
  const targetIdentities = buildLineIdentities(target, targetFormat)
  const lengths = buildLcsLengths(currentIdentities, targetIdentities)
  const result: MusicLyricsVersionDiffLine[] = []
  let currentIndex = 0
  let targetIndex = 0
  let removed: Array<{ line: MusicSongLyricsLine; index: number }> = []
  let added: Array<{ line: MusicSongLyricsLine; index: number }> = []

  const flushChanged = () => {
    appendChangedSegment(result, removed, added)
    removed = []
    added = []
  }

  while (currentIndex < current.length || targetIndex < target.length) {
    if (currentIndex < current.length && targetIndex < target.length && currentIdentities[currentIndex] === targetIdentities[targetIndex]) {
      flushChanged()
      result.push({
        kind: linesHaveSamePresentation(current[currentIndex], target[targetIndex]) ? 'unchanged' : 'modified',
        current: current[currentIndex], currentIndex, target: target[targetIndex], targetIndex,
      })
      currentIndex += 1
      targetIndex += 1
    } else if (targetIndex < target.length && (currentIndex === current.length || lengths[currentIndex][targetIndex + 1] >= lengths[currentIndex + 1][targetIndex])) {
      added.push({ line: target[targetIndex], index: targetIndex })
      targetIndex += 1
    } else {
      removed.push({ line: current[currentIndex], index: currentIndex })
      currentIndex += 1
    }
  }
  flushChanged()
  return result
}

function targetKeepsAnnotation(
  annotation: MusicSongLyrics['annotations'][number],
  currentLine: MusicSongLyricsLine | undefined,
  targetLine: MusicSongLyricsLine | undefined,
) {
  if (!currentLine || !targetLine) return false
  const selectedText = targetLine.text.slice(annotation.start_offset, annotation.end_offset)
  return selectedText === annotation.selected_text
}

export function buildMusicLyricsVersionPreview(
  currentLyrics: MusicSongLyrics,
  targetVersion: MusicSongLyricsVersion,
): MusicLyricsVersionPreview {
  const targetLines = parseVersionLines(targetVersion)
  const lines = buildLineDiff(currentLyrics.lines, targetLines, currentLyrics.format, targetVersion.format)
  const currentLineIdentities = buildLineIdentities(currentLyrics.lines, currentLyrics.format)
  const targetLineIdentities = buildLineIdentities(targetLines, targetVersion.format)
  const targetByCurrentLineIndex = new Map(
    lines
      .filter((line) => line.currentIndex !== undefined)
      .map((line) => [line.currentIndex as number, line]),
  )
  const currentIndexByLineKey = new Map(
    currentLyrics.lines.map((line, index) => [line.line_key ?? line.id ?? '', index]),
  )
  const affectedActiveAnnotationIds = currentLyrics.annotations
    .filter((annotation) => annotation.status === 'active')
    .filter((annotation) => {
      const currentIndex = currentIndexByLineKey.get(annotation.line_key ?? annotation.line_id ?? '')
      const targetIndex = targetByCurrentLineIndex.get(currentIndex ?? -1)?.targetIndex
      const lineIdentityMatches = currentLyrics.format === targetVersion.format
        && currentIndex !== undefined
        && targetIndex !== undefined
        && currentLineIdentities[currentIndex] === targetLineIdentities[targetIndex]
      if (!lineIdentityMatches) return true
      return !targetKeepsAnnotation(
        annotation,
        currentIndex === undefined ? undefined : currentLyrics.lines[currentIndex],
        targetByCurrentLineIndex.get(currentIndex ?? -1)?.target,
      )
    })
    .map((annotation) => annotation.id)

  return {
    lines,
    affectedActiveAnnotationIds,
    affectedActiveAnnotationCount: affectedActiveAnnotationIds.length,
  }
}
