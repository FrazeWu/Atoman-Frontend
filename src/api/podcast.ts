import { ApiErrorResponseError, apiRequest, apiRequestJson } from '@/api/client'
import { useApiUrl } from '@/composables/useApi'
import type { PodcastEpisode } from '@/types'

export type PodcastBookmarkKind = 'favorite' | 'listen_later'

export interface PodcastEpisodeSavePayload {
  channel_id: string
  title: string
  shownotes: string
  audio_url: string
  episode_cover_url: string
  season_number: number
  episode_number: number
  status: 'draft' | 'published'
  visibility: 'public' | 'followers' | 'private'
  collection_id: string | null
}

const podcastUrl = (path: string) => `${useApiUrl()}/podcast${path}`
const pathSegment = (value: string) => encodeURIComponent(value)
const queryString = (params: Record<string, string | number>) => new URLSearchParams(
  Object.entries(params).map(([key, value]) => [key, String(value)]),
).toString()

export const getPodcastEpisode = (id: string, token?: string) => (
  apiRequestJson<PodcastEpisode>(podcastUrl(`/episodes/${pathSegment(id)}`), token ? { headers: authHeaders(token) } : undefined)
)
export const listPodcastEpisodes = () => apiRequestJson<PodcastEpisode[]>(podcastUrl('/episodes'))
export const getPodcastRecommendations = <T>(mode: string) => (
  apiRequestJson<{ data?: T[] }>(podcastUrl(`/recommend/episodes?${queryString({ mode, page: 1, page_size: 8 })}`))
)
export const getPodcastShowEpisodes = <T = { channel: unknown; episodes: PodcastEpisode[] }>(slug: string) => (
  apiRequestJson<T>(podcastUrl(`/shows/${pathSegment(slug)}/episodes`))
)
export const getPodcastBookmarks = <T>(kind: PodcastBookmarkKind, token?: string) => (
  apiRequestJson<T>(podcastUrl(`/bookmarks?kind=${kind}`), { headers: authHeaders(token) })
)
export const getPodcastShowBookmarks = <T>(token?: string) => (
  apiRequestJson<T>(podcastUrl('/show-bookmarks'), { headers: authHeaders(token) })
)

function authHeaders(token?: string): Record<string, string> {
  return token && token !== 'cookie-session' ? { Authorization: `Bearer ${token}` } : {}
}

export async function addPodcastShowBookmark(channelId: string, token?: string) {
  const response = await apiRequest(podcastUrl('/show-bookmarks'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ channel_id: channelId }),
  })
  return response.ok
}

export function uploadPodcastCover(file: File, token?: string) {
  const body = new FormData()
  body.append('cover', file)
  return apiRequestJson<{ url: string }>(podcastUrl('/upload-cover'), {
    method: 'POST',
    headers: authHeaders(token),
    body,
  })
}

export function savePodcastEpisode<T>(payload: PodcastEpisodeSavePayload, token?: string, id?: string) {
  return apiRequestJson<T>(podcastUrl(id ? `/episodes/${pathSegment(id)}` : '/episodes'), {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(payload),
  })
}

export async function addPodcastEpisodeBookmark(
  episodeId: string,
  kind: PodcastBookmarkKind,
  token?: string,
) {
  const headers = { 'Content-Type': 'application/json', ...authHeaders(token) }

  const response = await apiRequest(`${useApiUrl()}/podcast/bookmarks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ episode_id: episodeId, kind }),
  })
  if (!response.ok) {
    throw new ApiErrorResponseError(response.status, 'podcast.bookmark_failed', 'Podcast bookmark failed.')
  }
}
