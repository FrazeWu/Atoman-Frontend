import type { CommentDTO } from '@/api/comments'

export const commentUser = {
  id: 'user-1',
  username: 'alice',
  display_name: 'Alice',
  avatar_url: '',
}

export function makeComment(id: string, overrides: Partial<CommentDTO> = {}): CommentDTO {
  return {
    id,
    author_id: commentUser.id,
    author: commentUser,
    root_id: null,
    reply_to_id: null,
    reply_to_author: null,
    floor_number: 1,
    content: `content ${id}`,
    rendered_html: `<p>content ${id}</p>`,
    status: 'active',
    edited_at: null,
    like_count: 0,
    reply_count: 0,
    hot_score: 0,
    created_at: '2026-07-15T08:00:00.000Z',
    marked: false,
    liked: false,
    mentions: [],
    attachments: [],
    time_anchors: [],
    replies: [],
    ...overrides,
  }
}
