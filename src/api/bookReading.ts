import { apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'

export interface ReadingPosition {
  current_percent: number
  epub_cfi: string
  pdf_page: number
  txt_offset: number
}
export interface CloudReadingState extends ReadingPosition {
  revision_id: string
  version: number
  furthest_percent: number
}
export interface ReadingSession {
  session: { id: string; last_sequence: number; heartbeat_sequence: number }
  state: CloudReadingState
}
export interface ReadingWrite extends ReadingPosition {
  session_id: string
  request_id: string
  sequence: number
  base_version: number
  furthest_percent: number
}
export interface ReadingAnchor {
  epub_start_cfi?: string
  epub_end_cfi?: string
  pdf_page?: number
  pdf_rects?: { x: number; y: number; width: number; height: number }[]
  txt_offset_start?: number
  txt_offset_end?: number
}
export interface ReadingMarkInput {
  base_version: number
  kind: 'bookmark' | 'highlight'
  anchor: ReadingAnchor
  label: string
  quote: string
  note: string
  color: string
  style: string
}
export interface ReadingMark extends Omit<ReadingMarkInput, 'base_version'> {
  id: string
  revision_id: string
  version: number
  created_at: string
}
const path = (value: string) => encodeURIComponent(value)
async function request<T>(route: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  return (await apiRequestEnvelope<T>(`${useApiUrl()}/books/me${route}`, {
    method, signal, cache: 'no-store',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })).data
}
export const createReadingSession = (revisionId: string, clientSessionId: string, deviceId: string, signal?: AbortSignal) =>
  request<ReadingSession>('/reading-sessions', 'POST', { revision_id: revisionId, client_session_id: clientSessionId, device_id: deviceId }, signal)
export const getCloudReadingState = (revisionId: string, signal?: AbortSignal) => request<CloudReadingState>(`/reading-states/${path(revisionId)}`, 'GET', undefined, signal)
export const saveCloudReadingState = (revisionId: string, input: ReadingWrite, signal?: AbortSignal) =>
  request<{ state: CloudReadingState; position_applied: boolean; duplicate: boolean; ignored_reason?: string }>(`/reading-states/${path(revisionId)}`, 'PUT', input, signal)
export const sendReadingHeartbeat = (sessionId: string, input: { sequence: number; visible: boolean; active: boolean }, signal?: AbortSignal) =>
  request(`/reading-sessions/${path(sessionId)}/heartbeat`, 'POST', input, signal)
export const listReadingMarks = (revisionId: string, signal?: AbortSignal) =>
  request<{ items: ReadingMark[]; deleted: { id: string; version: number }[] }>(`/reading-marks/${path(revisionId)}`, 'GET', undefined, signal)
export const saveReadingMark = (revisionId: string, id: string, input: ReadingMarkInput, signal?: AbortSignal) =>
  request<ReadingMark>(`/reading-marks/${path(revisionId)}/${path(id)}`, 'PUT', input, signal)
export const deleteReadingMark = (revisionId: string, id: string, version: number, signal?: AbortSignal) =>
  request(`/reading-marks/${path(revisionId)}/${path(id)}?base_version=${version}`, 'DELETE', undefined, signal)
