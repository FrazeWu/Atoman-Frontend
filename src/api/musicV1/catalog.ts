import {
	apiDeleteJson,
	apiGet,
	apiGetEnvelope,
	apiPatchJson,
	apiPostJson,
	apiPutJson,
} from "../client";
import { commentApi, type CommentDTO } from "../comments";
import type { PaginationMeta } from "../types";
import {
	listResponseWithPaginationFallback,
	musicV1Endpoints,
	queryString,
} from "./core";
import { useQueryCache } from "@/composables/useQueryCache";
import type {
	CreateMusicLyricsAnnotationInput,
	CreateMusicPlaylistInput,
	MusicAlbumBookmark,
	MusicAlbumLinkSuggestions,
	MusicAlbumListItem,
	MusicAlbumMergePreview,
	MusicArtistBookmark,
	MusicArtistInput,
	MusicArtistListItem,
	MusicDiscussion,
	MusicEditStatus,
	MusicEntryStateRequest,
	MusicStateRequestAction,
	MusicContributor,
	MusicContributorList,
	MusicHome,
	MusicListFilters,
	MusicListResponse,
	MusicListeningHistory,
	MusicPlaybackProgress,
	MusicPlaybackSession,
	SaveMusicPlaybackProgressInput,
	SaveMusicPlaybackSessionInput,
	MusicLyricsAnnotation,
	MusicLyricsAnnotationVote,
	MusicPlaylistBookmark,
	MusicPlaylistDetail,
	MusicPlaylistSummary,
	MusicRecommendationItem,
	MusicRecommendationEventsInput,
	MusicRecommendationMode,
	MusicRevisionSummary,
	MusicRevisionPage,
	MusicSearchResults,
	MusicSearchKind,
	MusicSongDetail,
	MusicSongRatingSummary,
	MusicAlbumRatingSummary,
	MusicSongListItem,
	MusicStandaloneSongType,
	MusicSongLyrics,
	MusicSongLyricsVersion,
	MusicStarredItem,
	PendingMusicLyricsAnnotation,
	UpdateMusicLyricsAnnotationInput,
	UpdateMusicPlaylistInput,
	UpdateMusicSongLyricsInput,
} from "./types";

type MusicPlaylistSongEnvelope = {
	song?: MusicSongListItem;
};

type MusicPlaylistMutationResult = Record<string, unknown>;

const queryCache = useQueryCache();

export type MusicSongSearchResult = {
	id: string;
	title: string;
	artist: string;
	album: string;
	album_id?: string;
	audio_url: string;
	cover_url?: string;
};

export async function searchMusicSongs(
	query: string,
): Promise<MusicSongSearchResult[]> {
	return apiGet<MusicSongSearchResult[]>(
		`${musicV1Endpoints.songs()}${queryString({ q: query })}`,
	);
}

export async function searchMusic(
	query: string,
	options: {
		type?: MusicSearchKind;
		page?: number;
		page_size?: number;
		signal?: AbortSignal;
	} = {},
): Promise<MusicSearchResults> {
	return apiGet<MusicSearchResults>(
		`${musicV1Endpoints.search()}${queryString({ q: query, type: options.type, page: options.page, page_size: options.page_size })}`,
		{ signal: options.signal },
	);
}

export async function recordMusicSearchInteraction(input: {
	query: string;
	entity_type: MusicSearchKind;
	entity_id: string;
}): Promise<void> {
	await apiPostJson<void>(musicV1Endpoints.searchInteractions(), input);
}

export async function getMusicSongDetail(
	songId: string,
): Promise<MusicSongDetail> {
	return apiGet<MusicSongDetail>(musicV1Endpoints.songDetail(songId));
}

export async function setMusicAlbumRating(
	albumId: string,
	score: number,
): Promise<MusicAlbumRatingSummary> {
	return apiPutJson<MusicAlbumRatingSummary>(
		musicV1Endpoints.albumRating(albumId),
		{ score },
	);
}

export async function deleteMusicAlbumRating(
	albumId: string,
): Promise<MusicAlbumRatingSummary> {
	return apiDeleteJson<MusicAlbumRatingSummary>(
		musicV1Endpoints.albumRating(albumId),
	);
}

