import { reportError } from "@/utils/logger";
import { apiRequestResult } from "@/api/client";
import { defineStore, getActivePinia } from "pinia";
import { computed, onScopeDispose, ref, watch } from "vue";
import type { RepeatMode, TimelineItem, PodcastEpisode } from "@/types";
import {
	type Song,
	fetchSongById,
	saveMusicProgress as saveEntityMusicProgress,
	restoreMusicSession as restoreEntityMusicSession,
} from "@/entities/music";
import { isPlayableFeedPodcast } from "@/utils/feedPodcast";
import { useApi } from "@/composables/useApi";
import {
	getMusicPlaybackProgress,
	recordMusicRecommendationEvents,
	recordMusicSongPlay,
	saveMusicPlaybackSession,
} from "@/api/musicV1";
import {
	usePodcastPlaybackAdapter,
	type PodcastTrackerInstance,
} from "@/composables/usePodcastPlaybackAdapter";
import { useAuthStore } from "@/stores/auth";
import { usePlayerPresenceStore } from "@/stores/playerPresence";
import { registerSessionReset } from "@/stores/sessionReset";
import { useAudioPlayerSync } from "@/composables/useAudioPlayerSync";
import {
	resolvePlayableAudioURL,
	resolveUploadedMediaURL,
} from "@/utils/mediaUrl";
import {
	compactPlaybackSong,
	hasPlayableAudio,
	normalizePlaybackSong,
	playbackItemKey,
} from "@/utils/playerState";
import {
	buildPrefetchCandidates,
	shufflePlaybackItems,
} from "@/utils/playerQueue";

const api = useApi();

import {
	audioStartPrefetchBytes,
	audioStartPrefetchConcurrency,
	computeActualVolume,
	fadeOutAudio,
	resolvePlaybackAudioUrl as resolveAudioEngineUrl,
	transitionAudioSource,
	AudioPrefetcher,
} from "@/utils/audioEngine";

export { computeActualVolume, fadeOutAudio };

export type PlaybackMode = "loop" | "single" | "random";

type PersistedPlaybackState = {
	song?: Song;
	queue?: Song[];
	currentTime?: number;
	volume?: number;
	isShuffled?: boolean;
	repeatMode?: RepeatMode;
	playbackMode?: PlaybackMode;
};

function resolvePlaybackAudioUrl(url: string) {
	return resolvePlayableAudioURL(resolveAudioEngineUrl(url), api.url);
}

