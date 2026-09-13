import type { MusicAlbumImportTrack } from "@/api/musicV1";
import type {
	MusicCreationFlowState,
	MusicCreationLyricsDraft,
	MusicCreationTrackDraft,
} from "@/components/music/musicCreationTypes";
import { parseMusicLyricDraft } from "@/utils/musicLyricsDraft";

type TrackWithIdentity = {
	songId?: string;
	fileId?: string;
	importFileId?: string;
	audioKey?: string;
	audioAssetId?: string;
	discNumber?: number;
	trackNumber?: number;
	originalDiscNumber?: number;
	originalTrackNumber?: number;
};

function positionKey(track: TrackWithIdentity) {
	const disc = track.discNumber ?? track.originalDiscNumber;
	const position = track.trackNumber ?? track.originalTrackNumber;
	if (!disc || !position) return "";
	return `position:${disc}:${position}`;
}

export function importTrackAliases(track: TrackWithIdentity): string[] {
	const aliases = [
		track.songId ? `song:${track.songId}` : "",
		track.fileId ? `file:${track.fileId}` : "",
		track.importFileId ? `file:${track.importFileId}` : "",
		track.audioKey ? `audio:${track.audioKey}` : "",
		positionKey(track),
		track.originalDiscNumber && track.originalTrackNumber
			? `position:${track.originalDiscNumber}:${track.originalTrackNumber}`
			: "",
	];
	return [...new Set(aliases.filter(Boolean))];
}

function stableTrackAliases(track: TrackWithIdentity): string[] {
	return importTrackAliases(track).filter((alias) =>
		alias.startsWith("file:") || alias.startsWith("audio:"),
	);
}

export function rememberDeletedImportedTrack(
	flow: MusicCreationFlowState,
	track: MusicCreationTrackDraft,
) {
	const aliases = importTrackAliases(track);
	for (const alias of aliases) {
		if (!flow.deletedImportTrackKeys.includes(alias)) {
			flow.deletedImportTrackKeys.push(alias);
		}
	}
}

function lyricsDraftFromTrack(
	track: MusicAlbumImportTrack,
): MusicCreationLyricsDraft | undefined {
	if (!track.lyrics) return undefined;
	return {
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
	};
}

function trackFromImport(
	track: MusicAlbumImportTrack,
	index: number,
	current?: MusicCreationTrackDraft,
): MusicCreationTrackDraft {
	const preserveTitle = current?.titleCustomized === true;
	const preserveSequence = current?.sequenceCustomized === true;
	const lyricDraft = lyricsDraftFromTrack(track);
	const manuallyChanged = preserveTitle || preserveSequence;
	const audioKey = track.audioKey || current?.audioKey;
	const audioUrl = track.audioUrl || current?.audioUrl;
	return {
		id: current?.id ?? `import-track-${index + 1}`,
		...(track.songId ? { songId: track.songId } : {}),
		...(track.fileId ? { importFileId: track.fileId } : {}),
		sequence: preserveSequence ? current!.sequence : track.trackNumber ?? index + 1,
		...(preserveSequence
			? { discNumber: current!.discNumber }
			: track.discNumber
				? { discNumber: track.discNumber }
				: {}),
		title: preserveTitle ? current!.title : track.title,
		...(audioKey ? { audioKey } : {}),
		...(current?.audioAssetId ? { audioAssetId: current.audioAssetId } : {}),
		...(audioUrl ? { audioUrl } : {}),
		origin: current?.origin === "manual" ? current.origin : track.origin,
		...(track.originalTitle ? { originalTitle: track.originalTitle } : {}),
		...(track.originalDiscNumber
			? { originalDiscNumber: track.originalDiscNumber }
			: {}),
		...(track.originalTrackNumber
			? { originalTrackNumber: track.originalTrackNumber }
			: {}),
		...(manuallyChanged && track.matchStatus === "matched"
			? { matchStatus: "manual" as const }
			: track.matchStatus
				? { matchStatus: track.matchStatus }
				: {}),
		...(track.matchProvider ? { matchProvider: track.matchProvider } : {}),
		...(track.matchExternalId ? { matchExternalId: track.matchExternalId } : {}),
		...(track.matchSourceUrl ? { matchSourceUrl: track.matchSourceUrl } : {}),
		...(track.matchConfidence !== undefined
			? { matchConfidence: track.matchConfidence }
			: {}),
		...(current?.titleCustomized ? { titleCustomized: true } : {}),
		...(current?.sequenceCustomized ? { sequenceCustomized: true } : {}),
		...(current?.lyrics
			? { lyrics: current.lyrics, ...(current.lyricsDraft ? { lyricsDraft: current.lyricsDraft } : {}) }
			: lyricDraft
				? { lyrics: lyricDraft.content, lyricsDraft: lyricDraft }
				: {}),
		...(track.lyricsSource || current?.lyricsSource
			? { lyricsSource: track.lyricsSource || current?.lyricsSource }
			: {}),
	};
}