export async function setMusicSongRating(
	songId: string,
	score: number,
): Promise<MusicSongRatingSummary> {
	return apiPutJson<MusicSongRatingSummary>(
		musicV1Endpoints.songRating(songId),
		{ score },
	);
}

export async function deleteMusicSongRating(
	songId: string,
): Promise<MusicSongRatingSummary> {
	return apiDeleteJson<MusicSongRatingSummary>(
		musicV1Endpoints.songRating(songId),
	);
}

export async function queueMusicSongAudioReplacement(
	songId: string,
	input: { asset_id: string },
) {
	return apiPostJson<{ id: string; song_id: string; status: string }>(
		musicV1Endpoints.songAudioReplacements(songId),
		input,
	);
}

export async function createMusicEntryStateRequest(
	entityType: "artist" | "album" | "song",
	entityId: string,
	input: { action: MusicStateRequestAction; reason: string },
) {
	return apiPostJson<MusicEntryStateRequest>(
		musicV1Endpoints.musicEntryStateRequests(entityType, entityId),
		input,
	);
}

export async function listMusicEntryStateRequests(
	filters: {
		entity_type?: "artist" | "album" | "song";
		entity_id?: string;
		status?: string;
	} = {},
) {
	return apiGet<MusicEntryStateRequest[]>(
		`${musicV1Endpoints.musicStateRequests()}${queryString(filters)}`,
	);
}

export async function reviewMusicEntryStateRequest(
	requestId: string,
	decision: "approved" | "rejected",
	reason: string,
) {
	return apiPostJson<MusicEntryStateRequest>(
		musicV1Endpoints.musicStateRequestDecision(requestId),
		{ decision, reason },
	);
}

export async function cancelMusicEntryStateRequest(requestId: string) {
	return apiDeleteJson<void>(musicV1Endpoints.musicStateRequest(requestId));
}

export async function setEmergencyMusicEntryState(
	entityType: "artist" | "album" | "song",
	entityId: string,
	status: MusicEditStatus,
	reason: string,
) {
	return apiPostJson<void>(
		musicV1Endpoints.musicEntryEmergencyState(entityType, entityId),
		{ status, reason },
	);
}

export async function addMusicSongToLater(
	songId: string,
): Promise<{ playlist_id: string; added: boolean }> {
	return apiPostJson<{ playlist_id: string; added: boolean }>(
		musicV1Endpoints.laterPlaylistSong(songId),
		{},
	);
}

export async function removeMusicSongFromLater(
	songId: string,
): Promise<{ deleted: boolean }> {
	return apiDeleteJson<{ deleted: boolean }>(
		musicV1Endpoints.laterPlaylistSong(songId),
	);
}

export async function getMusicSong(
	songId: string,
): Promise<MusicSongSearchResult> {
	return apiGet<MusicSongSearchResult>(`${musicV1Endpoints.songs()}/${songId}`);
}

export async function listMusicSongs(
	filters: {
		artist_id?: string;
		release_type?: MusicStandaloneSongType | "single,leak_song" | "single,leak";
		sort?: "-release_date" | "release_date" | "hot";
		page?: number;
		page_size?: number;
	} = {},
): Promise<MusicListResponse<MusicSongListItem>> {
	const response = await apiGetEnvelope<MusicSongListItem[], PaginationMeta>(
		`${musicV1Endpoints.songs()}${queryString(filters)}`,
	);
	return listResponseWithPaginationFallback(response, filters);
}

export async function listMusicAlbums(
	filters: MusicListFilters = {},
): Promise<MusicListResponse<MusicAlbumListItem>> {
	const response = await apiGetEnvelope<MusicAlbumListItem[], PaginationMeta>(
		`${musicV1Endpoints.albums()}${queryString(filters)}`,
	);
	return listResponseWithPaginationFallback(response, filters);
}

export async function listMusicAlbumLinkSuggestions(
	artistId: string,
): Promise<MusicAlbumLinkSuggestions> {
	return apiGet<MusicAlbumLinkSuggestions>(
		musicV1Endpoints.artistAlbumLinkSuggestions(artistId),
	);
}

export async function listArtistBookmarks(
	filters: Pick<MusicListFilters, "sort" | "page" | "page_size"> = {},
) {
	return apiGetEnvelope<MusicArtistBookmark[], PaginationMeta>(
		`${musicV1Endpoints.artistBookmarks()}${queryString(filters)}`,
	);
}

