import DOMPurify from 'dompurify'
import { Marked, type Token } from 'marked'

const allowedTags = ['p', 'br', 'strong', 'em', 'code', 'a', 'blockquote']
const commentMarked = new Marked({ gfm: false, breaks: true })

export interface CommentMarkdownResult { ok: boolean; html: string; error?: string }

export function normalizeCommentMarkdown(content: string) {
  return content.replace(/\r\n?/g, '\n').normalize('NFC').trim()
}

export function commentCodePointLength(content: string) {
  return Array.from(normalizeCommentMarkdown(content)).length
}

function isEscaped(source: string, index: number) {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}

function maskCodeSpans(source: string) {
  const masked = source.split('')
  let cursor = 0
  while (cursor < source.length) {
    if (source[cursor] !== '`' || isEscaped(source, cursor)) {
      cursor += 1
      continue
    }
    let openerEnd = cursor
    while (source[openerEnd] === '`') openerEnd += 1
    const delimiterLength = openerEnd - cursor
    let search = openerEnd
    let closerEnd = -1
    while (search < source.length) {
      const closerStart = source.indexOf('`', search)
      if (closerStart < 0) break
      let runEnd = closerStart
      while (source[runEnd] === '`') runEnd += 1
      if (!isEscaped(source, closerStart) && runEnd - closerStart === delimiterLength) {
        closerEnd = runEnd
        break
      }
      search = runEnd
    }
    if (closerEnd < 0) {
      cursor = openerEnd
      continue
    }
    for (let index = cursor; index < closerEnd; index += 1) {
      if (masked[index] !== '\n') masked[index] = ' '
    }
    cursor = closerEnd
  }
  return masked.join('')
}

function validateTokens(tokens: Token[]): string | undefined {
  for (const token of tokens) {
    if (['html', 'image', 'list', 'heading', 'code', 'table', 'del'].includes(token.type)) return `unsupported_${token.type}`
    if (token.type === 'link') {
      try {
        const url = new URL(token.href)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'unsafe_link'
      } catch {
        return 'unsafe_link'
      }
    }
    const nested = 'tokens' in token && Array.isArray(token.tokens) ? validateTokens(token.tokens) : undefined
    if (nested) return nested
  }
}

export function validateCommentMarkdown(source: string): { ok: boolean; error?: string } {
  const content = normalizeCommentMarkdown(source)
  if (commentCodePointLength(content) > 2000) return { ok: false, error: 'too_long' }
  const tokens = commentMarked.lexer(content)
  const error = validateTokens(tokens)
  if (error) return { ok: false, error }
  const withoutCodeSpans = maskCodeSpans(content)
  if (/~~[\s\S]+?~~/.test(withoutCodeSpans)) return { ok: false, error: 'unsupported_del' }
  if (/^\s*\|?.+\|.+\|?\s*\n\s*\|?\s*:?-{1,}:?\s*\|/m.test(withoutCodeSpans)) {
    return { ok: false, error: 'unsupported_table' }
  }
  return { ok: true }
}

export function renderCommentMarkdown(source: string): CommentMarkdownResult {
  const validation = validateCommentMarkdown(source)
  if (!validation.ok) return { ...validation, html: '' }
  const rendered = commentMarked.parse(normalizeCommentMarkdown(source)) as string
  const html = DOMPurify.sanitize(rendered, { ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: ['href', 'rel'] })
    .replace(/<a href=/g, '<a rel="nofollow noreferrer noopener" href=')
  return { ok: true, html }
}
