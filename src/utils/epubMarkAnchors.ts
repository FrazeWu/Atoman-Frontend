import type { ReadingAnchor } from '@/api/bookReading'
import type { HighlightSelection } from '@/utils/bookMarkAnchors'

export type EpubCfiConstructor = new (...args: any[]) => {
  collapse: (toStart: boolean) => void
  compare: (a: any, b: any) => number
  toString: () => string
  toRange: (doc: Document) => Range
  base?: any
}

let activeEpubCfiConstructor: EpubCfiConstructor | null = null

export function setGlobalEpubCfi(cls: EpubCfiConstructor | null) {
  activeEpubCfiConstructor = cls
}

export function getGlobalEpubCfi(): EpubCfiConstructor | null {
  return activeEpubCfiConstructor
}

export function epubSelection(
  cfi: string,
  range: Range,
  CfiClass: EpubCfiConstructor | null = activeEpubCfiConstructor
): HighlightSelection | null {
  if (!range.toString().trim()) return null
  const Cls = CfiClass || activeEpubCfiConstructor
  if (!Cls) {
    throw new Error('EpubCFI is not loaded. Ensure EPUB engine is initialized before computing CFI selection.')
  }
  const start = new Cls(cfi)
  const end = new Cls(cfi)
  start.collapse(true)
  end.collapse(false)
  if (start.compare(start, end) >= 0) return null
  return { quote: range.toString(), anchor: { epub_start_cfi: start.toString(), epub_end_cfi: end.toString() } }
}

export function epubMarkRange(
  anchor: ReadingAnchor,
  doc: Document,
  CfiClass: EpubCfiConstructor | null = activeEpubCfiConstructor
): Range {
  const Cls = CfiClass || activeEpubCfiConstructor
  if (!Cls) {
    throw new Error('EpubCFI is not loaded. Ensure EPUB engine is initialized before computing CFI mark range.')
  }
  const start = new Cls(anchor.epub_start_cfi).toRange(doc)
  const end = new Cls(anchor.epub_end_cfi).toRange(doc)
  start.setEnd(end.endContainer, end.endOffset)
  return start
}
