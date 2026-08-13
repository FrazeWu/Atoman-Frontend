import { apiRequest, apiRequestJson } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import type { Video } from '@/types'

export type VideoImportStatus = 'pending_upload' | 'uploading' | 'completing' | 'awaiting_submit' | 'publishing' | 'published' | 'draft' | 'scheduled' | 'failed' | 'canceled'
export type VideoImportPublishMode = 'draft' | 'published' | 'scheduled'

export interface VideoImportPayload {
  channel_id: string | null
  title: string
  description: string
  thumbnail_url: string
  duration_sec: number
  visibility: 'public' | 'followers' | 'private'
  tags: string[]
  collection_ids: string[]
}

export interface VideoImportTask {
  id: string
  status: VideoImportStatus
  file_name: string
  file_size: number
  content_type: string
  part_size: number
  progress_current: number
  progress_total: number
  completed_parts: number[]
  payload: VideoImportPayload
  publish_mode: VideoImportPublishMode | ''
  scheduled_at?: string | null
  error_message: string
  target_video_id?: string | null
  upload_completed_at?: string | null
  publish_requested_at?: string | null
  created_at: string
  updated_at: string
}

export interface VideoSubscriptionPage {
  data: Video[]
  meta: { page: number; page_size: number; total: number; has_more: boolean }
}

export interface VideoRecommendationPage<T> {
  data: T[]
  meta: { page: number; page_size: number; total: number; has_more: boolean }
}

const videoUrl = (path: string) => `${useApiUrl()}/videos${path}`
const authHeaders = (token?: string): Record<string, string> => (
  token && token !== 'cookie-session' ? { Authorization: `Bearer ${token}` } : {}
)

export const listVideos = (sort: string) => apiRequestJson<Video[]>(videoUrl(`?sort=${sort}`))
export const getVideo = <T = Video>(id: string, token?: string) => (
  apiRequestJson<T>(videoUrl(`/${id}`), token ? { headers: authHeaders(token) } : undefined)
)
export const getRecommendedVideos = <T>(id: string) => apiRequestJson<T>(videoUrl(`/${id}/recommended`))
export const getVideoRecommendations = <T>(mode: string, page = 1, pageSize = 8) => (
  apiRequestJson<VideoRecommendationPage<T>>(videoUrl(`/recommend/items?mode=${mode}&page=${page}&page_size=${pageSize}`))
)
export const getVideoSubscriptions = (page = 1, pageSize = 20) => (
  apiRequestJson<VideoSubscriptionPage>(videoUrl(`/subscriptions?page=${page}&page_size=${pageSize}`))
)
export const recordVideoView = (id: string) => apiRequest(videoUrl(`/${id}/view`), { method: 'POST' })

export function uploadVideoCover(file: File, token?: string) {
  const body = new FormData()
  body.append('cover', file)
  return apiRequestJson<{ url: string }>(videoUrl('/upload-cover'), {
    method: 'POST',
    headers: authHeaders(token),
    body,
  })
}

export function saveVideo(payload: unknown, token?: string, id?: string) {
  return apiRequestJson<Video>(videoUrl(id ? `/${id}` : ''), {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  })
}

const importUrl = (id = '', suffix = '') => videoUrl(`/imports${id ? `/${id}` : ''}${suffix}`)

export function createVideoImport(file: File, channelId: string | null, token?: string) {
  return apiRequestJson<VideoImportTask>(importUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ channel_id: channelId, file_name: file.name, file_size: file.size, content_type: file.type }),
  })
}

export function listVideoImports(token?: string) {
  return apiRequestJson<VideoImportTask[]>(importUrl(), { headers: authHeaders(token) })
}

export function getVideoImport(id: string, token?: string) {
  return apiRequestJson<VideoImportTask>(importUrl(id), { headers: authHeaders(token) })
}

export function updateVideoImport(id: string, payload: VideoImportPayload, token?: string) {
  return apiRequestJson<VideoImportTask>(importUrl(id), {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify(payload),
  })
}

export function submitVideoImport(id: string, payload: VideoImportPayload, publishMode: VideoImportPublishMode, scheduledAt: string | null, token?: string) {
  return apiRequestJson<VideoImportTask>(importUrl(id, '/submit'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ payload, publish_mode: publishMode, scheduled_at: scheduledAt }),
  })
}

export function createVideoImportPartUpload(id: string, partNumber: number, token?: string) {
  return apiRequestJson<{ part_number: number; upload_url: string }>(importUrl(id, `/parts/${partNumber}`), {
    method: 'POST', headers: authHeaders(token),
  })
}

export function completeVideoImportPart(id: string, partNumber: number, etag: string, size: number, token?: string) {
  return apiRequestJson<VideoImportTask>(importUrl(id, `/parts/${partNumber}/complete`), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ etag, size }),
  })
}

export function completeVideoImport(id: string, token?: string) {
  return apiRequestJson<VideoImportTask>(importUrl(id, '/complete'), { method: 'POST', headers: authHeaders(token) })
}

export function retryVideoImport(id: string, token?: string) {
  return apiRequestJson<VideoImportTask>(importUrl(id, '/retry'), { method: 'POST', headers: authHeaders(token) })
}

export function cancelVideoImport(id: string, token?: string) {
  return apiRequestJson<VideoImportTask>(importUrl(id), { method: 'DELETE', headers: authHeaders(token) })
}

export function deleteVideoImportRecord(id: string, token?: string) {
  return apiRequestJson<{ ok: boolean }>(importUrl(id, '/record'), { method: 'DELETE', headers: authHeaders(token) })
}

export async function getVideoResource<T>(path: string, token?: string): Promise<T> {
  const payload = await apiRequestJson<T | { data: T }>(`${useApiUrl()}${path}`, { headers: authHeaders(token) })
  return payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload
}
