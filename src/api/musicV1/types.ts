import type { ApiList, UploadAsset } from "../types";

export type MusicEntryStatus =
	| "draft"
	| "open"
	| "disputed"
	| "confirmed"
	| "protected"
	| "closed";
export type MusicLifecycleStatus = "draft" | "active" | "retired" | "merged";
export type MusicEditStatus = "development" | "locked" | "closed";
export type MusicStateRequestAction = "close" | "reopen" | "unlock";
export type MusicStateRequestStatus =
	| "pending"
	| "approved"
	| "rejected"
	| "cancelled"
	| "superseded";

export type MusicEntryStateRequest = {
	id: string;
	entity_type: "artist" | "album" | "song";
	entity_id: string;
	action: MusicStateRequestAction;
	status: MusicStateRequestStatus;
	base_revision_id?: string | null;
	requested_by: string;
	requester?: { uuid: string; username: string };
	request_reason: string;
	reviewed_by?: string | null;
	reviewer?: { uuid: string; username: string };
	review_reason?: string;
	created_at: string;
	updated_at: string;
};

export type MusicSource = {
	type: "url" | string;
	url?: string;
	title?: string;
};

export type MusicAlbumImportStatus =
	| "pending_upload"
	| "uploading"
	| "uploaded"
	| "extracting"
	| "ready"
	| "failed"
	| "committed"
	| "queued"
	| "analyzing"
	| "transcoding"
	| "needs_attention"
	| "canceled";

export type MusicAlbumImportTrack = {
	songId?: string;
	title: string;
	audioKey: string;
	origin: string;
	discNumber?: number;
	trackNumber?: number;
	lyrics?: {
		content: string;
		translation: string;
		format: MusicLyricsFormat;
		language: string;
		edit_summary: string;
	};
	lyricsSource?: "local" | "lrclib" | string;
};

export type MusicAlbumImportCommitStageName = {
	name: string;
	is_primary: boolean;
	start_date_text: string;
	end_date_text: string;
};

export type MusicAlbumImportCommitTrack = {
	song_id?: string;
	audio_url?: string;
	title: string;
	disc_number: number;
	track_number: number;
	lyrics?: {
		content: string;
		translation: string;
		format: MusicLyricsFormat;
		language: string;
		edit_summary: string;
	};
};

export type MusicAlbumImportCommitMember = {
	artist_id: string;
	name?: string;
	join_date: string;
	join_date_precision?: string;
	leave_date: string;
	leave_date_precision?: string;
};

export type MusicAlbumImportCommitArtist = {
	artist_id: string;
	roles: MusicAlbumArtistRoleInput[];
	name: string;
	disambiguation?: string;
	legal_name: string;
	bio: string;
	image_url?: string;
	nationality: string;
	birth_date: string;
	stage_names: MusicAlbumImportCommitStageName[];
	birth_place: string;
	artist_form: "person" | "group";
	active_start_date: string;
	active_end_date: string;
	members: MusicAlbumImportCommitMember[];
};

export type MusicAlbumArtistRole =
	| "primary"
	| "featured"
	| "vocals"
	| "backing_vocals"
	| "writer"
	| "composer"
	| "arranger"
	| "producer"
	| "vocal_producer"
	| "recording_engineer"
	| "mixing_engineer"
	| "mastering_engineer"
	| "remixer"
	| "custom";

export type MusicAlbumArtistRoleInput = {
	role: MusicAlbumArtistRole;
	label?: string;
};

export type MusicAlbumArtistCreditInput = {
	artist_id: string;
	roles: MusicAlbumArtistRoleInput[];
	position: number;
};

export type MusicAlbumArtistCredit = {
	album_id: string;
	artist_id: string;
	artist?: MusicArtistListItem;
	role: MusicAlbumArtistRole;
	custom_role?: string;
	position: number;
};

export type MusicAlbumImportCommitInput = {
	artist_id?: string;
	artist: {
		name: string;
		legal_name: string;
		bio: string;
		image_url?: string;
		nationality: string;
		birth_date: string;
		stage_names: MusicAlbumImportCommitStageName[];
		birth_place: string;
	};
	artists?: MusicAlbumImportCommitArtist[];
	artist_source?: string;
	artist_sources?: MusicSource[];
	album: {
		title: string;
		description: string;
		album_type: string;
		cover_url?: string;
		release_date?: string;
		release_year: number;
		tracks: MusicAlbumImportCommitTrack[];
	};
	album_source?: string;
	album_sources?: MusicSource[];
};

