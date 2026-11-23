import { onScopeDispose, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'
import { registerSessionReset } from '@/stores/sessionReset'

export type DiscussionQuoteTarget = 'short_note' | 'forum' | 'debate' | 'blog_post'
export type DiscussionQuoteSourceType = 'book_annotation' | 'feed_article' | 'blog_post' | 'timeline_event'

export interface DiscussionQuotePayload {
  sourceType: DiscussionQuoteSourceType
  target: DiscussionQuoteTarget
  mode: 'append' | 'replace'
  title: string
  sourceName?: string
  author?: string
  quoteText: string
  personalNote?: string
  referenceToken?: string
  annotationId?: string
  assetId?: string
  bookTitle?: string
  bookAuthor?: string
}

export interface BookQuotePayload {
  sourceType: 'book_annotation'
  annotationId: string
  assetId: string
  bookTitle: string
  bookAuthor?: string
  quoteText: string
  personalNote?: string
  target: DiscussionQuoteTarget
  mode: 'append' | 'replace'
  title?: string
  sourceName?: string
  author?: string
  referenceToken?: string
}

const RESOURCE_TOKEN_PATTERN = /@[A-Za-z][A-Za-z0-9_-]*:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?::[A-Za-z]+)?/g
const SHORT_NOTE_MAX_CHARS = 500

export function stripResourceReferenceTokens(text: string): string {
  return text.replace(RESOURCE_TOKEN_PATTERN, ' ').replace(/\s+/g, ' ').trim()
}

function sliceByCodePoints(text: string, maxChars: number): string {
  const chars = Array.from(text)
  if (chars.length <= maxChars) return text
  return chars.slice(0, maxChars).join('')
}

function formatBlockquoteLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n')
}

function fitShortNoteContent(prefixParts: string[], token?: string): string {
  const cleanToken = token?.trim() || ''
  const rawBody = prefixParts.filter(Boolean).join('\n\n')
  if (!cleanToken) {
    const chars = Array.from(rawBody)
    if (chars.length <= SHORT_NOTE_MAX_CHARS) return rawBody
    return `${sliceByCodePoints(rawBody, SHORT_NOTE_MAX_CHARS - 1).trimEnd()}…`
  }

  const suffix = rawBody ? `\n\n${cleanToken}` : cleanToken
  const full = `${rawBody}${suffix}`
  if (Array.from(full).length <= SHORT_NOTE_MAX_CHARS) {
    return full
  }

  const suffixLen = Array.from(suffix).length
  const budget = SHORT_NOTE_MAX_CHARS - suffixLen
  if (budget <= 0) {
    return sliceByCodePoints(cleanToken, SHORT_NOTE_MAX_CHARS)
  }
  if (budget === 1) {
    return `${sliceByCodePoints(rawBody, 1)}${suffix}`
  }
  const clippedBody = sliceByCodePoints(rawBody, budget - 1).trimEnd()
  return `${clippedBody}…${suffix}`
}

export function formatBookQuoteCitation(
  payload: Pick<BookQuotePayload, 'quoteText' | 'personalNote' | 'target'> & {
    bookTitle?: string
    title?: string
    bookAuthor?: string
    author?: string
  }
): string {
  const quote = payload.quoteText.trim()
  const title = (payload.bookTitle ?? payload.title ?? '').trim()
  const author = (payload.bookAuthor ?? payload.author)?.trim()
  const note = payload.personalNote?.trim()

  if (payload.target === 'short_note') {
    const quoteLine = `「${quote}」——《${title}》`
    return note ? `${note}\n\n${quoteLine}` : quoteLine
  }

  const authorSuffix = author ? ` · ${author}` : ''
  const quoteBlock = `${formatBlockquoteLines(quote)}\n> ——《${title}》${authorSuffix}`
  return note ? `${quoteBlock}\n\n${note}` : quoteBlock
}

