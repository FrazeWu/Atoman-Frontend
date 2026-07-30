import {
  ApiErrorResponseError,
  apiDeleteJson,
  apiGet,
  apiGetEnvelope,
  apiPatchJson,
  apiPostJson,
  apiPutJson,
} from '../client'
import { commentApi, type CommentDTO } from '../comments'
import type { PaginationMeta } from '../types'
import { listResponseWithPaginationFallback, musicV1Endpoints, queryString } from './core'
import type {
  CreateMusicLyricsAnnotationInput,
  CreateMusicPlaylistInput,
  MusicAlbumBookmark,
  MusicAlbumListItem,
  MusicArtistBookmark,
  MusicArtistInput,
  MusicArtistListItem,
  MusicArtistUpdateInput,
  MusicBrowseMode,
  MusicDiscoverItem,
  MusicDiscussion,
  MusicEditFilters,
  MusicEditRequest,
  MusicEditSummary,
  MusicListFilters,
  MusicListResponse,
  MusicListeningHistory,
  MusicLyricsAnnotation,
  MusicLyricsAnnotationVote,
  MusicPlaylistBookmark,
  MusicPlaylistDetail,
  MusicPlaylistSummary,
  MusicRecommendationItem,
  MusicRecommendationMode,
  MusicRevisionSummary,
  MusicSongBookmark,
  MusicSongListItem,
  MusicSongLyrics,
  MusicSongLyricsVersion,
  MusicStarredItem,
  PendingMusicLyricsAnnotation,
  UpdateMusicLyricsAnnotationInput,
  UpdateMusicPlaylistInput,
  UpdateMusicSongLyricsInput,
} from './types'

type MusicPlaylistSongEnvelope = {
  song?: MusicSongListItem
}

type MusicPlaylistMutationResult = Record<string, unknown>

export async function listMusicAlbums(filters: MusicListFilters = {}): Promise<MusicListResponse<MusicAlbumListItem>> {
  const response = await apiGetEnvelope<MusicAlbumListItem[], PaginationMeta>(`${musicV1Endpoints.albums()}${queryString(filters)}`)
  return listResponseWithPaginationFallback(response, filters)
}

export async function listArtistBookmarks(filters: Pick<MusicListFilters, 'sort' | 'page' | 'page_size'> = {}) {
  return apiGetEnvelope<MusicArtistBookmark[], PaginationMeta>(`${musicV1Endpoints.artistBookmarks()}${queryString(filters)}`)
}

export async function createArtistBookmark(artistId: string): Promise<MusicArtistBookmark> {
  return apiPostJson<MusicArtistBookmark>(musicV1Endpoints.artistBookmarks(), { artist_id: artistId })
}

export async function deleteArtistBookmark(artistId: string): Promise<{ deleted: boolean }> {
  return apiDeleteJson<{ deleted: boolean }>(musicV1Endpoints.artistBookmark(artistId))
}

export async function listAlbumBookmarks(filters: Pick<MusicListFilters, 'sort' | 'page' | 'page_size'> = {}) {
  return apiGetEnvelope<MusicAlbumBookmark[], PaginationMeta>(`${musicV1Endpoints.albumBookmarks()}${queryString(filters)}`)
}

export async function createAlbumBookmark(albumId: string): Promise<MusicAlbumBookmark> {
  return apiPostJson<MusicAlbumBookmark>(musicV1Endpoints.albumBookmarks(), { album_id: albumId })
}

export async function deleteAlbumBookmark(albumId: string): Promise<{ deleted: boolean }> {
  return apiDeleteJson<{ deleted: boolean }>(musicV1Endpoints.albumBookmark(albumId))
}

export async function listSongBookmarks(filters: Pick<MusicListFilters, 'sort' | 'page' | 'page_size'> = {}) {
  return apiGetEnvelope<MusicSongBookmark[], PaginationMeta>(`${musicV1Endpoints.songBookmarks()}${queryString(filters)}`)
}