export type MusicStandaloneSongType = "single" | "leak";

export type MusicAlbumImport = {
	importId: string;
	targetAlbumId: string;
	targetSongId?: string;
	artistId?: string;
	artistSource?: string;
	commitRequest?: MusicAlbumImportCommitInput;
	albumTitle?: string;
	albumSource?: string;
	status: MusicAlbumImportStatus;
	archiveName: string;
	uploadProgress: number;
	uploadSpeed: number;
	coverUrl: string;
	coverKey: string;
	derivedAlbumTitle: string;
	derivedCover: string;
	derivedTracks: MusicAlbumImportTrack[];
	derivedReleaseDate?: string;
	derivedAlbumType?: string;
	metadataSourceUrl?: string;
	missingArtists?: string[];
	lastSyncedAt: string;
	errorMessage: string;
	inputMode: MusicAlbumImportInputMode;
	stage: MusicAlbumImportStage;
	progress: MusicAlbumImportProgress;
	files: MusicAlbumImportFile[];
	errors: MusicAlbumImportError[];
};

export type MusicAlbumImportError = {
	fileId: string;
	message: string;
	code: string;
};

export type MusicAlbumImportMultipartPart = {
	partNumber: number;
	etag: string;
};

export type CreateMusicAlbumImportInput = {
	artistId?: string | null;
	artistName?: string;
	inputMode?: MusicAlbumImportInputMode;
};

export type StartMusicAlbumImportMultipartInput = {
	fileName: string;
	fileSize: number;
	contentType?: string;
};

export type MusicAlbumImportMultipart = {
	partSize: number;
	completedParts: MusicAlbumImportMultipartPart[];
};

export type MusicAlbumImportMultipartPartUpload = {
	partNumber: number;
	uploadUrl: string;
};

export type MusicAlbumImportFileUploadStatus =
	| "pending"
	| "uploading"
	| "completing"
	| "uploaded"
	| "failed";
export type MusicAlbumImportFileProcessingStatus =
	| "pending"
	| "processing"
	| "completed"
	| "failed"
	| "ignored";
export type MusicAlbumImportStage =
	| "upload"
	| "queued"
	| "extracting"
	| "analyzing"
	| "transcoding"
	| "ready"
	| "committing"
	| "completed"
	| "failed"
	| "canceled";
export type MusicAlbumImportInputMode = "auto" | "archive" | "files" | "folder";

export type MusicAlbumImportFile = {
	fileId: string;
	relativePath: string;
	fileName: string;
	role: string;
	detectedFormat: string;
	size: number;
	uploadStatus: MusicAlbumImportFileUploadStatus;
	processingStatus: MusicAlbumImportFileProcessingStatus;
	discNumber: number;
	trackNumber: number;
	title: string;
	errorMessage: string;
};

export type MusicAlbumImportProgress = {
	current: number;
	total: number;
};

export type RegisterMusicAlbumImportFileInput = {
	relativePath: string;
	fileName: string;
	fileSize: number;
	contentType: string;
};

export type RegisterMusicAlbumImportFilesInput = {
	files: RegisterMusicAlbumImportFileInput[];
};

export type MusicAlbumImportFilePartUpload = {
	partNumber: number;
	uploadUrl: string;
};

function arrayOrEmpty<T>(value: T[] | null | undefined): T[] {
	return Array.isArray(value) ? value : [];
}

export function normalizeMusicAlbumImport(
	snapshot: MusicAlbumImport,
): MusicAlbumImport {
	return {
		...snapshot,
		targetAlbumId: snapshot.targetAlbumId ?? "",
		targetSongId: snapshot.targetSongId ?? "",
		artistId: snapshot.artistId ?? "",
		commitRequest: snapshot.commitRequest,
		albumTitle: snapshot.albumTitle ?? "",
		derivedTracks: arrayOrEmpty(snapshot.derivedTracks),
		files: arrayOrEmpty(snapshot.files),
		errors: arrayOrEmpty(snapshot.errors),
	};
}

export type MusicAlbumArchiveUploadProgress = {
	loaded: number;
	total: number;
	bytesPerSecond: number;
};

export type UploadMusicAlbumArchiveOptions = {
	onProgress?: (progress: MusicAlbumArchiveUploadProgress) => void;
};

