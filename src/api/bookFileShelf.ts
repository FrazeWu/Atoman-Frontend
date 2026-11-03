import { apiGet, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'

export type FileShelfStatus = 'unstarted' | 'reading' | 'finished' | 'paused'
export type FileShelfSort = 'activity' | 'added' | 'progress' | 'title'

export interface EditionFile {
  asset_id: string
  revision_id: string
  edition_id: string
  work_id: string
  title: string
  format: string
  language: string
  file_name: string
  is_best: boolean
  is_public: boolean
  can_manage: boolean
  created_at: string
}

export interface FileShelfItem {
  id: string
  revision_id: string
  asset_id: string
  work_id: string
  edition_id?: string
  title: string
  cover_url: string
  format: string
  status: FileShelfStatus
  archived: boolean
  furthest_percent: number
  has_better: boolean
  file_available: boolean
  created_at: string
  last_read_at?: string
}

const url = (path: string) => useApiUrl() + '/books' + path
const id = encodeURIComponent
const write = async <T>(path: string, method: string, body?: unknown): Promise<T> =>
  (await apiRequestEnvelope<T>(url(path), {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })).data

export const listEditionFiles = (editionId: string) =>
  apiGet<{ items: EditionFile[] }>(url('/editions/' + id(editionId) + '/files'))

export const selectEditionBestFile = (editionId: string, revisionId: string) =>
  write('/editions/' + id(editionId) + '/best-file', 'PUT', { revision_id: revisionId })

export const listFileShelf = (options: { status?: string; sort?: FileShelfSort; offset?: number } = {}) => {
  const query = new URLSearchParams({
    limit: '100',
    offset: String(options.offset ?? 0),
    sort: options.sort ?? 'activity',
  })
  if (options.status) query.set('status', options.status)
  return apiGet<{ items: FileShelfItem[]; total: number }>(url('/me/shelf/files?' + query))
}

export const saveFileShelf = (revisionId: string, data: { status?: FileShelfStatus; archived?: boolean } = {}) =>
  write('/me/shelf/files/' + id(revisionId), 'PUT', data)

export const removeFileShelf = (revisionId: string) =>
  write('/me/shelf/files/' + id(revisionId), 'DELETE')

export const saveEditionCover = (editionId: string, imageData: string) =>
  write<{ cover_url: string }>('/editions/' + id(editionId) + '/cover', 'PUT', { image_data: imageData })

export const setFilePublicAccess = (revisionId: string, publicAccess: boolean, rightsConfirmed = false) =>
  write<{ revision_id: string; public: boolean }>(
    '/asset-revisions/' + id(revisionId) + '/visibility', 'PUT',
    { public: publicAccess, rights_confirmed: rightsConfirmed },
  )
