import { apiGet } from './client'
import { useApiUrl } from '@/composables/useApi'

export type SearchScope = 'public' | 'mine'
export interface SearchState {
  q: string
  scope: SearchScope
  module: string
  types: string[]
  sort: string
  page: number
  filters: Record<string, string[]>
}
export interface SearchHit {
  key: string; module: string; type: string; id: string; title: string
  subtitle?: string; snippet?: string; cover_url?: string; href: string
}
export interface SearchGroup {
  module: string; type: string; label: string; items: SearchHit[]
  total: number | null; has_more: boolean; error: { code: string; message: string } | null
}
export interface SearchResponse {
  view: string; scope: SearchScope; query: string; groups: SearchGroup[]; items: SearchHit[]
  partial: boolean
  pagination?: { page: number; page_size: number; total: number; has_more: boolean }
}
export interface SearchFilter {
  key: string; label: string; kind: string; multiple: boolean; integer?: boolean
  options?: { value: string; label: string }[]; min?: number; max?: number
}
export interface SearchCapability {
  key: string; label: string; filters: SearchFilter[]
  sorts: { key: string; label: string }[]; default_sort: string; allow_empty_query: boolean
}
export interface SearchModule extends Omit<SearchCapability, 'key'> {
  module: string; types: SearchCapability[]
}
export interface SearchCapabilities { scope: SearchScope; modules: SearchModule[] }

export function searchParams(state: SearchState, preview = false) {
  const params = new URLSearchParams({ scope: state.scope })
  if (state.q.trim()) params.set('q', state.q.trim())
  if (state.module) params.set('module', state.module)
  state.types.forEach(type => params.append('type', type))
  if (state.sort) params.set('sort', state.sort)
  params.set('view', preview ? 'preview' : state.module && state.types.length === 1 ? 'list' : 'grouped')
  if (!preview && state.module && state.types.length === 1) params.set('page', String(state.page))
  for (const [key, values] of Object.entries(state.filters)) {
    values.forEach(value => params.append(`filter[${key}]`, value))
  }
  return params
}

export const searchApi = {
  search: (state: SearchState, signal: AbortSignal, preview = false) =>
    apiGet<SearchResponse>(`${useApiUrl()}/search?${searchParams(state, preview)}`, { signal }),
  capabilities: (scope: SearchScope, signal: AbortSignal) =>
    apiGet<SearchCapabilities>(`${useApiUrl()}/search/capabilities?scope=${scope}`, { signal }),
}