export type MusicRevisionSummary = {
	id: string;
	content_type: "album" | "song" | "artist";
	content_id: string;
	version_number: number;
	previous_revision_id?: string | null;
	content_snapshot: unknown;
	editor_id: string;
	editor?: {
		uuid?: string;
		username?: string;
		display_name?: string;
		avatar_url?: string;
	};
	edit_summary: string;
	edit_type: string;
	status: string;
	is_current: boolean;
	created_at: string;
};

export type MusicRevisionPage = {
	data: MusicRevisionSummary[];
	total: number;
	limit: number;
	offset: number;
};

export type MusicContributor = {
	user_id: string;
	username: string;
	display_name?: string;
	avatar_url?: string;
	revision_count: number;
	last_contributed_at: string;
};

export type MusicContributorList = {
	data: MusicContributor[];
	total: number;
};

export type MusicDiscussionAuthor = {
	id: string;
	username?: string;
	display_name?: string;
};

export type MusicDiscussion = {
	id: string;
	album_id: string;
	parent_id?: string | null;
	content: string;
	created_at: string;
	updated_at?: string;
	author_id: string;
	author?: MusicDiscussionAuthor;
	replies?: MusicDiscussion[];
	can_delete?: boolean;
};

export type MusicArtistListItem = {
	id: string;
	name: string;
	disambiguation?: string;
	display_name?: string;
	created_by?: string;
	sources?: MusicSource[];
	legal_name?: string;
	stage_names_json?: string;
	bio?: string;
	image_url?: string;
	nationality?: string;
	birth_place?: string;
	birth_date?: string;
	birth_date_precision?: string;
	birth_year?: number;
	death_year?: number;
	artist_form?: "person" | "group";
	active_start_date?: string;
	active_start_date_precision?: string;
	active_end_date?: string;
	active_end_date_precision?: string;
	members?: string;
	member_groups?: {
		current: Array<{
			artist_id: string;
			name: string;
			image_url?: string;
			join_date?: string;
			join_date_precision?: string;
			leave_date?: string;
			leave_date_precision?: string;
			is_published?: boolean;
		}>;
		former: Array<{
			artist_id: string;
			name: string;
			image_url?: string;
			join_date?: string;
			join_date_precision?: string;
			leave_date?: string;
			leave_date_precision?: string;
			is_published?: boolean;
		}>;
	};
	aliases?: Array<{ id?: string; alias: string; is_main_name?: boolean }>;
	play_count?: number;
	bookmark_count?: number;
	entry_status: MusicEntryStatus;
	lifecycle_status?: MusicLifecycleStatus;
	edit_status?: MusicEditStatus;
	redirect_to?: string | null;
	created_at?: string;
	updated_at?: string;
};

export type MusicAlbumListItem = {
	id: string;
	title: string;
	sources?: MusicSource[];
	status?: string;
	importSession?: MusicAlbumImport;
	artists?: Array<{ id: string; name: string }>;
	artist_credits?: MusicAlbumArtistCredit[];
	year?: number;
	release_date?: string;
	release_date_precision?: string;
	cover_url?: string;
	description?: string;
	reason?: string;
	section?: string;
	album_type?: string;
	hot_score?: number;
	play_count?: number;
	bookmark_count?: number;
	songs?: Array<{
		id: string;
		title: string;
		track_number?: number;
		disc_number?: number;
		audio_url?: string;
		cover_url?: string;
		lyrics?: string;
		status?: string;
		lifecycle_status?: MusicLifecycleStatus;
		edit_status?: MusicEditStatus;
		play_count?: number;
		duration_sec?: number;
		source_file_name?: string;
		source_container?: string;
		source_codec?: string;
		source_bitrate_kbps?: number;
		source_sample_rate_hz?: number;
		source_bit_depth?: number;
		source_channels?: number;
		source_size_bytes?: number;
		source_lossless?: boolean;
		playback_container?: string;
		playback_codec?: string;
		playback_bitrate_kbps?: number;
		playback_sample_rate_hz?: number;
		playback_channels?: number;
		artist_credits?: Array<{
			song_id: string;
			artist_id: string;
			artist?: MusicArtistListItem;
			role: MusicAlbumArtistRole;
			custom_role?: string;
			position: number;
		}>;
	}>;
	entry_status: MusicEntryStatus;
	lifecycle_status?: MusicLifecycleStatus;
	edit_status?: MusicEditStatus;
	redirect_to?: string | null;
};

