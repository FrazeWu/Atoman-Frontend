import type { LocationQuery, RouteLocationRaw } from 'vue-router'

export function hasAppHistory() {
  return typeof window !== 'undefined'
    && window.history.length > 1
    && Boolean(window.history.state?.back)
}

function queryString(value: LocationQuery[string]) {
  if (Array.isArray(value)) return ''
  return value || ''
}

export function studioContentLocation(module: string, query: LocationQuery): RouteLocationRaw {
  const collectionID = queryString(query.collection_id) || queryString(query.collection)

  return {
    path: `/studio/${module}/content`,
    query: collectionID ? { collection_id: collectionID } : undefined,
  }
}
