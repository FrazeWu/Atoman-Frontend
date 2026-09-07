export type ResolvedLyricsSelection = {
  startLineKey: string
  endLineKey: string
  startOffset: number
  endOffset: number
  selectedText: string
}

function lineElementForNode(root: HTMLElement, node: Node): HTMLElement | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
  const line = element?.closest<HTMLElement>('[data-lyric-line-key]') ?? null
  return line && root.contains(line) ? line : null
}

function textElementForNode(root: HTMLElement, node: Node): HTMLElement | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement
  const text = element?.closest<HTMLElement>('.music-lyrics-line__text') ?? null
  return text && root.contains(text) ? text : null
}

function offsetWithinText(textElement: HTMLElement, node: Node, offset: number): number | null {
  if (!textElement.contains(node)) return null
  const prefix = document.createRange()
  prefix.selectNodeContents(textElement)
  try {
    prefix.setEnd(node, offset)
  } catch {
    return null
  }
  return prefix.toString().length
}

export function resolveLyricsSelection(root: HTMLElement, range: Range): ResolvedLyricsSelection | null {
  const startLine = lineElementForNode(root, range.startContainer)
  const endLine = lineElementForNode(root, range.endContainer)
  const startText = textElementForNode(root, range.startContainer)
  const endText = textElementForNode(root, range.endContainer)
  if (!startLine || !endLine || !startText || !endText) return null

  const startOffset = offsetWithinText(startText, range.startContainer, range.startOffset)
  const endOffset = offsetWithinText(endText, range.endContainer, range.endOffset)
  if (startOffset === null || endOffset === null) return null

  const lines = [...root.querySelectorAll<HTMLElement>('[data-lyric-line-key]')]
  const startIndex = lines.indexOf(startLine)
  const endIndex = lines.indexOf(endLine)
  if (startIndex < 0 || endIndex < startIndex) return null

  const lineTexts = lines.slice(startIndex, endIndex + 1).map((line) => (
    line.querySelector<HTMLElement>('.music-lyrics-line__text')?.textContent ?? ''
  ))
  if (lineTexts.length === 0) return null

  const selectedParts = [
    lineTexts[0].slice(startOffset),
    ...lineTexts.slice(1, -1),
    lineTexts[lineTexts.length - 1].slice(0, endOffset),
  ]
  const selectedText = lineTexts.length === 1
    ? lineTexts[0].slice(startOffset, endOffset)
    : selectedParts.join('\n')
  if (!selectedText.trim() || (lineTexts.length === 1 && endOffset <= startOffset)) return null

  return {
    startLineKey: startLine.dataset.lyricLineKey ?? '',
    endLineKey: endLine.dataset.lyricLineKey ?? '',
    startOffset,
    endOffset,
    selectedText,
  }
}
