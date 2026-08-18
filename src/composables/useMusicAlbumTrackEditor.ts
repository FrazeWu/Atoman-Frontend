import { computed, ref } from "vue";
import type { MusicSongLyrics } from "@/api/musicV1";
import type { UploadAsset } from "@/api/types";
import type { MusicCreationLyricsDraft } from "@/components/music/musicCreationTypes";
import { useMusicDrawers } from "@/composables/useMusicDrawers";

export function useMusicAlbumTrackEditor() {
	const { state } = useMusicDrawers();
	const creationFlow = computed(() => state.value.creationFlow);
	const tracksDraft = computed(() => creationFlow.value?.draft.tracks ?? []);
	const draggedTrackId = ref<string | null>(null);
	const dragOverTrackId = ref<string | null>(null);
	const lyricTrackId = ref<string | null>(null);
	const lyricTrack = computed(
		() =>
			tracksDraft.value.find((track) => track.id === lyricTrackId.value) ??
			null,
	);

	function updateTracks(
		mutator: (tracks: typeof tracksDraft.value) => typeof tracksDraft.value,
	) {
		if (!creationFlow.value) return;
		creationFlow.value.tracksCustomized = true;
		creationFlow.value.draft.tracks = mutator(
			creationFlow.value.draft.tracks,
		).map((track, index) => ({
			...track,
			sequence: index + 1,
		}));
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
		]);
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
		]);
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
		updateTracks((tracks) =>
			tracks.map((track) =>
				track.id === trackId ? { ...track, title } : track,
			),
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
		});
	}

	function handleTrackDragStart(trackId: string, event: DragEvent) {
		draggedTrackId.value = trackId;
		event.dataTransfer?.setData("text/plain", trackId);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
	}

	function handleTrackDragOver(trackId: string) {
		if (draggedTrackId.value && draggedTrackId.value !== trackId)
			dragOverTrackId.value = trackId;
	}

	function handleTrackDragLeave(trackId: string) {
		if (dragOverTrackId.value === trackId) dragOverTrackId.value = null;
	}

	function handleTrackDrop(targetTrackId: string, event: DragEvent) {
		event.preventDefault();
		dragOverTrackId.value = null;
		const sourceTrackId =
			event.dataTransfer?.getData("text/plain") || draggedTrackId.value;
		draggedTrackId.value = null;
		if (!sourceTrackId || sourceTrackId === targetTrackId) return;

		updateTracks((tracks) => {
			const next = [...tracks];
			const sourceIndex = next.findIndex((track) => track.id === sourceTrackId);
			const targetIndex = next.findIndex((track) => track.id === targetTrackId);
			if (sourceIndex < 0 || targetIndex < 0) return tracks;
			const [sourceTrack] = next.splice(sourceIndex, 1);
			next.splice(
				sourceIndex < targetIndex ? targetIndex - 1 : targetIndex,
				0,
				sourceTrack,
			);
			return next;
		});
	}

	const removeTrack = (trackId: string) =>
		updateTracks((tracks) => tracks.filter((track) => track.id !== trackId));
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
		dragOverTrackId,
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
