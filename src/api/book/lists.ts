import { apiGet, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import type { BookPublicWork } from './books'

export interface BookListEntry { work_id: string; recommendation: string }
export interface BookListSnapshot { title: string; description: string; items: BookListEntry[] }
export interface BookListDraft extends BookListSnapshot {
  id: string
  version: number
  published_version: number
  visibility: 'public' | 'private'
  published_at?: string
  updated_at: string
}
export interface BookListCard {
  id: string
  owner_id: string
  visibility: 'public' | 'private'
  published_version: number
  title: string
  description: string
  item_count: number
  published_at: string | null
  changes: {
    items_added: number
    items_removed: number
    recommendations_changed: number
    order_changed: boolean
    metadata_changed: boolean
  }
}
export interface BookListDetail extends BookListCard {
  items: (BookListEntry & { canonical_work_id: string | null; title: string; available: boolean })[]
}
export interface BookListBookmark { list: BookListCard; seen_version: number; has_updates: boolean }
export interface BookListPage<T> { items: T[]; total: number; limit: number; offset: number }

const url = (path: string) => `${useApiUrl()}/books${path}`
const listPath = (id: string) => `/booklists/${encodeURIComponent(id)}`
const minePath = (id: string) => `/me${listPath(id)}`
async function mutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  return (await apiRequestEnvelope<T>(url(path), {
    method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })).data
}
export const searchBookLists = (query = '', offset = 0) =>
  apiGet<BookListPage<BookListCard>>(url(`/booklists?q=${encodeURIComponent(query)}&limit=20&offset=${offset}`))
export const listMyBookLists = (offset = 0) =>
  apiGet<BookListPage<BookListDraft>>(url(`/me/booklists?limit=20&offset=${offset}`))
export const listBookListBookmarks = (offset = 0) =>
  apiGet<BookListPage<BookListBookmark>>(url(`/me/booklist-bookmarks?limit=20&offset=${offset}`))
export const getBookList = (id: string) => apiGet<BookListDetail>(url(listPath(id)))
export const getBookListDraft = (id: string) => apiGet<BookListDraft>(url(`${minePath(id)}/draft`))
export const saveBookListDraft = (id: string, input: BookListSnapshot & { base_version: number }) =>
  mutate<BookListDraft>(`${minePath(id)}/draft`, 'PUT', input)
export const publishBookList = (id: string, baseVersion: number, visibility: 'public' | 'private') =>
  mutate<BookListDraft>(`${minePath(id)}/publish`, 'POST', { base_version: baseVersion, visibility })
export const unpublishBookList = (id: string, baseVersion: number) =>
  mutate<{ version: number }>(`${minePath(id)}/unpublish`, 'POST', { base_version: baseVersion })
export const deleteBookList = (id: string, baseVersion: number) =>
  mutate(`${minePath(id)}?base_version=${baseVersion}`, 'DELETE')
export const saveBookListBookmark = (id: string, seenVersion?: number) =>
  mutate<BookListBookmark>(`${listPath(id)}/bookmark`, 'PUT', seenVersion === undefined ? {} : { seen_version: seenVersion })
export const deleteBookListBookmark = (id: string) => mutate(`${listPath(id)}/bookmark`, 'DELETE')

// 书单只收录新版作品，不调用旧 catalog/search。
export const searchBookListWorks = (query: string) =>
  apiGet<BookListPage<BookPublicWork>>(url(`/works?q=${encodeURIComponent(query)}&limit=20&offset=0`))
export const getBookListWork = (id: string) => apiGet<BookPublicWork>(url(`/works/${encodeURIComponent(id)}`))
