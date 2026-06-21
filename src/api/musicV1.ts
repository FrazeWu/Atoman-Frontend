import { apiGet, apiGetEnvelope, apiPostJson, apiPostMultipart } from './client'
import type { ApiList, PaginationMeta, UploadAsset, UploadPurpose } from './types'

export type MusicEntryStatus = 'open' | 'disputed' | 'confirmed' | 'protected' | 'closed'
export type MusicEntityType = 'artist' | 'album' | 'song'
export type MusicEditStatus =
  | 'open'
  | 'applied'
  | 'rejected'
  | 'cancelled'
  | 'failed_dependency'
  | 'failed_prerequisite'
  | 'reverted'
  | 'internal_error'
export type MusicEditType =
  | 'create_artist'
  | 'update_artist'
  | 'merge_artist'
  | 'delete_artist'
  | 'create_album'
  | 'update_album'
  | 'merge_album'
  | 'delete_album'
  | 'create_song'
  | 'update_song'
  | 'move_song'
  | 'delete_song'
  | 'update_lyrics'
  | 'change_entry_status'

export type MusicSource = {
  type: 'url' | string
  url?: string
  title?: string
}

export type MusicEditRequest = {
  type: MusicEditType
  entity_type: MusicEntityType
  entity_id?: string
  payload?: Record<string, unknown>
  changes?: Record<string, unknown>
  reason: string
  sources?: MusicSource[]
}

export type MusicEditSummary = {
  id: string
  type: MusicEditType
  status: MusicEditStatus
  entity_type: MusicEntityType
  entity_id?: string
  submitted_by: string
  auto_applied: boolean
  votable: boolean
  votes: { yes: number; no: number }
  created_at: string
}

export type MusicArtistListItem = {
  id: string
  name: string
  bio?: string
  image_url?: string
  nationality?: string
  birth_date?: string
  birth_year?: number
  death_year?: number
  members?: string
  entry_status: MusicEntryStatus
  created_at?: string
  updated_at?: string
}

export type MusicAlbumListItem = {
  id: string
  title: string
  artists?: Array<{ id: string; name: string }>
  year?: number
  release_date?: string
  cover_url?: string
  description?: string
  album_type?: string
  hot_score?: number
  songs?: Array<{ id: string; title: string; track_number?: number; audio_url?: string }>
  entry_status: MusicEntryStatus
}

export type MusicListResponse<T> = ApiList<T>

export type MusicListFilters = {
  q?: string
  artist_id?: string
  album_id?: string
  year?: string | number
  status?: MusicEntryStatus
  page?: number
  page_size?: number
  sort?: string
}

export type MusicEditFilters = {
  status?: MusicEditStatus
  entity_type?: MusicEntityType
  type?: MusicEditType
  submitted_by?: string
  page?: number
  page_size?: number
  sort?: string
}

export type AlbumEditDraft = {
  title?: string
  artist_ids?: string[]
  release_date?: string
  cover?: UploadAsset | null
  description?: string
  album_type?: string
  reason: string
  sources: MusicSource[]
}

export type ArtistEditDraft = {
  name?: string
  bio?: string
  image_url?: string
  nationality?: string
  birth_date?: string
  birth_year?: number
  death_year?: number
  reason: string
  sources: MusicSource[]
}

const API_V1_BASE = '/api/v1'