export async function createArtistBookmark(
	artistId: string,
): Promise<MusicArtistBookmark> {
	return apiPostJson<MusicArtistBookmark>(musicV1Endpoints.artistBookmarks(), {
		artist_id: artistId,
	});
}

export async function deleteArtistBookmark(
	artistId: string,
): Promise<{ deleted: boolean }> {
	return apiDeleteJson<{ deleted: boolean }>(
		musicV1Endpoints.artistBookmark(artistId),
	);
}

export async function listAlbumBookmarks(
	filters: Pick<MusicListFilters, "sort" | "page" | "page_size"> = {},
) {
	return apiGetEnvelope<MusicAlbumBookmark[], PaginationMeta>(
		`${musicV1Endpoints.albumBookmarks()}${queryString(filters)}`,
	);
}

export async function createAlbumBookmark(
	albumId: string,
): Promise<MusicAlbumBookmark> {
	return apiPostJson<MusicAlbumBookmark>(musicV1Endpoints.albumBookmarks(), {
		album_id: albumId,
	});
}

export async function deleteAlbumBookmark(
	albumId: string,
): Promise<{ deleted: boolean }> {
	return apiDeleteJson<{ deleted: boolean }>(
		musicV1Endpoints.albumBookmark(albumId),
	);
}

export async function listPlaylistBookmarks(
	filters: Pick<MusicListFilters, "sort" | "page" | "page_size"> = {},
) {
	return apiGetEnvelope<MusicPlaylistBookmark[], PaginationMeta>(
		`${musicV1Endpoints.playlistBookmarks()}${queryString(filters)}`,
	);
}

export async function createPlaylistBookmark(
	playlistId: string,
): Promise<MusicPlaylistBookmark> {
	return apiPostJson<MusicPlaylistBookmark>(
		musicV1Endpoints.playlistBookmarks(),
		{ playlist_id: playlistId },
	);
}

export async function deletePlaylistBookmark(
	playlistId: string,
): Promise<{ deleted: boolean }> {
	return apiDeleteJson<{ deleted: boolean }>(
		musicV1Endpoints.playlistBookmark(playlistId),
	);
}

export async function listMusicPlaylists(
	filters: Pick<MusicListFilters, "sort" | "page" | "page_size"> = {},
) {
	return apiGetEnvelope<MusicPlaylistSummary[], PaginationMeta>(
		`${musicV1Endpoints.playlists()}${queryString(filters)}`,
	);
}

export async function listPublicMusicPlaylists(
	filters: Pick<MusicListFilters, "page" | "page_size"> = {},
) {
	return apiGetEnvelope<MusicPlaylistSummary[], PaginationMeta>(
		`${musicV1Endpoints.playlists()}/public${queryString(filters)}`,
	);
}

export async function listMusicStarred(): Promise<MusicStarredItem[]> {
	const [artistBookmarks, albumBookmarks, playlistBookmarks] = await Promise.all(
		[listArtistBookmarks(), listAlbumBookmarks(), listPlaylistBookmarks()],
	);

	const [artists, albums] = await Promise.all([
		Promise.all(
			artistBookmarks.data.map((bookmark: MusicArtistBookmark) =>
				getMusicArtist(bookmark.artist_id),
			),
		),
		Promise.all(
			albumBookmarks.data.map((bookmark: MusicAlbumBookmark) =>
				getMusicAlbum(bookmark.album_id),
			),
		),
	]);

	return [
		...artistBookmarks.data.map(
			(bookmark: MusicArtistBookmark, index: number) => ({
				id: bookmark.id,
				kind: "artist" as const,
				starred_at: bookmark.created_at,
				artist: artists[index],
			}),
		),
		...albumBookmarks.data.map((bookmark: MusicAlbumBookmark, index: number) => ({
			id: bookmark.id,
			kind: "album" as const,
			starred_at: bookmark.created_at,
			album: albums[index],
		})),
		...playlistBookmarks.data.map((bookmark: MusicPlaylistBookmark) => ({
			id: bookmark.id,
			kind: "playlist" as const,
			starred_at: bookmark.created_at,
			playlist: bookmark.playlist,
		})),
	];
}

export async function getMusicAlbum(
	albumId: string,
	options?: { force?: boolean },
): Promise<MusicAlbumListItem> {
	return queryCache.fetchWithCache(
		`music:album:${albumId}`,
		() => apiGet<MusicAlbumListItem>(musicV1Endpoints.album(albumId)),
		options,
	);
}

