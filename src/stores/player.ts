import { reportError } from "@/utils/logger";
import { apiRequestResult } from "@/api/client";
import { defineStore, getActivePinia } from "pinia";
import { computed, onScopeDispose, ref, watch } from "vue";
import type { RepeatMode, TimelineItem, PodcastEpisode } from "@/types";
import {
	type Song,
	fetchSongById,
} from "@/entities/music";
import { isPlayableFeedPodcast } from "@/utils/feedPodcast";
import { useApi } from "@/composables/useApi";
import { createPlayerOfflineState } from "./player/offline";
import { createPlayerAnalytics } from "./player/analytics";
import { createPlayerProgressSync, isMusicSong } from "./player/progress";
import { createPlayerQueue, type PlaybackMode } from "./player/queue";
import { createPlayerAudioRecovery } from "./player/recovery";
import { createPlayerMediaSession } from "./player/mediaSession";
import { computeBufferedTime } from "./player/audioElement";
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
	CURRENT_PLAYBACK_STATE_VERSION,
	isPlaybackStateExpired,
	isPlaybackProgressStale,
	sanitizeResumePosition,
	type PersistedPlaybackState,
} from "@/utils/playerState";
import {
	buildPrefetchCandidates,
	shufflePlaybackItems,
} from "@/utils/playerQueue";
import {
	getCachedMediaObjectURL,
	initMediaOfflineCacheIndex,
} from "@/utils/mediaOfflineCache";

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
export type { PlaybackMode };

function resolvePlaybackAudioUrl(url: string) {
	return resolvePlayableAudioURL(resolveAudioEngineUrl(url), api.url);
}

