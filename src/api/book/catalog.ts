import { apiGet, apiRequestEnvelope } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import type { BookPublicEdition, CatalogWork, CreateCatalogWork, CreateCatalogEdition, CatalogResource, CatalogPage } from '@/entities/book/model/types'
import { readonly, ref } from 'vue'

export type { CatalogWork, CreateCatalogWork, CreateCatalogEdition, CatalogResource, CatalogPage } from '@/entities/book/model/types'
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
