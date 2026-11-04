import { apiGet, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import type { BookPublicWork, BookPublicEdition, CatalogWork, CreateCatalogWork, CreateCatalogEdition, CatalogResource, CatalogPage } from '@/entities/book/model/types'
import { readonly, ref } from 'vue'

export type { CatalogWork, CreateCatalogWork, CreateCatalogEdition, CatalogResource, CatalogPage } from '@/entities/book/model/types'
export interface WorkDuplicateMatch {
  work: BookPublicWork
  reason: string
  score: number
}
export interface EditionDuplicateMatch {
  edition: BookPublicEdition
  reason: string
  score: number
}
const url = (path: string) => `${useApiUrl()}/books${path}`
const revision = ref(0)
export const catalogRevision = readonly(revision)
async function post<T>(path: string, input: unknown, requestId?: string): Promise<T> {
  return (await apiRequestEnvelope<T>(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(requestId ? { 'Idempotency-Key': requestId } : {}) },
    body: JSON.stringify(input),
  })).data
}
export const searchCatalogWorks = (query = '', limit = 24, offset = 0, signal?: AbortSignal) =>
  apiGet<CatalogPage>(url(`/works?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`), { signal })
export const getCatalogWork = (id: string) => apiGet<CatalogWork>(url(`/works/${encodeURIComponent(id)}`))
export async function checkCatalogWorkDuplicates(input: Pick<CreateCatalogWork, 'title' | 'original_title' | 'authors' | 'author_ids'>) {
  return await post<{ matches: WorkDuplicateMatch[] }>('/works/duplicate-check', input)
}
export async function checkCatalogEditionDuplicates(id: string, input: CreateCatalogEdition) {
  return await post<{ matches: EditionDuplicateMatch[] }>(`/works/${encodeURIComponent(id)}/editions/duplicate-check`, input)
}
export async function createCatalogWork(input: CreateCatalogWork, requestId?: string) {
  const work = await post<CatalogWork>('/works', input, requestId)
  revision.value++
  return work
}
export async function createCatalogEdition(id: string, input: CreateCatalogEdition, requestId?: string) {
  const edition = await post<BookPublicEdition>(`/works/${encodeURIComponent(id)}/editions`, input, requestId)
  revision.value++
  return edition
}
export const listCatalogResources = (id: string) =>
  apiGet<{ items: CatalogResource[] }>(url(`/works/${encodeURIComponent(id)}/assets`))
