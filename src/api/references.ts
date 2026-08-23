import { apiGet, apiPostJson } from './client'
import { useApiUrl } from '@/composables/useApi'

export type ReferenceResourceType =
  | 'post' | 'short_note' | 'thread' | 'debate' | 'feed' | 'article'
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

const base = () => `${useApiUrl()}/references`

export const referenceApi = {
  search(targetTypes: ReferenceTargetType | readonly ReferenceTargetType[], query = '', limit = 10, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query, limit: String(limit) })
    const types = Array.isArray(targetTypes) ? targetTypes : [targetTypes]
    types.forEach((targetType) => params.append('type', targetType))
    return apiGet<ReferenceTarget[]>(`${base()}/search?${params.toString()}`, { signal })
  },
  resolve(content: string) {
    return apiPostJson<ResolvedReference[]>(`${base()}/resolve`, { content })
  },
}