export async function previewMusicAlbumMerge(
	targetAlbumId: string,
	sourceAlbumId: string,
) {
	return apiPostJson<MusicAlbumMergePreview>(
		musicV1Endpoints.albumMergePreview(targetAlbumId),
		{
			source_album_id: sourceAlbumId,
		},
	);
}

export async function mergeMusicAlbums(
	targetAlbumId: string,
	sourceAlbumId: string,
	matches: MusicAlbumMergePreview["matches"],
) {
	return apiPostJson<{ merged: boolean; redirect_to: string }>(
		musicV1Endpoints.albumMerge(targetAlbumId),
		{
			source_album_id: sourceAlbumId,
			confirmed: true,
			song_matches: matches.map((match) => ({
				source_song_id: match.source_song.id,
				target_song_id: match.target_song.id,
			})),
		},
	);
}

export async function mergeMusicArtists(
	targetArtistId: string,
	sourceArtistId: string,
) {
	return apiPostJson<{ message: string }>(
		musicV1Endpoints.artistMerge(targetArtistId),
		{ source_id: sourceArtistId },
	);
}

export async function createMusicPlaylist(
	input: CreateMusicPlaylistInput,
): Promise<MusicPlaylistDetail> {
	return apiPostJson<MusicPlaylistDetail>(musicV1Endpoints.playlists(), input);
}

export async function updateMusicPlaylist(
	playlistId: string,
	input: UpdateMusicPlaylistInput,
): Promise<MusicPlaylistDetail> {
	return apiPatchJson<MusicPlaylistDetail>(
		musicV1Endpoints.playlist(playlistId),
		input,
	);
}

export async function deleteMusicPlaylist(
	playlistId: string,
): Promise<{ deleted: boolean }> {
	return apiDeleteJson<{ deleted: boolean }>(
		musicV1Endpoints.playlist(playlistId),
	);
}

export async function getMusicPlaylist(
	playlistId: string,
): Promise<MusicPlaylistDetail> {
	const [playlist, songsResponse] = await Promise.all([
		apiGet<MusicPlaylistSummary>(musicV1Endpoints.playlist(playlistId)),
		listMusicPlaylistSongs(playlistId, { page: 1, page_size: 20 }),
	]);
	return {
		...playlist,
		songs: songsResponse.data,
	};
}

export async function listMusicPlaylistSongs(
	playlistId: string,
	filters: Pick<MusicListFilters, "page" | "page_size"> = {},
): Promise<MusicListResponse<MusicSongListItem>> {
	const response = await apiGetEnvelope<
		MusicPlaylistSongEnvelope[],
		PaginationMeta
	>(`${musicV1Endpoints.playlistSongs(playlistId)}${queryString(filters)}`);
	return listResponseWithPaginationFallback(
		{
			...response,
			data: (response.data || [])
				.map((item) => item.song)
				.filter((song): song is MusicSongListItem => Boolean(song))
				.map((song) => ({
					...song,
					cover_url: song.cover_url || song.album?.cover_url || "",
				})),
		},
		filters,
	);
}

export async function addMusicPlaylistSong(
	playlistId: string,
	songId: string,
): Promise<MusicPlaylistMutationResult> {
	return apiPostJson<MusicPlaylistMutationResult>(
		musicV1Endpoints.playlistSongs(playlistId),
		{ song_id: songId },
	);
}

export async function getMusicPlaylistSongStatus(
	playlistId: string,
	songIds: string[],
): Promise<string[]> {
	if (!songIds.length) return [];
	const response = await apiGet<{ song_ids: string[] }>(
		`${musicV1Endpoints.playlistSongStatus(playlistId)}${queryString({ song_ids: songIds.join(",") })}`,
	);
	return response.song_ids || [];
}

export async function removeMusicPlaylistSong(
	playlistId: string,
	songId: string,
): Promise<MusicPlaylistMutationResult> {
	return apiDeleteJson<MusicPlaylistMutationResult>(
		musicV1Endpoints.playlistSong(playlistId, songId),
	);
}

export async function reorderMusicPlaylistSongs(
	playlistId: string,
	songIds: string[],
): Promise<{ reordered: boolean }> {
	return apiPutJson<{ reordered: boolean }>(
		musicV1Endpoints.playlistSongsOrder(playlistId),
		{ song_ids: songIds },
	);
}