export async function listPlaylistBookmarks(filters: Pick<MusicListFilters, 'sort' | 'page' | 'page_size'> = {}) {
  return apiGetEnvelope<MusicPlaylistBookmark[], PaginationMeta>(`${musicV1Endpoints.playlistBookmarks()}${queryString(filters)}`)
}

export async function createPlaylistBookmark(playlistId: string): Promise<MusicPlaylistBookmark> {
  return apiPostJson<MusicPlaylistBookmark>(musicV1Endpoints.playlistBookmarks(), { playlist_id: playlistId })
}

export async function deletePlaylistBookmark(playlistId: string): Promise<{ deleted: boolean }> {
  return apiDeleteJson<{ deleted: boolean }>(musicV1Endpoints.playlistBookmark(playlistId))
}

export async function listMusicPlaylists(filters: Pick<MusicListFilters, 'sort' | 'page' | 'page_size'> = {}) {
  return apiGetEnvelope<MusicPlaylistSummary[], PaginationMeta>(`${musicV1Endpoints.playlists()}${queryString(filters)}`)
}

export async function listPublicMusicPlaylists(filters: Pick<MusicListFilters, 'page' | 'page_size'> = {}) {
  return apiGetEnvelope<MusicPlaylistSummary[], PaginationMeta>(`${musicV1Endpoints.playlists()}/public${queryString(filters)}`)
}

