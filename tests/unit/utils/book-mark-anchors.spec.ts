import { afterEach, describe, expect, it, vi } from 'vitest'
import { EpubCFI } from 'epubjs'
import { textSelection, textRange, pdfSelection, epubSelection, epubMarkRange, highlightedText } from '@/utils/bookMarkAnchors'
import type { ReadingMark } from '@/api/bookReading'
afterEach(() => { document.body.replaceChildren(); window.getSelection()?.removeAllRanges(); vi.restoreAllMocks() })
describe('固定修订阅读选区', () => {
  it('重复中文段落选中第二处，保留空白及 UTF-16 偏移，不退回第一处', () => {
    const root = document.createElement('pre')
    root.innerHTML = '<span>相同😀 </span><mark>相同😀 </mark>'
    document.body.append(root)
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(root.lastChild!)
    selection.addRange(range)
    expect(textSelection(root, selection)).toEqual({ quote: '相同😀 ', anchor: { txt_offset_start: 5, txt_offset_end: 10 } })
    expect(textRange(root, 5, 10)?.toString()).toBe('相同😀 ')
  })
  it('跨越正文以外的选区不能被记录成书内划线', () => {
    const root = document.createElement('pre'); root.textContent = '正文'
    const outside = document.createTextNode('外部')
    document.body.append(root, outside)
    const range = document.createRange(); range.setStart(root.firstChild!, 0); range.setEnd(outside, 1)
    window.getSelection()!.addRange(range)
    expect(textSelection(root, window.getSelection())).toBeNull()
  })
  it('重叠划线不重复或吞掉原文，所有原始批注保持独立', () => {
    const mark = (id: string, start: number, end: number) => ({ id, anchor: { txt_offset_start: start, txt_offset_end: end } } as ReadingMark)
    const marks = [mark('one', 1, 5), mark('two', 3, 7)]
    const result = highlightedText('0123456789', marks)
    expect(result.map(part => part.text).join('')).toBe('0123456789')
    expect(result.filter(part => part.mark).map(part => part.text).join('')).toBe('123456')
    expect(marks).toHaveLength(2)
  })
  it('PDF 矩形按当前页尺寸归一化，缩放后仍对应同一位置', () => {
    const root = document.createElement('div'); root.textContent = 'PDF text'; document.body.append(root)
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 200, height: 400 } as DOMRect)
    const range = document.createRange(); range.selectNodeContents(root)
    Object.defineProperty(range, 'getClientRects', { value: () => [{ left: 30, top: 60, right: 110, bottom: 80 }] })
    const selection = { rangeCount: 1, isCollapsed: false, getRangeAt: () => range } as unknown as Selection
    expect(pdfSelection(root, 3, selection)).toEqual({ quote: 'PDF text', anchor: { pdf_page: 3, pdf_rects: [{ x: .1, y: .1, width: .4, height: .04999999999999999 }] } })
  })
  it('EPUB 使用起止文本点 CFI，还原区间，不通过逗号猜测选区', () => {
    const doc = document
    doc.body.innerHTML = '<section><p>相同😀文本与批注</p></section>'
    const range = doc.createRange(); range.setStart(doc.querySelector('p')!.firstChild!, 2); range.setEnd(doc.querySelector('p')!.firstChild!, 8)
    const cfi = new EpubCFI(range, '/6/2[chapter]').toString()
    const selected = epubSelection(cfi, range, EpubCFI)!
    expect(selected.anchor.epub_start_cfi).toContain(':2)')
    expect(selected.anchor.epub_end_cfi).toContain(':8)')
    expect(epubMarkRange(selected.anchor, doc, EpubCFI).toString()).toBe(range.toString())
  })
})
