import { ref, computed, watch } from "vue";
import type {
	MusicAlbumImport,
	MusicAlbumImportCommitInput,
	MusicEntryStatus,
	MusicSource,
} from "@/api/musicV1";
import type {
	MusicCreationDraft,
	MusicCreationFlowState,
	MusicCreationFlowStep,
} from "@/components/music/musicCreationTypes";
import type {
	MusicCreationFlowSeed,
	MusicEditorState,
	MusicSheetLayer,
	NestedActionType,
} from "@/components/music/musicSheetTypes";
import { createSheetStack } from "@/composables/useSheetStack";
import { primaryAlbumRole } from "@/utils/musicAlbumCredits";
import { parseMusicLyricDraft } from "@/utils/musicLyricsDraft";
import { parsePartialDateParts } from "@/components/music/birthDateMask";
import { normalizeMusicImportSource } from "@/utils/musicImportSource";

export type {
	MusicEditorEntity,
	MusicEditorMode,
	MusicEditorState,
} from "@/components/music/musicSheetTypes";

interface DrawerState {
	artistId: string | null;
	artistRefreshToken: number;
	albumId: string | null;
	songId: string | null;
	playlistId: string | null;
	albumRefreshToken: number;
	songRefreshToken: number;
	playlistRefreshToken: number;
	nestedAction: NestedActionType;
	nestedPayload: unknown;
	musicEditor: MusicEditorState | null;
	creationFlow: MusicCreationFlowState | null;
}

function createEmptyDateParts() {
	return {
		year: "",
		month: "",
		day: "",
	};
}

function createSeededContributors(seed?: MusicCreationFlowSeed) {
	if (!seed?.artistId) return [];

	return [
		{
			id: `contributor-${seed.artistId}`,
			artistId: seed.artistId,
			name: seed.artistName ?? "",
			avatarUrl: "",
			kind: "person" as const,
			locked: false,
			roles: [primaryAlbumRole(`role-${seed.artistId}-primary`)],
		},
	];
}

function musicSourceValue(sources?: MusicSource[]) {
	const source = sources?.find(
		(item) => item.url?.trim() || item.title?.trim(),
	);
	return normalizeMusicImportSource(
		source?.url?.trim() || source?.title?.trim(),
	);
}