export function formatDiscussionQuote(payload: DiscussionQuotePayload): { title: string; content: string } {
  const cleanTitle = stripResourceReferenceTokens(payload.title || payload.bookTitle || '') || '阅读摘录'
  const note = payload.personalNote?.trim() || ''
  const quote = payload.quoteText.trim()

  if (payload.sourceType === 'book_annotation') {
    const bookTitle = stripResourceReferenceTokens(payload.bookTitle || cleanTitle) || '书籍摘录'
    const bookAuthor = (payload.bookAuthor || payload.author)?.trim()
    const baseCitation = formatBookQuoteCitation({
      target: payload.target,
      quoteText: quote,
      bookTitle,
      bookAuthor,
      personalNote: note || undefined,
    })

    if (payload.target === 'short_note') {
      return {
        title: '',
        content: fitShortNoteContent([baseCitation]),
      }
    }
    if (payload.target === 'forum') {
      return {
        title: stripResourceReferenceTokens(`关于《${bookTitle}》的讨论`),
        content: baseCitation,
      }
    }
    if (payload.target === 'debate') {
      return {
        title: stripResourceReferenceTokens(`《${bookTitle}》中的观点是否成立？`),
        content: baseCitation,
      }
    }
    return {
      title: stripResourceReferenceTokens(`《${bookTitle}》读后感`),
      content: baseCitation,
    }
  }

  const token = payload.referenceToken?.trim() || ''
  const sourceName = payload.sourceName?.trim() || ''
  const author = payload.author?.trim() || ''
  const attribution = [sourceName, author].filter(Boolean).join(' · ')
  const attributionLine = attribution ? `〈${cleanTitle}〉 · ${attribution}` : `〈${cleanTitle}〉`

  if (payload.target === 'short_note') {
    const lead = quote ? `「${quote}」` : `《${cleanTitle}》`
    return {
      title: '',
      content: fitShortNoteContent([note, lead], token),
    }
  }

  const blocks: string[] = []
  if (quote) {
    blocks.push(`${formatBlockquoteLines(quote)}\n> ——${attributionLine}`)
  }
  const refLabel = payload.target === 'debate' ? '背景材料' : '参考来源'
  if (token) {
    blocks.push(`${refLabel}：${token}`)
  }
  if (note) {
    blocks.push(note)
  }
  const content = blocks.join('\n\n')

  if (payload.target === 'forum') {
    return {
      title: stripResourceReferenceTokens(`关于「${cleanTitle}」的讨论`),
      content,
    }
  }
  if (payload.target === 'debate') {
    return {
      title: stripResourceReferenceTokens(`「${cleanTitle}」中的核心观点是否成立？`),
      content,
    }
  }
  return {
    title: stripResourceReferenceTokens(`读〈${cleanTitle}〉有感`),
    content,
  }
}

export const useDraftStagingStore = defineStore('draftStaging', () => {
  const pendingQuote = ref<DiscussionQuotePayload | null>(null)

  function setPendingQuote(payload: BookQuotePayload | DiscussionQuotePayload) {
    pendingQuote.value = {
      ...payload,
      title: payload.title ?? payload.bookTitle ?? '',
    }
  }

  function consumePendingQuote(target: DiscussionQuoteTarget): DiscussionQuotePayload | null {
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

  function clearLocalEditorDrafts() {
    try {
      if (typeof localStorage === 'undefined') return
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key?.startsWith('blog_editor_')) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key)
      }
    } catch {
      // ignore storage errors
    }
  }

  const pinia = getActivePinia()
  if (pinia) {
    onScopeDispose(registerSessionReset(pinia, () => {
      clearPendingQuote()
      clearLocalEditorDrafts()
    }))
  }

  return {
    pendingQuote,
    setPendingQuote,
    consumePendingQuote,
    clearPendingQuote,
    clearLocalEditorDrafts,
  }
})

export function hasExistingBlogPostDraft(currentUserId?: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const raw = localStorage.getItem('blog_editor_blog:new')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    const payload = parsed?.payload
    if (payload?.owner_id && currentUserId && payload.owner_id !== currentUserId) {
      return false
    }
    return Boolean(payload && (payload.title?.trim() || payload.content?.trim()))
  } catch {
    return false
  }
}
