import DOMPurify from 'dompurify'
import { Marked, type Token } from 'marked'

const allowedTags = ['p', 'br', 'strong', 'em', 'code', 'a', 'blockquote']
const commentMarked = new Marked({ gfm: false, breaks: true })

export interface CommentMarkdownResult { ok: boolean; html: string; error?: string }

export function normalizeCommentMarkdown(content: string) {
  return content.replace(/\r\n?/g, '\n').normalize('NFC')
}

export function commentCodePointLength(content: string) {
  return Array.from(normalizeCommentMarkdown(content)).length
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
  const withoutCodeSpans = content.replace(/`[^`\n]*`/g, '')
  if (/~~[\s\S]+?~~/.test(withoutCodeSpans)) return { ok: false, error: 'unsupported_del' }
  if (/^\s*\|?.+\|.+\|?\s*\n\s*\|?\s*:?-{1,}:?\s*\|/m.test(withoutCodeSpans)) {
    return { ok: false, error: 'unsupported_table' }
  }
  const error = validateTokens(commentMarked.lexer(content))
  return error ? { ok: false, error } : { ok: true }
}

export function renderCommentMarkdown(source: string): CommentMarkdownResult {
  const validation = validateCommentMarkdown(source)
  if (!validation.ok) return { ...validation, html: '' }
  const rendered = commentMarked.parse(normalizeCommentMarkdown(source)) as string
  const html = DOMPurify.sanitize(rendered, { ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: ['href', 'rel'] })
    .replace(/<a href=/g, '<a rel="nofollow noreferrer noopener" href=')
  return { ok: true, html }
}
