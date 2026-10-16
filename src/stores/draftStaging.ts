import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface BookQuotePayload {
  sourceType: 'book_annotation'
  annotationId: string
  assetId: string
  bookTitle: string
  bookAuthor?: string
  quoteText: string
  personalNote?: string
  target: 'blog_post' | 'short_note'
  mode: 'append' | 'replace'
}

export function formatBookQuoteCitation(
  payload: Pick<BookQuotePayload, 'quoteText' | 'bookTitle' | 'bookAuthor' | 'personalNote' | 'target'>
): string {
  const quote = payload.quoteText.trim()
  const title = payload.bookTitle.trim()
  const author = payload.bookAuthor?.trim()
  const note = payload.personalNote?.trim()

  if (payload.target === 'blog_post') {
    const authorSuffix = author ? ` · ${author}` : ''
    const quoteBlock = `> ${quote}\n> ——《${title}》${authorSuffix}`
    if (note) {
      return `${quoteBlock}\n\n${note}`
    }
    return quoteBlock
  }

  // short_note
  const quoteLine = `「${quote}」——《${title}》`
  if (note) {
    return `${note}\n\n${quoteLine}`
  }
  return quoteLine
}

export const useDraftStagingStore = defineStore('draftStaging', () => {
  const pendingQuote = ref<BookQuotePayload | null>(null)

  function setPendingQuote(payload: BookQuotePayload) {
    pendingQuote.value = { ...payload }
  }

  function consumePendingQuote(target: 'blog_post' | 'short_note'): BookQuotePayload | null {
    if (!pendingQuote.value || pendingQuote.value.target !== target) {
      return null
    }
    const payload = pendingQuote.value
    pendingQuote.value = null
    return payload
  }

  function clearPendingQuote() {
    pendingQuote.value = null
  }

  return {
    pendingQuote,
    setPendingQuote,
    consumePendingQuote,
    clearPendingQuote,
  }
})

export function hasExistingBlogPostDraft(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const raw = localStorage.getItem('blog_editor_blog:new')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const payload = parsed?.payload
    return Boolean(payload && (payload.title?.trim() || payload.content?.trim()))
  } catch {
    return false
  }
}

