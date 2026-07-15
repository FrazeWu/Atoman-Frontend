import {
  apiDeleteJson,
  apiGet,
  apiPatchJson,
  apiPostJson,
  apiPostMultipart,
  apiPutJson,
} from './client'
import { useApi } from '@/composables/useApi'

export type CommentTargetKind =
  | 'blog_post'
  | 'video'
  | 'podcast_episode'
  | 'feed_article'
  | 'music_artist'
  | 'music_album'
  | 'music_song'
  | 'forum_topic'
  | 'debate'
  | 'timeline_event'
  | 'timeline_person'

export interface CommentTargetRef { kind: CommentTargetKind; resourceId: string }
export interface CommentUserSummary { id: string; username: string; display_name: string; avatar_url: string }
export interface CommentMention { user_id: string; start: number; end: number }
export type CommentMentionInput = CommentMention
export interface CommentAttachment { id: string; url: string; content_type: string; position: number }
export interface CommentTimeAnchor { start: number; end: number; seconds: number }

export interface CommentDTO {
  id: string
  author_id: string
  author: CommentUserSummary
  root_id?: string | null
  reply_to_id?: string | null
  reply_to_author?: CommentUserSummary | null
  floor_number?: number | null
  content: string
  rendered_html: string
  status: string
  edited_at?: string | null
  like_count: number
  reply_count: number
  hot_score: number
  created_at: string
  marked: boolean
  liked: boolean
  mentions: CommentMention[]
  attachments: CommentAttachment[]
  time_anchors: CommentTimeAnchor[]
  replies: CommentDTO[]
}

export interface CommentTargetSummary {
  kind: CommentTargetKind
  resource_id: string
  mark_label: string
  can_mark: boolean
  marked_comment_id?: string | null
  comment_count: number
  root_count: number
}

export interface CommentRootList {
  items: CommentDTO[]
  page: number
  per_page: number
  total_roots: number
  total_comments: number
  total_replies: number
  target: CommentTargetSummary
}
export interface CommentReplyList { items: CommentDTO[]; page: number; per_page: number; total: number; has_more: boolean }
export interface CreateCommentInput { content: string; reply_to_id?: string | null; mentions: CommentMentionInput[]; attachment_ids: string[] }
export interface EditCommentInput { content: string; mentions: CommentMentionInput[]; attachment_ids: string[] }
export interface ReportCommentInput { reason: string; note: string }
export interface ModerateCommentInput { action: string; report_id?: string | null; reason: string }
export interface CommentActionResult { ok: boolean }
export interface CommentReportQueueItem {
  id: string; reason: string; note: string; status: string; reviewer_id?: string | null
  created_at: string; reviewed_at?: string | null; comment_id: string; root_id: string
  target_kind: CommentTargetKind; resource_id: string; reporter_id: string; username: string
  content: string; comment_status: string
}
export interface CommentReportQueue { items: CommentReportQueueItem[]; page: number; per_page: number; total: number; has_more: boolean }
export interface CommentListOptions { sort?: 'oldest' | 'newest' | 'hot'; page?: number; page_size?: number }
export interface ReplyListOptions { page?: number; page_size?: number }
export interface ReportListOptions { status?: string; page?: number; page_size?: number }
export interface UploadCommentAsset { id: string; url: string; key: string; content_type: string; size: number }

export const commentEndpoints = useApi().comments

function withQuery(url: string, values: object) {
  const query = new URLSearchParams()
  Object.entries(values as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const suffix = query.toString()
  return suffix ? `${url}?${suffix}` : url
}

export const commentApi = {
  listRoots: (target: CommentTargetRef, options: CommentListOptions = {}) =>
    apiGet<CommentRootList>(withQuery(commentEndpoints.roots(target.kind, target.resourceId), options)),
  listReplies: (rootId: string, options: ReplyListOptions = {}) =>
    apiGet<CommentReplyList>(withQuery(commentEndpoints.replies(rootId), options)),
  create: (target: CommentTargetRef, input: CreateCommentInput) =>
    apiPostJson<CommentDTO>(commentEndpoints.roots(target.kind, target.resourceId), input),
  edit: (commentId: string, input: EditCommentInput) => apiPatchJson<CommentDTO>(commentEndpoints.comment(commentId), input),
  delete: (commentId: string) => apiDeleteJson<CommentActionResult>(commentEndpoints.comment(commentId)),
  async uploadImage(file: File) {
    const body = new FormData()
    body.append('purpose', 'comment.image')
    body.append('file', file)
    const asset = await apiPostMultipart<UploadCommentAsset>(commentEndpoints.upload, body)
    return asset.id
  },
  like: (commentId: string) => apiPutJson<CommentActionResult>(commentEndpoints.like(commentId)),
  unlike: (commentId: string) => apiDeleteJson<CommentActionResult>(commentEndpoints.like(commentId)),
  report: (commentId: string, input: ReportCommentInput) => apiPutJson<CommentActionResult>(commentEndpoints.report(commentId), input),
  mark: (target: CommentTargetRef, commentId: string) =>
    apiPutJson<CommentActionResult>(commentEndpoints.mark(target.kind, target.resourceId), { comment_id: commentId }),
  unmark: (target: CommentTargetRef) => apiDeleteJson<CommentActionResult>(commentEndpoints.mark(target.kind, target.resourceId)),
  listReports: (options: ReportListOptions = {}) => apiGet<CommentReportQueue>(withQuery(commentEndpoints.reports, options)),
  moderate: (commentId: string, input: ModerateCommentInput) =>
    apiPutJson<CommentActionResult>(commentEndpoints.moderation(commentId), input),
}

export type CommentApiClient = typeof commentApi
