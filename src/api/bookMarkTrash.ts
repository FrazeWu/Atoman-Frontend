import { apiGet, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import type { ReadingMark } from './bookReading'

export interface TrashedBookHighlight extends ReadingMark {
  work_id: string
  asset_id: string
  work_title: string
  restore_until: string
}
export interface BookHighlightTrashPage { items: TrashedBookHighlight[]; total: number }
const endpoint = (path: string) => `${useApiUrl()}/books/me/reading-marks${path}`
const id = encodeURIComponent
const mutate = async <T>(path: string, payload: unknown): Promise<T> =>
  (await apiRequestEnvelope<T>(endpoint(path), { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).data
export const listTrashedHighlights = (offset = 0) =>
  apiGet<BookHighlightTrashPage>(endpoint(`/trash?limit=50&offset=${offset}`))
export const restoreTrashedHighlight = (item: TrashedBookHighlight) =>
  mutate<ReadingMark>(`/${id(item.revision_id)}/${id(item.id)}/restore`, { base_version: item.version })
export const eraseTrashedHighlight = (item: TrashedBookHighlight) =>
  mutate<{ id: string; version: number }>(`/${id(item.revision_id)}/${id(item.id)}/erase`, { base_version: item.version, confirm_erase: true })
