import { apiGet, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'

export type NoteShareVisibility = 'private' | 'link' | 'public'
export type NoteCollectionItemKind = 'chapter_note' | 'highlight'
export interface NoteCollectionReference { kind: NoteCollectionItemKind; id: string }
export interface NoteCollectionDraft { title: string; description: string; items: NoteCollectionReference[] }
export interface NoteCollection extends NoteCollectionDraft {
  id: string
  work_id: string
  version: number
  published_version: number
  visibility: NoteShareVisibility
  share_path?: string
  revoked_at?: string
  updated_at: string
}
export interface SharedNoteItem {
  kind: NoteCollectionItemKind
  title?: string
  quote?: string
  note?: string
  color?: string
  chapter?: string
}
export interface SharedNoteCollection {
  title: string
  description: string
  version: number
  visibility: 'link' | 'public'
  published_at: string
  items: SharedNoteItem[]
}
const url = (suffix: string) => `${useApiUrl()}/books${suffix}`
const path = (id: string) => `/me/note-collections/${encodeURIComponent(id)}`
const change = async <T>(path: string, method: string, body: unknown): Promise<T> =>
  (await apiRequestEnvelope<T>(url(path), { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).data

export const listNoteCollections = (workId: string) =>
  apiGet<{ items: NoteCollection[]; total: number }>(url(`/me/note-collections?work_id=${encodeURIComponent(workId)}`))
export const getNoteCollection = (id: string) => apiGet<NoteCollection>(url(path(id)))
export const saveNoteCollection = (id: string, workId: string, baseVersion: number, draft: NoteCollectionDraft) =>
  change<NoteCollection>(path(id), 'PUT', { work_id: workId, base_version: baseVersion, ...draft })
export const publishNoteCollection = (id: string, baseVersion: number, visibility: 'link' | 'public', requestId: string) =>
  change<NoteCollection>(`${path(id)}/publish`, 'POST', { base_version: baseVersion, request_id: requestId, visibility, confirm_publish: true })
export const revokeNoteCollection = (id: string, baseVersion: number) =>
  change<NoteCollection>(`${path(id)}/revoke`, 'POST', { base_version: baseVersion })
export const getSharedNoteCollection = (shareKey: string) =>
  apiGet<SharedNoteCollection>(url(`/note-shares/${encodeURIComponent(shareKey)}`))

export interface NoteShareImpact { total: number; items: { collection_id: string; title: string; visibility: 'link'|'public'; share_path: string }[] }
export const getNoteShareImpact = (kind: NoteCollectionItemKind, id: string) =>
  apiGet<NoteShareImpact>(url(`/me/note-share-impact/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`))
export interface PublicNoteShareCard { share_path: string; title: string; description: string; note_count: number; published_at: string }
export const listPublicNoteShares = (offset = 0) => apiGet<{ items: PublicNoteShareCard[]; total: number }>(url(`/note-shares?limit=20&offset=${offset}`))
