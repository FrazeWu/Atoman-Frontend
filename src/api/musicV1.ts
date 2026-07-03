import { apiDeleteJson, apiGet, apiGetEnvelope, apiPatchJson, apiPostJson, apiPostMultipart } from './client'
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

export type MusicAlbumImportStatus =
  | 'pending_upload'
  | 'uploading'
  | 'uploaded'
  | 'extracting'
  | 'ready'
  | 'failed'
  | 'committed'

export type MusicAlbumImportTrack = {
  title: string
  audioKey: string
  origin: string
}

export type MusicAlbumImportCommitStageName = {
  name: string
  isPrimary: boolean
  startDateText: string
  endDateText: string
}

export type MusicAlbumImportCommitTrack = {
  title: string
  trackNumber: number
}

export type MusicAlbumImportCommitInput = {
  artist_id?: string
  artist: {
    name: string
    legal_name: string
    stage_names: MusicAlbumImportCommitStageName[]
    birth_place: string
  }
  album: {
    title: string
    release_year: number
    tracks: MusicAlbumImportCommitTrack[]
  }
}

export type MusicAlbumImport = {
  importId: string
  status: MusicAlbumImportStatus
  archiveName: string
  uploadProgress: number
  uploadSpeed: number
  coverUrl: string
  coverKey: string
  derivedAlbumTitle: string
  derivedCover: string
  derivedTracks: MusicAlbumImportTrack[]
  lastSyncedAt: string
  errorMessage: string
}

export type CreateMusicAlbumImportInput = {
  artistId?: string | null
}

export type MusicAlbumArchiveUploadProgress = {
  loaded: number
  total: number
  bytesPerSecond: number
}

