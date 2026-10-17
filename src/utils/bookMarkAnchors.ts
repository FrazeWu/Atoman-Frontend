import { EpubCFI } from 'epubjs'
import type { ReadingAnchor, ReadingMark } from '@/api/bookReading'

export interface HighlightSelection { anchor: ReadingAnchor; quote: string }

// 用实际 DOM 区间定位，不能用 indexOf：相同段落可以出现多次。
export function textSelection(root: HTMLElement, selection: Selection | null): HighlightSelection | null {
  if (!selection?.rangeCount || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const before = root.ownerDocument.createRange()
  before.selectNodeContents(root)
  before.setEnd(range.startContainer, range.startOffset)
  const start = before.toString().length
  const quote = range.toString()
  if (!quote.trim()) return null
  return { quote, anchor: { txt_offset_start: start, txt_offset_end: start + quote.length } }
}

export function textRange(root: HTMLElement, start: number, end = start): Range | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const range = root.ownerDocument.createRange()
  let offset = 0
  let found = false
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length || 0
    if (!found && start <= offset + length) { range.setStart(node, Math.max(0, start - offset)); found = true }
    if (found && end <= offset + length) { range.setEnd(node, Math.max(0, end - offset)); return range }
    offset += length
  }
  return null
}

export function pdfSelection(root: HTMLElement, page: number, selection: Selection | null): HighlightSelection | null {
  if (!selection?.rangeCount || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const quote = range.toString()
  if (!quote.trim()) return null
  const box = root.getBoundingClientRect()
  if (!box.width || !box.height) return null
  const rects = Array.from(range.getClientRects()).map(rect => {
    const x = Math.max(0, (rect.left - box.left) / box.width)
    const y = Math.max(0, (rect.top - box.top) / box.height)
    return { x, y, width: Math.min(1, (rect.right - box.left) / box.width) - x, height: Math.min(1, (rect.bottom - box.top) / box.height) - y }
  }).filter(rect => rect.width > 0 && rect.height > 0)
  return rects.length ? { quote, anchor: { pdf_page: page, pdf_rects: rects } } : null
}

export function epubSelection(cfi: string, range: Range): HighlightSelection | null {
  if (!range.toString().trim()) return null
  const start = new EpubCFI(cfi)
  const end = new EpubCFI(cfi)
  start.collapse(true)
  end.collapse(false)
  if (start.compare(start, end) >= 0) return null
  return { quote: range.toString(), anchor: { epub_start_cfi: start.toString(), epub_end_cfi: end.toString() } }
}

export function epubMarkRange(anchor: ReadingAnchor, doc: Document): Range {
  const start = new EpubCFI(anchor.epub_start_cfi).toRange(doc)
  const end = new EpubCFI(anchor.epub_end_cfi).toRange(doc)
  start.setEnd(end.endContainer, end.endOffset)
  return start
}

export const highlightColors: Record<string, string> = { yellow: '#facc15', green: '#4ade80', blue: '#60a5fa', pink: '#f472b6' }

// 重叠划线只分割显示，不重复或删除原文；每条原始批注仍在列表中独立保存。
export function highlightedText(text: string, marks: ReadingMark[]) {
  const valid = marks.filter(mark => mark.anchor.txt_offset_start !== undefined && mark.anchor.txt_offset_end !== undefined && mark.anchor.txt_offset_start >= 0 && mark.anchor.txt_offset_end <= text.length && mark.anchor.txt_offset_end > mark.anchor.txt_offset_start)
  const points = [...new Set([0, text.length, ...valid.flatMap(mark => [mark.anchor.txt_offset_start!, mark.anchor.txt_offset_end!])])].sort((a, b) => a - b)
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1]!
    return { start, text: text.slice(start, end), mark: valid.find(mark => mark.anchor.txt_offset_start! <= start && mark.anchor.txt_offset_end! >= end) }
  })
}
