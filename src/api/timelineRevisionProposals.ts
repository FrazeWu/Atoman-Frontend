import { apiGet, apiPostJson, apiPutJson } from './client'
import type { CommentDTO, CommentMentionInput } from './comments'
import { useApiUrl } from '@/composables/useApi'

export type TimelineProposalTargetKind = 'event' | 'person'
export type TimelineProposalDecision = 'accept' | 'reject'
export type TimelineProposalStatus = 'pending' | 'accepted' | 'rejected'

export interface TimelineRevisionProposal {
  comment: CommentDTO
  target_kind: 'timeline_event' | 'timeline_person'
  target_id: string
  patch: Record<string, unknown>
  evidence: string
  status: TimelineProposalStatus
  reviewer_id?: string | null
  applied_revision_id?: string | null
}

export interface TimelineProposalList { items: TimelineRevisionProposal[]; page: number; has_more: boolean }
export interface CreateTimelineProposalInput {
  content: string
  evidence: string
  patch: Record<string, unknown>
  mentions: CommentMentionInput[]
  attachment_ids: string[]
}

const base = useApiUrl()
const collection = (kind: TimelineProposalTargetKind, id: string) =>
  `${base}/timeline/${kind === 'event' ? 'events' : 'persons'}/${encodeURIComponent(id)}/revision-proposals`

export const timelineRevisionProposalApi = {
  list: (kind: TimelineProposalTargetKind, id: string, page = 1) =>
    apiGet<TimelineProposalList>(`${collection(kind, id)}?page=${page}`),
  create: (kind: TimelineProposalTargetKind, id: string, input: CreateTimelineProposalInput) =>
    apiPostJson<TimelineRevisionProposal>(collection(kind, id), input),
  decide: (commentId: string, decision: TimelineProposalDecision) =>
    apiPutJson<TimelineRevisionProposal>(`${base}/timeline/revision-proposals/${encodeURIComponent(commentId)}/decision`, { decision }),
}