export type UploadMusicAlbumArchiveOptions = {
  onProgress?: (progress: MusicAlbumArchiveUploadProgress) => void
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

export type MusicRevisionSummary = {
  id: string
  content_type: 'album' | 'song' | 'artist'
  content_id: string
  version_number: number
  previous_revision_id?: string | null
  content_snapshot: unknown
  editor_id: string
  editor?: {
    username?: string
    display_name?: string
  }
  edit_summary: string
  edit_type: string
  status: string
  is_current: boolean
  created_at: string
}

export type MusicDiscussionAuthor = {
  id: string
  username?: string
  display_name?: string
}

export type MusicDiscussion = {
  id: string
  album_id: string
  parent_id?: string | null
  content: string
  created_at: string
  updated_at?: string
  author_id: string
  author?: MusicDiscussionAuthor
  replies?: MusicDiscussion[]
  can_delete?: boolean
}

export type MusicArtistListItem = {
  id: string
  name: string
  legal_name?: string
  bio?: string
  image_url?: string
  nationality?: string
  birth_date?: string
  birth_year?: number
  death_year?: number
  members?: string
  aliases?: Array<{ id?: string; alias: string; is_main_name?: boolean }>
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
  songs?: Array<{ id: string; title: string; track_number?: number; audio_url?: string; cover_url?: string; lyrics?: string; status?: string }>
  entry_status: MusicEntryStatus
}

export type MusicSongListItem = {
  id: string
  title: string
  track_number?: number
  audio_url?: string
  cover_url?: string
  lyrics?: string
  status?: string
  entry_status: MusicEntryStatus
  artists?: Array<{ id: string; name: string }>
  album?: { id: string; title: string }
}

export type MusicPlaylistSummary = {
  id: string
  name: string
  description?: string
  song_count: number
}

export type MusicPlaylistDetail = MusicPlaylistSummary & {
  songs: MusicSongListItem[]
}

export type MusicStarredKind = 'artist' | 'album' | 'song' | 'playlist'

export type MusicArtistBookmark = {
  id: string
  artist_id: string
  created_at: string
}

export type MusicAlbumBookmark = {
  id: string
  album_id: string
  created_at: string
}

export type MusicSongBookmark = {
  id: string
  song_id: string
  created_at: string
  song?: MusicSongListItem
}

export type MusicStarredItem = {
  id: string
  kind: MusicStarredKind
  starred_at: string
  artist?: MusicArtistListItem
  album?: MusicAlbumListItem
  song?: MusicSongListItem
  playlist?: MusicPlaylistSummary
}

export type CreateMusicPlaylistInput = {
  name: string
}

export type MusicAlbumTrackEditInput = {
  id?: string
  title: string
  track_number: number
  lyrics?: string
  audio_url?: string
  removed?: boolean
}

export type MusicArtistInput = {
  name: string
  bio?: string
  image_url?: string
  nationality?: string
  birth_date?: string
  birth_year?: number
  death_year?: number
}

export type MusicAlbumInput = {
  title: string
  artist_ids?: string[]
  release_date?: string
  cover_url?: string
  cover_key?: string
  description?: string
  album_type?: string
  tracks?: MusicAlbumTrackEditInput[]
}

export type MusicArtistUpdateInput = Partial<MusicArtistInput>
export type MusicAlbumUpdateInput = Partial<MusicAlbumInput>

export type MusicListResponse<T> = ApiList<T>

export type MusicRecommendationMode = 'hot' | 'featured' | 'discover'

export type MusicRecommendationItem = {
  id: string
  title: string
  summary?: string
  image_url?: string
  target_path: string
  score_label?: string
}

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
  tracks?: MusicAlbumTrackEditInput[]
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
  artistBookmarks: () => `${API_V1_BASE}/music/bookmarks/artists`,
  artistBookmark: (artistId: string) => `${API_V1_BASE}/music/bookmarks/artists/${artistId}`,
  albumBookmarks: () => `${API_V1_BASE}/music/bookmarks/albums`,
  albumBookmark: (albumId: string) => `${API_V1_BASE}/music/bookmarks/albums/${albumId}`,
  songBookmarks: () => `${API_V1_BASE}/music/bookmarks/songs`,
  songBookmark: (songId: string) => `${API_V1_BASE}/music/bookmarks/songs/${songId}`,
  playlists: () => `${API_V1_BASE}/music/playlists`,
  playlist: (playlistId: string) => `${API_V1_BASE}/music/playlists/${playlistId}`,
  playlistSongs: (playlistId: string) => `${API_V1_BASE}/music/playlists/${playlistId}/songs`,
  playlistSong: (playlistId: string, songId: string) => `${API_V1_BASE}/music/playlists/${playlistId}/songs/${songId}`,
  albumRevisions: (albumId: string) => `${API_V1_BASE}/albums/${albumId}/revisions`,
  albumRevision: (albumId: string, version: number) => `${API_V1_BASE}/albums/${albumId}/revisions/${version}`,
  albumRevert: (albumId: string, version: number) => `${API_V1_BASE}/albums/${albumId}/revisions/${version}/revert`,
  albumDiscussions: (albumId: string) => `${API_V1_BASE}/albums/${albumId}/discussions`,
  albumDiscussion: (albumId: string, discussionId: string) => `${API_V1_BASE}/albums/${albumId}/discussions/${discussionId}`,
  albumImports: () => `${API_V1_BASE}/music/imports/albums`,
  albumImport: (importId: string) => `${API_V1_BASE}/music/imports/albums/${importId}`,
  albumImportArchive: (importId: string) => `${API_V1_BASE}/music/imports/albums/${importId}/upload`,
  albumImportCommit: (importId: string) => `${API_V1_BASE}/music/imports/albums/${importId}/commit`,
  recommendAlbums: (mode: MusicRecommendationMode) => `${API_V1_BASE}/music/recommend/albums?mode=${mode}`,
  recommendArtists: (mode: MusicRecommendationMode) => `${API_V1_BASE}/music/recommend/artists?mode=${mode}`,
  edits: () => `${API_V1_BASE}/music/edits`,
  edit: (editId: string) => `${API_V1_BASE}/music/edits/${editId}`,
  editVotes: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/votes`,
  editApprove: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/approve`,
  editReject: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/reject`,
  editCancel: (editId: string) => `${API_V1_BASE}/music/edits/${editId}/cancel`,
}

function albumPayloadFromDraft(draft: AlbumEditDraft): Record<string, unknown> {
  return {
    ...(draft.title !== undefined ? { title: draft.title } : {}),
    ...(draft.artist_ids !== undefined ? { artist_ids: draft.artist_ids } : {}),
    ...(draft.release_date !== undefined ? { release_date: draft.release_date } : {}),
    ...(draft.cover ? { cover_url: draft.cover.url, cover_key: draft.cover.key } : {}),
    ...(draft.description !== undefined ? { description: draft.description } : {}),
    ...(draft.album_type !== undefined ? { album_type: draft.album_type } : {}),
    ...(('tracks' in draft && Array.isArray((draft as AlbumEditDraft & { tracks?: MusicAlbumTrackEditInput[] }).tracks))
      ? { tracks: (draft as AlbumEditDraft & { tracks?: MusicAlbumTrackEditInput[] }).tracks }
      : {}),
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

export async function createMusicAlbumImport(input: CreateMusicAlbumImportInput = {}): Promise<MusicAlbumImport> {
  return apiPostJson<MusicAlbumImport>(musicV1Endpoints.albumImports(), input)
}

export async function getMusicAlbumImport(importId: string): Promise<MusicAlbumImport> {
  return apiGet<MusicAlbumImport>(musicV1Endpoints.albumImport(importId))
}

export async function commitMusicAlbumImport(
  importId: string,
  input: MusicAlbumImportCommitInput,
): Promise<MusicAlbumImport> {
  return apiPostJson<MusicAlbumImport>(musicV1Endpoints.albumImportCommit(importId), input)
}

export async function uploadMusicAlbumArchive(
  importId: string,
  file: File,
  options: UploadMusicAlbumArchiveOptions = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const form = new FormData()
    form.append('archive', file)

    const xhr = new XMLHttpRequest()
    const startedAt = Date.now()
    xhr.open('POST', musicV1Endpoints.albumImportArchive(importId))
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001)
      options.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        bytesPerSecond: event.loaded / elapsedSeconds,
      })
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }

      reject(new Error(`上传压缩包失败 (${xhr.status})`))
    })

    xhr.addEventListener('error', () => {
      reject(new Error('上传压缩包失败'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('上传已取消'))
    })

    xhr.send(form)
  })
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

export async function listArtistBookmarks() {
  return apiGetEnvelope<MusicArtistBookmark[], PaginationMeta>(musicV1Endpoints.artistBookmarks())
}

export async function createArtistBookmark(artistId: string): Promise<MusicArtistBookmark> {
  return apiPostJson<MusicArtistBookmark>(musicV1Endpoints.artistBookmarks(), { artist_id: artistId })
}

export async function deleteArtistBookmark(artistId: string): Promise<{ deleted: boolean }> {
  return apiDeleteJson<{ deleted: boolean }>(musicV1Endpoints.artistBookmark(artistId))
}

export async function listAlbumBookmarks() {
  return apiGetEnvelope<MusicAlbumBookmark[], PaginationMeta>(musicV1Endpoints.albumBookmarks())
}

export async function createAlbumBookmark(albumId: string): Promise<MusicAlbumBookmark> {
  return apiPostJson<MusicAlbumBookmark>(musicV1Endpoints.albumBookmarks(), { album_id: albumId })
}

export async function deleteAlbumBookmark(albumId: string): Promise<{ deleted: boolean }> {
  return apiDeleteJson<{ deleted: boolean }>(musicV1Endpoints.albumBookmark(albumId))
}

export async function listSongBookmarks() {
  return apiGetEnvelope<MusicSongBookmark[], PaginationMeta>(musicV1Endpoints.songBookmarks())
}

export async function listMusicPlaylists() {
  return apiGetEnvelope<MusicPlaylistSummary[], PaginationMeta>(musicV1Endpoints.playlists())
}

export async function listMusicStarred(): Promise<MusicStarredItem[]> {
  const [artistBookmarks, albumBookmarks, songBookmarks, playlists] = await Promise.all([
    listArtistBookmarks(),
    listAlbumBookmarks(),
    listSongBookmarks(),
    listMusicPlaylists(),
  ])

  const [artists, albums] = await Promise.all([
    Promise.all(artistBookmarks.data.map((bookmark: MusicArtistBookmark) => getMusicArtist(bookmark.artist_id))),
    Promise.all(albumBookmarks.data.map((bookmark: MusicAlbumBookmark) => getMusicAlbum(bookmark.album_id))),
  ])

  return [
    ...artistBookmarks.data.map((bookmark: MusicArtistBookmark, index: number) => ({
      id: bookmark.id,
      kind: 'artist' as const,
      starred_at: bookmark.created_at,
      artist: artists[index],
    })),
    ...albumBookmarks.data.map((bookmark: MusicAlbumBookmark, index: number) => ({
      id: bookmark.id,
      kind: 'album' as const,
      starred_at: bookmark.created_at,
      album: albums[index],
    })),
    ...songBookmarks.data.map((bookmark: MusicSongBookmark) => ({
      id: bookmark.id,
      kind: 'song' as const,
      starred_at: bookmark.created_at,
      song: bookmark.song,
    })),
    ...playlists.data.map((playlist: MusicPlaylistSummary) => ({
      id: playlist.id,
      kind: 'playlist' as const,
      starred_at: '',
      playlist,
    })),
  ]
}

export async function getMusicAlbum(albumId: string): Promise<MusicAlbumListItem> {
  return apiGet<MusicAlbumListItem>(musicV1Endpoints.album(albumId))
}

export async function createMusicPlaylist(input: CreateMusicPlaylistInput): Promise<MusicPlaylistDetail> {
  return apiPostJson<MusicPlaylistDetail>(musicV1Endpoints.playlists(), input)
}

export async function getMusicPlaylist(playlistId: string): Promise<MusicPlaylistDetail> {
  const [playlist, songsResponse] = await Promise.all([
    apiGet<MusicPlaylistSummary>(musicV1Endpoints.playlist(playlistId)),
    apiGetEnvelope<any[], PaginationMeta>(musicV1Endpoints.playlistSongs(playlistId)),
  ])
  return {
    ...playlist,
    songs: (songsResponse.data || []).map((item) => item.song).filter(Boolean),
  }
}

export async function addMusicPlaylistSong(playlistId: string, songId: string): Promise<any> {
  return apiPostJson<any>(musicV1Endpoints.playlistSongs(playlistId), { song_id: songId })
}

export async function removeMusicPlaylistSong(playlistId: string, songId: string): Promise<any> {
  return apiDeleteJson<any>(musicV1Endpoints.playlistSong(playlistId, songId))
}

export async function listAlbumRevisions(albumId: string): Promise<MusicRevisionSummary[]> {
  const response = await apiGetEnvelope<MusicRevisionSummary[]>(musicV1Endpoints.albumRevisions(albumId))
  return response.data
}

export async function getAlbumRevision(albumId: string, version: number): Promise<MusicRevisionSummary> {
  return apiGet<MusicRevisionSummary>(musicV1Endpoints.albumRevision(albumId, version))
}

export async function revertAlbumRevision(albumId: string, version: number, editSummary: string): Promise<MusicRevisionSummary> {
  return apiPostJson<MusicRevisionSummary>(musicV1Endpoints.albumRevert(albumId, version), {
    edit_summary: editSummary,
  })
}

export async function listAlbumDiscussions(albumId: string): Promise<MusicDiscussion[]> {
  const response = await apiGetEnvelope<MusicDiscussion[]>(musicV1Endpoints.albumDiscussions(albumId))
  return response.data
}

export async function createAlbumDiscussion(albumId: string, content: string): Promise<MusicDiscussion> {
  return apiPostJson<MusicDiscussion>(musicV1Endpoints.albumDiscussions(albumId), { content })
}

export async function replyAlbumDiscussion(albumId: string, discussionId: string, content: string): Promise<MusicDiscussion> {
  return apiPostJson<MusicDiscussion>(musicV1Endpoints.albumDiscussion(albumId, discussionId), { content })
}

export async function deleteAlbumDiscussion(albumId: string, discussionId: string): Promise<{ success: boolean }> {
  return apiDeleteJson<{ success: boolean }>(musicV1Endpoints.albumDiscussion(albumId, discussionId))
}

export async function listRecommendedAlbums(mode: MusicRecommendationMode) {
  return apiGetEnvelope<MusicRecommendationItem[]>(musicV1Endpoints.recommendAlbums(mode))
}

export async function listRecommendedArtists(mode: MusicRecommendationMode) {
  return apiGetEnvelope<MusicRecommendationItem[]>(musicV1Endpoints.recommendArtists(mode))
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

export async function createMusicArtist(input: MusicArtistInput): Promise<MusicArtistListItem> {
  return apiPostJson<MusicArtistListItem>(musicV1Endpoints.artists(), input)
}

export async function updateMusicArtist(artistId: string, input: MusicArtistUpdateInput): Promise<MusicArtistListItem> {
  return apiPatchJson<MusicArtistListItem>(musicV1Endpoints.artist(artistId), input)
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