export async function recordMusicSongPlay(
	songId: string,
): Promise<{ recorded: boolean }> {
	return apiPostJson<{ recorded: boolean }>(musicV1Endpoints.plays(), {
		song_id: songId,
	});
}

export async function getMusicPlaybackProgress(): Promise<MusicPlaybackProgress | null> {
	return apiGet<MusicPlaybackProgress | null>(
		musicV1Endpoints.playbackProgress(),
	);
}

export async function saveMusicPlaybackProgress(
	input: SaveMusicPlaybackProgressInput,
): Promise<MusicPlaybackProgress> {
	return apiPutJson<MusicPlaybackProgress>(
		musicV1Endpoints.playbackProgress(),
		input,
	);
}

export async function getMusicPlaybackSession(): Promise<MusicPlaybackSession | null> {
	return apiGet<MusicPlaybackSession | null>(musicV1Endpoints.playbackSession());
}

export async function saveMusicPlaybackSession(
	input: SaveMusicPlaybackSessionInput,
): Promise<MusicPlaybackSession> {
	return apiPutJson<MusicPlaybackSession>(
		musicV1Endpoints.playbackSession(),
		input,
	);
}

export async function listMusicListeningHistory(
	filters: Pick<MusicListFilters, "page" | "page_size"> = {},
): Promise<MusicListResponse<MusicListeningHistory>> {
	const response = await apiGetEnvelope<MusicListeningHistory[], PaginationMeta>(
		`${musicV1Endpoints.history()}${queryString(filters)}`,
	);
	return listResponseWithPaginationFallback(response, filters);
}

export async function clearMusicListeningHistory(): Promise<void> {
	await apiDeleteJson<void>(musicV1Endpoints.history());
}

export async function listMusicLibrary<T>(
	kind: "album" | "artist" | "playlist" | "later",
	filters: Pick<MusicListFilters, "q" | "sort" | "page" | "page_size"> = {},
): Promise<MusicListResponse<T>> {
	const response = await apiGetEnvelope<T[], PaginationMeta>(
		`${musicV1Endpoints.library()}${queryString({ kind, ...filters })}`,
	);
	return listResponseWithPaginationFallback(response, filters);
}

export async function recordMusicRecommendationEvents(
	input: MusicRecommendationEventsInput,
): Promise<void> {
	await apiPostJson<void>(musicV1Endpoints.recommendationEvents(), input);
}

export async function getMusicHome(): Promise<MusicHome> {
	return apiGet<MusicHome>(musicV1Endpoints.home());
}

export async function getMusicSongLyrics(
	songId: string,
): Promise<MusicSongLyrics> {
	return apiGet<MusicSongLyrics>(musicV1Endpoints.songLyrics(songId));
}

export async function listPendingMusicLyricsAnnotations(): Promise<
	PendingMusicLyricsAnnotation[]
> {
	const response = await apiGetEnvelope<PendingMusicLyricsAnnotation[]>(
		musicV1Endpoints.pendingLyricAnnotations(),
	);
	return response.data;
}

export async function updateMusicSongLyrics(
	songId: string,
	input: UpdateMusicSongLyricsInput,
): Promise<MusicSongLyrics> {
	return apiPutJson<MusicSongLyrics>(musicV1Endpoints.songLyrics(songId), input);
}

export async function createMusicLyricsAnnotation(
	songId: string,
	input: CreateMusicLyricsAnnotationInput,
): Promise<MusicLyricsAnnotation> {
	return apiPostJson<MusicLyricsAnnotation>(
		musicV1Endpoints.lyricAnnotations(songId),
		input,
	);
}

export async function updateMusicLyricsAnnotation(
	songId: string,
	annotationId: string,
	input: UpdateMusicLyricsAnnotationInput,
): Promise<MusicLyricsAnnotation> {
	return apiPatchJson<MusicLyricsAnnotation>(
		musicV1Endpoints.lyricAnnotation(songId, annotationId),
		input,
	);
}

export async function deleteMusicLyricsAnnotation(
	songId: string,
	annotationId: string,
): Promise<{ deleted: boolean }> {
	return apiDeleteJson<{ deleted: boolean }>(
		musicV1Endpoints.lyricAnnotation(songId, annotationId),
	);
}