export const usePlayerStore = defineStore("player", () => {
	const podcastAdapter = usePodcastPlaybackAdapter();
	const authStore = useAuthStore();
	const {
		tabId: playerTabId,
		broadcastPlayRequest,
		setForeignPlayRequestCallback,
		closeChannel,
		setupMediaSession,
		updateMediaSessionPlaybackState,
		updateMediaSessionMetadata,
		updateMediaSessionPosition,
		clearMediaSession,
	} = useAudioPlayerSync();
	let lastPlayInitiatedAt = 0;
	const songs = ref<Song[]>([]);
	const currentSong = ref<Song | null>(null);
	const playerPresence = usePlayerPresenceStore();
	const isPlaying = ref(false);
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
	const playbackError = ref("");
	const audioRecoveryNotice = ref("");
	const songLibraryLoading = ref(false);
	const songLibraryBootstrapped = ref(false);
	const songLibraryLoaded = ref(false);
	const showLyrics = ref(false);
	const lyricsCloseRequest = computed(() => playerPresence.lyricsCloseRequest);
	const expandRequest = computed(() => playerPresence.expandRequest);
	const expandPlayer = () => {
		playerPresence.requestExpand();
	};
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

	const {
		queue,
		shuffledQueue,
		currentAlbum,
		isShuffled,
		repeatMode,
		playbackMode,
		activeQueue,
		getActiveList,
		recomputeShuffledQueue,
		toggleShuffle,
		toggleRepeat,
		cyclePlaybackMode,
		setQueueFromCurrentItems,
		setQueueFromPodcastEpisodes,
		resetForSession: resetQueueForSession,
	} = createPlayerQueue({
		getCurrentSong: () => currentSong.value,
		getFallbackSongs: () => songs.value,
		onQueueOrShuffleChanged: () => {
			if (currentSongStartCached) prefetchQueueAudioStarts();
		},
		createPodcastSong: (feedItem) => podcastAdapter.createPodcastSong(feedItem),
		createPodcastEpisodeSong: (episode) =>
			podcastAdapter.createPodcastEpisodeSong(episode),
	});

	let audio: HTMLAudioElement | null = null;
	let cachedAudioObjectUrl = "";
	let playGeneration = 0;
	let playRequested = false;
	let reloadCurrentAudioFn = async (_automatic: boolean) => {};
	let startSongFn = (_song: Song, _startAt?: number, _persistPrevious?: boolean, _fromRecovery?: boolean) => {};

	const {
		recoverFromMediaError,
		resetAudioRecovery,
		hasRecoveryTimer,
		clearRecoveryTimer,
	} = createPlayerAudioRecovery({
		getCurrentSong: () => currentSong.value,
		getActiveList: () => getActiveList(),
		getPlayGeneration: () => playGeneration,
		getAudio: () => audio,
		setPlaybackError: (err) => {
			playbackError.value = err;
		},
		setAudioRecoveryNotice: (notice) => {
			audioRecoveryNotice.value = notice;
		},
		reloadCurrentAudio: (forceReload) => reloadCurrentAudioFn(forceReload),
		startSong: (song, startAt, persistPrevious, fromRecovery) => startSongFn(song, startAt, persistPrevious, fromRecovery),
	});

	let registerMediaSessionHandlers = (_playerTarget?: HTMLAudioElement | null) => {};
	let currentSongStartCached = false;
	const audioPrefetcher = new AudioPrefetcher();
	let audioStartPrefetchKey: string | null = null;

	function releaseCachedAudioObjectUrl() {
		if (!cachedAudioObjectUrl) return;
		URL.revokeObjectURL(cachedAudioObjectUrl);
		cachedAudioObjectUrl = "";
	}

	const {
		isCurrentAudioCached,
		isAudioCaching,
		audioCacheError,
		syncCachedStatus,
		checkAudioCache,
		checkCurrentSongAudioCached,
		cacheCurrentAudio,
		removeCurrentAudio,
		resetForSession: resetOfflineForSession,
	} = createPlayerOfflineState({
		getCurrentSong: () => currentSong.value,
		getPlayGeneration: () => playGeneration,
		releaseCachedAudioObjectUrl,
	});
	let songsRequest: Promise<void> | null = null;
	let musicAccountGeneration = 0;

	const {
		saveMusicProgress,
		saveMusicSession,
		restoreMusicSession,
		restoreMusicProgress,
		restoreMusicPlayback,
		resetForSession: resetProgressForSession,
	} = createPlayerProgressSync({
		getCurrentSong: () => currentSong.value,
		setCurrentSong: (song) => {
			currentSong.value = song;
		},
		getQueue: () => queue.value,
		setQueue: (newQueue) => {
			queue.value = newQueue;
		},
		setCurrentAlbum: (album) => {
			currentAlbum.value = album;
		},
		getCurrentTime: () => currentTime.value,
		setCurrentTime: (time) => {
			currentTime.value = time;
		},
		getDuration: () => duration.value,
		setDuration: (dur) => {
			duration.value = dur;
		},
		getPlaybackMode: () => playbackMode.value,
		setPlaybackMode: (mode) => {
			playbackMode.value = mode;
		},
		setIsPlaying: (playing) => {
			isPlaying.value = playing;
		},
		getAudio: () => audio,
		getIsAuthenticated: () => authStore.isAuthenticated,
		getUserUuid: () => authStore.user?.uuid,
		getMusicAccountGeneration: () => musicAccountGeneration,
		getPlayGeneration: () => playGeneration,
		resolvePlaybackAudioUrl,
	});

	const shouldPauseAudio = (player: HTMLAudioElement) =>
		!player.paused || isPlaying.value || playRequested;

	if (typeof window !== "undefined") {
		window.addEventListener("pagehide", () => {
			saveMusicProgress(false, true);
			saveMusicSession(true);
			savePlaybackState();
		});
	}

	watch(
		[() => authStore.isAuthenticated, () => authStore.user?.uuid],
		([isAuthenticated]) => {
			if (isAuthenticated) void restoreMusicPlayback();
			else {
				resetProgressForSession();
			}
		},
		{ immediate: true },
	);

	setForeignPlayRequestCallback((meta) => {
		if (!audio || !shouldPauseAudio(audio)) return;

		// 并发仲裁：若 600ms 内双方均发起起播，后发者胜，防止双停死锁
		const COLLISION_WINDOW_MS = 600;
		const isRecentPlay = Date.now() - lastPlayInitiatedAt < COLLISION_WINDOW_MS;
		if (isRecentPlay && isPlaying.value && meta && typeof meta.timestamp === "number") {
			const isForeignWinner =
				meta.timestamp > lastPlayInitiatedAt ||
				(meta.timestamp === lastPlayInitiatedAt && meta.tabId > playerTabId);

			if (!isForeignWinner) {
				// 本标签页胜出，保持播放，避免互相暂停
				return;
			}
		}

		playGeneration += 1;
		playRequested = false;
		isLoading.value = false;
		resetAudioRecovery();

		savePodcastProgress();
		saveMusicProgress(false, true);
		saveMusicSession(true);
		savePlaybackState();

		audio.pause();
		isPlaying.value = false;
		pauseListening();
		updateMediaSessionPlaybackState("paused");
	});
	let podcastTracker: PodcastTrackerInstance | null = null;

	const {
		pauseListening,
		resumeListening,
		resetListening,
		ensureListening,
		reportRecommendationEvent,
		clearListeningTimer,
		resetForSession: resetListeningForSession,
	} = createPlayerAnalytics({
		getCurrentSong: () => currentSong.value,
		getIsAuthenticated: () => authStore.isAuthenticated,
	});

	const resetAudioStartPrefetch = () => {
		audioPrefetcher.abortPending();
		audioStartPrefetchKey = null;
	};

	const resetPlaybackForSession = () => {
		resetAudioRecovery();
		clearMediaSession();
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
		resetOfflineForSession();
		resetListeningForSession();
		podcastTracker = null;
		currentSongStartCached = false;
		audioPrefetcher.reset();
		songsRequest = null;
		resetProgressForSession();
		songs.value = [];
		resetQueueForSession();
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

	void initMediaOfflineCacheIndex();

	function prefetchQueueAudioStarts() {
		const current = currentSong.value;
		const effectiveQueue =
			activeQueue.value.length > 0 ? activeQueue.value : queue.value;
		if (!current || effectiveQueue.length < 2) return;

		const currentKey = playbackItemKey(current);
		const queueKey = effectiveQueue
			.map(
				(song) =>
					`${playbackItemKey(song)}:${resolvePlaybackAudioUrl(song.audio_url)}`,
			)
			.join("|");
		const prefetchKey = `${isShuffled.value ? "shuffled" : "normal"}|${currentKey}|${queueKey}`;
		if (audioStartPrefetchKey === prefetchKey) return;

		resetAudioStartPrefetch();
		audioStartPrefetchKey = prefetchKey;
		const signal = audioPrefetcher.getAbortSignal();
		const urls = buildPrefetchCandidates(
			effectiveQueue,
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
		resetAudioRecovery();
		playGeneration += 1;
		playRequested = false;
		player.pause();
		isPlaying.value = false;
		isLoading.value = false;
		pauseListening();
		savePodcastProgress();
		saveMusicProgress(false, true);
		saveMusicSession(true);
		savePlaybackState();
		updateMediaSessionPlaybackState("paused");
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
			updateMediaSessionPlaybackState("paused");
		});
		nextAudio.addEventListener("error", () => {
			if (audio !== nextAudio) return;
			// Repeated browser error events after all queue candidates failed
			// must not replace the actionable terminal error message.
			if (playbackError.value.startsWith("队列音源均无法播放")) return;
			const wasActive = playRequested || isPlaying.value || isLoading.value;
			playRequested = false;
			isLoading.value = false;
			isPlaying.value = false;
			pauseListening();
			if (hasRecoveryTimer() || (wasActive && recoverFromMediaError(nextAudio))) return;
			playbackError.value = "音频加载失败，请重试";
			updateMediaSessionPlaybackState("paused");
		});
		nextAudio.addEventListener("canplay", () => {
			if (audio !== nextAudio) return;
			isLoading.value = false;
			if (!currentSong.value) return;
			currentSongStartCached = true;
			prefetchQueueAudioStarts();
		});
		const updateBuffered = () => {
			bufferedTime.value = computeBufferedTime(nextAudio);
		};
		nextAudio.addEventListener("progress", updateBuffered);
		nextAudio.addEventListener("timeupdate", () => {
			if (audio !== nextAudio) return;
			if (nextAudio.currentTime === 0 && currentTime.value > 0 && nextAudio.paused) {
				return;
			}
			currentTime.value = nextAudio.currentTime;
			// A brief playable prefix is not proof of a healthy song: keep the
			// failed-track guard until a full song completes, preventing loops
			// through sources that each fail after a few seconds.
			if (!nextAudio.paused && currentTime.value >= 1) {
				audioRecoveryNotice.value = "";
			}
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
			resetAudioRecovery();
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
			const targetPosition = currentTime.value;
			if (targetPosition > 0) {
				if (nextAudio.readyState >= HTMLMediaElement.HAVE_METADATA) {
					try {
						nextAudio.currentTime = targetPosition;
					} catch {}
				} else {
					nextAudio.addEventListener(
						"loadedmetadata",
						() => {
							try {
								nextAudio.currentTime = targetPosition;
							} catch {}
						},
						{ once: true },
					);
				}
			}
		}

		registerMediaSessionHandlers(nextAudio);

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
		lastPlayInitiatedAt = Date.now();
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
				updateMediaSessionPlaybackState("playing");
			})
			.catch((err) => {
				if (generation !== playGeneration || player !== audio) return;
				playRequested = false;
				isLoading.value = false;
				playbackError.value = "无法播放此音频，请重试";
				isPlaying.value = false;
				pauseListening();
				updateMediaSessionPlaybackState("paused");
			});
	};

	let playbackProgressSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let lastPlaybackStateSavedAt = 0;
	const THROTTLE_SAVE_INTERVAL_MS = 2500;

	const savePlaybackState = () => {
		if (typeof localStorage === "undefined") return;

		try {
			if (!currentSong.value) {
				localStorage.removeItem("playbackState");
				return;
			}

			const state: PersistedPlaybackState = {
				version: CURRENT_PLAYBACK_STATE_VERSION,
				savedAt: Date.now(),
				song: compactPlaybackSong(currentSong.value),
				queue: queue.value.map(compactPlaybackSong),
				currentTime: audio?.currentTime ?? currentTime.value,
				volume: volume.value,
				isShuffled: isShuffled.value,
				repeatMode: repeatMode.value,
				playbackMode: playbackMode.value,
			};

			localStorage.setItem("playbackState", JSON.stringify(state));
			lastPlaybackStateSavedAt = Date.now();
		} catch (error) {
			reportError(error, "Failed to persist playback state:");
		}
	};

	const schedulePlaybackStateSave = (immediate = false) => {
		const now = Date.now();
		if (immediate || now - lastPlaybackStateSavedAt >= THROTTLE_SAVE_INTERVAL_MS) {
			if (playbackProgressSaveTimer !== null) {
				clearTimeout(playbackProgressSaveTimer);
				playbackProgressSaveTimer = null;
			}
			savePlaybackState();
			return;
		}

		if (playbackProgressSaveTimer === null) {
			playbackProgressSaveTimer = setTimeout(() => {
				playbackProgressSaveTimer = null;
				savePlaybackState();
			}, 1000);
		}
	};

	const restorePlaybackState = () => {
		if (typeof localStorage === "undefined") return;

		const savedState = localStorage.getItem("playbackState");
		if (!savedState) return;

		try {
			const state = JSON.parse(savedState) as PersistedPlaybackState;
			if (isPlaybackStateExpired(state)) {
				localStorage.removeItem("playbackState");
				return;
			}

			const restoredVol = typeof state.volume === "number" ? state.volume : 1;
			volume.value = restoredVol;
			if (restoredVol > 0) {
				lastNonZeroVolume.value = restoredVol;
			}
			isShuffled.value = Boolean(state.isShuffled);
			repeatMode.value = (state.repeatMode as RepeatMode) || "all";
			playbackMode.value = (state.playbackMode as PlaybackMode) || "loop";

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

			const songDuration =
				(typeof (restoredSong as any)?.duration === "number"
					? (restoredSong as any).duration
					: 0) ||
				(typeof (restoredSong as any)?.duration_seconds === "number"
					? (restoredSong as any).duration_seconds
					: 0);

			const isPodcast = restoredSong?.source_type === "podcast_episode";
			let targetProgress = typeof state.currentTime === "number" ? state.currentTime : 0;

			// 如果普通歌曲进度超过 24 小时，进度归零
			if (!isPodcast && isPlaybackProgressStale(state)) {
				targetProgress = 0;
			} else {
				targetProgress = sanitizeResumePosition(targetProgress, songDuration, isPodcast);
			}

			currentTime.value = targetProgress;
			currentSong.value = restoredSong;
			queue.value = restoredQueue;
			currentAlbum.value = null;
			isPlaying.value = false;
			duration.value = songDuration;
		} catch (error) {
			reportError(error, "Failed to restore playback state:");
		}
	};

	restorePlaybackState();

	watch(currentTime, () => {
		schedulePlaybackStateSave(false);
	});

	watch(
		[currentSong, volume, isShuffled, repeatMode, playbackMode, queue],
		() => schedulePlaybackStateSave(true),
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

	const startSong = (song: Song, startAt?: number, persistPrevious = true, fromRecovery = false) => {
		if (!fromRecovery) resetAudioRecovery();
		else clearRecoveryTimer();
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
				// Preserve the established random order and refresh its metadata
				// without generating a different shuffle during lyric hydration.
				if (shuffledQueue.value.length > 0) {
					shuffledQueue.value = shuffledQueue.value.map(item =>
						playbackItemKey(item) === playbackItemKey(normalizedSong) ? { ...item, ...update } : item,
					);
				}
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
			syncCachedStatus(normalizedSong.audio_url);
			player.volume = computeActualVolume(volume.value);
			applyResumePosition();
			if (resumePosition > 0) {
				player.addEventListener("loadedmetadata", applyResumePosition, {
					once: true,
				});
			}
			attemptPlay(player, generation);
			void checkCurrentSongAudioCached(generation);
		};

		if (audio && !audio.paused && audio.currentTime > 0) {
			void transitionAudioSource(player, normalizedSong.audio_url, applySongSourceAndPlay);
		} else {
			applySongSourceAndPlay();
		}

		duration.value = normalizedSong.duration || (normalizedSong as any).duration_seconds || 0;
		podcastTracker = null;

		const displayArtist =
			song.artists && song.artists.length > 0
				? song.artists
						.map((a: any) => (typeof a === "string" ? a : a?.name || ""))
						.filter(Boolean)
						.join(", ")
				: song.artist || "未知艺术家";

		const displayAlbum =
			song.source_type === "podcast_episode"
				? song.album || "播客"
				: song.album || "未知专辑";

		updateMediaSessionMetadata({
			title: song.title,
			artist: displayArtist,
			album: displayAlbum,
			artworkUrl: song.cover_url || "",
		});
		registerMediaSessionHandlers(player);

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
	startSongFn = startSong;

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
		resetAudioRecovery();
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
		const targetPosition = currentTime.value;
		if (targetPosition > 0) {
			if (player.readyState >= HTMLMediaElement.HAVE_METADATA) {
				try {
					if (Math.abs(player.currentTime - targetPosition) > 0.05) {
						player.currentTime = targetPosition;
					}
				} catch {
					// Metadata may not be available yet
				}
			} else {
				player.addEventListener(
					"loadedmetadata",
					() => {
						try {
							if (Math.abs(player.currentTime - targetPosition) > 0.05) {
								player.currentTime = targetPosition;
							}
						} catch {}
					},
					{ once: true },
				);
			}
		}

		if (shouldPauseAudio(player)) {
			pauseCurrentAudio(player);
		} else {
			ensureListening(currentSong.value);
			attemptPlay(player);
		}
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
		// Single-track repeat applies only to natural playback completion.
		// Manual next (including gestures and MediaSession) must advance.
		if (completed && repeatMode.value === "one") {
			player.currentTime = 0;
			currentTime.value = 0;
			resetListening(currentSong.value);
			attemptPlay(player);
			return;
		} else if (currentIndex === -1) {
			nextIndex = 0;
		} else if (!completed || repeatMode.value === "all" || currentIndex < list.length - 1) {
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

	const {
		createPodcastSong,
		createPodcastEpisodeSong,
		readPodcastProgress,
	} = podcastAdapter;

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
		schedulePlaybackStateSave(true);
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

	const reloadCurrentAudio = async (automatic: boolean) => {
		if (!currentSong.value) return;
		if (!automatic) resetAudioRecovery();
		const player = ensureAudio();
		const resumePosition = currentTime.value;
		playbackError.value = "";
		isLoading.value = true;
		player.pause();
		let targetSrc = resolvePlaybackAudioUrl(currentSong.value.audio_url);
		const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
		if (isCurrentAudioCached.value || isOffline) {
			const blobUrl = await getCachedMediaObjectURL(currentSong.value.audio_url);
			if (blobUrl) {
				releaseCachedAudioObjectUrl();
				cachedAudioObjectUrl = blobUrl;
				targetSrc = blobUrl;
				isCurrentAudioCached.value = true;
			}
		}
		player.src = targetSrc;
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
	reloadCurrentAudioFn = reloadCurrentAudio;

	const { registerMediaSessionHandlers: setupMediaSessionHandlers } =
		createPlayerMediaSession({
			getCurrentSong: () => currentSong.value,
			getIsPlaying: () => isPlaying.value,
			getCurrentTime: () => currentTime.value,
			getDuration: () => duration.value,
			getPlaybackRate: () => playbackRate.value,
			setCurrentTime: (time) => {
				currentTime.value = time;
			},
			getAudio: () => audio,
			setupMediaSession,
			updateMediaSessionPosition,
			updateMediaSessionPlaybackState,
			updateMediaSessionMetadata,
			attemptPlay: (audioTarget) => attemptPlay(audioTarget),
			shouldPauseAudio: (audioTarget) => shouldPauseAudio(audioTarget),
			pauseCurrentAudio: (audioTarget) => pauseCurrentAudio(audioTarget),
			seek: (time) => seek(time),
			skip: (seconds) => skip(seconds),
			playPrevious: () => playPrevious(),
			playNext: () => playNext(),
		});
	registerMediaSessionHandlers = setupMediaSessionHandlers;

	// Deliberately no parameters: Vue @click may pass MouseEvent, which must
	// never turn a manual retry into an automatic recovery attempt.
	const retryPlayback = () => reloadCurrentAudio(false);

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
		isCurrentAudioCached,
		isAudioCaching,
		audioCacheError,
		playbackError,
		audioRecoveryNotice,
		songLibraryLoading,
		songLibraryBootstrapped,
		queue,
		activeQueue,
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
		cacheCurrentAudio,
		removeCurrentAudio,
		checkCurrentSongAudioCached,
		showLyrics,
		lyricsCloseRequest,
		expandRequest,
		expandPlayer,
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
		resetPlaybackForSession,
	};
});

export const useAudioPlayerStore = usePlayerStore;