function restoreCommittedAlbumImportDraft(
	flow: MusicCreationFlowState,
	request: MusicAlbumImportCommitInput,
	fallbackArtistID: string,
) {
	const primary =
		request.artists?.find(
			(artist) => !artist.artist_id || artist.artist_id === request.artist_id,
		) ?? request.artists?.[0];
	const artist = primary ?? request.artist;
	const stageNames = artist.stage_names ?? [];
	flow.draft.artist.id = request.artist_id?.trim() || fallbackArtistID || null;
	flow.draft.artist.avatarUrl = artist.image_url?.trim() || "";
	flow.draft.artist.kind =
		"artist_form" in artist && artist.artist_form === "group"
			? "group"
			: "person";
	flow.draft.artist.legalName = artist.legal_name ?? "";
	flow.draft.artist.stageNames = stageNames.length
		? stageNames.map((name, index) => ({
				id: `stage-name-${index}`,
				name: name.name ?? "",
				isPrimary: name.is_primary || index === 0,
				startDateParts: createEmptyDateParts(),
				endDateParts: createEmptyDateParts(),
				startDateText: name.start_date_text ?? "",
				endDateText: name.end_date_text ?? "",
			}))
		: flow.draft.artist.stageNames;
	flow.draft.artist.nationality = artist.nationality ?? "";
	flow.draft.artist.birthPlace = artist.birth_place ?? "";
	flow.draft.artist.birthDateParts = parsePartialDateParts(
		artist.birth_date ?? "",
	);
	flow.draft.artist.bio = artist.bio ?? "";
	flow.draft.artist.source =
		normalizeMusicImportSource(request.artist_source) ||
		normalizeMusicImportSource(flow.draft.artist.source);
	if (primary) {
		flow.draft.artist.activeStartDateParts = parsePartialDateParts(
			primary.active_start_date ?? "",
		);
		flow.draft.artist.activeEndDateParts = parsePartialDateParts(
			primary.active_end_date ?? "",
		);
		flow.draft.artist.members = primary.members.map((member, index) => ({
			id: `member-${member.artist_id || index}`,
			artistId: member.artist_id || null,
			name: member.name ?? "",
			joinDateParts: parsePartialDateParts(member.join_date ?? ""),
			leaveDateParts: parsePartialDateParts(member.leave_date ?? ""),
		}));
	}
	flow.draft.albumDetails.title = request.album.title ?? "";
	flow.draft.albumDetails.bio = request.album.description ?? "";
	flow.draft.albumDetails.type = request.album.album_type?.trim() || "album";
	flow.draft.albumDetails.coverUrl = request.album.cover_url?.trim() || "";
	flow.draft.albumDetails.releaseDateParts = parsePartialDateParts(
		request.album.release_date ?? "",
	);
	flow.draft.albumDetails.releaseYear = String(
		request.album.release_year || "",
	);
	flow.draft.albumDetails.source =
		normalizeMusicImportSource(request.album_source) ||
		normalizeMusicImportSource(flow.draft.albumDetails.source);
	if (request.artists?.length) {
		flow.draft.albumDetails.contributors = request.artists.map(
			(contributor, index) => ({
				id: `contributor-${contributor.artist_id || index}`,
				artistId: contributor.artist_id || null,
				name: contributor.name ?? "",
				avatarUrl: contributor.image_url ?? "",
				kind: contributor.artist_form === "group" ? "group" : "person",
				locked: !!contributor.artist_id,
				roles: contributor.roles.map((role, roleIndex) => ({
					id: `role-${contributor.artist_id || index}-${roleIndex}`,
					role: role.role,
					label: role.label ?? "",
				})),
			}),
		);
	}
	flow.draft.tracks = request.album.tracks.map((track, index) => ({
		id: `import-track-${index + 1}`,
		...(track.song_id ? { songId: track.song_id } : {}),
		sequence: track.track_number || index + 1,
		discNumber: track.disc_number || 1,
		title: track.title,
		origin: "import",
		...(track.audio_url ? { audioUrl: track.audio_url } : {}),
		...(track.lyrics
			? {
					lyrics: track.lyrics.content,
					lyricsDraft: {
						content: track.lyrics.content,
						translation: track.lyrics.translation,
						format: track.lyrics.format,
						language: track.lyrics.language,
						editSummary: track.lyrics.edit_summary,
						lines: parseMusicLyricDraft(
							track.lyrics.content,
							track.lyrics.translation,
							track.lyrics.format,
						).map((row) => ({
							line_key: row.lineKey,
							text: row.original,
							translation: row.translation,
							time_ms: row.timeMs,
						})),
					},
				}
			: {}),
	}));
	flow.titleCustomized = true;
	flow.tracksCustomized = true;
}

function createEmptyDraft(seed?: MusicCreationFlowSeed): MusicCreationDraft {
	return {
		artist: {
			id: seed?.artistId ?? null,
			disambiguation: "",
			avatarUrl: "",
			avatarAsset: null,
			kind: "person",
			legalName: seed?.artistLegalName ?? "",
			stageNames: [
				{
					id: "stage-name-primary",
					name: seed?.artistName ?? "",
					isPrimary: true,
					startDateParts: createEmptyDateParts(),
					endDateParts: createEmptyDateParts(),
					startDateText: "",
					endDateText: "",
				},
			],
			members: [],
			nationality: "",
			birthPlace: "",
			birthDateParts: createEmptyDateParts(),
			activeStartDateParts: createEmptyDateParts(),
			activeEndDateParts: createEmptyDateParts(),
			birthDate: "",
			bio: "",
			source: seed?.artistSource?.trim() ?? "",
		},
		albumImport: {
			importId: null,
			inputMode: "auto",
			archiveName: "",
			status: "pending_upload",
			stage: "upload",
			uploadProgress: 0,
			uploadSpeed: 0,
			files: [],
			totalBytesLoaded: 0,
			totalBytesTotal: 0,
			coverUrl: "",
			coverKey: "",
			derivedAlbumTitle: "",
			derivedCover: "",
			derivedTracks: [],
			lastSyncedAt: "",
			errorMessage: "",
		},
		albumSeed: {
			title: "",
			uploadedAssets: [],
		},
		albumDetails: {
			coverUrl: "",
			coverAsset: null,
			title: "",
			contributors: createSeededContributors(seed),
			releaseDateParts: createEmptyDateParts(),
			releaseDate: "",
			type: "album",
			releaseYear: "",
			bio: "",
			source: "",
		},
		tracks: [],
	};
}

