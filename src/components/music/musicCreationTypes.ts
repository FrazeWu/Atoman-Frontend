import type { UploadAsset } from "@/api/types";
import type {
	MusicAlbumImportFile,
	MusicAlbumImportInputMode,
	MusicAlbumImportStage,
	MusicAlbumImportStatus,
	MusicEntryStatus,
	MusicSource,
} from "@/api/musicV1";
import type { MusicAlbumArtistRole } from "@/api/musicV1";

export type MusicCreationFlowStep =
	| "artist"
	| "albumImport"
	| "albumDetails"
	| "preview";
export type MusicArtistKind = "person" | "group";

export interface MusicCreationDatePartsDraft {
	year: string;
	month: string;
	day: string;
}

export interface MusicCreationTrackDraft {
	id: string;
	sequence: number;
	title: string;
	audioUrl?: string;
	audioKey?: string;
	audioAssetId?: string;
	audioFileName?: string;
	uploadProgress?: number;
	uploadError?: string;
	origin?: string;
	songId?: string;
	discNumber?: number;
	lyrics?: string;
	lyricsDraft?: MusicCreationLyricsDraft;
	lyricsSource?: string;
	coverUrl?: string;
	contributors?: MusicCreationAlbumContributorDraft[];
}

export interface MusicCreationLyricsDraft {
	content: string;
	translation: string;
	format: "plain" | "lrc";
	language: string;
	editSummary: string;
	lines: Array<{
		line_key?: string;
		text: string;
		translation: string;
		time_ms: number | null;
	}>;
}

export interface MusicCreationArtistStageNameDraft {
	id: string;
	name: string;
	isPrimary: boolean;
	startDateParts?: MusicCreationDatePartsDraft;
	endDateParts?: MusicCreationDatePartsDraft;
	startDateText: string;
	endDateText: string;
}

export interface MusicCreationArtistMemberDraft {
	id: string;
	artistId: string | null;
	name: string;
	joinDateParts: MusicCreationDatePartsDraft;
	leaveDateParts: MusicCreationDatePartsDraft;
}

export interface MusicCreationArtistDraft {
	id: string | null;
	disambiguation: string;
	avatarUrl: string;
	avatarAsset?: UploadAsset | null;
	kind: MusicArtistKind;
	legalName: string;
	stageNames: MusicCreationArtistStageNameDraft[];
	members: MusicCreationArtistMemberDraft[];
	nationality: string;
	birthPlace: string;
	birthDateParts: MusicCreationDatePartsDraft;
	activeStartDateParts: MusicCreationDatePartsDraft;
	activeEndDateParts: MusicCreationDatePartsDraft;
	birthDate: string;
	bio: string;
	source: string;
	existingSources?: MusicSource[];
}

export interface MusicCreationAlbumImportDraft {
	importId: string | null;
	inputMode: MusicAlbumImportInputMode;
	archiveName: string;
	status: MusicAlbumImportStatus;
	stage: MusicAlbumImportStage;
	uploadProgress: number;
	uploadSpeed: number;
	files: MusicAlbumImportFile[];
	totalBytesLoaded: number;
	totalBytesTotal: number;
	coverUrl: string;
	coverKey: string;
	derivedAlbumTitle: string;
	derivedCover: string;
	derivedTracks: Array<{
		songId?: string;
		title: string;
		audioKey: string;
		origin: string;
		discNumber?: number;
		trackNumber?: number;
		lyrics?: {
			content: string;
			translation: string;
			format: "plain" | "lrc";
			language: string;
			edit_summary: string;
		};
		lyricsSource?: string;
	}>;
	derivedReleaseDate?: string;
	derivedAlbumType?: string;
	metadataSourceUrl?: string;
	metadataMatched?: boolean;
	missingArtists?: string[];
	lastSyncedAt: string;
	errorMessage: string;
}

export interface MusicCreationAlbumSeedDraft {
	title: string;
	uploadedAssets: Array<{
		id: string;
		url: string;
	}>;
}

export interface MusicCreationAlbumContributorDraft {
	id: string;
	artistId: string | null;
	name: string;
	avatarUrl: string;
	source?: string;
	entryStatus?: MusicEntryStatus;
	kind: MusicArtistKind;
	locked: boolean;
	roles: Array<{
		id: string;
		role: MusicAlbumArtistRole;
		label: string;
	}>;
}

export interface MusicCreationAlbumDetailsDraft {
	coverUrl: string;
	coverAsset?: UploadAsset | null;
	title: string;
	contributors: MusicCreationAlbumContributorDraft[];
	releaseDateParts: MusicCreationDatePartsDraft;
	releaseDate: string;
	type: string;
	releaseYear: string;
	bio: string;
	source: string;
	existingSources?: MusicSource[];
	musicBrainzMatched?: boolean;
}

export interface MusicCreationDraft {
	artist: MusicCreationArtistDraft;
	albumImport: MusicCreationAlbumImportDraft;
	albumSeed: MusicCreationAlbumSeedDraft;
	albumDetails: MusicCreationAlbumDetailsDraft;
	tracks: MusicCreationTrackDraft[];
}

export interface MusicCreationFlowState {
	mode?: "create" | "edit";
	entity?: "artist" | "album" | "song";
	targetId?: string | null;
	parentKey?: string;
	loading?: boolean;
	step: MusicCreationFlowStep;
	draft: MusicCreationDraft;
	tracksCustomized: boolean;
	titleCustomized: boolean;
	dirty: boolean;
	assetUploading: boolean;
	submitting: boolean;
	errorMessage: string;
}
