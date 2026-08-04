import { useApiUrl } from "@/composables/useApi";
import type { ApiSuccess, PaginationMeta } from "../types";
import type {
  MusicBrowseMode,
  MusicListFilters,
  MusicListResponse,
  MusicRecommendationMode,
} from "./types";

type PaginationFallbackFilters = Pick<MusicListFilters, "page" | "page_size">;

export function listResponseWithPaginationFallback<T>(
  response: ApiSuccess<T[], PaginationMeta>,
  filters: PaginationFallbackFilters = {},
): MusicListResponse<T> {
  return {
    data: response.data,
    meta: response.meta ?? {
      page: filters.page ?? 1,
      page_size: filters.page_size ?? response.data.length,
      total: response.data.length,
      has_more: false,
    },
  };
}

function apiV1Base() {
  return useApiUrl();
}

export function queryString(
  filters: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export const musicV1Endpoints = {
  uploads: () => `${apiV1Base()}/uploads`,
  artists: () => `${apiV1Base()}/music/artists`,
  artist: (artistId: string) => `${apiV1Base()}/music/artists/${artistId}`,
  artistMerge: (artistId: string) =>
    `${apiV1Base()}/admin/artists/${artistId}/merge`,
  artistRevisions: (artistId: string) =>
    `${apiV1Base()}/artists/${artistId}/revisions`,
  artistRevision: (artistId: string, version: number) =>
    `${apiV1Base()}/artists/${artistId}/revisions/${version}`,
  albums: () => `${apiV1Base()}/music/albums`,
  songs: () => `${apiV1Base()}/songs`,
  search: () => `${apiV1Base()}/music/search`,
  songDetail: (songId: string) => `${apiV1Base()}/music/songs/${songId}`,
  library: () => `${apiV1Base()}/music/library`,
  laterPlaylistSong: (songId: string) =>
    `${apiV1Base()}/music/playlists/later/${songId}`,
  album: (albumId: string) => `${apiV1Base()}/music/albums/${albumId}`,
  albumMerge: (albumId: string) =>
    `${apiV1Base()}/music/albums/${albumId}/merge`,
  songLyrics: (songId: string) => `${apiV1Base()}/music/songs/${songId}/lyrics`,
  lyricAnnotations: (songId: string) =>
    `${apiV1Base()}/music/songs/${songId}/lyrics/annotations`,
  lyricAnnotation: (songId: string, annotationId: string) =>
    `${apiV1Base()}/music/songs/${songId}/lyrics/annotations/${annotationId}`,
  lyricAnnotationVote: (songId: string, annotationId: string) =>
    `${apiV1Base()}/music/songs/${songId}/lyrics/annotations/${annotationId}/votes`,
  pendingLyricAnnotations: () =>
    `${apiV1Base()}/music/lyrics/annotations/pending`,
  songLyricsVersions: (songId: string) =>
    `${apiV1Base()}/music/songs/${songId}/lyrics/versions`,
  songLyricsVersionRevert: (songId: string, version: number) =>
    `${apiV1Base()}/music/songs/${songId}/lyrics/versions/${version}/revert`,
  artistBookmarks: () => `${apiV1Base()}/music/bookmarks/artists`,
  artistBookmark: (artistId: string) =>
    `${apiV1Base()}/music/bookmarks/artists/${artistId}`,
  albumBookmarks: () => `${apiV1Base()}/music/bookmarks/albums`,
  albumBookmark: (albumId: string) =>
    `${apiV1Base()}/music/bookmarks/albums/${albumId}`,
  songBookmarks: () => `${apiV1Base()}/music/bookmarks/songs`,
  songBookmark: (songId: string) =>
    `${apiV1Base()}/music/bookmarks/songs/${songId}`,
  playlistBookmarks: () => `${apiV1Base()}/music/bookmarks/playlists`,
  playlistBookmark: (playlistId: string) =>
    `${apiV1Base()}/music/bookmarks/playlists/${playlistId}`,
  playlists: () => `${apiV1Base()}/music/playlists`,
  playlist: (playlistId: string) =>
    `${apiV1Base()}/music/playlists/${playlistId}`,
  playlistSongs: (playlistId: string) =>
    `${apiV1Base()}/music/playlists/${playlistId}/songs`,
  playlistSongsOrder: (playlistId: string) =>
    `${apiV1Base()}/music/playlists/${playlistId}/songs/order`,
  playlistSong: (playlistId: string, songId: string) =>
    `${apiV1Base()}/music/playlists/${playlistId}/songs/${songId}`,
  plays: () => `${apiV1Base()}/music/plays`,
  history: () => `${apiV1Base()}/music/history`,
  home: () => `${apiV1Base()}/music/home`,
  albumRevisions: (albumId: string) =>
    `${apiV1Base()}/albums/${albumId}/revisions`,
  albumRevision: (albumId: string, version: number) =>
    `${apiV1Base()}/albums/${albumId}/revisions/${version}`,
  albumRevert: (albumId: string, version: number) =>
    `${apiV1Base()}/albums/${albumId}/revisions/${version}/revert`,
  albumDiscussions: (albumId: string) =>
    `${apiV1Base()}/discussions/music_album/${albumId}/comments`,
  albumDiscussion: (_albumId: string, discussionId: string) =>
    `${apiV1Base()}/comments/${discussionId}`,
  albumDiscussionReply: (_albumId: string, discussionId: string) =>
    `${apiV1Base()}/comments/${discussionId}`,
  albumImports: () => `${apiV1Base()}/music/imports/albums`,
  albumImport: (importId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}`,
  albumImportArchive: (importId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/upload`,
  albumImportMultipart: (importId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/multipart`,
  albumImportMultipartPart: (importId: string, partNumber: number) =>
    `${apiV1Base()}/music/imports/albums/${importId}/multipart/parts/${partNumber}`,
  albumImportMultipartPartComplete: (importId: string, partNumber: number) =>
    `${apiV1Base()}/music/imports/albums/${importId}/multipart/parts/${partNumber}/complete`,
  albumImportMultipartComplete: (importId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/multipart/complete`,
  albumImportFiles: (importId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/files`,
  albumImportFilePart: (importId: string, fileId: string, partNumber: number) =>
    `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/parts/${partNumber}`,
  albumImportFilePartComplete: (
    importId: string,
    fileId: string,
    partNumber: number,
  ) =>
    `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/parts/${partNumber}/complete`,
  albumImportFileComplete: (importId: string, fileId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/complete`,
  albumImportFileRetry: (importId: string, fileId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/retry`,
  albumImportFileReplace: (importId: string, fileId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}/replace`,
  albumImportFileDelete: (importId: string, fileId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/files/${fileId}`,
  albumImportSessionComplete: (importId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/complete`,
  albumImportSessionCancel: (importId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}`,
  albumImportCommit: (importId: string) =>
    `${apiV1Base()}/music/imports/albums/${importId}/commit`,
  discover: (mode?: MusicBrowseMode) =>
    `${apiV1Base()}/music/discover${mode ? `?mode=${mode}` : ""}`,
  recommendAlbums: (mode: MusicRecommendationMode) =>
    `${apiV1Base()}/music/recommend/albums?mode=${mode}`,
  recommendArtists: (mode: MusicRecommendationMode) =>
    `${apiV1Base()}/music/recommend/artists?mode=${mode}`,
  edits: () => `${apiV1Base()}/music/edits`,
  edit: (editId: string) => `${apiV1Base()}/music/edits/${editId}`,
  editVotes: (editId: string) => `${apiV1Base()}/music/edits/${editId}/votes`,
  editApprove: (editId: string) =>
    `${apiV1Base()}/music/edits/${editId}/approve`,
  editReject: (editId: string) => `${apiV1Base()}/music/edits/${editId}/reject`,
  editCancel: (editId: string) => `${apiV1Base()}/music/edits/${editId}/cancel`,
};
