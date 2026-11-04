import { describe, expect, it } from 'vitest'
import { extractBookPdfMetadata } from '@/utils/bookPdfMetadata'

// Extracted from the user-supplied 地球往事.pdf, page 6; page 1-5 have
// cover artwork and no usable CIP metadata. No OCR/external lookup needed.
const cipPage = `图书在版编目(C I P)数据
三体／刘慈欣著． ―重庆：重庆出版社，2008.1
ISBN 978-7-5366-9293-0
中国版本图书馆CIP 数据核字（2007）第186976 号
三 体（中国科幻基石丛书）
刘慈欣 著
重庆出版社
2008 年1 月第1 版 2008 年1 月第1 次印刷`

describe('PDF copyright/CIP book detection', () => {
  it('finds page 6 and recovers 三体 metadata without relying on PDF Title/Author', () => {
    const parsed = extractBookPdfMetadata(['', '', '', '', '', cipPage], { Title: '', Author: '' })
    expect(parsed).toMatchObject({
      title: '三体', author: '刘慈欣', isbn: '9787536692930', publisher: '重庆出版社',
      publishedDate: '2008-01', editionStatement: '第1版', language: 'zh',
      sources: { isbn: { page: 6 }, publisher: { page: 6 }, publishedDate: { page: 6 } },
    })
  })
  it('does not hallucinate ISBN or date when evidence is absent', () => {
    const parsed = extractBookPdfMetadata(['这是纯文字小说，没有版权资料。'.repeat(5)])
    expect(parsed.isbn).toBeUndefined()
    expect(parsed.publishedDate).toBeUndefined()
    expect(parsed.publisher).toBeUndefined()
  })
  it('prefers a CIP title over generic PDF document metadata', () => {
    expect(extractBookPdfMetadata(['', '', '', '', '', cipPage], { Title: 'PDFPatcher', Author: 'Unknown' }).title).toBe('三体')
  })
  it('rejects invalid ISBN check digits', () => {
    const p = extractBookPdfMetadata(['ISBN 978-7-5366-9293-1'])
    expect(p.isbn).toBeUndefined()
  })
})
