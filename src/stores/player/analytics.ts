import { reportError } from "@/utils/logger";
import type { Song } from "@/types";
import {
	recordMusicRecommendationEvents,
	recordMusicSongPlay,
} from "@/api/musicV1";

export interface PlayerAnalyticsOptions {
	getCurrentSong: () => Song | null;
	getIsAuthenticated: () => boolean;
	listeningThresholdMs?: number;
}

export function createPlayerAnalytics(options: PlayerAnalyticsOptions) {
	const listeningThresholdMs = options.listeningThresholdMs ?? 5000;
	let listeningTimer: ReturnType<typeof setTimeout> | null = null;
	let listeningStartedAt: number | null = null;
	let listenedMs = 0;
	let listeningSongId: string | null = null;
	let playReported = false;
	let listeningEventId: string | null = null;

	const clearListeningTimer = () => {
		if (listeningTimer === null) return;
		clearTimeout(listeningTimer);
		listeningTimer = null;
	};

	const pauseListening = () => {
		if (listeningStartedAt !== null) {
			listenedMs += Date.now() - listeningStartedAt;
			listeningStartedAt = null;
		}
		clearListeningTimer();
	};

	const reportRecommendationEvent = (
		song: Song | null,
		event: "play_start" | "play_complete" | "skip",
	) => {
		const context = song?.recommendation_context;
		if (!options.getIsAuthenticated() || !song || !context) return;
		void recordMusicRecommendationEvents({
			request_id: context.request_id,
			surface: context.surface,
			events: [
				{
					event,
					entity_type: "song",
					entity_id: String(song.id),
					position: context.position,
					reason: context.reason,
				},
			],
		}).catch((error) => {
			reportError(error, "Failed to record music recommendation playback event:");
		});
	};

	const reportCurrentPlay = () => {
		const song = options.getCurrentSong();
		const songId = song?.id ? String(song.id) : null;
		if (!songId || songId !== listeningSongId || playReported) return;
		playReported = true;
		listeningStartedAt = null;
		listeningTimer = null;
		reportRecommendationEvent(song, "play_start");
		const playlistId = song?.playlist_id;
		const report = recordMusicSongPlay(songId, playlistId, listeningEventId ?? undefined);
		void report.catch((error) => {
			reportError(error, "Failed to record music play:");
		});
	};

	const resumeListening = () => {
		if (!listeningSongId || playReported || listeningStartedAt !== null) return;
		listeningStartedAt = Date.now();
		listeningTimer = setTimeout(
			reportCurrentPlay,
			Math.max(0, listeningThresholdMs - listenedMs),
		);
	};

	const resetListening = (song: Song) => {
		pauseListening();
		listenedMs = 0;
		listeningSongId =
			!song.source_type || song.source_type === "music" ? String(song.id) : null;
		// 同一次播放暂停、恢复和网络重试复用 ID；切歌或重新播放才创建新事件。
		listeningEventId = listeningSongId ? crypto.randomUUID() : null;
		playReported = false;
	};

	const resetForSession = () => {
		clearListeningTimer();
		listeningStartedAt = null;
		listenedMs = 0;
		listeningSongId = null;
		listeningEventId = null;
		playReported = false;
	};

	const ensureListening = (song: Song) => {
		if (listeningSongId !== String(song.id)) {
			resetListening(song);
		}
	};

	return {
		pauseListening,
		resumeListening,
		resetListening,
		ensureListening,
		getListeningSongId: () => listeningSongId,
		reportRecommendationEvent,
		clearListeningTimer,
		resetForSession,
	};
}
