import DOMPurify from 'dompurify'
import { Marked } from 'marked'

const allowedTags = ['p', 'br', 'strong', 'em', 'code', 'a', 'blockquote']
const commentMarked = new Marked({ gfm: false, breaks: true })
const validationMarked = new Marked({ gfm: true, breaks: true })
const allowedTokenTypes = new Set([
  'paragraph', 'text', 'space', 'strong', 'em', 'codespan', 'link', 'blockquote', 'br', 'escape',
])

export interface CommentMarkdownResult { ok: boolean; html: string; error?: string }

export function normalizeCommentMarkdown(content: string) {
  return content.replace(/\r\n?/g, '\n').normalize('NFC').trim()
}

export function commentCodePointLength(content: string) {
  return Array.from(normalizeCommentMarkdown(content)).length
}

function validateTokenTree(value: unknown, inBlockquote = false): string | undefined {
  if (Array.isArray(value)) {
    for (const child of value) {
      const error = validateTokenTree(child, inBlockquote)
      if (error) return error
    }
    return
  }
  if (!value || typeof value !== 'object') return

  const node = value as Record<string, unknown>
  const type = typeof node.type === 'string' ? node.type : ''
  const childInBlockquote = inBlockquote || type === 'blockquote'
  if (type && !allowedTokenTypes.has(type) && !(type === 'table' && inBlockquote)) {
    return `unsupported_${type}`
  }
  if (type === 'link') {
    const href = typeof node.href === 'string' ? node.href : ''
    const text = typeof node.text === 'string' ? node.text : ''
    const raw = typeof node.raw === 'string' ? node.raw : ''
    if (raw.startsWith('<') && raw.endsWith('>') && href === text) return 'unsupported_autolink'
    try {
      const url = new URL(href)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'unsafe_link'
    } catch {
      return 'unsafe_link'
    }
  }

  for (const key of ['tokens', 'children', 'items', 'rows', 'header', 'cells']) {
    const error = validateTokenTree(node[key], childInBlockquote)
    if (error) return error
  }
}

export function validateCommentMarkdown(source: string): { ok: boolean; error?: string } {
  const content = normalizeCommentMarkdown(source)
  if (commentCodePointLength(content) > 2000) return { ok: false, error: 'too_long' }
  const tokens = validationMarked.lexer(content)
  const error = validateTokenTree(tokens)
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