function findCurrentTrack(
	track: MusicAlbumImportTrack,
	current: MusicCreationTrackDraft[],
	used: Set<string>,
) {
	const aliases = importTrackAliases(track);
	const stableAliases = stableTrackAliases(track);
	if (stableAliases.length > 0) {
		const stableMatch = current.find((candidate) => {
			if (used.has(candidate.id)) return false;
			return stableTrackAliases(candidate).some((alias) => stableAliases.includes(alias));
		});
		if (stableMatch) return stableMatch;
	}
	const originalPositionAliases = aliases.filter((alias) =>
		alias === `position:${track.originalDiscNumber}:${track.originalTrackNumber}`,
	);
	if (originalPositionAliases.length > 0) {
		const originalMatch = current.find((candidate) => {
			if (used.has(candidate.id)) return false;
			return importTrackAliases(candidate).some((alias) => originalPositionAliases.includes(alias));
		});
		if (originalMatch) return originalMatch;
	}
	if (stableAliases.length > 0) return undefined;
	return current.find((candidate) => {
		if (used.has(candidate.id)) return false;
		return importTrackAliases(candidate).some((alias) => aliases.includes(alias));
	});
}

export function mergeImportedTracksIntoDraft(
	flow: MusicCreationFlowState,
	derivedTracks: MusicAlbumImportTrack[],
) {
	if (derivedTracks.length === 0) return;
	const current = flow.draft.tracks;
	const deleted = new Set(flow.deletedImportTrackKeys);
	const used = new Set<string>();
	const imported = derivedTracks.filter((track) =>
		!importTrackAliases(track).some((alias) => deleted.has(alias)),
	);
	const mergedImported = imported.flatMap((track, index) => {
		const existing = findCurrentTrack(track, current, used);
		if (!existing && flow.tracksCustomized) return [];
		if (existing) used.add(existing.id);
		return [trackFromImport(track, index, existing)];
	});
	const preserved = current.filter((track) => {
		if (used.has(track.id)) return false;
		if (flow.tracksCustomized) return true;
		return Boolean(
			track.songId || track.importFileId || track.audioKey ||
			track.origin?.startsWith("manual") || track.titleCustomized || track.sequenceCustomized,
		);
	});
	const hasSequenceOverride = current.some(
		(track) => track.sequenceCustomized === true,
	);
	if (!hasSequenceOverride) {
		flow.draft.tracks = [...mergedImported, ...preserved];
		return;
	}
	const currentIDs = new Set(current.map((track) => track.id));
	const replacements = new Map(
		mergedImported.map((track) => [track.id, track]),
	);
	flow.draft.tracks = [
		...current.map((track) => replacements.get(track.id) ?? track),
		...mergedImported.filter((track) => !currentIDs.has(track.id)),
	];
}
