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
export interface CatalogFilterParams {
  language?: string
  minRating?: number
  yearFrom?: number
  yearTo?: number
}

export interface FacetCountItem {
  key: string
  label: string
  count: number
}

export interface BookWorkFacetsResult {
  languages: FacetCountItem[]
  decades: FacetCountItem[]
  ratings: FacetCountItem[]
}

export function searchCatalogWorks(
  query = '',
  limit = 24,
  offset = 0,
  filtersOrSignal?: CatalogFilterParams | AbortSignal,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  let filters: CatalogFilterParams | undefined
  let actualSignal = signal
  if (filtersOrSignal instanceof AbortSignal) {
    actualSignal = filtersOrSignal
  } else if (filtersOrSignal) {
    filters = filtersOrSignal
  }
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (filters?.language) params.set('language', filters.language)
  if (filters?.minRating) params.set('min_rating', String(filters.minRating))
  if (filters?.yearFrom) params.set('year_from', String(filters.yearFrom))
  if (filters?.yearTo) params.set('year_to', String(filters.yearTo))
  return apiGet<CatalogPage>(url(`/works?${params.toString()}`), { signal: actualSignal })
}

export const getCatalogWorkFacets = (query = '', signal?: AbortSignal) =>
  apiGet<BookWorkFacetsResult>(url(`/works/facets?q=${encodeURIComponent(query)}`), { signal })
export interface CatalogPublisherSuggestion { id: string; name: string }
export const searchCatalogPublishers = (query = '', limit = 24, offset = 0, signal?: AbortSignal) =>
  apiGet<{ items: CatalogPublisherSuggestion[]; total: number }>(url(`/publishers?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`), { signal })
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
