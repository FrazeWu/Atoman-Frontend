export type BookReaderBookmark = {
  id: string
  label: string
  reading_percent: number
  epub_cfi?: string
  pdf_page?: number
  txt_offset?: number
  comic_page?: number
  created_at: string
}

export function parseBookReaderBookmarks(value: unknown): BookReaderBookmark[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<BookReaderBookmark>
    if (typeof candidate.id !== 'string' || typeof candidate.label !== 'string' || !Number.isFinite(candidate.reading_percent)) return []
    const readingPercent = candidate.reading_percent as number
    return [{
      id: candidate.id,
      label: candidate.label,
      reading_percent: Math.max(0, Math.min(1, readingPercent)),
      epub_cfi: typeof candidate.epub_cfi === 'string' ? candidate.epub_cfi : '',
      pdf_page: Number.isFinite(candidate.pdf_page) ? Math.max(1, Number(candidate.pdf_page)) : undefined,
      txt_offset: Number.isFinite(candidate.txt_offset) ? Math.max(0, Number(candidate.txt_offset)) : undefined,
      comic_page: Number.isFinite(candidate.comic_page) ? Math.max(1, Number(candidate.comic_page)) : undefined,
      created_at: typeof candidate.created_at === 'string' ? candidate.created_at : '',
    }]
  })
}