const artistLayer = (id: string): MusicSheetLayer => ({
	key: `artist:${id}`,
	kind: "artist",
	title: "艺术家详情",
	route: `/music/artist/${id}`,
	payload: { artistId: id },
});

const albumLayer = (id: string): MusicSheetLayer => ({
	key: `album:${id}`,
	kind: "album",
	title: "专辑详情",
	route: `/music/album/${id}`,
	payload: { albumId: id },
});

const songLayer = (id: string): MusicSheetLayer => ({
	key: `song:${id}`,
	kind: "song",
	title: "歌曲详情",
	route: `/music/song/${id}`,
	payload: { songId: id },
});

function resolveShortestMusicPath(layer: MusicSheetLayer): MusicSheetLayer[] {
	if (layer.kind !== "action") return [layer];
	if (!layer.payload.data || typeof layer.payload.data !== "object")
		return [layer];

	if ("albumId" in layer.payload.data) {
		return [albumLayer(String(layer.payload.data.albumId)), layer];
	}
	if ("artistId" in layer.payload.data) {
		return [artistLayer(String(layer.payload.data.artistId)), layer];
	}
	return [layer];
}

// Global state singleton
const state = ref<DrawerState>({
	artistId: null,
	artistRefreshToken: 0,
	albumId: null,
	songId: null,
	playlistId: null,
	albumRefreshToken: 0,
	songRefreshToken: 0,
	playlistRefreshToken: 0,
	nestedAction: null,
	nestedPayload: null,
	musicEditor: null,
	creationFlow: null,
});

const sheetStack = createSheetStack<MusicSheetLayer>({
	maxLayers: 3,
	resolveOverflow: resolveShortestMusicPath,
	overflowTransitionMs: 300,
});

watch(
	sheetStack.layers,
	(layers) => {
		const reversed = [...layers].reverse();
		const artist = reversed.find((layer) => layer.kind === "artist");
		const album = reversed.find((layer) => layer.kind === "album");
		const song = reversed.find((layer) => layer.kind === "song");
		const playlist = reversed.find((layer) => layer.kind === "playlist");
		const action = reversed.find((layer) => layer.kind === "action");
		const editor = reversed.find((layer) => layer.kind === "editor");

		state.value.artistId =
			artist?.kind === "artist" ? artist.payload.artistId : null;
		state.value.albumId =
			album?.kind === "album" ? album.payload.albumId : null;
		state.value.songId = song?.kind === "song" ? song.payload.songId : null;
		state.value.playlistId =
			playlist?.kind === "playlist" ? playlist.payload.playlistId : null;
		state.value.nestedAction =
			action?.kind === "action" ? action.payload.action : null;
		state.value.nestedPayload =
			action?.kind === "action" ? action.payload.data : null;
		state.value.musicEditor = editor?.kind === "editor" ? editor.payload : null;
	},
	{ flush: "sync" },
);

