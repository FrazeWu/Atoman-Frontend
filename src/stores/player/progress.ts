import { reportError } from "@/utils/logger";
import type { Song } from "@/types";
import type { PlaybackMode } from "./queue";
import {
	saveMusicProgress as saveEntityMusicProgress,
	restoreMusicSession as restoreEntityMusicSession,
} from "@/entities/music";
import {
	getMusicPlaybackProgress,
	saveMusicPlaybackSession,
} from "@/api/musicV1";
import {
	hasPlayableAudio,
	normalizePlaybackSong,
} from "@/utils/playerState";

export interface PlayerProgressOptions {
	getCurrentSong: () => Song | null;
	setCurrentSong: (song: Song | null) => void;
	getQueue: () => Song[];
	setQueue: (queue: Song[]) => void;
	setCurrentAlbum: (album: Song[] | null) => void;
	getCurrentTime: () => number;
	setCurrentTime: (time: number) => void;
	getDuration: () => number;
	setDuration: (duration: number) => void;
	getPlaybackMode: () => PlaybackMode;
	setPlaybackMode: (mode: PlaybackMode) => void;
	setIsPlaying: (isPlaying: boolean) => void;
	getAudio: () => HTMLAudioElement | null;
	getIsAuthenticated: () => boolean;
	getUserUuid: () => string | undefined;
	getMusicAccountGeneration: () => number;
	getPlayGeneration: () => number;
	resolvePlaybackAudioUrl: (url: string) => string;
}

export const isMusicSong = (song: Song) =>
	!song.source_type || song.source_type === "music";

