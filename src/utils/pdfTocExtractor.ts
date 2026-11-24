import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
export type PdfTocItem = {
  id?: string
  href: string
  label: string
  depth: number
}

/**
 * 递归解析 PDF 电子大纲树（PDF.js getOutline）
 */
export async function extractPdfOutlineTree(
  items: any[],
  doc: PDFDocumentProxy,
  depth = 0
): Promise<PdfTocItem[]> {
  const result: PdfTocItem[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    let pageNum = 1
    try {
      if (typeof item.dest === 'string') {
        const explicitDest = await doc.getDestination(item.dest)
        if (explicitDest && explicitDest[0]) {
          const pageIndex = await doc.getPageIndex(explicitDest[0])
          pageNum = pageIndex + 1
        }
      } else if (Array.isArray(item.dest) && item.dest[0]) {
        const pageIndex = await doc.getPageIndex(item.dest[0])
        pageNum = pageIndex + 1
      }
    } catch {
      pageNum = 1
    }

    result.push({
      id: `pdf-outline-${depth}-${i}-${pageNum}`,
      label: item.title?.trim() || `第 ${pageNum} 页`,
      href: `page:${pageNum}`,
      depth,
    })

    if (item.items && item.items.length > 0) {
      const children = await extractPdfOutlineTree(item.items, doc, depth + 1)
      result.push(...children)
    }
  }
  return result
}

/**
 * 当 PDF 无内嵌电子 Outline 时，智能扫描前 20 页正文印刷目录提取章节与对应页码
 */
export async function scanPdfPrintedTOC(doc: PDFDocumentProxy): Promise<PdfTocItem[]> {
  const rawEntries: Array<{ chapterNum: string; title: string; printedPage: number; sourcePage: number }> = []
  let tocStartPage = -1
  let tocEndPage = -1

  const maxScanPages = Math.min(20, doc.numPages)
  for (let p = 1; p <= maxScanPages; p++) {
    try {
      const page = await doc.getPage(p)
      const textContent = await page.getTextContent()
      const fullText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')

      if (/目\s*录|CONTENTS/i.test(fullText)) {
        if (tocStartPage === -1) tocStartPage = p
        tocEndPage = p
      }

      // 匹配：1 ． 科学边界 ··········· 1 或 1. 科学边界 ... 1
      const re = /(\d+)\s*[．\.]\s*([^\d·\.]{1,40}?)\s*[·\.]{3,}\s*(\d+)/g
      let m: RegExpExecArray | null
      let foundOnPage = false
      while ((m = re.exec(fullText)) !== null) {
        foundOnPage = true
        const chapterNum = m[1]
        const title = m[2].replace(/\s+/g, '').trim()
        const printedPage = parseInt(m[3], 10)
        if (title && !isNaN(printedPage)) {
          rawEntries.push({
            chapterNum,
            title,
            printedPage,
            sourcePage: p,
          })
        }
      }
      if (foundOnPage && tocStartPage !== -1) {
        tocEndPage = Math.max(tocEndPage, p)
      }
    } catch {
      // 容错继续下一页
    }
  }

  if (rawEntries.length === 0) {
    return []
  }

  // 探测印刷页码与实际 PDF 页面之间的偏移（Offset）
  // 查找第一章在目录后实际出现的 PDF 页
  const firstEntry = rawEntries[0]
  let offset = (tocEndPage > 0 ? tocEndPage : 10) - firstEntry.printedPage + 1
  const searchLimit = Math.min(doc.numPages, (tocEndPage > 0 ? tocEndPage : 10) + 15)

  for (let p = Math.max(1, tocEndPage + 1); p <= searchLimit; p++) {
    try {
      const page = await doc.getPage(p)
      const textContent = await page.getTextContent()
      const fullText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
      if (fullText.includes(firstEntry.title)) {
        offset = p - firstEntry.printedPage
        break
      }
    } catch {
      // 容错
    }
  }

  return rawEntries.map((entry, index) => {
    const targetPdfPage = Math.min(doc.numPages, Math.max(1, entry.printedPage + offset))
    return {
      id: `pdf-scanned-toc-${index}`,
      label: `${entry.chapterNum}. ${entry.title}`,
      href: `page:${targetPdfPage}`,
      depth: 0,
    }
  })
}
