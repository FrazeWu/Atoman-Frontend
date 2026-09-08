import { computed, ref } from "vue";
import type { MusicSongLyrics } from "@/api/musicV1";
import type { UploadAsset } from "@/api/types";
import type { MusicCreationLyricsDraft } from "@/components/music/musicCreationTypes";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { useMusicCreationFlow } from "@/components/music/musicCreationFlowContext";
import { rememberDeletedImportedTrack } from "@/utils/musicImportTrackMerge";

type TrackMetadataEdit = false | "title" | "sequence";

export function useMusicAlbumTrackEditor() {
	const { state } = useMusicDrawers();
	const creationFlowFallback = computed(() => state.value.creationFlow);
	const creationFlow = useMusicCreationFlow(creationFlowFallback);
	const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? []);
	const draggedTrackId = ref<string | null>(null);
	const dragOverInsertionIndex = ref<number | null>(null);
	const lyricTrackId = ref<string | null>(null);
	const lyricTrack = computed(
		() =>
			tracksDraft.value.find((track) => track.id === lyricTrackId.value) ??
			null,
	);

	function updateTracks(
		mutator: (tracks: typeof tracksDraft.value) => typeof tracksDraft.value,
		metadataEdit: TrackMetadataEdit = false,
	) {
		if (!creationFlow.value) return;
		creationFlow.value.tracksCustomized = true;
		const previousTracks = creationFlow.value.draft.tracks;
		const previousByID = new Map(previousTracks.map((track) => [track.id, track]));
		creationFlow.value.draft.tracks = mutator(previousTracks).map((track, index) => {
			const previous = previousByID.get(track.id);
			const sequenceChanged = metadataEdit === "sequence" && previous?.sequence !== index + 1;
			const titleChanged = metadataEdit === "title" && previous?.title !== track.title;
			const metadataChanged = sequenceChanged || titleChanged || !previous;
			return {
				...track,
				...(sequenceChanged || (!previous && metadataEdit === "sequence")
					? { sequence: index + 1, sequenceCustomized: true }
					: {}),
				...(titleChanged ? { titleCustomized: true } : {}),
				...(metadataChanged && track.matchStatus === "matched"
					? { matchStatus: "manual" as const }
					: {}),
			};
		});
	}

	function addPendingTrack(fileName: string, title: string) {
		const id = `manual-track-${Date.now()}`;
		updateTracks((tracks) => [
			...tracks,
			{
				id,
				sequence: tracks.length + 1,
				title,
				audioFileName: fileName,
				uploadProgress: 0,
				origin: "manual",
			},
		], "sequence");
		return id;
	}

	function updateTrackUpload(trackId: string, progress: number) {
		updateTracks((tracks) =>
			tracks.map((track) =>
				track.id === trackId
					? {
							...track,
							uploadProgress: Math.max(0, Math.min(100, progress)),
							uploadError: undefined,
						}
					: track,
			),
		);
	}

	function completeTrackUpload(
		trackId: string,
		asset: UploadAsset,
		fileName: string,
	) {
		updateTracks((tracks) =>
			tracks.map((track) =>
				track.id === trackId
					? {
							...track,
							audioUrl: asset.url,
							audioKey: asset.key,
							audioAssetId: asset.id,
							audioFileName: fileName,
							uploadProgress: undefined,
							uploadError: undefined,
						}
					: track,
			),
		);
	}

	function failTrackUpload(trackId: string, message: string) {
		updateTracks((tracks) =>
			tracks.map((track) =>
				track.id === trackId
					? {
							...track,
							uploadProgress: undefined,
							uploadError: message,
						}
					: track,
			),
		);
	}

	function addTrack(asset: UploadAsset, fileName: string) {
		updateTracks((tracks) => [
			...tracks,
			{
				id: `manual-track-${Date.now()}`,
				sequence: tracks.length + 1,
				title: titleFromFileName(fileName),
				audioUrl: asset.url,
				audioKey: asset.key,
				audioAssetId: asset.id,
				audioFileName: fileName,
				origin: "manual",
			},
		], "sequence");
	}

	function replaceTrackAudio(
		trackId: string,
		asset: UploadAsset,
		fileName: string,
	) {
		updateTracks((tracks) =>
			tracks.map((track) =>
				track.id === trackId
					? {
							...track,
							audioUrl: asset.url,
							audioKey: asset.key,
							audioAssetId: asset.id,
							audioFileName: fileName,
						}
					: track,
			),
		);
	}

	function updateTrackTitle(trackId: string, title: string) {
		updateTracks(
			(tracks) =>
				tracks.map((track) =>
					track.id === trackId ? { ...track, title } : track,
				),
			"title",
		);
	}

	function moveTrack(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= tracksDraft.value.length) return;
		updateTracks((tracks) => {
			const next = [...tracks];
			const [track] = next.splice(index, 1);
			next.splice(target, 0, track);
			return next;
		}, "sequence");
	}

	function handleTrackDragStart(trackId: string, event: DragEvent) {
		draggedTrackId.value = trackId;
		event.dataTransfer?.setData("text/plain", trackId);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
	}

	function handleTrackDragOver(insertionIndex: number, event: DragEvent) {
		if (!draggedTrackId.value) return;
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
		dragOverInsertionIndex.value = insertionIndex;
	}

	function handleTrackDragLeave(insertionIndex: number) {
		if (dragOverInsertionIndex.value === insertionIndex)
			dragOverInsertionIndex.value = null;
	}

	function clearTrackDragState() {
		draggedTrackId.value = null;
		dragOverInsertionIndex.value = null;
	}

	function handleTrackDrop(insertionIndex: number, event: DragEvent) {
		event.preventDefault();
		const sourceTrackId =
			event.dataTransfer?.getData("text/plain") || draggedTrackId.value;
		clearTrackDragState();
		if (!sourceTrackId) return;

		updateTracks((tracks) => {
			const next = [...tracks];
			const sourceIndex = next.findIndex((track) => track.id === sourceTrackId);
			if (sourceIndex < 0 || insertionIndex < 0 || insertionIndex > next.length)
				return tracks;
			const [sourceTrack] = next.splice(sourceIndex, 1);
			const targetIndex =
				sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
			next.splice(targetIndex, 0, sourceTrack);
			return next;
		}, "sequence");
	}

	function removeTrack(trackId: string) {
		const flow = creationFlow.value;
		const track = flow?.draft.tracks.find((item) => item.id === trackId);
		if (flow && track) rememberDeletedImportedTrack(flow, track);
		updateTracks((tracks) => tracks.filter((track) => track.id !== trackId), "sequence");
	}
	const openTrackLyrics = (trackId: string) => {
		lyricTrackId.value = trackId;
	};
	const closeTrackLyrics = () => {
		lyricTrackId.value = null;
	};

	function saveExistingTrackLyrics(lyrics: MusicSongLyrics) {
		const track = lyricTrack.value;
		if (!track?.songId || String(track.songId) !== String(lyrics.song_id))
			return;
		track.lyrics = lyrics.content;
		closeTrackLyrics();
	}

	function saveTrackLyrics(payload: {
		language?: string;
		content: string;
		translation: string;
		format: "plain" | "lrc";
		lines: MusicCreationLyricsDraft["lines"];
		editSummary: string;
	}) {
		const track = lyricTrack.value;
		if (!track) return;
		track.lyricsDraft = {
			content: payload.content,
			translation: payload.translation,
			format: payload.format,
			language: payload.language ?? "",
			editSummary: payload.editSummary,
			lines: payload.lines,
		};
		track.lyrics = payload.content;
		closeTrackLyrics();
	}

	return {
		tracksDraft,
		orderedTracks: tracksDraft,
		draggedTrackId,
		dragOverInsertionIndex,
		lyricTrack,
		addTrack,
		addPendingTrack,
		updateTrackUpload,
		completeTrackUpload,
		failTrackUpload,
		replaceTrackAudio,
		updateTrackTitle,
		moveTrack,
		handleTrackDragStart,
		handleTrackDragOver,
		handleTrackDragLeave,
		handleTrackDrop,
		clearTrackDragState,
		removeTrack,
		openTrackLyrics,
		closeTrackLyrics,
		saveExistingTrackLyrics,
		saveTrackLyrics,
		formatSequence: (sequence: number) => String(sequence).padStart(2, "0"),
	};
}

function titleFromFileName(fileName: string) {
	const baseName = fileName.split(/[\\/]/).pop() || fileName;
	return baseName.replace(/\.[^.]+$/, "") || baseName;
}
