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
  subtitle_url?: string
  chapters?: Array<{ title: string; start_sec: number }>
  duration_sec: number
  visibility: 'public' | 'followers' | 'private'
  tags: string[]
  collection_id: string | null
  collection_ids?: string[] | null
}

export interface VideoSavePayload extends VideoImportPayload {
  storage_type: 'local' | 'external'
  video_url: string
  status: 'draft' | 'published'
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
const pathSegment = (value: string) => encodeURIComponent(value)
const queryString = (params: Record<string, string | number>) => new URLSearchParams(
  Object.entries(params).map(([key, value]) => [key, String(value)]),
).toString()
const authHeaders = (token?: string): Record<string, string> => (
  token && token !== 'cookie-session' ? { Authorization: `Bearer ${token}` } : {}
)

export interface VideoRatingSummary {
  rating_score: number
  rating_count: number
  viewer_rating?: number | null
}

export const listVideos = (sort: string) => apiRequestJson<Video[]>(videoUrl(`?${queryString({ sort })}`))
export const getVideo = <T = Video>(id: string, token?: string) => (
  apiRequestJson<T>(videoUrl(`/${pathSegment(id)}`), token ? { headers: authHeaders(token) } : undefined)
)
export const getRecommendedVideos = <T>(id: string) => apiRequestJson<T>(videoUrl(`/${pathSegment(id)}/recommended`))
export const getVideoRecommendations = <T>(mode: string, page = 1, pageSize = 8, token?: string) => (
  apiRequestJson<VideoRecommendationPage<T>>(
    videoUrl(`/recommend/items?${queryString({ mode, page, page_size: pageSize })}`),
    token ? { headers: authHeaders(token) } : undefined,
  )
)

export type VideoRecommendationFeedbackScope = 'video' | 'channel' | 'tag'
export const createVideoRecommendationFeedback = (scope: VideoRecommendationFeedbackScope, targetId: string, token?: string) => (
  apiRequest(videoUrl('/recommendation-feedback'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify({ scope, target_id: targetId }) })
)
export const getVideoSubscriptions = (page = 1, pageSize = 20, token?: string) => (
  apiRequestJson<VideoSubscriptionPage>(videoUrl(`/subscriptions?page=${page}&page_size=${pageSize}`), { headers: authHeaders(token) })
)
export const recordVideoView = (id: string) => apiRequest(videoUrl(`/${pathSegment(id)}/view`), { method: 'POST' })

export const setVideoRating = (id: string, score: number, token?: string) => (
  apiRequestJson<VideoRatingSummary>(videoUrl(`/${pathSegment(id)}/rating`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ score }),
  })
)

export const deleteVideoRating = (id: string, token?: string) => (
  apiRequestJson<VideoRatingSummary>(videoUrl(`/${pathSegment(id)}/rating`), {
    method: 'DELETE',
    headers: authHeaders(token),
  })
)

export function uploadVideoCover(file: File, token?: string) {
  const body = new FormData()
  body.append('cover', file)
  return apiRequestJson<{ url: string }>(videoUrl('/upload-cover'), {
    method: 'POST',
    headers: authHeaders(token),
    body,
  })
}

export function uploadVideoSubtitle(file: File, token?: string) {
  const body = new FormData()
  body.append('subtitle', file)
  return apiRequestJson<{ url: string }>(videoUrl('/upload-subtitle'), { method: 'POST', headers: authHeaders(token), body })
}

export function saveVideo(payload: VideoSavePayload, token?: string, id?: string) {
  return apiRequestJson<Video>(videoUrl(id ? `/${pathSegment(id)}` : ''), {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  })
}

export function duplicateVideo(id: string, token?: string) {
  return apiRequestJson<Video>(videoUrl(`/${pathSegment(id)}/duplicate`), {
    method: 'POST',
    headers: authHeaders(token),
  })
}

const importUrl = (id = '', suffix = '') => videoUrl(`/imports${id ? `/${pathSegment(id)}` : ''}${suffix}`)

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

export type VideoImportPartUploadOptions = {
  signal?: AbortSignal
}

export function uploadVideoImportPart(
  uploadUrl: string,
  body: Blob,
  options: VideoImportPartUploadOptions = {},
): Promise<string> {
  if (!/^https:\/\//i.test(uploadUrl)) {
    return Promise.reject(new Error('视频分片必须使用 R2 预签名上传地址'))
  }

  return apiRequest(uploadUrl, { method: 'PUT', body, signal: options.signal }).then(async response => {
    if (!response.ok) throw new Error('视频分片上传失败')
    const etag = response.headers.get('ETag') || response.headers.get('etag')
    if (!etag) throw new Error('视频分片上传失败')
    return etag
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