export type MusicAlbumLinkSuggestion = {
	album: MusicAlbumListItem;
	musicbrainz: MusicBrainzReleaseCandidate;
	already_linked: boolean;
	match_kind: "musicbrainz_release" | "musicbrainz_release_group";
};

export type MusicBrainzReleaseCandidate = {
	release_id: string;
	release_group_id?: string;
	title: string;
	release_date?: string;
	artist_names?: string[];
	source_url: string;
};

export type MusicAlbumLinkSuggestions = {
	local_matches: MusicAlbumLinkSuggestion[];
	external_only: MusicBrainzReleaseCandidate[];
	metadata_status: "ready" | "unavailable";
};

export type MusicAlbumMergePreview = {
	source_album: MusicAlbumListItem;
	target_album: MusicAlbumListItem;
	matches: Array<{
		source_song: MusicSongListItem;
		target_song: MusicSongListItem;
		reason: string;
	}>;
};

export type MusicSongListItem = {
	id: string;
	title: string;
	description?: string;
	release_type?: MusicStandaloneSongType;
	release_date?: string;
	release_date_precision?: string;
	sources?: MusicSource[];
	effective_sources?: MusicSource[];
	album_id?: string | null;
	track_number?: number;
	disc_number?: number;
	audio_url?: string;
	duration_sec?: number;
	waveform_peaks?: number[];
	cover_url?: string;
	lyrics?: string;
	status?: string;
	lifecycle_status?: MusicLifecycleStatus;
	edit_status?: MusicEditStatus;
	entry_status: MusicEntryStatus;
	artists?: Array<{ id: string; name: string }>;
	album?: {
		id: string;
		title: string;
		cover_url?: string;
		album_type?: string;
		release_date?: string;
		release_date_precision?: string;
		year?: number;
		lifecycle_status?: MusicLifecycleStatus;
		edit_status?: MusicEditStatus;
	};
	position?: number;
};

export type MusicSearchResults = {
	songs: MusicSongListItem[];
	albums: MusicAlbumListItem[];
	artists: MusicArtistListItem[];
	playlists: MusicPlaylistSummary[];
	meta: {
		page: number;
		page_size: number;
		totals: Record<MusicSearchKind, number>;
		has_more: Record<MusicSearchKind, boolean>;
	};
};

export type MusicSearchKind = "song" | "album" | "artist" | "playlist";

export type MusicSongDetail = {
	song: MusicSongListItem;
	artists: Array<{
		id: string;
		name: string;
		role: MusicAlbumArtistRole;
		custom_role?: string;
		position: number;
	}>;
	previous?: MusicSongListItem;
	next?: MusicSongListItem;
	playable: boolean;
};

export type MusicListeningHistory = {
	id: string;
	play_count: number;
	last_played_at: string;
	song: MusicSongListItem;
};

export type MusicPlaybackProgress = {
	id: string;
	song_id: string;
	position_seconds: number;
	duration_seconds: number;
	completed: boolean;
	updated_at: string;
	song?: MusicSongListItem;
};

export type SaveMusicPlaybackProgressInput = {
	song_id: string;
	position_seconds: number;
	duration_seconds: number;
	completed: boolean;
	reported_at: string;
};

export type MusicPlaybackSession = {
	queue: MusicSongListItem[];
	current_song_id: string;
	position_seconds: number;
	playback_mode: "loop" | "single" | "random";
	updated_at: string;
};

export type SaveMusicPlaybackSessionInput = {
	song_ids: string[];
	current_song_id: string;
	position_seconds: number;
	playback_mode: "loop" | "single" | "random";
	reported_at: string;
};

export type MusicHome = {
	personalized: boolean;
	continue_listening?: MusicPlaybackProgress;
	recently_played: MusicListeningHistory[];
	for_you: Array<MusicAlbumListItem & { reason?: string }>;
	for_you_reason?: string;
};

export type MusicPlaylistSummary = {
	id: string;
	name: string;
	description?: string;
	cover_url?: string;
	song_count: number;
	user_id?: string;
	owner_username?: string;
	is_public?: boolean;
	kind?: "user" | "favorite" | "later";
	play_count?: number;
	bookmark_count?: number;
	reason?: string;
	section?: string;
};

export type MusicPlaylistDetail = MusicPlaylistSummary & {
	songs: MusicSongListItem[];
};

export type MusicStarredKind = "artist" | "album" | "playlist";

export type MusicArtistBookmark = {
	id: string;
	artist_id: string;
	created_at: string;
	artist?: MusicArtistListItem;
};

