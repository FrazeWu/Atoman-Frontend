import type { LocationQuery, LocationQueryRaw } from 'vue-router'
import type { SearchState } from '@/api/search'

export const unifiedSearchEnabled = import.meta.env.VITE_UNIFIED_SEARCH_ENABLED === 'true'
const values = (value: LocationQuery[string]) => (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string' && v !== '')
export function readSearchQuery(query: LocationQuery): SearchState {
  const filters: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(query)) {
    const match = /^filter\[([a-z_]+)\]$/.exec(key)
    if (match) filters[match[1]!] = values(value)
  }
  const page = Number(values(query.page)[0] || 1)
  return {
    q: values(query.q)[0]?.trim() || '', scope: query.scope === 'mine' ? 'mine' : 'public',
    module: values(query.module)[0] || '', types: [...new Set(values(query.type))],
    sort: values(query.sort)[0] || '', page: Number.isInteger(page) && page > 0 ? page : 1, filters,
  }
}
export function writeSearchQuery(state: SearchState): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  if (state.q) query.q = state.q
  if (state.scope === 'mine') query.scope = 'mine'
  if (state.module) query.module = state.module
  if (state.types.length) query.type = state.types
  if (state.sort) query.sort = state.sort
  if (state.page > 1) query.page = String(state.page)
  for (const [key, value] of Object.entries(state.filters)) if (value.length) query[`filter[${key}]`] = value
  return query
}
export function searchLocation(q: string, module = '', types: string[] = []) {
  return { path: '/search', query: writeSearchQuery({ q: q.trim(), scope: 'public', module, types, sort: '', page: 1, filters: {} }) }
}
export function safeSearchHref(href: string) {
  return href.startsWith('/') && !href.startsWith('//') && !/[\\\r\n\t]/.test(href) ? href : '/search'
}
