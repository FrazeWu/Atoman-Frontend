import { apiGet } from '@/api/client'
import type { CommentMentionInput } from '@/api/comments'
import { useApi } from './useApi'

export interface MentionRange { start: number; end: number }
export interface MentionSearchUser {
  uuid: string
  username: string
  display_name: string
  avatar_url: string
  role: string
}

export function normalizeCommentContent(content: string) {
  return content.replace(/\r\n?/g, '\n').normalize('NFC').trim()
}

function assertUTF16Boundary(text: string, offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) throw new RangeError('Invalid mention offset')
  if (offset > 0 && offset < text.length) {
    const previous = text.charCodeAt(offset - 1)
    const current = text.charCodeAt(offset)
    if (previous >= 0xD800 && previous <= 0xDBFF && current >= 0xDC00 && current <= 0xDFFF) {
      throw new RangeError('Mention offset splits a surrogate pair')
    }
  }
}

export function toMentionRange(content: string, startUTF16: number, endUTF16: number): MentionRange {
  if (content !== normalizeCommentContent(content)) throw new RangeError('Mention offsets require normalized content')
  assertUTF16Boundary(content, startUTF16)
  assertUTF16Boundary(content, endUTF16)
  if (endUTF16 <= startUTF16 || !content.slice(startUTF16, endUTF16).startsWith('@')) {
    throw new RangeError('Mention range must cover an @ token')
  }
  return {
    start: Array.from(content.slice(0, startUTF16)).length,
    end: Array.from(content.slice(0, endUTF16)).length,
  }
}

export function createMentionInput(user: MentionSearchUser, range: MentionRange): CommentMentionInput {
  return { user_id: user.uuid, start: range.start, end: range.end }
}

type MentionRequest = (url: string) => Promise<MentionSearchUser[]>

export function searchMentionUsers(query: string, limit = 10, request: MentionRequest = apiGet) {
  const params = new URLSearchParams({ scope: 'mention', q: query, limit: String(Math.min(20, Math.max(1, limit))) })
  return request(`${useApi().comments.mentionUsers}?${params.toString()}`)
}