export type MusicAlbumBookmark = {
	id: string;
	album_id: string;
	created_at: string;
	album?: MusicAlbumListItem;
};

export type MusicPlaylistBookmark = {
	id: string;
	playlist_id: string;
	created_at: string;
	playlist?: MusicPlaylistSummary;
};

export type MusicStarredItem = {
	id: string;
	kind: MusicStarredKind;
	starred_at: string;
	artist?: MusicArtistListItem;
	album?: MusicAlbumListItem;
	playlist?: MusicPlaylistSummary;
};

export type CreateMusicPlaylistInput = {
	name: string;
	description?: string;
	cover_url?: string;
	is_public?: boolean;
};

export type UpdateMusicPlaylistInput = {
	name?: string;
	description?: string;
	cover_url?: string;
	is_public?: boolean;
};

export type MusicAlbumTrackEditInput = {
	id?: string;
	title: string;
	track_number: number;
	disc_number?: number;
	lyrics?: string;
	audio_asset_id?: string;
	cover_url?: string;
	artist_credits?: MusicAlbumArtistCreditInput[];
	removed?: boolean;
};

export type MusicArtistInput = {
	name: string;
	disambiguation?: string;
	legal_name?: string;
	stage_names?: MusicAlbumImportCommitStageName[];
	bio?: string;
	image_url?: string;
	nationality?: string;
	birth_place?: string;
	birth_date?: string;
	birth_year?: number;
	death_year?: number;
	artist_form?: "person" | "group";
	active_start_date?: string;
	active_end_date?: string;
	members?: MusicAlbumImportCommitMember[];
	sources?: MusicSource[];
	draft_context?: "member";
};

export type MusicAlbumInput = {
	title: string;
	artist_ids?: string[];
	release_date?: string;
	cover_url?: string;
	cover_key?: string;
	description?: string;
	album_type?: string;
	tracks?: MusicAlbumTrackEditInput[];
};

export type MusicArtistUpdateInput = Partial<MusicArtistInput>;
export type MusicAlbumUpdateInput = Partial<MusicAlbumInput>;

export type MusicListResponse<T> = ApiList<T>;

export type MusicBrowseMode = "hot" | "featured" | "latest";
export type MusicRecommendationMode = MusicBrowseMode | "discover";

export type MusicRecommendationItem = {
	id: string;
	title: string;
	summary?: string;
	image_url?: string;
	target_path: string;
	score_label?: string;
	play_count?: number;
	bookmark_count?: number;
	birth_year?: number;
	birth_date?: string;
	reason?: string;
	section?: string;
};

export type MusicDiscoverItemType = "album" | "artist" | "playlist";

export type MusicDiscoverAlbumItem = MusicRecommendationItem & {
	type: "album";
	section?: string;
	reason?: string;
	cover_url?: string;
	cover_s3_key?: string;
	release_date?: string;
	year?: number | string;
	artists?: Array<{ id: string; name: string }>;
};

export type MusicDiscoverArtistItem = MusicArtistListItem & {
	type: "artist";
	section?: string;
	reason?: string;
	title?: string;
	summary?: string;
	target_path: string;
};

export type MusicDiscoverPlaylistItem = {
	type: "playlist";
	section?: string;
	reason?: string;
	id: string;
	title: string;
	description?: string;
	summary?: string;
	cover_url?: string;
	image_url?: string;
	song_count: number;
	owner_username?: string;
	play_count?: number;
	bookmark_count?: number;
	target_path: string;
};

export type MusicDiscoverItem =
	| MusicDiscoverAlbumItem
	| MusicDiscoverArtistItem
	| MusicDiscoverPlaylistItem;

export type MusicListFilters = {
	q?: string;
	artist_id?: string;
	album_id?: string;
	release_type?: MusicStandaloneSongType | "single,leak";
	year?: string | number;
	status?: MusicEntryStatus;
	page?: number;
	page_size?: number;
	sort?: string;
};

export type MusicUploadTarget = {
	entityType: "artist" | "album" | "playlist";
	entityId: string;
	stagingId: string;
};

export type AlbumEditDraft = {
	title?: string;
	artist_ids?: string[];
	artist_credits?: MusicAlbumArtistCreditInput[];
	release_date?: string;
	cover?: UploadAsset | null;
	description?: string;
	album_type?: string;
	tracks?: MusicAlbumTrackEditInput[];
	reason: string;
	sources: MusicSource[];
};

