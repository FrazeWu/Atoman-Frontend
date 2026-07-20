import { apiGet, apiPostJson } from './client'

export type ReferenceResourceType =
  | 'post' | 'thread' | 'debate' | 'feed' | 'article'
  | 'artist' | 'album' | 'song' | 'playlist' | 'podcast'
  | 'episode' | 'video' | 'person' | 'event' | 'channel'
  | 'collection' | 'comment'

export type ReferenceTargetType = 'user' | ReferenceResourceType

export interface ReferenceTarget {
  type: ReferenceTargetType
  id: string
  label: string
  subtitle?: string
  module: string
  path: string
  available: boolean
}

export interface ResolvedReference {
  kind: 'user' | 'resource'
  target_type: ReferenceTargetType
  target_id?: string
  field?: string
  start: number
  end: number
  label?: string
  subtitle?: string
  module?: string
  path?: string
  available: boolean
}

const base = '/api/v1/references'

export const referenceApi = {
  search(targetType: ReferenceTargetType, query = '', limit = 10) {
    const params = new URLSearchParams({ type: targetType, q: query, limit: String(limit) })
    return apiGet<ReferenceTarget[]>(`${base}/search?${params.toString()}`)
  },
  resolve(content: string) {
    return apiPostJson<ResolvedReference[]>(`${base}/resolve`, { content })
  },
}
