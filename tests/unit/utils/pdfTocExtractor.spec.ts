import { describe, expect, it } from 'vitest'
import { extractPdfOutlineTree, scanPdfPrintedTOC } from '@/utils/pdfTocExtractor'

describe('pdfTocExtractor', () => {
  it('extractPdfOutlineTree recursively resolves destinations', async () => {
    const mockDoc = {
      getDestination: async (dest: string) => (dest === 'ch2' ? [{ num: 5 }] : null),
      getPageIndex: async (ref: { num: number }) => ref.num - 1,
    } as any

    const mockOutline = [
      {
        title: '第一章 序言',
        dest: [{ num: 1 }],
        items: [
          {
            title: '1.1 背景',
            dest: [{ num: 2 }],
          },
        ],
      },
      {
        title: '第二章 正文',
        dest: 'ch2',
      },
    ]

    const result = await extractPdfOutlineTree(mockOutline, mockDoc)
    expect(result).toHaveLength(3)
    expect(result[0].label).toBe('第一章 序言')
    expect(result[0].href).toBe('page:1')
    expect(result[0].depth).toBe(0)

    expect(result[1].label).toBe('1.1 背景')
    expect(result[1].href).toBe('page:2')
    expect(result[1].depth).toBe(1)

    expect(result[2].label).toBe('第二章 正文')
    expect(result[2].href).toBe('page:5')
    expect(result[2].depth).toBe(0)
  })

  it('scanPdfPrintedTOC scans text content and computes offset', async () => {
    const pagesText: Record<number, string> = {
      1: '封面',
      2: '目 录 1 ． 科学边界 ·································································· 1 2 ． 台球 ···································································· 14',
      3: '序言',
      4: '1 ． 科学边界 汪淼觉得来找他的这四个人...',
    }

    const mockDoc = {
      numPages: 4,
      getPage: async (p: number) => ({
        getTextContent: async () => ({
          items: [{ str: pagesText[p] || '' }],
        }),
      }),
    } as any

    const result = await scanPdfPrintedTOC(mockDoc)
    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('1. 科学边界')
    // Printed page 1 was found on PDF page 4, so offset = 4 - 1 = 3 -> target page = 1 + 3 = 4
    expect(result[0].href).toBe('page:4')
    expect(result[1].label).toBe('2. 台球')
    expect(result[1].href).toBe('page:4') // clamped to numPages (4)
  })
})