export async function listMusicStarred(): Promise<MusicStarredItem[]> {
  const [artistBookmarks, albumBookmarks, songBookmarks, playlistBookmarks] = await Promise.all([
    listArtistBookmarks(),
    listAlbumBookmarks(),
    listSongBookmarks(),
    listPlaylistBookmarks(),
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
    ...playlistBookmarks.data.map((bookmark: MusicPlaylistBookmark) => ({
      id: bookmark.id,
      kind: 'playlist' as const,
      starred_at: bookmark.created_at,
      playlist: bookmark.playlist,
    })),
  ]
}

export async function getMusicAlbum(albumId: string): Promise<MusicAlbumListItem> {
  return apiGet<MusicAlbumListItem>(musicV1Endpoints.album(albumId))
}

export async function createMusicPlaylist(input: CreateMusicPlaylistInput): Promise<MusicPlaylistDetail> {
  return apiPostJson<MusicPlaylistDetail>(musicV1Endpoints.playlists(), input)
}

export async function updateMusicPlaylist(playlistId: string, input: UpdateMusicPlaylistInput): Promise<MusicPlaylistDetail> {
  try {
    return await apiPatchJson<MusicPlaylistDetail>(musicV1Endpoints.playlist(playlistId), input)
  } catch (error) {
    const shouldRetryWithBearer = (
      error instanceof ApiErrorResponseError
      && error.status === 404
      && typeof window !== 'undefined'
    )
    if (!shouldRetryWithBearer) throw error

    const absoluteUrl = new URL(musicV1Endpoints.playlist(playlistId), window.location.origin).toString()
    return apiPatchJson<MusicPlaylistDetail>(absoluteUrl, input)
  }
}

export async function deleteMusicPlaylist(playlistId: string): Promise<{ deleted: boolean }> {
  return apiDeleteJson<{ deleted: boolean }>(musicV1Endpoints.playlist(playlistId))
}

export async function getMusicPlaylist(playlistId: string): Promise<MusicPlaylistDetail> {
  const [playlist, songsResponse] = await Promise.all([
    apiGet<MusicPlaylistSummary>(musicV1Endpoints.playlist(playlistId)),
    apiGetEnvelope<MusicPlaylistSongEnvelope[], PaginationMeta>(musicV1Endpoints.playlistSongs(playlistId)),
  ])
  return {
    ...playlist,
    songs: (songsResponse.data || [])
      .map((item) => item.song)
      .filter(Boolean)
      .map((song) => ({
        ...song,
        cover_url: song.cover_url || song.album?.cover_url || '',
      })),
  }
}

export async function addMusicPlaylistSong(playlistId: string, songId: string): Promise<MusicPlaylistMutationResult> {
  return apiPostJson<MusicPlaylistMutationResult>(musicV1Endpoints.playlistSongs(playlistId), { song_id: songId })
}

export async function removeMusicPlaylistSong(playlistId: string, songId: string): Promise<MusicPlaylistMutationResult> {
  return apiDeleteJson<MusicPlaylistMutationResult>(musicV1Endpoints.playlistSong(playlistId, songId))
}

export async function reorderMusicPlaylistSongs(playlistId: string, songIds: string[]): Promise<{ reordered: boolean }> {
  return apiPutJson<{ reordered: boolean }>(musicV1Endpoints.playlistSongsOrder(playlistId), { song_ids: songIds })
}

export async function recordMusicSongPlay(songId: string): Promise<{ recorded: boolean }> {
  return apiPostJson<{ recorded: boolean }>(musicV1Endpoints.plays(), { song_id: songId })
}

export async function listMusicListeningHistory(
  filters: Pick<MusicListFilters, 'page' | 'page_size'> = {},
): Promise<MusicListResponse<MusicListeningHistory>> {
  const response = await apiGetEnvelope<MusicListeningHistory[], PaginationMeta>(`${musicV1Endpoints.history()}${queryString(filters)}`)
  return listResponseWithPaginationFallback(response, filters)
}

export async function getMusicSongLyrics(songId: string): Promise<MusicSongLyrics> {
  return apiGet<MusicSongLyrics>(musicV1Endpoints.songLyrics(songId))
}

export async function listPendingMusicLyricsAnnotations(): Promise<PendingMusicLyricsAnnotation[]> {
  const response = await apiGetEnvelope<PendingMusicLyricsAnnotation[]>(musicV1Endpoints.pendingLyricAnnotations())
  return response.data
}

export async function updateMusicSongLyrics(songId: string, input: UpdateMusicSongLyricsInput): Promise<MusicSongLyrics> {
  return apiPutJson<MusicSongLyrics>(musicV1Endpoints.songLyrics(songId), input)
}

export async function createMusicLyricsAnnotation(songId: string, input: CreateMusicLyricsAnnotationInput): Promise<MusicLyricsAnnotation> {
  return apiPostJson<MusicLyricsAnnotation>(musicV1Endpoints.lyricAnnotations(songId), input)
}

export async function updateMusicLyricsAnnotation(songId: string, annotationId: string, input: UpdateMusicLyricsAnnotationInput): Promise<MusicLyricsAnnotation> {
  return apiPatchJson<MusicLyricsAnnotation>(musicV1Endpoints.lyricAnnotation(songId, annotationId), input)
}

export async function deleteMusicLyricsAnnotation(songId: string, annotationId: string): Promise<{ deleted: boolean }> {
  return apiDeleteJson<{ deleted: boolean }>(musicV1Endpoints.lyricAnnotation(songId, annotationId))
}

export async function voteMusicLyricsAnnotation(
  songId: string,
  annotationId: string,
  vote: MusicLyricsAnnotationVote | null,
): Promise<MusicLyricsAnnotation> {
  return apiPostJson<MusicLyricsAnnotation>(musicV1Endpoints.lyricAnnotationVote(songId, annotationId), { vote: vote ?? 'none' })
}

export async function listMusicSongLyricsVersions(songId: string): Promise<MusicSongLyricsVersion[]> {
  const response = await apiGetEnvelope<MusicSongLyricsVersion[]>(musicV1Endpoints.songLyricsVersions(songId))
  return response.data
}

export async function revertMusicSongLyricsVersion(songId: string, version: number, editSummary: string): Promise<MusicSongLyrics> {
  return apiPostJson<MusicSongLyrics>(musicV1Endpoints.songLyricsVersionRevert(songId, version), {
    edit_summary: editSummary,
  })
}

export async function listAlbumRevisions(albumId: string): Promise<MusicRevisionSummary[]> {
  const response = await apiGetEnvelope<MusicRevisionSummary[]>(musicV1Endpoints.albumRevisions(albumId))
  return response.data
}

export async function listArtistRevisions(artistId: string): Promise<MusicRevisionSummary[]> {
  const response = await apiGetEnvelope<MusicRevisionSummary[]>(musicV1Endpoints.artistRevisions(artistId))
  return response.data
}

export async function getArtistRevision(artistId: string, version: number): Promise<MusicRevisionSummary> {
  return apiGet<MusicRevisionSummary>(musicV1Endpoints.artistRevision(artistId, version))
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
  const response = await commentApi.listRoots({ kind: 'music_album', resourceId: albumId })
  return response.items.map((comment) => musicDiscussionFromComment(comment, albumId))
}

export async function createAlbumDiscussion(albumId: string, content: string): Promise<MusicDiscussion> {
  const comment = await commentApi.create({ kind: 'music_album', resourceId: albumId }, {
    content,
    mentions: [],
    attachment_ids: [],
  })
  return musicDiscussionFromComment(comment, albumId)
}

export async function replyAlbumDiscussion(albumId: string, discussionId: string, content: string): Promise<MusicDiscussion> {
  const comment = await commentApi.create({ kind: 'music_album', resourceId: albumId }, {
    content,
    reply_to_id: discussionId,
    mentions: [],
    attachment_ids: [],
  })
  return musicDiscussionFromComment(comment, albumId)
}

export async function deleteAlbumDiscussion(albumId: string, discussionId: string): Promise<{ success: boolean }> {
  void albumId
  const result = await commentApi.delete(discussionId)
  return { success: result.ok }
}

function musicDiscussionFromComment(comment: CommentDTO, albumId: string): MusicDiscussion {
  return {
    id: comment.id,
    album_id: albumId,
    parent_id: comment.reply_to_id ?? comment.root_id ?? null,
    content: comment.content,
    created_at: comment.created_at,
    updated_at: comment.edited_at ?? undefined,
    author_id: comment.author_id,
    author: comment.author ? {
      id: comment.author.id,
      username: comment.author.username,
      display_name: comment.author.display_name,
    } : undefined,
    replies: comment.replies?.map((reply) => musicDiscussionFromComment(reply, albumId)) ?? [],
    can_delete: true,
  }
}

export async function listRecommendedAlbums(mode: MusicRecommendationMode) {
  return apiGetEnvelope<MusicRecommendationItem[]>(musicV1Endpoints.recommendAlbums(mode))
}

export async function listMusicDiscoverFeed(mode?: MusicBrowseMode) {
  return apiGetEnvelope<MusicDiscoverItem[], PaginationMeta>(musicV1Endpoints.discover(mode))
}

export async function listRecommendedArtists(mode: MusicRecommendationMode) {
  return apiGetEnvelope<MusicRecommendationItem[]>(musicV1Endpoints.recommendArtists(mode))
}

export async function listMusicArtists(filters: MusicListFilters = {}): Promise<MusicListResponse<MusicArtistListItem>> {
  const response = await apiGetEnvelope<MusicArtistListItem[], PaginationMeta>(`${musicV1Endpoints.artists()}${queryString(filters)}`)
  return listResponseWithPaginationFallback(response, filters)
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

export async function mergeMusicArtists(targetArtistId: string, sourceArtistId: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.artistMerge(targetArtistId), {
    source_id: sourceArtistId,
  })
}

export async function mergeMusicAlbums(targetAlbumId: string, sourceAlbumId: string): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.albumMerge(targetAlbumId), {
    source_album_id: sourceAlbumId,
  })
}

export async function submitMusicEdit(request: MusicEditRequest): Promise<MusicEditSummary> {
  return apiPostJson<MusicEditSummary>(musicV1Endpoints.edits(), request)
}

export async function listMusicEdits(filters: MusicEditFilters = {}): Promise<MusicListResponse<MusicEditSummary>> {
  const response = await apiGetEnvelope<MusicEditSummary[], PaginationMeta>(`${musicV1Endpoints.edits()}${queryString(filters)}`)
  return listResponseWithPaginationFallback(response, filters)
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
