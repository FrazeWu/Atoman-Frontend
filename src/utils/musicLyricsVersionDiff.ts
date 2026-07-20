import type { MusicLyricsFormat, MusicSongLyrics, MusicSongLyricsLine, MusicSongLyricsVersion } from '@/api/musicV1'
import { mergeLyricsWithTranslation, parseLrcLyrics } from '@/utils/musicLyrics'

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

function parseVersionLines(version: Pick<MusicSongLyricsVersion, 'content' | 'translation' | 'format'>) {
  if (version.format === 'lrc') {
    return mergeLyricsWithTranslation(parseLrcLyrics(version.content), parseLrcLyrics(version.translation))
  }

  const contentLines = parsePlainVersionLines(version.content)
  const translationLines = parsePlainVersionLines(version.translation)
  return contentLines.map((line, index) => ({ ...line, translation: translationLines[index]?.text ?? '' }))
}

function lineTimeMs(line: MusicSongLyricsLine) {
  return line.time_ms ?? line.startTimeMs ?? null
}

function lineKey(line: MusicSongLyricsLine, format: MusicLyricsFormat) {
  const timestamp = format === 'lrc' ? `${lineTimeMs(line) ?? ''}\u0000` : ''
  return `${timestamp}${normalizePlainLineText(line.text)}\u0000${line.translation}`
}

function normalizePlainLineText(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).join(' ')
}

function buildLcsLengths(current: MusicSongLyricsLine[], target: MusicSongLyricsLine[], format: MusicLyricsFormat) {
  const lengths = Array.from({ length: current.length + 1 }, () => Array<number>(target.length + 1).fill(0))
  for (let currentIndex = current.length - 1; currentIndex >= 0; currentIndex -= 1) {
    for (let targetIndex = target.length - 1; targetIndex >= 0; targetIndex -= 1) {
      lengths[currentIndex][targetIndex] = lineKey(current[currentIndex], format) === lineKey(target[targetIndex], format)
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

function buildLineDiff(current: MusicSongLyricsLine[], target: MusicSongLyricsLine[], format: MusicLyricsFormat) {
  const lengths = buildLcsLengths(current, target, format)
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
    if (currentIndex < current.length && targetIndex < target.length && lineKey(current[currentIndex], format) === lineKey(target[targetIndex], format)) {
      flushChanged()
      result.push({ kind: 'unchanged', current: current[currentIndex], currentIndex, target: target[targetIndex], targetIndex })
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
  format: MusicSongLyricsVersion['format'],
) {
  if (!currentLine || !targetLine) return false
  const lineTextMatches = normalizePlainLineText(targetLine.text) === normalizePlainLineText(currentLine.text)
  const lineTimeMatches = format !== 'lrc' || lineTimeMs(targetLine) === lineTimeMs(currentLine)
  if (!lineTextMatches || !lineTimeMatches) return false
  const selectedText = targetLine.text.slice(annotation.start_offset, annotation.end_offset)
  return selectedText === annotation.selected_text
}

export function buildMusicLyricsVersionPreview(
  currentLyrics: MusicSongLyrics,
  targetVersion: MusicSongLyricsVersion,
): MusicLyricsVersionPreview {
  const targetLines = parseVersionLines(targetVersion)
  const lines = buildLineDiff(currentLyrics.lines, targetLines, targetVersion.format)
  const targetByCurrentLineIndex = new Map(
    lines
      .filter((line) => line.currentIndex !== undefined)
      .map((line) => [line.currentIndex as number, line.target]),
  )
  const currentIndexByLineKey = new Map(
    currentLyrics.lines.map((line, index) => [line.line_key ?? line.id ?? '', index]),
  )
  const affectedActiveAnnotationIds = currentLyrics.annotations
    .filter((annotation) => annotation.status === 'active')
    .filter((annotation) => {
      const currentIndex = currentIndexByLineKey.get(annotation.line_key ?? annotation.line_id ?? '')
      return !targetKeepsAnnotation(
        annotation,
        currentIndex === undefined ? undefined : currentLyrics.lines[currentIndex],
        targetByCurrentLineIndex.get(currentIndex ?? -1),
        targetVersion.format,
      )
    })
    .map((annotation) => annotation.id)

  return {
    lines,
    affectedActiveAnnotationIds,
    affectedActiveAnnotationCount: affectedActiveAnnotationIds.length,
  }
}