export function createPlayerProgressSync(options: PlayerProgressOptions) {
	let musicProgressLastSavedAt = 0;
	let musicProgressRestored = false;
	let musicSessionLastSavedAt = 0;
	let musicSessionRestored = false;

	const saveMusicProgress = (completed = false, force = false) => {
		const song = options.getCurrentSong();
		if (!options.getIsAuthenticated() || !song || !isMusicSong(song)) return;
		const now = Date.now();
		if (!force && now - musicProgressLastSavedAt < 15_000) return;
		const audio = options.getAudio();
		const position = audio?.currentTime ?? options.getCurrentTime();
		const total = audio?.duration ?? options.getDuration();
		if (!Number.isFinite(position) || position < 0) return;
		musicProgressLastSavedAt = now;
		void saveEntityMusicProgress({
			song_id: String(song.id),
			position_seconds: position,
			duration_seconds: Number.isFinite(total) && total > 0 ? total : 0,
			completed,
			reported_at: new Date(now).toISOString(),
		}).catch((error) => {
			reportError(error, "Failed to save music playback progress:");
		});
	};

	const saveMusicSession = (force = false) => {
		const song = options.getCurrentSong();
		const musicQueue = options.getQueue().filter(isMusicSong);
		if (
			!options.getIsAuthenticated() ||
			!song ||
			!isMusicSong(song) ||
			musicQueue.length === 0
		)
			return;
		const songIDs = musicQueue.map((item) => String(item.id));
		if (!songIDs.includes(String(song.id))) return;
		const now = Date.now();
		if (!force && now - musicSessionLastSavedAt < 15_000) return;
		const audio = options.getAudio();
		const position = audio?.currentTime ?? options.getCurrentTime();
		if (!Number.isFinite(position) || position < 0) return;
		musicSessionLastSavedAt = now;
		void saveMusicPlaybackSession({
			song_ids: songIDs,
			current_song_id: String(song.id),
			position_seconds: position,
			playback_mode: options.getPlaybackMode(),
			reported_at: new Date(now).toISOString(),
		}).catch((error) => {
			reportError(error, "Failed to save music playback session:");
		});
	};

	const musicSongFromAPI = (source: {
		id: string;
		title: string;
		artists?: Array<{ name: string }>;
		album?: { id: string; title: string; cover_url?: string };
		audio_url?: string;
		audio_status?: string;
		cover_url?: string;
		lyrics?: string;
		waveform_peaks?: number[];
		track_number?: number;
		summary_only?: boolean;
	}): Song =>
		normalizePlaybackSong({
			summary_only: source.summary_only,
			id: source.id,
			title: source.title,
			artist:
				source.artists?.map((artist) => artist.name).join(" / ") || "未知艺术家",
			album: source.album?.title || "",
			album_id: source.album?.id || "",
			audio_url: source.audio_url || "",
			audio_status: source.audio_status,
			cover_url: source.cover_url || source.album?.cover_url || "",
			lyrics: source.lyrics || "",
			waveform_peaks: source.waveform_peaks,
			track_number: source.track_number,
			status: "open",
		} as Song, options.resolvePlaybackAudioUrl);

	const restoreMusicSession = async () => {
		if (!options.getIsAuthenticated() || musicSessionRestored) return false;
		const generation = options.getMusicAccountGeneration();
		const playbackGeneration = options.getPlayGeneration();
		const userID = options.getUserUuid();
		try {
			const session = await restoreEntityMusicSession();
			if (
				generation !== options.getMusicAccountGeneration() ||
				playbackGeneration !== options.getPlayGeneration() ||
				!options.getIsAuthenticated() ||
				options.getUserUuid() !== userID
			)
				return false;
			if (!session?.queue?.length) {
				musicSessionRestored = true;
				return false;
			}
			const restoredQueue = session.queue
				.map(musicSongFromAPI)
				.filter(hasPlayableAudio);
			const restoredCurrentSong = restoredQueue.find(
				(song) => String(song.id) === session.current_song_id,
			);
			if (!restoredCurrentSong) {
				musicSessionRestored = true;
				return false;
			}
			options.setQueue(restoredQueue);
			options.setCurrentAlbum(null);
			options.setCurrentSong(restoredCurrentSong);
			options.setCurrentTime(session.position_seconds);
			options.setPlaybackMode(session.playback_mode);
			options.setIsPlaying(false);
			musicSessionRestored = true;
			return true;
		} catch (error) {
			reportError(error, "Failed to restore music playback session:");
			return false;
		}
	};

	const restoreMusicProgress = async () => {
		if (!options.getIsAuthenticated() || musicProgressRestored) return;
		const generation = options.getMusicAccountGeneration();
		const playbackGeneration = options.getPlayGeneration();
		const userID = options.getUserUuid();
		try {
			const progress = await getMusicPlaybackProgress();
			if (
				generation !== options.getMusicAccountGeneration() ||
				playbackGeneration !== options.getPlayGeneration() ||
				!options.getIsAuthenticated() ||
				options.getUserUuid() !== userID
			)
				return;
			if (!progress?.song?.audio_url || progress.completed) {
				musicProgressRestored = true;
				return;
			}
			const source = progress.song;
			const song = musicSongFromAPI(source);
			if (!hasPlayableAudio(song)) {
				musicProgressRestored = true;
				return;
			}
			options.setCurrentSong(song);
			options.setQueue([song]);
			options.setCurrentAlbum(null);
			options.setCurrentTime(progress.position_seconds);
			options.setDuration(progress.duration_seconds);
			options.setIsPlaying(false);
			musicProgressRestored = true;
		} catch (error) {
			reportError(error, "Failed to restore music playback progress:");
		}
	};

	const restoreMusicPlayback = async () => {
		const generation = options.getMusicAccountGeneration();
		const playbackGeneration = options.getPlayGeneration();
		if (await restoreMusicSession()) return;
		if (
			generation !== options.getMusicAccountGeneration() ||
			playbackGeneration !== options.getPlayGeneration()
		)
			return;
		await restoreMusicProgress();
	};

	const resetForSession = () => {
		musicProgressLastSavedAt = 0;
		musicProgressRestored = false;
		musicSessionLastSavedAt = 0;
		musicSessionRestored = false;
	};

	return {
		saveMusicProgress,
		saveMusicSession,
		restoreMusicSession,
		restoreMusicProgress,
		restoreMusicPlayback,
		resetForSession,
	};
}
