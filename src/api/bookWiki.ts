import { privateBookRequest as request } from './bookPrivate'
export type WikiKind = 'work' | 'person' | 'edition'
export interface WikiRevision { id: string; version: number; is_current: boolean; edit_type: string; summary: string; created_at: string; snapshot: Record<string, unknown>; changes: { field: string; before: unknown; after: unknown }[] }
export interface WikiMetadata { entity_id: string; entity_type: WikiKind; revision_id: string; fields: Record<string, unknown> }
export interface MergePreview { source_id: string; target_id: string; source_revision_id: string; target_revision_id: string; preview_token: string; conflict_policy: string; record_counts: Record<string, number> }
export interface WikiMerge { id: string; source_id: string; target_id: string; status: string }
const id = encodeURIComponent
export const wikiHistory = (kind: WikiKind, entityId: string, offset = 0) => request<{ items: WikiRevision[]; total: number }>(`/wiki/${kind}/${id(entityId)}/revisions?limit=50&offset=${offset}`)
export const wikiMetadata = (kind: WikiKind, entityId: string) => request<WikiMetadata>(`/wiki/${kind}/${id(entityId)}`)
export const patchWiki = (kind: WikiKind, entityId: string, revisionId: string, fields: Record<string, unknown>, summary: string) => request(kind === 'work' ? `/works/${id(entityId)}` : `/wiki/${kind}/${id(entityId)}`, 'PATCH', kind === 'work' ? { ...fields, base_revision_id: revisionId, summary } : { fields, base_revision_id: revisionId, summary })
export const revertWiki = (revisionId: string, baseId: string) => request(`/wiki/revisions/${id(revisionId)}/revert`, 'POST', { base_revision_id: baseId, summary: '恢复历史资料' })
export const previewWikiMerge = (kind: WikiKind, sourceId: string, targetId: string) => request<MergePreview>('/wiki/merges/preview', 'POST', { entity_type: kind, source_id: sourceId, target_id: targetId })
export const mergeWiki = (kind: WikiKind, preview: MergePreview) => request<WikiMerge>('/wiki/merges', 'POST', { entity_type: kind, source_id: preview.source_id, target_id: preview.target_id, source_revision_id: preview.source_revision_id, target_revision_id: preview.target_revision_id, preview_token: preview.preview_token })
export const revertWikiMerge = (mergeId: string) => request(`/wiki/merges/${id(mergeId)}/revert`, 'POST')
export const wikiMerges = (kind: WikiKind, entityId: string) => request<{ items: WikiMerge[] }>(`/wiki/${kind}/${id(entityId)}/merges`)
export const searchWikiPeople = (query: string, offset = 0, limit = 50) => request<{ items: { id: string; name: string; description?: string }[]; total: number }>(`/people?q=${id(query)}&limit=${limit}&offset=${offset}`)
export const createWikiPerson = (name: string) => request<{ id: string; name: string }>('/people', 'POST', { name })