export type SongEditDraft = {
	title?: string;
	description?: string;
	release_type?: MusicStandaloneSongType;
	release_date?: string;
	cover?: UploadAsset | null;
	artist_credits?: MusicAlbumArtistCreditInput[];
	sources?: MusicSource[];
	reason: string;
};

export type MusicReleaseConversionInput = {
	title: string;
	description: string;
	release_date: string;
	release_type: string;
	cover_url: string;
	artist_credits: MusicAlbumArtistCreditInput[];
	sources: MusicSource[];
};

export type MusicReleaseConversionResult = {
	entity_type: "album" | "song";
	id: string;
};

export type ArtistEditDraft = {
	name?: string;
	disambiguation?: string;
	legal_name?: string;
	stage_names_json?: string;
	bio?: string;
	image_url?: string;
	nationality?: string;
	birth_place?: string;
	birth_date?: string;
	birth_year?: number;
	death_year?: number;
	artist_form?: "person" | "group";
	active_start_date?: string;
	active_end_date?: string;
	members?: MusicAlbumImportCommitMember[];
	reason: string;
	sources: MusicSource[];
};

export type MusicLyricsFormat = "plain" | "lrc";
export type MusicLyricsEditTarget = "original" | "translation";
export type MusicLyricsSaveTarget = MusicLyricsEditTarget | "import" | "all";
export type MusicLyricsAnnotationVote = "up" | "down";
export type MusicLyricsViewerVote = MusicLyricsAnnotationVote | "none";
export type MusicLyricsAnnotationStatus = "active" | "deleted" | "needs_rebind";
export type PendingMusicLyricsAnnotation = {
	annotation_id: string;
	song_id: string;
	album_id: string;
};

export type MusicSongLyricsLine = {
	line_key?: string;
	line_index?: number;
	time_ms?: number | null;
	id?: string;
	text: string;
	translation: string;
	startTimeMs?: number | null;
	endTimeMs?: number | null;
	lineNumber?: number;
};

export type MusicLyricsAnnotation = {
	id: string;
	song_id?: string;
	line_key?: string;
	line_id?: string;
	body: string;
	selected_text: string;
	start_offset: number;
	end_offset: number;
	creator?: {
		id: string;
		username: string;
	};
	upvotes: number;
	downvotes: number;
	net_score?: number;
	viewer_vote?: MusicLyricsViewerVote;
	current_user_vote?: MusicLyricsAnnotationVote | null;
	status: MusicLyricsAnnotationStatus;
	created_at: string;
	updated_at: string;
};

export type MusicSongLyricsVersion = {
	id: string;
	song_id: string;
	version: number;
	content: string;
	translation: string;
	format: MusicLyricsFormat;
	edit_summary: string;
	target?: MusicLyricsSaveTarget | "all" | "restore";
	language?: string;
	created_at: string;
	created_by: string;
	updated_by?: string;
};

export type MusicLyricsAnnotationResolution = {
	annotation_id: string;
	action: "needs_rebind" | "rebind";
	line_id?: string;
	line_key?: string;
	selected_text?: string;
	start_offset?: number;
	end_offset?: number;
};

export type UpdateMusicSongLyricsInput = {
	target: MusicLyricsSaveTarget;
	language?: string;
	translation_included?: boolean;
	base_version: number;
	lines: Array<{
		line_key?: string;
		text: string;
		translation: string;
		time_ms: number | null;
	}>;
	content?: string;
	translation?: string;
	format?: MusicLyricsFormat;
	edit_summary: string;
	annotation_resolutions?: MusicLyricsAnnotationResolution[];
};

export type CreateMusicLyricsAnnotationInput = {
	line_key: string;
	selected_text: string;
	start_offset: number;
	end_offset: number;
	body: string;
};

export type UpdateMusicLyricsAnnotationInput =
	| {
			body: string;
			line_key?: never;
			selected_text?: never;
			start_offset?: never;
			end_offset?: never;
	  }
	| {
			body?: string;
			line_key: string;
			selected_text: string;
			start_offset: number;
			end_offset: number;
	  };

export type MusicSongLyrics = {
	id: string;
	song_id: string;
	format: MusicLyricsFormat;
	content: string;
	translation: string;
	translation_language?: string;
	edit_summary: string;
	updated_at: string;
	updated_by?: string;
	lines: MusicSongLyricsLine[];
	annotations: MusicLyricsAnnotation[];
	version: number;
};