function queryString(filters: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

export const musicV1Endpoints = {
  uploads: () => `${API_V1_BASE}/uploads`,
  artists: () => `${API_V1_BASE}/music/artists`,
  artist: (artistId: string) => `${API_V1_BASE}/music/artists/${artistId}`,
  albums: () => `${API_V1_BASE}/music/albums`,
  album: (albumId: string) => `${API_V1_BASE}/music/albums/${albumId}`,
  songs: () => `${API_V1_BASE}/music/songs`,
  song: (songId: string) => `${API_V1_BASE}/music/songs/${songId}`,
  edits: () => `${API_V1_BASE}/music/edits`,
  edit: (editId: string) => `${API_V1_BASE}/music/edits/${editId}`,
  editVotes: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/votes`,
  editApprove: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/approve`,
  editReject: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/reject`,
  editCancel: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/cancel`,
  editRevert: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/revert`,
}

function albumPayloadFromDraft(draft: AlbumEditDraft): Record<string, unknown> {
  return {
    ...(draft.title !== undefined ? { title: draft.title } : {}),
    ...(draft.artist_ids !== undefined ? { artist_ids: draft.artist_ids } : {}),
    ...(draft.release_date !== undefined ? { release_date: draft.release_date } : {}),
    ...(draft.cover ? { cover_url: draft.cover.url, cover_key: draft.cover.key } : {}),
    ...(draft.description !== undefined ? { description: draft.description } : {}),
    ...(draft.album_type !== undefined ? { album_type: draft.album_type } : {}),
  }
}

function artistPayloadFromDraft(draft: ArtistEditDraft): Record<string, unknown> {
  return {
    ...(draft.name !== undefined ? { name: draft.name } : {}),
    ...(draft.bio !== undefined ? { bio: draft.bio } : {}),
    ...(draft.image_url !== undefined ? { image_url: draft.image_url } : {}),
    ...(draft.nationality !== undefined ? { nationality: draft.nationality } : {}),
    ...(draft.birth_date !== undefined ? { birth_date: draft.birth_date } : {}),
    ...(draft.birth_year !== undefined ? { birth_year: draft.birth_year } : {}),
    ...(draft.death_year !== undefined ? { death_year: draft.death_year } : {}),
  }
}

export function buildCreateArtistEdit(draft: ArtistEditDraft): MusicEditRequest {
  return {
    type: 'create_artist',
    entity_type: 'artist',
    payload: artistPayloadFromDraft(draft),
    changes: {},
    reason: draft.reason,
    sources: draft.sources,
  }
}

export function buildUpdateArtistEdit(artistId: string, draft: ArtistEditDraft): MusicEditRequest {
  return {
    type: 'update_artist',
    entity_type: 'artist',
    entity_id: artistId,
    payload: {},
    changes: artistPayloadFromDraft(draft),
    reason: draft.reason,
    sources: draft.sources,
  }
}

export function buildCreateAlbumEdit(draft: AlbumEditDraft): MusicEditRequest {
  return {
    type: 'create_album',
    entity_type: 'album',
    payload: albumPayloadFromDraft(draft),
    changes: {},
    reason: draft.reason,
    sources: draft.sources,
  }
}

export function buildUpdateAlbumEdit(albumId: string, draft: AlbumEditDraft): MusicEditRequest {
  return {
    type: 'update_album',
    entity_type: 'album',
    entity_id: albumId,
    payload: {},
    changes: albumPayloadFromDraft(draft),
    reason: draft.reason,
    sources: draft.sources,
  }
}

export function buildDeleteAlbumEdit(albumId: string, reason: string): MusicEditRequest {
  return {
    type: 'delete_album',
    entity_type: 'album',
    entity_id: albumId,
    payload: {},
    changes: { target_status: 'closed' },
    reason,
    sources: [],
  }
}

export async function uploadMusicAsset(
  file: File,
  purpose: Extract<UploadPurpose, 'music.cover' | 'music.audio'>,
): Promise<UploadAsset> {
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', purpose)
  return apiPostMultipart<UploadAsset>(musicV1Endpoints.uploads(), form)
}

export async function uploadMusicAudioBatch(files: File[]): Promise<UploadAsset[]> {
  return Promise.all(files.map((file) => uploadMusicAsset(file, 'music.audio')))
}

function buildSources(source?: string): MusicSource[] {
  const value = source?.trim()
  return value ? [{ type: 'url', url: value }] : []
}

function buildSharedCreationReason() {
  return 'Create artist and debut album from music creation flow'
}

export function buildArtistEditFromCreationFlow(artist: {
  avatarUrl?: string
  name?: string
  country?: string
  birthday?: string
  bio?: string
  source?: string
}): MusicEditRequest {
  return buildCreateArtistEdit({
    name: artist.name?.trim() || undefined,
    bio: artist.bio?.trim() || undefined,
    image_url: artist.avatarUrl?.trim() || undefined,
    nationality: artist.country?.trim() || undefined,
    birth_date: artist.birthday?.trim() || undefined,
    reason: buildSharedCreationReason(),
    sources: buildSources(artist.source),
  })
}

export function buildAlbumEditFromCreationFlow(
  album: {
    coverUrl?: string
    coverAsset?: UploadAsset | null
    title?: string
    releaseDate?: string
    type?: string
    bio?: string
    source?: string
  },
  artistId: string,
): MusicEditRequest {
  const coverUrl = album.coverUrl?.trim()
  return buildCreateAlbumEdit({
    title: album.title?.trim() || undefined,
    artist_ids: [artistId],
    release_date: album.releaseDate?.trim() || undefined,
    cover: album.coverAsset || (coverUrl
      ? {
          url: coverUrl,
          key: '',
          content_type: '',
          size: 0,
        }
      : null),
    description: album.bio?.trim() || undefined,
    album_type: album.type?.trim() || undefined,
    reason: buildSharedCreationReason(),
    sources: buildSources(album.source),
  })
}

export async function listMusicAlbums(filters: MusicListFilters = {}): Promise<MusicListResponse<MusicAlbumListItem>> {
  const response = await apiGetEnvelope<MusicAlbumListItem[], PaginationMeta>(`${musicV1Endpoints.albums()}${queryString(filters)}`)
  return {
    data: response.data,
    meta: response.meta ?? {
      page: filters.page ?? 1,
      page_size: filters.page_size ?? response.data.length,
      total: response.data.length,
      has_more: false,
    },
  }
}

export async function getMusicAlbum(albumId: string): Promise<MusicAlbumListItem> {
  return apiGet<MusicAlbumListItem>(musicV1Endpoints.album(albumId))
}

export async function listMusicArtists(filters: MusicListFilters = {}): Promise<MusicListResponse<MusicArtistListItem>> {
  const response = await apiGetEnvelope<MusicArtistListItem[], PaginationMeta>(`${musicV1Endpoints.artists()}${queryString(filters)}`)
  return {
    data: response.data,
    meta: response.meta ?? {
      page: filters.page ?? 1,
      page_size: filters.page_size ?? response.data.length,
      total: response.data.length,
      has_more: false,
    },
  }
}

export async function getMusicArtist(artistId: string): Promise<MusicArtistListItem & { albums?: MusicAlbumListItem[] }> {
  return apiGet<MusicArtistListItem & { albums?: MusicAlbumListItem[] }>(musicV1Endpoints.artist(artistId))
}

export async function submitMusicEdit(request: MusicEditRequest): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.edits(), request)
}

export async function listMusicEdits(filters: MusicEditFilters = {}): Promise<MusicListResponse<MusicEditSummary>> {
  const response = await apiGetEnvelope<MusicEditSummary[], PaginationMeta>(`${musicV1Endpoints.edits()}${queryString(filters)}`)
  return {
    data: response.data,
    meta: response.meta ?? {
      page: filters.page ?? 1,
      page_size: filters.page_size ?? response.data.length,
      total: response.data.length,
      has_more: false,
    },
  }
}

export async function voteMusicEdit(editId: string, vote: 'yes' | 'no', comment = ''): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editVotes(editId), { vote, comment })
}

export async function approveMusicEdit(editId: string, reason: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editApprove(editId), { reason })
}

export async function rejectMusicEdit(editId: string, reason: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editReject(editId), { reason })
}

export async function cancelMusicEdit(editId: string, reason: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editCancel(editId), { reason })
}

export async function revertMusicEdit(editId: string, reason: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.editRevert(editId), { reason })
}
