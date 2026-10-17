import { apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import type { CatalogResource } from './bookCatalog'

export type ShelfStatus = 'want_to_read' | 'reading' | 'read' | 'on_hold' | 'dropped'
export const shelfStatuses: { value: ShelfStatus; label: string }[] = [
  { value: 'want_to_read', label: '想读' }, { value: 'reading', label: '在读' },
  { value: 'read', label: '读完' }, { value: 'on_hold', label: '暂停' }, { value: 'dropped', label: '弃读' },
]
export interface LibraryEntry { id: string; work_id: string; work_title: string; status: ShelfStatus; tags: string[]; version: number }
export interface PrivateNote { id: string; work_id: string; source_revision_id?: string; title: string; body: string; tags: string[]; version: number; trashed_at?: string }
export type NoteInput = Omit<PrivateNote, 'id' | 'version' | 'trashed_at'> & { base_version: number }
export interface NoteBackup { schema_version: 1; exported_at?: string; notes: Omit<PrivateNote, 'version' | 'trashed_at'>[] }
export interface ReadingRecommendation { work_id: string; asset?: CatalogResource; revision_id?: string; available: boolean; reason?: string; source: string }
export interface ReadingStatistics { timezone: string; from: string; to: string; total_seconds: number; days: { day: string; seconds: number }[]; works: { work_id: string; title: string; seconds: number }[] }
export async function privateBookRequest<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  return (await apiRequestEnvelope<T>(`${useApiUrl()}/books${path}`, {
    method, signal, cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })).data
}
const id = encodeURIComponent
export const listLibrary = (offset = 0) => privateBookRequest<{ items: LibraryEntry[]; total: number }>(`/me/library?limit=100&offset=${offset}`)
export const saveLibrary = (workId: string, status: ShelfStatus, tags: string[], entry?: LibraryEntry) => privateBookRequest<LibraryEntry>(`/me/library/works/${id(workId)}`, 'PUT', { entry_id: entry?.id, base_version: entry?.version ?? 0, status, tags })
export const removeLibrary = (entry: LibraryEntry) => privateBookRequest(`/me/library/entries/${id(entry.id)}?base_version=${entry.version}`, 'DELETE')
export const readingRecommendation = (workId: string) => privateBookRequest<ReadingRecommendation>(`/works/${id(workId)}/reading-recommendation`)
export const selectReading = (workId: string, assetId: string, revisionId: string) => privateBookRequest(`/me/selections/${id(workId)}`, 'PUT', { asset_id: assetId, revision_id: revisionId })
export const readingStatistics = () => privateBookRequest<ReadingStatistics>('/me/reading-statistics')
export const listPrivateNotes = (query: { q?: string; tag?: string; work_id?: string; trash?: boolean; offset?: number } = {}) => {
  const params = new URLSearchParams({ limit: '100' })
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  return privateBookRequest<{ items: PrivateNote[]; total: number }>(`/me/private-notes?${params}`)
}
export const savePrivateNote = (noteId: string, input: NoteInput) => privateBookRequest<PrivateNote>(`/me/private-notes/${id(noteId)}`, 'PUT', input)
export const deletePrivateNote = (note: PrivateNote) => privateBookRequest(`/me/private-notes/${id(note.id)}?base_version=${note.version}`, 'DELETE')
export const restorePrivateNote = (note: PrivateNote) => privateBookRequest(`/me/private-notes/${id(note.id)}/restore`, 'POST', { base_version: note.version })
export const exportPrivateNotes = () => privateBookRequest<NoteBackup>('/me/private-notes/export')
export const importPrivateNotes = (input: NoteBackup & { request_id: string }) => privateBookRequest<{ created: string[]; skipped: string[]; conflicts: string[] }>('/me/private-notes/import', 'POST', input)
export const publishPrivateNote = (note: PrivateNote, channelId: string, requestId: string) => privateBookRequest<{ target_path: string }>(`/me/private-notes/${id(note.id)}/publish`, 'POST', { base_version: note.version, channel_id: channelId, request_id: requestId, confirm_public: true })

export function downloadBookData(body: string | Blob, filename: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(body instanceof Blob ? body : new Blob([body], { type }))
  const link = document.createElement('a')
  link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