export async function voteMusicLyricsAnnotation(
	songId: string,
	annotationId: string,
	vote: MusicLyricsAnnotationVote | null,
): Promise<MusicLyricsAnnotation> {
	return apiPostJson<MusicLyricsAnnotation>(
		musicV1Endpoints.lyricAnnotationVote(songId, annotationId),
		{ vote: vote ?? "none" },
	);
}

export async function listMusicSongLyricsVersions(
	songId: string,
): Promise<MusicSongLyricsVersion[]> {
	const response = await apiGetEnvelope<MusicSongLyricsVersion[]>(
		musicV1Endpoints.songLyricsVersions(songId),
	);
	return response.data;
}

export async function revertMusicSongLyricsVersion(
	songId: string,
	version: number,
	editSummary: string,
): Promise<MusicSongLyrics> {
	return apiPostJson<MusicSongLyrics>(
		musicV1Endpoints.songLyricsVersionRevert(songId, version),
		{
			edit_summary: editSummary,
		},
	);
}

export async function listAlbumRevisions(
	albumId: string,
	options: { limit?: number; offset?: number } = {},
): Promise<MusicRevisionPage> {
	const response: {
		data: MusicRevisionSummary[];
		total?: number;
		limit?: number;
		offset?: number;
	} = await apiGetEnvelope<MusicRevisionSummary[]>(
		`${musicV1Endpoints.albumRevisions(albumId)}${queryString(options)}`,
	);
	return {
		data: response.data,
		total: response.total ?? response.data.length,
		limit: response.limit ?? options.limit ?? response.data.length,
		offset: response.offset ?? options.offset ?? 0,
	};
}

export async function listArtistRevisions(
	artistId: string,
	options: { limit?: number; offset?: number } = {},
): Promise<MusicRevisionPage> {
	const response: {
		data: MusicRevisionSummary[];
		total?: number;
		limit?: number;
		offset?: number;
	} = await apiGetEnvelope<MusicRevisionSummary[]>(
		`${musicV1Endpoints.artistRevisions(artistId)}${queryString(options)}`,
	);
	return {
		data: response.data,
		total: response.total ?? response.data.length,
		limit: response.limit ?? options.limit ?? response.data.length,
		offset: response.offset ?? options.offset ?? 0,
	};
}

export async function listSongRevisions(
	songId: string,
	options: { limit?: number; offset?: number } = {},
): Promise<MusicRevisionPage> {
	const response: {
		data: MusicRevisionSummary[];
		total?: number;
		limit?: number;
		offset?: number;
	} = await apiGetEnvelope<MusicRevisionSummary[]>(
		`${musicV1Endpoints.songRevisions(songId)}${queryString(options)}`,
	);
	return {
		data: response.data,
		total: response.total ?? response.data.length,
		limit: response.limit ?? options.limit ?? response.data.length,
		offset: response.offset ?? options.offset ?? 0,
	};
}

async function listRevisionContributors(
	url: string,
): Promise<MusicContributorList> {
	const response = await apiGetEnvelope<MusicContributor[], { total?: number }>(
		url,
	);
	return {
		data: response.data,
		total: response.meta?.total ?? response.data.length,
	};
}

export function listAlbumContributors(
	albumId: string,
): Promise<MusicContributorList> {
	return listRevisionContributors(musicV1Endpoints.albumContributors(albumId));
}

export function listArtistContributors(
	artistId: string,
): Promise<MusicContributorList> {
	return listRevisionContributors(musicV1Endpoints.artistContributors(artistId));
}

export async function getSongRevision(
	songId: string,
	version: number,
): Promise<MusicRevisionSummary> {
	return apiGet<MusicRevisionSummary>(
		musicV1Endpoints.songRevision(songId, version),
	);
}

export async function getArtistRevision(
	artistId: string,
	version: number,
): Promise<MusicRevisionSummary> {
	return apiGet<MusicRevisionSummary>(
		musicV1Endpoints.artistRevision(artistId, version),
	);
}

export async function getAlbumRevision(
	albumId: string,
	version: number,
): Promise<MusicRevisionSummary> {
	return apiGet<MusicRevisionSummary>(
		musicV1Endpoints.albumRevision(albumId, version),
	);
}

