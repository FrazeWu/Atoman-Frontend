/** Metadata extraction from selectable PDF text, not OCR.
 * The sample "地球往事.pdf" has its CIP/copyright block on PDF page 6,
 * so extracting cover thumbnails from pages 1-5 must not limit metadata search.
 */
export interface BookPdfDetectedField {
  value: string
  page: number
}
export interface BookPdfTextMetadata {
  title?: string
  author?: string
  isbn?: string
  publisher?: string
  publishedDate?: string // YYYY-MM, precision is intentionally one month
  editionStatement?: string
  language?: string
  sources: Partial<Record<'title' | 'author' | 'isbn' | 'publisher' | 'publishedDate' | 'editionStatement' | 'language', BookPdfDetectedField>>
}

function isValidISBN(value: string) {
  if (/^[0-9]{9}[0-9X]$/.test(value)) {
    return [...value].reduce((sum, digit, index) => sum + (10 - index) * (digit === 'X' ? 10 : Number(digit)), 0) % 11 === 0
  }
  if (/^[0-9]{13}$/.test(value)) {
    return [...value].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0) % 10 === 0
  }
  return false
}
function firstValidISBN(input: string) {
  const isbnLines = input.split('\n').filter(line => /ISBN/i.test(line))
  for (const line of isbnLines) {
    const match = line.match(/ISBN(?:-1[03])?[\s:：-]*([97\dX][0-9X\s-]{8,24})/i)
    const normalized = match?.[1]?.replace(/[^\dX]/gi, '').toUpperCase()
    if (normalized && isValidISBN(normalized)) return normalized
  }
}
function compactName(name: string) { return name.replace(/[\s\u3000]+/g, '').trim() }
function meaningfulTitle(name: string) { return name.trim().replace(/[\s\u3000]+/g, ' ').replace(/^[\s\-—]+|[\s\-—]+$/g, '') }
export function extractBookPdfMetadata(pageTexts: string[], pdfInfo?: { Title?: string; Author?: string }): BookPdfTextMetadata {
  const result: BookPdfTextMetadata = { sources: {} }
  const record = (field: keyof BookPdfTextMetadata['sources'], value: string | undefined, page: number) => {
    if (value && !result.sources[field]) result.sources[field] = { value, page }
  }
  pageTexts.forEach((raw, index) => {
    const page = index + 1
    if (!raw) return
    const lines = raw.replace(/\r/g, '\n').split('\n').map(line => line.replace(/[\u00a0\u3000]/g, ' ').trim()).filter(Boolean)
    const combined = lines.join('\n')
    const flat = combined.replace(/\s+/g, ' ')
    // Chinese CIP records use the authoritative book title / author / imprint format.
    // Example (PDF page 6): 三体／刘慈欣著． ―重庆：重庆出版社，2008.1
    for (const line of lines) {
      const cip = line.match(/^(.{1,65}?)\s*[／/]\s*([\p{Script=Han}·\s]{2,20}?)\s*著[．.。\s]/u)
      if (!cip) continue
      const title = meaningfulTitle(cip[1] || '')
      const author = compactName(cip[2] || '')
      if (title && author && !/[：:]|ISBN|出版社/i.test(title)) {
        record('title', title, page)
        record('author', author, page)
        break
      }
    }
    const isbn = firstValidISBN(combined)
    record('isbn', isbn, page)
    // Prefer an imprint attached to the CIP bibliographic record to avoid
    // accidentally selecting a printer or an unrelated publisher in body text.
    const publisher = flat.match(/[：:]\s*([\p{Script=Han}·]{2,24}出版社)/u)?.[1] ||
      flat.match(/([\p{Script=Han}·]{2,24}出版社)/u)?.[1]
    record('publisher', publisher, page)
    const date = flat.match(/(?:出版社[，,]\s*|出版[：:]\s*)?(?<year>(?:18|19|20)\d{2})\s*(?:[.．年/-])\s*(?<month>1[0-2]|0?[1-9])\s*(?:月)?(?=\s|[，,．.第]|$)/u)
    if (date?.groups) record('publishedDate', `${date.groups.year}-${date.groups.month.padStart(2, '0')}`, page)
    const edition = flat.match(/(?:18|19|20)\d{2}\s*年\s*(?:1[0-2]|0?[1-9])\s*月\s*第\s*(\d+)\s*版/u)
    if (edition) record('editionStatement', `第${edition[1]}版`, page)
    // This is a text-script heuristic, not a language-identification service.
    const sample = flat.slice(0, 1300)
    const chinese = (sample.match(/\p{Script=Han}/gu) || []).length
    const latin = (sample.match(/[a-z]/gi) || []).length
    if (chinese >= 40 && chinese >= latin * 2) record('language', 'zh', page)
  })
  const title = result.sources.title?.value || pdfInfo?.Title?.trim()
  const author = result.sources.author?.value || pdfInfo?.Author?.trim()
  if (title) result.title = title
  if (author) result.author = author
  for (const field of ['isbn', 'publisher', 'publishedDate', 'editionStatement', 'language'] as const) {
    const value = result.sources[field]?.value
    if (value) result[field] = value
  }
  return result
}