export const usePlayerStore = defineStore("player", () => {
	const podcastAdapter = usePodcastPlaybackAdapter();
	const authStore = useAuthStore();
	const {
		broadcastPlayRequest,
		setForeignPlayRequestCallback,
		closeChannel,
		setupMediaSession,
		updateMediaSessionMetadata,
		updateMediaSessionPosition,
	} = useAudioPlayerSync();
	const songs = ref<Song[]>([]);
	const currentSong = ref<Song | null>(null);
	const playerPresence = usePlayerPresenceStore();
	const isPlaying = ref(false);
	const isShuffled = ref(false);
	const repeatMode = ref<RepeatMode>("all");
	const playbackMode = ref<PlaybackMode>("loop");
	const INITIAL_VOLUME = 0.6;
	const readInitialVolume = () => {
		if (typeof localStorage === "undefined") return INITIAL_VOLUME;
		try {
			const saved = localStorage.getItem("playerVolume");
			if (saved !== null) {
				const val = parseFloat(saved);
				if (Number.isFinite(val) && val >= 0 && val <= 1) {
					return val;
				}
			}
		} catch {
			// localStorage might be unavailable
		}
		return INITIAL_VOLUME;
	};

	const initialVolume = readInitialVolume();
	const volume = ref(initialVolume);
	const lastNonZeroVolume = ref(initialVolume > 0 ? initialVolume : 0.5);
	const playbackRate = ref(1.0);
	const playedHistory = ref<Song[]>([]);
	const currentTime = ref(0);
	const bufferedTime = ref(0);
	const duration = ref(0);
	const isLoading = ref(false);
	const isCurrentAudioCached = ref(false);
	const playbackError = ref("");
	const songLibraryLoading = ref(false);
	const songLibraryBootstrapped = ref(false);
	const songLibraryLoaded = ref(false);
	const showLyrics = ref(false);
	const lyricsCloseRequest = computed(() => playerPresence.lyricsCloseRequest);
	const showQueue = ref(false);
	const isPinned = ref(
		typeof localStorage === "undefined" ||
			localStorage.getItem("playerPinned") !== "false",
	);

	const recordSongToHistory = (song: Song) => {
		const key = playbackItemKey(song);
		const filtered = playedHistory.value.filter((item) => playbackItemKey(item) !== key);
		filtered.unshift(compactPlaybackSong(song));
		if (filtered.length > 50) {
			filtered.length = 50;
		}
		playedHistory.value = filtered;
	};

	const clearPlayedHistory = () => {
		playedHistory.value = [];
	};

	watch(
		currentSong,
		(song, oldSong) => {
			playerPresence.setHasCurrentTrack(Boolean(song));
			if (oldSong && hasPlayableAudio(oldSong) && (!song || playbackItemKey(song) !== playbackItemKey(oldSong))) {
				recordSongToHistory(oldSong);
			}
		},
		{ immediate: true, flush: 'sync' },
	);

	watch(isPinned, (value) => {
		if (typeof localStorage === "undefined") return;
		try {
			localStorage.setItem("playerPinned", String(value));
		} catch (error) {
			reportError(error, "Failed to persist player pin preference:");
		}
	});

	// Album-based queue
	const queue = ref<Song[]>([]);
	const shuffledQueue = ref<Song[]>([]);
	const currentAlbum = ref<Song[] | null>(null);

	const recomputeShuffledQueue = () => {
		if (!isShuffled.value) {
			shuffledQueue.value = [];
			return;
		}
		const list = queue.value.length > 0 ? queue.value : songs.value;
		if (list.length === 0) return;

		const newList = shufflePlaybackItems(list);
		if (currentSong.value) {
			const currentKey = playbackItemKey(currentSong.value);
			const idx = newList.findIndex((s) => playbackItemKey(s) === currentKey);
			if (idx > -1) {
				newList.splice(idx, 1);
				newList.unshift(currentSong.value);
			}
		}
		shuffledQueue.value = newList;
	};

	watch(isShuffled, () => recomputeShuffledQueue());
	watch(
		queue,
		() => {
			if (isShuffled.value) recomputeShuffledQueue();
			if (currentSongStartCached) prefetchQueueAudioStarts();
		},
		{ deep: true },
	);

	// Sync isShuffled and repeatMode based on playbackMode
	watch(
		playbackMode,
		(mode) => {
			switch (mode) {
				case "loop":
					isShuffled.value = false;
					repeatMode.value = "all";
					break;
				case "single":
					isShuffled.value = false;
					repeatMode.value = "one";
					break;
				case "random":
					isShuffled.value = true;
					repeatMode.value = "all";
					break;
			}
		},
		{ immediate: true },
	);

	let audio: HTMLAudioElement | null = null;
	let cachedAudioObjectUrl = "";
	let playGeneration = 0;
	let playRequested = false;
	let currentSongStartCached = false;
	const audioPrefetcher = new AudioPrefetcher();
	let audioStartPrefetchKey: string | null = null;

	function releaseCachedAudioObjectUrl() {
		if (!cachedAudioObjectUrl) return;
		URL.revokeObjectURL(cachedAudioObjectUrl);
		cachedAudioObjectUrl = "";
	}
	let songsRequest: Promise<void> | null = null;
	let musicProgressLastSavedAt = 0;
	let musicProgressRestored = false;
	let musicSessionLastSavedAt = 0;
	let musicSessionRestored = false;
	let musicAccountGeneration = 0;

	const shouldPauseAudio = (player: HTMLAudioElement) =>
		!player.paused || isPlaying.value || playRequested;

	const isMusicSong = (song: Song) =>
		!song.source_type || song.source_type === "music";

	const saveMusicProgress = (completed = false, force = false) => {
		const song = currentSong.value;
		if (!authStore.isAuthenticated || !song || !isMusicSong(song)) return;
		const now = Date.now();
		if (!force && now - musicProgressLastSavedAt < 15_000) return;
		const position = audio?.currentTime ?? currentTime.value;
		const total = audio?.duration ?? duration.value;
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
		const song = currentSong.value;
		const musicQueue = queue.value.filter(isMusicSong);
		if (
			!authStore.isAuthenticated ||
			!song ||
			!isMusicSong(song) ||
			musicQueue.length === 0
		)
			return;
		const songIDs = musicQueue.map((item) => String(item.id));
		if (!songIDs.includes(String(song.id))) return;
		const now = Date.now();
		if (!force && now - musicSessionLastSavedAt < 15_000) return;
		const position = audio?.currentTime ?? currentTime.value;
		if (!Number.isFinite(position) || position < 0) return;
		musicSessionLastSavedAt = now;
		void saveMusicPlaybackSession({
			song_ids: songIDs,
			current_song_id: String(song.id),
			position_seconds: position,
			playback_mode: playbackMode.value,
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
		} as Song, resolvePlaybackAudioUrl);

	const restoreMusicSession = async () => {
		if (!authStore.isAuthenticated || musicSessionRestored) return false;
		const generation = musicAccountGeneration;
		const playbackGeneration = playGeneration;
		const userID = authStore.user?.uuid;
		try {
			const session = await restoreEntityMusicSession();
			if (
				generation !== musicAccountGeneration ||
				playbackGeneration !== playGeneration ||
				!authStore.isAuthenticated ||
				authStore.user?.uuid !== userID
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
			queue.value = restoredQueue;
			currentAlbum.value = null;
			currentSong.value = restoredCurrentSong;
			currentTime.value = session.position_seconds;
			playbackMode.value = session.playback_mode;
			isPlaying.value = false;
			musicSessionRestored = true;
			return true;
		} catch (error) {
			reportError(error, "Failed to restore music playback session:");
			return false;
		}
	};

	const restoreMusicProgress = async () => {
		if (!authStore.isAuthenticated || musicProgressRestored) return;
		const generation = musicAccountGeneration;
		const playbackGeneration = playGeneration;
		const userID = authStore.user?.uuid;
		try {
			const progress = await getMusicPlaybackProgress();
			if (
				generation !== musicAccountGeneration ||
				playbackGeneration !== playGeneration ||
				!authStore.isAuthenticated ||
				authStore.user?.uuid !== userID
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
			currentSong.value = song;
			queue.value = [song];
			currentAlbum.value = null;
			currentTime.value = progress.position_seconds;
			duration.value = progress.duration_seconds;
			isPlaying.value = false;
			musicProgressRestored = true;
		} catch (error) {
			reportError(error, "Failed to restore music playback progress:");
		}
	};

	const restoreMusicPlayback = async () => {
		const generation = musicAccountGeneration;
		const playbackGeneration = playGeneration;
		if (await restoreMusicSession()) return;
		if (generation !== musicAccountGeneration || playbackGeneration !== playGeneration) return;
		await restoreMusicProgress();
	};

	if (typeof window !== "undefined") {
		window.addEventListener("pagehide", () => {
			saveMusicProgress(false, true);
			saveMusicSession(true);
		});
	}

	watch(
		[() => authStore.isAuthenticated, () => authStore.user?.uuid],
		([isAuthenticated]) => {
			if (isAuthenticated) void restoreMusicPlayback();
			else {
				musicProgressRestored = false;
				musicSessionRestored = false;
			}
		},
		{ immediate: true },
	);

	setForeignPlayRequestCallback(() => {
		if (audio && shouldPauseAudio(audio)) {
			playGeneration += 1;
			playRequested = false;
			savePodcastProgress();
			saveMusicProgress(false, true);
			audio.pause();
			isPlaying.value = false;
			pauseListening();
			if ("mediaSession" in navigator) {
				navigator.mediaSession.playbackState = "paused";
			}
		}
	});
	const listeningThresholdMs = 5000;
	let listeningTimer: ReturnType<typeof setTimeout> | null = null;
	let listeningStartedAt: number | null = null;
	let listenedMs = 0;
	let listeningSongId: string | null = null;
	let playReported = false;
	let listeningEventId: string | null = null;
	let podcastTracker: PodcastTrackerInstance | null = null;

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
		if (!authStore.isAuthenticated || !song || !context) return;
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
		const songId = currentSong.value?.id ? String(currentSong.value.id) : null;
		if (!songId || songId !== listeningSongId || playReported) return;
		playReported = true;
		listeningStartedAt = null;
		listeningTimer = null;
		reportRecommendationEvent(currentSong.value, "play_start");
		const playlistId = currentSong.value?.playlist_id;
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

	const resetAudioStartPrefetch = () => {
		audioPrefetcher.abortPending();
		audioStartPrefetchKey = null;
	};

	const resetPlaybackForSession = () => {
		musicAccountGeneration += 1;
		playGeneration += 1;
		resetAudioStartPrefetch();
		const previousAudio = audio;
		audio = null;
		if (previousAudio) {
			previousAudio.pause();
			previousAudio.removeAttribute("src");
			previousAudio.load();
		}
		releaseCachedAudioObjectUrl();
		clearListeningTimer();
		listeningStartedAt = null;
		listenedMs = 0;
		listeningSongId = null;
		listeningEventId = null;
		playReported = false;
		podcastTracker = null;
		currentSongStartCached = false;
		audioPrefetcher.reset();
		songsRequest = null;
		musicProgressLastSavedAt = 0;
		musicProgressRestored = false;
		musicSessionLastSavedAt = 0;
		musicSessionRestored = false;
		songs.value = [];
		queue.value = [];
		shuffledQueue.value = [];
		currentAlbum.value = null;
		currentSong.value = null;
		currentTime.value = 0;
		duration.value = 0;
		isPlaying.value = false;
		isLoading.value = false;
		isCurrentAudioCached.value = false;
		playbackError.value = "";
		songLibraryLoading.value = false;
		songLibraryBootstrapped.value = false;
		songLibraryLoaded.value = false;
		showLyrics.value = false;
		showQueue.value = false;
		isShuffled.value = false;
		repeatMode.value = "all";
		playbackMode.value = "loop";
		try {
			localStorage.removeItem("playbackState");
		} catch (error) {
			reportError(error, "Failed to clear playback state:");
		}
	};

	const pinia = getActivePinia();
	if (!pinia) throw new Error("播放器状态必须在 Pinia 实例中创建");
	const unregisterSessionReset = registerSessionReset(
		pinia,
		resetPlaybackForSession,
	);
	onScopeDispose(() => {
		resetPlaybackForSession();
		unregisterSessionReset();
		closeChannel();
	});

	function prefetchQueueAudioStarts() {
		const current = currentSong.value;
		if (!current || queue.value.length < 2) return;

		const currentKey = playbackItemKey(current);
		const queueKey = queue.value
			.map(
				(song) =>
					`${playbackItemKey(song)}:${resolvePlaybackAudioUrl(song.audio_url)}`,
			)
			.join("|");
		const prefetchKey = `${currentKey}|${queueKey}`;
		if (audioStartPrefetchKey === prefetchKey) return;

		resetAudioStartPrefetch();
		audioStartPrefetchKey = prefetchKey;
		const signal = audioPrefetcher.getAbortSignal();
		const urls = buildPrefetchCandidates(
			queue.value,
			currentKey,
			resolvePlaybackAudioUrl,
			hasPlayableAudio,
			audioPrefetcher.urls,
		);
		let nextUrlIndex = 0;
		const prefetch = async () => {
			while (!signal.aborted) {
				const url = urls[nextUrlIndex++];
				if (!url) return;
				try {
					const response = await fetch(url, {
						cache: "force-cache",
						headers: {
							Range: `bytes=0-${audioStartPrefetchBytes - 1}`,
						},
						signal,
					});
					if (response.status !== 206) {
						await response.body?.cancel();
						continue;
					}
					await response.arrayBuffer();
					audioPrefetcher.markPrefetched(url);
				} catch {
					// A failed background prefetch must not affect playback.
				}
			}
		};

		void Promise.all(
			Array.from(
				{ length: Math.min(audioStartPrefetchConcurrency, urls.length) },
				prefetch,
			),
		);
	}

	const pauseCurrentAudio = (player: HTMLAudioElement) => {
		playGeneration += 1;
		playRequested = false;
		player.pause();
		isPlaying.value = false;
		isLoading.value = false;
		pauseListening();
		savePodcastProgress();
		saveMusicProgress(false, true);
		saveMusicSession(true);
		if ("mediaSession" in navigator) {
			navigator.mediaSession.playbackState = "paused";
		}
	};

	const ensureAudio = () => {
		if (audio) return audio;

		const nextAudio = new Audio();
		nextAudio.preload = "auto";
		nextAudio.addEventListener("loadstart", () => {
			if (audio !== nextAudio) return;
			isLoading.value = true;
			playbackError.value = "";
		});
		nextAudio.addEventListener("waiting", () => {
			if (audio !== nextAudio) return;
			if (isPlaying.value) isLoading.value = true;
		});
		nextAudio.addEventListener("playing", () => {
			if (audio !== nextAudio) return;
			playRequested = false;
			isLoading.value = false;
			isPlaying.value = true;
			playbackError.value = "";
		});
		nextAudio.addEventListener("pause", () => {
			if (audio !== nextAudio) return;
			if (!nextAudio.paused) return;
			playRequested = false;
			isPlaying.value = false;
			isLoading.value = false;
			pauseListening();
			if ("mediaSession" in navigator) {
				navigator.mediaSession.playbackState = "paused";
			}
		});
		nextAudio.addEventListener("error", () => {
			if (audio !== nextAudio) return;
			playRequested = false;
			isLoading.value = false;
			isPlaying.value = false;
			playbackError.value = "音频加载失败，请重试";
			pauseListening();
			if ("mediaSession" in navigator) {
				try {
					navigator.mediaSession.playbackState = "paused";
				} catch {
					// Ignore media session errors
				}
			}
		});
		nextAudio.addEventListener("canplay", () => {
			if (audio !== nextAudio) return;
			isLoading.value = false;
			if (!currentSong.value) return;
			currentSongStartCached = true;
			prefetchQueueAudioStarts();
		});
		const updateBuffered = () => {
			if (!nextAudio || !nextAudio.buffered || nextAudio.buffered.length === 0) {
				bufferedTime.value = 0;
				return;
			}
			const ct = nextAudio.currentTime;
			for (let i = 0; i < nextAudio.buffered.length; i++) {
				if (nextAudio.buffered.start(i) <= ct && ct <= nextAudio.buffered.end(i)) {
					bufferedTime.value = nextAudio.buffered.end(i);
					return;
				}
			}
			bufferedTime.value = nextAudio.buffered.end(nextAudio.buffered.length - 1);
		};
		nextAudio.addEventListener("progress", updateBuffered);
		nextAudio.addEventListener("timeupdate", () => {
			if (audio !== nextAudio) return;
			currentTime.value = nextAudio.currentTime;
			if (playbackError.value && !nextAudio.paused) {
				playbackError.value = "";
			}
			updateBuffered();
			savePodcastProgress();
			saveMusicProgress();
			saveMusicSession();
			if (duration.value > 0) {
				updateMediaSessionPosition({
					duration: duration.value,
					playbackRate: nextAudio.playbackRate,
					position: currentTime.value,
				});
			}
		});
		nextAudio.addEventListener("durationchange", () => {
			duration.value = Number.isFinite(nextAudio.duration)
				? nextAudio.duration
				: 0;
			updateMediaSessionPosition({
				duration: duration.value,
				playbackRate: nextAudio.playbackRate,
				position: currentTime.value,
			});
		});
		nextAudio.addEventListener("ended", () => {
			savePodcastProgress(true);
			saveMusicProgress(true, true);
			saveMusicSession(true);
			reportRecommendationEvent(currentSong.value, "play_complete");
			advanceToNextSong(true);
		});
		nextAudio.volume = computeActualVolume(volume.value);
		nextAudio.playbackRate = playbackRate.value;

		if (currentSong.value) {
			nextAudio.src = resolvePlaybackAudioUrl(currentSong.value.audio_url);
			if (currentTime.value > 0) {
				nextAudio.currentTime = currentTime.value;
			}
		}

		setupMediaSession({
			play: () => {
				if (currentSong.value && !isPlaying.value) attemptPlay(nextAudio);
			},
			pause: () => {
				if (shouldPauseAudio(nextAudio)) pauseCurrentAudio(nextAudio);
			},
			previoustrack: playPrevious,
			nexttrack: playNext,
			seekto: (details) => {
				if (details.seekTime !== undefined) {
					seek(details.seekTime);
				}
			},
			skip: (seconds) => {
				skip(seconds);
			},
		});

		audio = nextAudio;
		return nextAudio;
	};

	const syncCurrentSongFromLibrary = (library: Song[]) => {
		if (!currentSong.value) return;
		if (
			currentSong.value.source_type &&
			currentSong.value.source_type !== "music"
		)
			return;

		const refreshedSong = library.find(
			(song) => playbackItemKey(song) === playbackItemKey(currentSong.value!),
		);
		if (!refreshedSong) return;

		const normalizedSong = normalizePlaybackSong(refreshedSong, resolvePlaybackAudioUrl);
		currentSong.value = normalizedSong;

		if (!audio) return;

		currentSongStartCached = false;
		resetAudioStartPrefetch();
		audio.src = normalizedSong.audio_url;
		audio.playbackRate = playbackRate.value;
		audio.volume = computeActualVolume(volume.value);
		if (currentTime.value > 0) {
			audio.currentTime = currentTime.value;
		}
	};

	const attemptPlay = (
		player: HTMLAudioElement,
		generation = ++playGeneration,
	) => {
		isLoading.value = true;
		playRequested = true;
		playbackError.value = "";
		player.volume = computeActualVolume(volume.value);
		player
			.play()
			.then(() => {
				if (generation !== playGeneration || player !== audio) return;
				playRequested = false;
				isPlaying.value = true;
				playbackError.value = "";
				try {
					broadcastPlayRequest();
				} catch {
					// Ignore tab sync broadcast error
				}
				try {
					resumeListening();
				} catch {
					// Ignore listening tracker error
				}
				if ("mediaSession" in navigator) {
					try {
						navigator.mediaSession.playbackState = "playing";
					} catch {
						// Ignore media session error
					}
				}
			})
			.catch((err) => {
				if (generation !== playGeneration || player !== audio) return;
				playRequested = false;
				isLoading.value = false;
				playbackError.value = "无法播放此音频，请重试";
				isPlaying.value = false;
				pauseListening();
				if ("mediaSession" in navigator) {
					try {
						navigator.mediaSession.playbackState = "paused";
					} catch {
						// Ignore media session error
					}
				}
			});
	};

	const savePlaybackState = () => {
		if (typeof localStorage === "undefined") return;

		try {
			if (!currentSong.value) {
				localStorage.removeItem("playbackState");
				return;
			}

			const state: PersistedPlaybackState = {
				song: compactPlaybackSong(currentSong.value),
				queue: queue.value.map(compactPlaybackSong),
				currentTime: audio?.currentTime ?? currentTime.value,
				volume: volume.value,
				isShuffled: isShuffled.value,
				repeatMode: repeatMode.value,
				playbackMode: playbackMode.value,
			};

			localStorage.setItem("playbackState", JSON.stringify(state));
		} catch (error) {
			reportError(error, "Failed to persist playback state:");
		}
	};

	const restorePlaybackState = () => {
		if (typeof localStorage === "undefined") return;

		const savedState = localStorage.getItem("playbackState");
		if (!savedState) return;

		try {
			const state = JSON.parse(savedState) as PersistedPlaybackState;
			const restoredVol = typeof state.volume === "number" ? state.volume : 1;
			volume.value = restoredVol;
			if (restoredVol > 0) {
				lastNonZeroVolume.value = restoredVol;
			}
			isShuffled.value = Boolean(state.isShuffled);
			repeatMode.value = state.repeatMode || "all";
			playbackMode.value = state.playbackMode || "loop";
			currentTime.value =
				typeof state.currentTime === "number" ? state.currentTime : 0;
			const restoredSong = hasPlayableAudio(state.song)
				? normalizePlaybackSong(state.song!, resolvePlaybackAudioUrl)
				: null;
			const restoredQueue = Array.isArray(state.queue)
				? state.queue.filter(hasPlayableAudio).map((song) => normalizePlaybackSong(song, resolvePlaybackAudioUrl))
				: restoredSong
					? [restoredSong]
					: [];
			if (restoredSong && !restoredQueue.some((song) => playbackItemKey(song) === playbackItemKey(restoredSong))) {
				restoredQueue.unshift(restoredSong);
			}
			currentSong.value = restoredSong;
			queue.value = restoredQueue;
			currentAlbum.value = null;
			isPlaying.value = false;
		} catch (error) {
			reportError(error, "Failed to restore playback state:");
		}
	};

	restorePlaybackState();

	let playbackProgressSaveTimer: ReturnType<typeof setTimeout> | null = null;
	watch(currentTime, () => {
		if (playbackProgressSaveTimer !== null)
			clearTimeout(playbackProgressSaveTimer);
		playbackProgressSaveTimer = setTimeout(() => {
			playbackProgressSaveTimer = null;
			savePlaybackState();
		}, 1000);
	});

	watch(
		[currentSong, volume, isShuffled, repeatMode, playbackMode, queue],
		savePlaybackState,
		{ deep: true },
	);

	let musicSessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
	watch(
		[currentSong, queue, playbackMode],
		() => {
			if (musicSessionSaveTimer !== null) clearTimeout(musicSessionSaveTimer);
			musicSessionSaveTimer = setTimeout(() => {
				musicSessionSaveTimer = null;
				saveMusicSession(true);
			}, 1_000);
		},
		{ deep: true },
	);

	const fetchSongs = async (force = false) => {
		if (songsRequest) return songsRequest;
		if (songLibraryLoaded.value && !force) return;

		const requestGeneration = musicAccountGeneration;
		songLibraryLoading.value = true;
		songsRequest = (async () => {
			try {
				const response = await apiRequestResult<Song[]>(`${api.url}/songs`);
				if (requestGeneration !== musicAccountGeneration) return;
				if (!response.ok) {
					songLibraryLoaded.value = false;
					return;
				}

				const library = response.data;
				songs.value = library;
				songLibraryLoaded.value = true;
				syncCurrentSongFromLibrary(library);
			} catch (error) {
				if (requestGeneration !== musicAccountGeneration) return;
				songLibraryLoaded.value = false;
				reportError(error, "Failed to fetch songs:");
			} finally {
				if (requestGeneration !== musicAccountGeneration) return;
				songLibraryBootstrapped.value = true;
				songLibraryLoading.value = false;
				songsRequest = null;
			}
		})();

		return songsRequest;
	};

	const startSong = (song: Song, startAt?: number, persistPrevious = true) => {
		const normalizedSong = normalizePlaybackSong(song, resolvePlaybackAudioUrl);
		if (!hasPlayableAudio(normalizedSong)) {
			currentSong.value = null;
			queue.value = queue.value.filter(hasPlayableAudio);
			isPlaying.value = false;
			isLoading.value = false;
			playbackError.value = "当前曲目没有可用音频源";
			return;
		}
		savePodcastProgress();
		if (persistPrevious) saveMusicProgress(false, true);
		resetListening(song);
		currentSongStartCached = false;
		const player = ensureAudio();
		const generation = ++playGeneration;
		currentSong.value = normalizedSong;
		savePlaybackState();
		if (normalizedSong.summary_only && isMusicSong(normalizedSong)) {
			void fetchSongById(String(normalizedSong.id)).then((detail) => {
				if (!detail || generation !== playGeneration || !currentSong.value || playbackItemKey(currentSong.value) !== playbackItemKey(normalizedSong)) return;
				const update = { lyrics: detail.lyrics || '', waveform_peaks: detail.waveform_peaks, summary_only: false };
				currentSong.value = { ...currentSong.value, ...update };
				queue.value = queue.value.map(item => playbackItemKey(item) === playbackItemKey(normalizedSong) ? { ...item, ...update } : item);
			}).catch(error => reportError(error, 'Failed to load playing song details'));
		}
		playbackError.value = "";
		isLoading.value = true;
		releaseCachedAudioObjectUrl();
		const savedProgress =
			song.source_type === "podcast_episode" && song.source_id
				? readPodcastProgress(song.source_id)
				: null;
		currentTime.value =
			startAt ?? (savedProgress?.completed ? 0 : savedProgress?.position_sec || 0);
		const resumePosition = currentTime.value;
		const applyResumePosition = () => {
			if (generation !== playGeneration || audio !== player) return;
			try {
				player.currentTime = resumePosition;
			} catch {
				// Metadata may not be available yet; loadedmetadata retries below.
			}
		};

		const applySongSourceAndPlay = () => {
			if (generation !== playGeneration || audio !== player) return;
			player.src = normalizedSong.audio_url;
			player.playbackRate = playbackRate.value;
			isCurrentAudioCached.value = false;
			player.volume = computeActualVolume(volume.value);
			applyResumePosition();
			if (resumePosition > 0) {
				player.addEventListener("loadedmetadata", applyResumePosition, {
					once: true,
				});
			}
			attemptPlay(player, generation);
		};

		if (audio && !audio.paused && audio.currentTime > 0) {
			void transitionAudioSource(player, normalizedSong.audio_url, applySongSourceAndPlay);
		} else {
			applySongSourceAndPlay();
		}

		duration.value = normalizedSong.duration || (normalizedSong as any).duration_seconds || 0;
		podcastTracker = null;

		updateMediaSessionMetadata({
			title: song.title,
			artist: song.artist || "未知艺术家",
			album: song.album || "未知专辑",
			artworkUrl: song.cover_url || "",
		});

		if (song.source_type === "podcast_episode" && song.source_id) {
			const episodeID = song.source_id;
			podcastTracker = podcastAdapter.createEpisodeConsumptionTracker({
				episodeId: episodeID,
				getCurrentTime: () => currentTime.value,
				getDuration: () => duration.value,
			});
			podcastTracker.open();
		}
	};

	const playSong = (song: Song) => {
		if (
			currentSong.value &&
			playbackItemKey(currentSong.value) === playbackItemKey(song)
		) {
			togglePlay();
			return;
		}

		currentAlbum.value = null;
		resetAudioStartPrefetch();
		queue.value = [song];
		startSong(song);
	};

	const resumeSong = (song: Song, positionSeconds: number) => {
		currentAlbum.value = null;
		resetAudioStartPrefetch();
		queue.value = [song];
		startSong(song, Math.max(0, positionSeconds));
	};

	const playQueuedSong = (song: Song) => {
		if (
			currentSong.value &&
			playbackItemKey(currentSong.value) === playbackItemKey(song)
		) {
			togglePlay();
			return;
		}

		startSong(song);
	};

	const addToQueue = (song: Song, playNext = false) => {
		const songKey = playbackItemKey(song);
		if (queue.value.some((item) => playbackItemKey(item) === songKey)) return;
		if (playNext && currentSong.value) {
			const currentKey = playbackItemKey(currentSong.value);
			const index = queue.value.findIndex(
				(item) => playbackItemKey(item) === currentKey,
			);
			queue.value.splice(Math.max(0, index + 1), 0, song);
			return;
		}
		queue.value.push(song);
	};

	const removeFromQueue = (target: Song) => {
		const targetKey = playbackItemKey(target);
		if (currentSong.value && playbackItemKey(currentSong.value) === targetKey)
			return;
		queue.value = queue.value.filter(
			(song) => playbackItemKey(song) !== targetKey,
		);
	};

	const clearQueue = () => {
		queue.value = currentSong.value ? [currentSong.value] : [];
	};

	const moveQueueItem = (from: number, to: number) => {
		if (
			from === to ||
			from < 0 ||
			to < 0 ||
			from >= queue.value.length ||
			to >= queue.value.length
		)
			return;
		const [song] = queue.value.splice(from, 1);
		queue.value.splice(to, 0, song);
	};

	const playAlbum = (albumSongs: Song[], startIndex = 0) => {
		if (albumSongs.length === 0) return;

		const normalizedStartIndex =
			Number.isInteger(startIndex) &&
			startIndex >= 0 &&
			startIndex < albumSongs.length
				? startIndex
				: 0;

		resetAudioStartPrefetch();
		currentAlbum.value = albumSongs;
		queue.value = [...albumSongs];

		startSong(albumSongs[normalizedStartIndex]);
	};

	const togglePlay = () => {
		if (!currentSong.value) return;
		if (!hasPlayableAudio(currentSong.value)) {
			playbackError.value = "当前曲目没有可用音频源";
			return;
		}

		const player = ensureAudio();
		if (!player.src) {
			player.src = currentSong.value.audio_url;
			player.playbackRate = playbackRate.value;
		}
		player.volume = computeActualVolume(volume.value);
		if (currentTime.value > 0) {
			try {
				player.currentTime = currentTime.value;
			} catch {
				// Metadata may not be available yet
			}
		}

		if (shouldPauseAudio(player)) {
			pauseCurrentAudio(player);
		} else {
			if (listeningSongId !== String(currentSong.value.id))
				resetListening(currentSong.value);
			attemptPlay(player);
		}
	};

	const getActiveList = () => {
		if (isShuffled.value && shuffledQueue.value.length > 0)
			return shuffledQueue.value;
		return queue.value.length > 0 ? queue.value : songs.value;
	};

	const advanceToNextSong = (completed = false) => {
		if (!completed) reportRecommendationEvent(currentSong.value, "skip");
		const list = getActiveList();
		if (!currentSong.value || list.length === 0) return;

		const currentKey = playbackItemKey(currentSong.value);
		const currentIndex = list.findIndex(
			(song) => playbackItemKey(song) === currentKey,
		);
		const player = ensureAudio();

		let nextIndex;
		if (repeatMode.value === "one") {
			player.currentTime = 0;
			currentTime.value = 0;
			resetListening(currentSong.value);
			attemptPlay(player);
			return;
		} else if (currentIndex === -1) {
			nextIndex = 0;
		} else if (repeatMode.value === "all" || currentIndex < list.length - 1) {
			nextIndex = (currentIndex + 1) % list.length;
		} else {
			isPlaying.value = false;
			return;
		}

		startSong(list[nextIndex], undefined, false);
	};

	const playNext = () => advanceToNextSong(false);

	const playPrevious = () => {
		reportRecommendationEvent(currentSong.value, "skip");
		const list = getActiveList();
		if (!currentSong.value || list.length === 0) return;

		const currentKey = playbackItemKey(currentSong.value);
		const currentIndex = list.findIndex(
			(song) => playbackItemKey(song) === currentKey,
		);
		const prevIndex =
			currentIndex === -1 ? 0 : (currentIndex - 1 + list.length) % list.length;
		startSong(list[prevIndex]);
	};

	const toggleShuffle = () => {
		isShuffled.value = !isShuffled.value;
	};

	const toggleRepeat = () => {
		const modes: RepeatMode[] = ["none", "all", "one"];
		const nextMode = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length];
		repeatMode.value = nextMode;
	};

	const cyclePlaybackMode = () => {
		const modes: PlaybackMode[] = ["loop", "single", "random"];
		const currentIndex = modes.indexOf(playbackMode.value);
		playbackMode.value = modes[(currentIndex + 1) % modes.length];
	};

	const createPodcastSong = podcastAdapter.createPodcastSong;
	const createPodcastEpisodeSong = podcastAdapter.createPodcastEpisodeSong;
	const readPodcastProgress = podcastAdapter.readPodcastProgress;

	const setQueueFromCurrentItems = (items: TimelineItem[]) => {
		const podcastSongs: Song[] = items
			.filter(
				(item) =>
					(item.type === "feed_item" || item.type === "project_update") && isPlayableFeedPodcast(item.feed_item),
			)
			.map((item) => createPodcastSong(item.feed_item))
			.filter((song): song is Song => Boolean(song));
		queue.value = podcastSongs;
	};

	const setQueueFromPodcastEpisodes = (episodes: PodcastEpisode[]) => {
		queue.value = episodes.map(createPodcastEpisodeSong);
	};

	function savePodcastProgress(
		completedOrSong: boolean | Song | null = false,
		currentTimeArg?: number,
		durationArg?: number,
		completedArg?: boolean,
	) {
		let song: Song | null;
		let pos: number;
		let dur: number;
		let isCompleted: boolean | undefined;

		if (typeof completedOrSong === "boolean") {
			song = currentSong.value;
			pos = audio?.currentTime ?? currentTime.value;
			dur = Number.isFinite(audio?.duration)
				? Math.floor(audio?.duration || 0)
				: Math.floor(duration.value || 0);
			isCompleted = completedOrSong;
		} else {
			song = completedOrSong ?? currentSong.value;
			pos = currentTimeArg ?? (audio?.currentTime ?? currentTime.value);
			dur = durationArg ?? (Number.isFinite(audio?.duration) ? Math.floor(audio?.duration || 0) : Math.floor(duration.value || 0));
			isCompleted = completedArg;
		}

		podcastAdapter.savePodcastProgress(song, pos, dur, isCompleted);
		podcastTracker?.update(
			isCompleted === true
				? 1
				: dur > 0
					? Math.floor(pos) / dur
					: 0,
		);
	}

	const setVolume = (v: number) => {
		const clamped = Math.max(0, Math.min(1, Number.isFinite(v) ? v : INITIAL_VOLUME));
		if (clamped > 0) {
			lastNonZeroVolume.value = clamped;
		}
		volume.value = clamped;
		if (typeof localStorage !== "undefined") {
			try {
				localStorage.setItem("playerVolume", String(clamped));
			} catch (error) {
				reportError(error, "Failed to persist player volume preference:");
			}
		}
		if (audio) {
			audio.volume = computeActualVolume(clamped);
		}
	};

	const toggleMute = () => {
		if (volume.value > 0) {
			lastNonZeroVolume.value = volume.value;
			setVolume(0);
		} else {
			setVolume(lastNonZeroVolume.value > 0 ? lastNonZeroVolume.value : 0.5);
		}
	};

	const isMuted = computed(() => volume.value === 0);

	const setPlaybackRate = (rate: number) => {
		const safeRate = Math.max(0.5, Math.min(3.0, Number.isFinite(rate) ? rate : 1.0));
		playbackRate.value = safeRate;
		if (audio) {
			audio.playbackRate = safeRate;
		}
		if (duration.value > 0) {
			updateMediaSessionPosition({
				duration: duration.value,
				playbackRate: safeRate,
				position: currentTime.value,
			});
		}
	};

	const seek = (time: number) => {
		const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
		currentTime.value = safeTime;
		if (audio) {
			if (Math.abs(audio.currentTime - safeTime) > 0.03) {
				try {
					audio.currentTime = safeTime;
				} catch {
					// Metadata may not be available yet
				}
			}
		}
	};

	const skip = (seconds: number) => {
		const current = audio && audio.currentTime > 0 ? audio.currentTime : currentTime.value;
		const audioDuration =
			Number.isFinite(audio?.duration) && (audio?.duration || 0) > 0
				? audio!.duration
				: duration.value;
		const targetTime = current + seconds;
		const newTime =
			audioDuration > 0 ? Math.min(targetTime, audioDuration) : targetTime;
		seek(Math.max(0, newTime));
	};

	const retryPlayback = () => {
		if (!currentSong.value) return;
		const player = ensureAudio();
		const resumePosition = currentTime.value;
		playbackError.value = "";
		isLoading.value = true;
		player.pause();
		player.src = resolvePlaybackAudioUrl(currentSong.value.audio_url);
		player.playbackRate = playbackRate.value;
		player.load();
		if (resumePosition > 0) {
			const restorePosition = () => {
				try {
					player.currentTime = resumePosition;
				} catch {
					// Metadata may still be unavailable.
				}
			};
			player.addEventListener("loadedmetadata", restorePosition, {
				once: true,
			});
		}
		attemptPlay(player);
	};

	const toggleLyrics = () => {
		showLyrics.value = !showLyrics.value;
	};

	const requestLyricsClose = () => {
		playerPresence.requestLyricsClose();
	};

	const closeLyrics = () => {
		showLyrics.value = false;
	};

	const toggleQueue = () => {
		showQueue.value = !showQueue.value;
	};

	const togglePinned = () => {
		isPinned.value = !isPinned.value;
	};

	return {
		songs,
		currentSong,
		isPlaying,
		isShuffled,
		repeatMode,
		playbackMode,
		volume,
		currentTime,
		bufferedTime,
		duration,
		isLoading,
		playbackError,
		songLibraryLoading,
		songLibraryBootstrapped,
		queue,
		currentAlbum,
		fetchSongs,
		playSong,
		resumeSong,
		playQueuedSong,
		addToQueue,
		removeFromQueue,
		clearQueue,
		moveQueueItem,
		playAlbum,
		togglePlay,
		playNext,
		playPrevious,
		toggleShuffle,
		toggleRepeat,
		cyclePlaybackMode,
		createPodcastSong,
		createPodcastEpisodeSong,
		savePodcastProgress,
		readPodcastProgress,
		setQueueFromCurrentItems,
		setQueueFromPodcastEpisodes,
		setVolume,
		isMuted,
		lastNonZeroVolume,
		toggleMute,
		playbackRate,
		setPlaybackRate,
		playedHistory,
		clearPlayedHistory,
		seek,
		skip,
		retryPlayback,
		showLyrics,
		lyricsCloseRequest,
		toggleLyrics,
		requestLyricsClose,
		closeLyrics,
		showQueue,
		toggleQueue,
		isPinned,
		playbackItemKey,
		togglePinned,
		savePlaybackState,
		restorePlaybackState,
	};
});

export const useAudioPlayerStore = usePlayerStore;