export async function revertAlbumRevision(
	albumId: string,
	version: number,
	editSummary: string,
): Promise<MusicRevisionSummary> {
	return apiPostJson<MusicRevisionSummary>(
		musicV1Endpoints.albumRevert(albumId, version),
		{
			edit_summary: editSummary,
		},
	);
}

export async function revertSongRevision(
	songId: string,
	version: number,
	editSummary: string,
): Promise<MusicRevisionSummary> {
	return apiPostJson<MusicRevisionSummary>(
		musicV1Endpoints.songRevert(songId, version),
		{ edit_summary: editSummary },
	);
}

export async function listAlbumDiscussions(
	albumId: string,
): Promise<MusicDiscussion[]> {
	const response = await commentApi.listRoots({
		kind: "music_album",
		resourceId: albumId,
	});
	return response.items.map((comment) =>
		musicDiscussionFromComment(comment, albumId),
	);
}

export async function createAlbumDiscussion(
	albumId: string,
	content: string,
): Promise<MusicDiscussion> {
	const comment = await commentApi.create(
		{ kind: "music_album", resourceId: albumId },
		{
			content,
			mentions: [],
			attachment_ids: [],
		},
	);
	return musicDiscussionFromComment(comment, albumId);
}

export async function replyAlbumDiscussion(
	albumId: string,
	discussionId: string,
	content: string,
): Promise<MusicDiscussion> {
	const comment = await commentApi.create(
		{ kind: "music_album", resourceId: albumId },
		{
			content,
			reply_to_id: discussionId,
			mentions: [],
			attachment_ids: [],
		},
	);
	return musicDiscussionFromComment(comment, albumId);
}

export async function deleteAlbumDiscussion(
	albumId: string,
	discussionId: string,
): Promise<{ success: boolean }> {
	void albumId;
	const result = await commentApi.delete(discussionId);
	return { success: result.ok };
}

function musicDiscussionFromComment(
	comment: CommentDTO,
	albumId: string,
): MusicDiscussion {
	return {
		id: comment.id,
		album_id: albumId,
		parent_id: comment.reply_to_id ?? comment.root_id ?? null,
		content: comment.content,
		created_at: comment.created_at,
		updated_at: comment.edited_at ?? undefined,
		author_id: comment.author_id,
		author: comment.author
			? {
					id: comment.author.id,
					username: comment.author.username,
					display_name: comment.author.display_name,
				}
			: undefined,
		replies:
			comment.replies?.map((reply) =>
				musicDiscussionFromComment(reply, albumId),
			) ?? [],
		can_delete: true,
	};
}

export async function listRecommendedAlbums(mode: MusicRecommendationMode) {
	return apiGetEnvelope<MusicRecommendationItem[]>(
		musicV1Endpoints.recommendAlbums(mode),
	);
}

export async function listRecommendedArtists(
	mode: MusicRecommendationMode,
	filters: Pick<MusicListFilters, "page" | "page_size"> = {},
): Promise<MusicListResponse<MusicRecommendationItem>> {
	const params = queryString(filters);
	const response = await apiGetEnvelope<
		MusicRecommendationItem[],
		PaginationMeta
	>(
		`${musicV1Endpoints.recommendArtists(mode)}${params ? `&${params.slice(1)}` : ""}`,
	);
	return listResponseWithPaginationFallback(response, filters);
}

export async function listMusicArtists(
	filters: MusicListFilters = {},
): Promise<MusicListResponse<MusicArtistListItem>> {
	const response = await apiGetEnvelope<MusicArtistListItem[], PaginationMeta>(
		`${musicV1Endpoints.artists()}${queryString(filters)}`,
	);
	return listResponseWithPaginationFallback(response, filters);
}

export async function getMusicArtist(
	artistId: string,
	options?: { force?: boolean },
): Promise<MusicArtistListItem & { albums?: MusicAlbumListItem[] }> {
	return queryCache.fetchWithCache(
		`music:artist:${artistId}`,
		() =>
			apiGet<MusicArtistListItem & { albums?: MusicAlbumListItem[] }>(
				musicV1Endpoints.artist(artistId),
			),
		options,
	);
}

export async function createMusicArtist(
	input: MusicArtistInput,
): Promise<MusicArtistListItem> {
	return apiPostJson<MusicArtistListItem>(musicV1Endpoints.artists(), input);
}
