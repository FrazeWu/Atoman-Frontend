import { apiGet, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import type { BookPublicEdition, BookPublicWork } from './books'
import { readonly, ref } from 'vue'

export interface CatalogWork extends BookPublicWork { revision_id: string; redirected_from?: string }
export interface CreateCatalogWork {
  title: string
  authors: string[]
  subtitle?: string
  original_title?: string
  description?: string
  language?: string
}
export interface CreateCatalogEdition {
  title?: string
  publisher?: string
  producer?: string
  isbn10?: string
  isbn13?: string
  language?: string
  published_date?: string
  page_count?: number
  binding?: string
  cover_url?: string
}
export interface CatalogResource {
  id: string
  work_id: string
  title: string
  language: string
  format: 'epub' | 'pdf' | 'txt' | 'cbz' | 'cbr'
  status: 'active' | 'removed'
  current_revision_id?: string
}
export interface CatalogPage { items: BookPublicWork[]; total: number; limit: number; offset: number }
const url = (path: string) => `${useApiUrl()}/books${path}`
const revision = ref(0)
export const catalogRevision = readonly(revision)
async function post<T>(path: string, input: unknown): Promise<T> {
  return (await apiRequestEnvelope<T>(url(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).data
}
export const searchCatalogWorks = (query = '', limit = 24, offset = 0, signal?: AbortSignal) =>
  apiGet<CatalogPage>(url(`/works?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`), { signal })
export const getCatalogWork = (id: string) => apiGet<CatalogWork>(url(`/works/${encodeURIComponent(id)}`))
export async function createCatalogWork(input: CreateCatalogWork) {
  const work = await post<CatalogWork>('/works', input)
  revision.value++
  return work
}
export async function createCatalogEdition(id: string, input: CreateCatalogEdition) {
  const edition = await post<BookPublicEdition>(`/works/${encodeURIComponent(id)}/editions`, input)
  revision.value++
  return edition
}
export const listCatalogResources = (id: string) =>
  apiGet<{ items: CatalogResource[] }>(url(`/works/${encodeURIComponent(id)}/assets`))