export function useMusicDrawers() {
	const returnToLayer = (key: string) => {
		if (sheetStack.layers.value.some((layer) => layer.key === key))
			sheetStack.popTo(key);
	};

	const closeLayerAndAbove = (key: string) => {
		if (!sheetStack.layers.value.some((layer) => layer.key === key)) return;
		sheetStack.popTo(key);
		sheetStack.pop();
	};

	const openArtist = (id: string) => {
		sheetStack.push(artistLayer(id));
	};
	const closeArtist = (
		key = [...sheetStack.layers.value]
			.reverse()
			.find((layer) => layer.kind === "artist")?.key ?? "",
	) => closeLayerAndAbove(key);
	const refreshArtist = () => {
		state.value.artistRefreshToken += 1;
	};

	const openAlbum = (id: string) => {
		sheetStack.push(albumLayer(id));
	};
	const closeAlbum = (
		key = [...sheetStack.layers.value]
			.reverse()
			.find((layer) => layer.kind === "album")?.key ?? "",
	) => closeLayerAndAbove(key);
	const refreshAlbum = () => {
		state.value.albumRefreshToken += 1;
	};
	const refreshSong = () => {
		state.value.songRefreshToken += 1;
	};

	const openSong = (id: string) => {
		sheetStack.push(songLayer(id));
	};
	const closeSong = (
		key = [...sheetStack.layers.value]
			.reverse()
			.find((layer) => layer.kind === "song")?.key ?? "",
	) => closeLayerAndAbove(key);

	const openPlaylist = (id: string) => {
		sheetStack.push({
			key: `playlist:${id}`,
			kind: "playlist",
			title: "歌单详情",
			route: `/music/playlist/${id}`,
			payload: { playlistId: id },
		});
	};
	const closePlaylist = (key = sheetStack.top.value?.key ?? "") =>
		closeLayerAndAbove(key);
	const refreshPlaylists = () => {
		state.value.playlistRefreshToken += 1;
	};

	const openNestedAction = (
		action: Exclude<NestedActionType, null>,
		payload: unknown = null,
	) => {
		const payloadOwner =
			payload && typeof payload === "object"
				? "albumId" in payload
					? String(payload.albumId)
					: "artistId" in payload
						? String(payload.artistId)
						: "songId" in payload
							? String(payload.songId)
							: null
				: null;
		const ownerId =
			payloadOwner ?? state.value.albumId ?? state.value.artistId ?? "root";
		sheetStack.push({
			key: `action:${action}:${ownerId}`,
			kind: "action",
			title:
				action === "history" ||
				action === "artist_history" ||
				action === "song_history"
					? "历史记录"
					: action === "link_album"
						? "关联现有专辑"
						: "操作",
			payload: { action, data: payload },
		});
	};
	const closeNestedAction = (key = sheetStack.top.value?.key ?? "") =>
		closeLayerAndAbove(key);

	const openMusicEditor = (editor: MusicEditorState) => {
		state.value.creationFlow = null;
		sheetStack.push({
			key: `editor:${editor.entity}:${editor.mode}:${editor.id}`,
			kind: "editor",
			title: "修改条目",
			payload: editor,
		});
	};

	const closeMusicEditor = (keyOrEvent?: string | Event) => {
		state.value.creationFlow = null;
		const key = typeof keyOrEvent === "string" ? keyOrEvent : undefined;
		const targetKey =
			key ??
			sheetStack.layers.value.find((layer) => layer.kind === "editor")?.key;
		if (targetKey) closeLayerAndAbove(targetKey);
	};

	const openMusicCreationFlow = (seed: MusicCreationFlowSeed = {}) => {
		let targetId = seed.artistId ?? null;
		if (seed.entity === "album") targetId = seed.albumId ?? null;
		if (seed.entity === "song") targetId = seed.songId ?? null;
		state.value.creationFlow = {
			mode: seed.mode ?? "create",
			entity: seed.entity,
			targetId,
			loading: false,
			step: seed.startStep ?? "albumImport",
			draft: createEmptyDraft(seed),
			tracksCustomized: false,
			titleCustomized: false,
			dirty: false,
			assetUploading: false,
			submitting: false,
			errorMessage: "",
		};
		sheetStack.push({
			key: `creation:${seed.mode ?? "create"}:${seed.entity ?? "album"}:${seed.songId ?? seed.albumId ?? seed.artistId ?? "new"}`,
			kind: "creation",
			title: "创建音乐条目",
			payload: seed,
		});
	};

	const resumeMusicCreationFlow = (
		snapshot: MusicAlbumImport,
		contributors: Array<{
			id: string;
			name: string;
			imageUrl?: string;
			kind?: "person" | "group";
			source?: string;
			entryStatus?: MusicEntryStatus;
		}> = [],
		artistSource = "",
	) => {
		const resolvedArtistSource =
			normalizeMusicImportSource(artistSource) ||
			normalizeMusicImportSource(snapshot.artistSource) ||
			normalizeMusicImportSource(snapshot.commitRequest?.artist_source) ||
			musicSourceValue(snapshot.commitRequest?.artist_sources);
		openMusicCreationFlow({
			artistId: snapshot.artistId?.trim() || contributors[0]?.id || undefined,
			artistName: contributors[0]?.name ?? "",
			artistSource: resolvedArtistSource,
			startStep: "albumDetails",
		});
		const flow = state.value.creationFlow;
		if (!flow) return;
		flow.draft.albumImport = {
			importId: snapshot.importId,
			inputMode: snapshot.inputMode,
			archiveName: snapshot.archiveName,
			status: snapshot.status,
			stage: snapshot.stage,
			uploadProgress: snapshot.uploadProgress,
			uploadSpeed: snapshot.uploadSpeed,
			files: snapshot.files,
			totalBytesLoaded: snapshot.progress.current,
			totalBytesTotal: snapshot.progress.total,
			coverUrl: snapshot.coverUrl,
			coverKey: snapshot.coverKey,
			derivedAlbumTitle: snapshot.derivedAlbumTitle,
			derivedCover: snapshot.derivedCover,
			derivedTracks: snapshot.derivedTracks,
			derivedReleaseDate: snapshot.derivedReleaseDate,
			derivedAlbumType: snapshot.derivedAlbumType,
			metadataSourceUrl: snapshot.metadataSourceUrl,
			missingArtists: snapshot.missingArtists ?? [],
			lastSyncedAt: snapshot.lastSyncedAt,
			errorMessage: snapshot.errorMessage,
		};
		flow.draft.albumDetails.title =
			snapshot.albumTitle?.trim() || snapshot.derivedAlbumTitle;
		if (snapshot.derivedReleaseDate) {
			flow.draft.albumDetails.releaseDateParts = parsePartialDateParts(
				snapshot.derivedReleaseDate,
			);
		}
		if (snapshot.derivedAlbumType)
			flow.draft.albumDetails.type = snapshot.derivedAlbumType;
		if (snapshot.derivedCover)
			flow.draft.albumDetails.coverUrl = snapshot.derivedCover;
		if (snapshot.metadataSourceUrl)
			flow.draft.albumDetails.source = normalizeMusicImportSource(
				snapshot.metadataSourceUrl,
			);
		if (snapshot.artistSource)
			flow.draft.artist.source = normalizeMusicImportSource(
				snapshot.artistSource,
			);
		if (snapshot.albumSource) {
			const albumSource = normalizeMusicImportSource(snapshot.albumSource);
			if (albumSource) flow.draft.albumDetails.source = albumSource;
		}
		if (snapshot.commitRequest) {
			restoreCommittedAlbumImportDraft(
				flow,
				snapshot.commitRequest,
				flow.draft.artist.id || "",
			);
			if (resolvedArtistSource) flow.draft.artist.source = resolvedArtistSource;
		}
		if (contributors.length > 0 && !snapshot.commitRequest) {
			flow.draft.albumDetails.contributors = contributors.map((artist) => ({
				id: `contributor-${artist.id}`,
				artistId: artist.id,
				name: artist.name,
				avatarUrl: artist.imageUrl ?? "",
				...(normalizeMusicImportSource(artist.source)
					? { source: normalizeMusicImportSource(artist.source) }
					: {}),
				...(artist.entryStatus ? { entryStatus: artist.entryStatus } : {}),
				kind: artist.kind ?? "person",
				locked: true,
				roles: [primaryAlbumRole(`role-${artist.id}-primary`)],
			}));
		}
		if (!snapshot.commitRequest) {
			flow.draft.tracks = snapshot.derivedTracks.map((track, index) => ({
				id: `import-track-${index + 1}`,
				...(track.songId ? { songId: track.songId } : {}),
				sequence: track.trackNumber ?? index + 1,
				...(track.discNumber ? { discNumber: track.discNumber } : {}),
				title: track.title,
				audioKey: track.audioKey,
				origin: track.origin,
				...(track.lyrics
					? {
							lyrics: track.lyrics.content,
							lyricsDraft: {
								content: track.lyrics.content,
								translation: track.lyrics.translation || "",
								format: track.lyrics.format,
								language: track.lyrics.language || "",
								editSummary: track.lyrics.edit_summary || "自动匹配歌词",
								lines: parseMusicLyricDraft(
									track.lyrics.content,
									track.lyrics.translation || "",
									track.lyrics.format,
								).map((row) => ({
									line_key: row.lineKey,
									text: row.original,
									translation: row.translation,
									time_ms: row.timeMs,
								})),
							},
						}
					: {}),
			}));
		}
		return flow;
	};

	const setMusicCreationStep = (step: MusicCreationFlowStep) => {
		if (state.value.creationFlow) state.value.creationFlow.step = step;
	};

	const closeMusicCreationFlow = (keyOrEvent?: string | Event) => {
		state.value.creationFlow = null;
		const key = typeof keyOrEvent === "string" ? keyOrEvent : undefined;
		const targetKey =
			key ??
			sheetStack.layers.value.find((layer) => layer.kind === "creation")?.key;
		if (targetKey) closeLayerAndAbove(targetKey);
	};

	const closeAll = () => {
		sheetStack.clear();
		state.value.artistId = null;
		state.value.artistRefreshToken = 0;
		state.value.albumId = null;
		state.value.songId = null;
		state.value.playlistId = null;
		state.value.albumRefreshToken = 0;
		state.value.songRefreshToken = 0;
		state.value.playlistRefreshToken = 0;
		state.value.nestedAction = null;
		state.value.nestedPayload = null;
		state.value.musicEditor = null;
		state.value.creationFlow = null;
	};

	const isMainShifted = computed(
		() =>
			state.value.artistId !== null ||
			state.value.playlistId !== null ||
			state.value.nestedAction === "add_artist" ||
			state.value.creationFlow !== null ||
			state.value.musicEditor !== null,
	);
	const isArtistShifted = computed(
		() =>
			state.value.albumId !== null ||
			state.value.nestedAction === "add_album" ||
			state.value.nestedAction === "revise_artist" ||
			state.value.nestedAction === "artist_history" ||
			state.value.nestedAction === "merge_artist" ||
			state.value.nestedAction === "link_album" ||
			state.value.creationFlow !== null,
	);
	const isAlbumShifted = computed(
		() =>
			state.value.nestedAction === "revise" ||
			state.value.nestedAction === "history" ||
			state.value.nestedAction === "discussion" ||
			state.value.nestedAction === "merge_album",
	);
	const isCreationFlowOpen = computed(() => state.value.creationFlow !== null);
	const isMusicEditorOpen = computed(() => state.value.musicEditor !== null);

	return {
		state,
		openArtist,
		closeArtist,
		refreshArtist,
		openAlbum,
		closeAlbum,
		refreshAlbum,
		refreshSong,
		openSong,
		closeSong,
		openPlaylist,
		closePlaylist,
		refreshPlaylists,
		openNestedAction,
		closeNestedAction,
		openMusicEditor,
		closeMusicEditor,
		openMusicCreationFlow,
		resumeMusicCreationFlow,
		setMusicCreationStep,
		closeMusicCreationFlow,
		closeAll,
		isMainShifted,
		isArtistShifted,
		isAlbumShifted,
		isCreationFlowOpen,
		isMusicEditorOpen,
		layers: sheetStack.layers,
		renderLayers: sheetStack.renderLayers,
		topLayer: sheetStack.top,
		popLayer: sheetStack.pop,
		popToLayer: sheetStack.popTo,
		returnToLayer,
		isTopLayer: sheetStack.isTop,
		isLayerActive: sheetStack.isActive,
		isLayerShifted: sheetStack.isShifted,
	};
}
