import { reportError } from "@/utils/logger";
import { apiRequestResult } from "@/api/client";
import { defineStore, getActivePinia } from "pinia";
import { onScopeDispose, ref, watch } from "vue";
import type { Song, RepeatMode, TimelineItem, PodcastEpisode } from "@/types";
import { useApi } from "@/composables/useApi";
import {
	getMusicPlaybackProgress,
	getMusicPlaybackSession,
	recordMusicRecommendationEvents,
	recordMusicSongPlay,
	saveMusicPlaybackProgress,
	saveMusicPlaybackSession,
} from "@/api/musicV1";
import {
	readPodcastProgress,
	writePodcastProgress,
} from "@/composables/usePodcastProgress";
import {
	createContentConsumptionTracker,
	useContentLifecycle,
} from "@/composables/useContentLifecycle";
import { useAuthStore } from "@/stores/auth";
import { registerSessionReset } from "@/stores/sessionReset";
import { useAudioPlayerSync } from "@/composables/useAudioPlayerSync";

const api = useApi();
const audioStartPrefetchBytes = 512 * 1024;
const audioStartPrefetchConcurrency = 4;

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

function resolveUploadedMediaUrl(url: string) {
	if (!url.startsWith("/uploads/")) return url;
	if (!api.url.startsWith("http://") && !api.url.startsWith("https://"))
		return url;
	try {
		return `${new URL(api.url).origin}${url}`;
	} catch {
		return url;
	}
}

function resolvePlaybackAudioUrl(url: string) {
	const resolved = resolveUploadedMediaUrl(url);
	try {
		const parsed = new URL(resolved);
		if (parsed.hostname !== "assets.atoman.org") return resolved;
		parsed.searchParams.set("cors", "1");
		return parsed.toString();
	} catch {
		return resolved;
	}
}

function normalizePlaybackSong(song: Song) {
	return { ...song, audio_url: resolvePlaybackAudioUrl(song.audio_url) };
}

function compactPlaybackSong(song: Song): Song {
	const { lyrics: _lyrics, waveform_peaks: _waveformPeaks, ...compact } = song;
	return compact as Song;
}

function playbackItemKey(song: Song) {
	const sourceType = song.source_type || "music";
	return `${sourceType}:${song.source_id || song.id}`;
}

export const usePlayerStore = defineStore("player", () => {
	const lifecycle = useContentLifecycle();
	const authStore = useAuthStore();
	const {
		broadcastPlayRequest,
		setForeignPlayRequestCallback,
		setupMediaSession,
		updateMediaSessionMetadata,
		updateMediaSessionPosition,
	} = useAudioPlayerSync();
	const songs = ref<Song[]>([]);
	const currentSong = ref<Song | null>(null);
	const isPlaying = ref(false);
	const isShuffled = ref(false);
	const repeatMode = ref<RepeatMode>("all");
	const playbackMode = ref<PlaybackMode>("loop");
	const volume = ref(1);
	const currentTime = ref(0);
	const duration = ref(0);
	const isLoading = ref(false);
	const playbackError = ref("");
	const songLibraryLoading = ref(false);
	const songLibraryBootstrapped = ref(false);
	const songLibraryLoaded = ref(false);
	const showLyrics = ref(false);
	const showQueue = ref(false);
	const isPinned = ref(
		typeof localStorage === "undefined" ||
			localStorage.getItem("playerPinned") !== "false",
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

	const shuffleArray = <T>(array: T[]): T[] => {
		const arr = [...array];
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	};

	const recomputeShuffledQueue = () => {
		if (!isShuffled.value) {
			shuffledQueue.value = [];
			return;
		}
		const list = queue.value.length > 0 ? queue.value : songs.value;
		if (list.length === 0) return;

		const newList = shuffleArray(list);
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
	let playGeneration = 0;
	let currentSongStartCached = false;
	let audioStartPrefetchController: AbortController | null = null;
	let audioStartPrefetchKey: string | null = null;
	const prefetchedAudioStartUrls = new Set<string>();
	let songsRequest: Promise<void> | null = null;
	let musicProgressLastSavedAt = 0;
	let musicProgressRestored = false;
	let musicSessionLastSavedAt = 0;
	let musicSessionRestored = false;
	let musicAccountGeneration = 0;

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
		void saveMusicPlaybackProgress({
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
		cover_url?: string;
		lyrics?: string;
		waveform_peaks?: number[];
		track_number?: number;
	}): Song =>
		normalizePlaybackSong({
			id: source.id,
			title: source.title,
			artist:
				source.artists?.map((artist) => artist.name).join(" / ") ||
				"未知艺术家",
			album: source.album?.title || "",
			album_id: source.album?.id || "",
			audio_url: source.audio_url || "",
			cover_url: source.cover_url || source.album?.cover_url || "",
			lyrics: source.lyrics || "",
			waveform_peaks: source.waveform_peaks,
			track_number: source.track_number,
			status: "open",
		} as Song);

	const restoreMusicSession = async () => {
		if (!authStore.isAuthenticated || musicSessionRestored) return false;
		const generation = musicAccountGeneration;
		const userID = authStore.user?.uuid;
		musicSessionRestored = true;
		try {
			const session = await getMusicPlaybackSession();
			if (
				generation !== musicAccountGeneration ||
				!authStore.isAuthenticated ||
				authStore.user?.uuid !== userID
			)
				return false;
			if (!session?.queue?.length) return false;
			const restoredQueue = session.queue
				.filter((song) => Boolean(song.audio_url))
				.map(musicSongFromAPI);
			const restoredCurrentSong = restoredQueue.find(
				(song) => String(song.id) === session.current_song_id,
			);
			if (!restoredCurrentSong) return false;
			queue.value = restoredQueue;
			currentAlbum.value = null;
			currentSong.value = restoredCurrentSong;
			currentTime.value = session.position_seconds;
			playbackMode.value = session.playback_mode;
			isPlaying.value = false;
			return true;
		} catch (error) {
			reportError(error, "Failed to restore music playback session:");
			return false;
		}
	};

	const restoreMusicProgress = async () => {
		if (!authStore.isAuthenticated || musicProgressRestored) return;
		const generation = musicAccountGeneration;
		const userID = authStore.user?.uuid;
		musicProgressRestored = true;
		try {
			const progress = await getMusicPlaybackProgress();
			if (
				generation !== musicAccountGeneration ||
				!authStore.isAuthenticated ||
				authStore.user?.uuid !== userID
			)
				return;
			if (!progress?.song?.audio_url || progress.completed) return;
			const source = progress.song;
			const song = musicSongFromAPI(source);
			currentSong.value = song;
			queue.value = [song];
			currentAlbum.value = null;
			currentTime.value = progress.position_seconds;
			duration.value = progress.duration_seconds;
			isPlaying.value = false;
		} catch (error) {
			reportError(error, "Failed to restore music playback progress:");
		}
	};

	const restoreMusicPlayback = async () => {
		const generation = musicAccountGeneration;
		if (await restoreMusicSession()) return;
		if (generation !== musicAccountGeneration) return;
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
		if (isPlaying.value && audio) {
			playGeneration += 1;
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
	let podcastTracker: ReturnType<
		typeof createContentConsumptionTracker
	> | null = null;

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
			events: [{
				event,
				entity_type: "song",
				entity_id: String(song.id),
				position: context.position,
				reason: context.reason,
			}],
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
		void recordMusicSongPlay(songId).catch((error) => {
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
			!song.source_type || song.source_type === "music"
				? String(song.id)
				: null;
		playReported = false;
	};

	const resetAudioStartPrefetch = () => {
		audioStartPrefetchController?.abort();
		audioStartPrefetchController = null;
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
		clearListeningTimer();
		listeningStartedAt = null;
		listenedMs = 0;
		listeningSongId = null;
		playReported = false;
		podcastTracker = null;
		currentSongStartCached = false;
		prefetchedAudioStartUrls.clear();
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
		const controller = new AbortController();
		audioStartPrefetchController = controller;
		const urls = [
			...new Set(
				queue.value
					.filter(
						(song) =>
							playbackItemKey(song) !== currentKey && Boolean(song.audio_url),
					)
					.map((song) => resolvePlaybackAudioUrl(song.audio_url))
					.filter((url) => !prefetchedAudioStartUrls.has(url)),
			),
		];
		let nextUrlIndex = 0;
		const prefetch = async () => {
			while (!controller.signal.aborted) {
				const url = urls[nextUrlIndex++];
				if (!url) return;
				try {
					const response = await fetch(url, {
						cache: "force-cache",
						headers: {
							Range: `bytes=0-${audioStartPrefetchBytes - 1}`,
						},
						signal: controller.signal,
					});
					if (response.status !== 206) {
						await response.body?.cancel();
						continue;
					}
					await response.arrayBuffer();
					prefetchedAudioStartUrls.add(url);
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
		).then(() => {
			if (audioStartPrefetchController === controller)
				audioStartPrefetchController = null;
		});
	}

	const pauseCurrentAudio = (player: HTMLAudioElement) => {
		playGeneration += 1;
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
			isLoading.value = true;
			playbackError.value = "";
		});
		nextAudio.addEventListener("waiting", () => {
			if (isPlaying.value) isLoading.value = true;
		});
		nextAudio.addEventListener("playing", () => {
			isLoading.value = false;
			isPlaying.value = true;
			playbackError.value = "";
		});
		nextAudio.addEventListener("pause", () => {
			isPlaying.value = false;
			isLoading.value = false;
			pauseListening();
			if ("mediaSession" in navigator) {
				navigator.mediaSession.playbackState = "paused";
			}
		});
		nextAudio.addEventListener("error", () => {
			isLoading.value = false;
			isPlaying.value = false;
			playbackError.value = "音频加载失败，请重试";
			pauseListening();
			if ("mediaSession" in navigator) {
				navigator.mediaSession.playbackState = "paused";
			}
		});
		nextAudio.addEventListener("canplay", () => {
			isLoading.value = false;
			if (!currentSong.value) return;
			currentSongStartCached = true;
			prefetchQueueAudioStarts();
		});
		nextAudio.addEventListener("timeupdate", () => {
			currentTime.value = nextAudio.currentTime;
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
		nextAudio.volume = volume.value;

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
				if (isPlaying.value) pauseCurrentAudio(nextAudio);
			},
			previoustrack: playPrevious,
			nexttrack: playNext,
			seekto: (details) => {
				if (details.seekTime !== undefined) {
					seek(details.seekTime);
				}
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

		const normalizedSong = normalizePlaybackSong(refreshedSong);
		currentSong.value = normalizedSong;

		if (!audio) return;

		currentSongStartCached = false;
		resetAudioStartPrefetch();
		audio.src = normalizedSong.audio_url;
		audio.volume = volume.value;
		if (currentTime.value > 0) {
			audio.currentTime = currentTime.value;
		}
	};

	const attemptPlay = (
		player: HTMLAudioElement,
		generation = ++playGeneration,
	) => {
		isLoading.value = true;
		isPlaying.value = true;
		playbackError.value = "";
		player.volume = volume.value;
		player
			.play()
			.then(() => {
				if (generation !== playGeneration || player !== audio) return;
				broadcastPlayRequest();
				resumeListening();
				if ("mediaSession" in navigator) {
					navigator.mediaSession.playbackState = "playing";
				}
			})
			.catch(() => {
				if (generation !== playGeneration || player !== audio) return;
				isLoading.value = false;
				playbackError.value = "无法播放此音频，请重试";
				isPlaying.value = false;
				pauseListening();
				if ("mediaSession" in navigator) {
					navigator.mediaSession.playbackState = "paused";
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
			volume.value = typeof state.volume === "number" ? state.volume : 1;
			isShuffled.value = Boolean(state.isShuffled);
			repeatMode.value = state.repeatMode || "all";
			playbackMode.value = state.playbackMode || "loop";
			currentTime.value =
				typeof state.currentTime === "number" ? state.currentTime : 0;
			currentSong.value = state.song ? normalizePlaybackSong(state.song) : null;
			queue.value = Array.isArray(state.queue)
				? state.queue
				: state.song
					? [state.song]
					: [];
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
		savePodcastProgress();
		if (persistPrevious) saveMusicProgress(false, true);
		resetListening(song);
		currentSongStartCached = false;
		const player = ensureAudio();
		const normalizedSong = normalizePlaybackSong(song);
		const generation = ++playGeneration;
		currentSong.value = normalizedSong;
		playbackError.value = "";
		isLoading.value = true;
		player.src = normalizedSong.audio_url;
		player.volume = volume.value;
		const savedProgress =
			song.source_type === "podcast_episode" && song.source_id
				? readPodcastProgress(song.source_id)
				: null;
		currentTime.value =
			startAt ??
			(savedProgress?.completed ? 0 : savedProgress?.position_sec || 0);
		const resumePosition = currentTime.value;
		const applyResumePosition = () => {
			if (generation !== playGeneration || audio !== player) return;
			try {
				player.currentTime = resumePosition;
			} catch {
				// Metadata may not be available yet; loadedmetadata retries below.
			}
		};
		applyResumePosition();
		if (resumePosition > 0) {
			player.addEventListener("loadedmetadata", applyResumePosition, {
				once: true,
			});
		}
		duration.value = 0;
		podcastTracker = null;

		updateMediaSessionMetadata({
			title: song.title,
			artist: song.artist || "未知艺术家",
			album: song.album || "未知专辑",
			artworkUrl: song.cover_url || "",
		});

		if (song.source_type === "podcast_episode" && song.source_id) {
			const episodeID = song.source_id;
			podcastTracker = createContentConsumptionTracker({
				onEvent: (event) => {
					void lifecycle
						.recordEvent({
							module: "podcast",
							content_id: episodeID,
							event,
							position_sec: Math.floor(currentTime.value),
							duration_sec: Math.floor(duration.value),
							progress:
								duration.value > 0 ? currentTime.value / duration.value : 0,
						})
						.catch(() => undefined);
				},
				onProgress: (progress) => {
					if (!authStore.token) return;
					void lifecycle
						.saveProgress({
							module: "podcast",
							content_id: episodeID,
							position_sec: Math.floor(currentTime.value),
							duration_sec: Math.floor(duration.value),
							progress,
							completed: progress >= 0.95,
						})
						.catch(() => undefined);
				},
			});
			podcastTracker.open();
		}
		attemptPlay(player, generation);
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

		const player = ensureAudio();
		if (!player.src) {
			player.src = currentSong.value.audio_url;
		}
		player.volume = volume.value;
		if (currentTime.value > 0) {
			player.currentTime = currentTime.value;
		}

		if (isPlaying.value) {
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
		const nextMode =
			modes[(modes.indexOf(repeatMode.value) + 1) % modes.length];
		repeatMode.value = nextMode;
	};

	const cyclePlaybackMode = () => {
		const modes: PlaybackMode[] = ["loop", "single", "random"];
		const currentIndex = modes.indexOf(playbackMode.value);
		playbackMode.value = modes[(currentIndex + 1) % modes.length];
	};

	const createPodcastSong = (
		feedItem: TimelineItem["feed_item"],
	): Song | null => {
		if (!feedItem) return null;

		return {
			id: Number(feedItem.id),
			source_type: "feed_podcast",
			source_id: String(feedItem.id),
			title: feedItem.title || "未知播客",
			artist: feedItem.author || feedItem.feed_source?.title || "Podcast",
			album: feedItem.feed_source?.title || "Podcast",
			album_id: -1,
			year: new Date(feedItem.published_at || "").getFullYear() || 0,
			release_date: feedItem.published_at || "",
			lyrics: feedItem.summary || "",
			audio_url: feedItem.enclosure_url || "",
			media_kind: "feed_item",
			cover_url: feedItem.image_url || feedItem.feed_source?.cover_url || "",
			status: "approved" as const,
		};
	};

	const episodeCover = (episode: PodcastEpisode) =>
		episode.episode_cover_url ||
		episode.post?.cover_url ||
		episode.post?.collections?.[0]?.cover_url ||
		episode.collections?.[0]?.cover_url ||
		episode.channel?.cover_url ||
		"";

	const createPodcastEpisodeSong = (episode: PodcastEpisode): Song => ({
		id: `podcast:${episode.id}`,
		source_type: "podcast_episode",
		source_id: episode.id,
		title: episode.post?.title || "未命名单集",
		artist: episode.channel?.name || "播客",
		album:
			episode.post?.collections?.[0]?.name ||
			episode.collections?.[0]?.name ||
			episode.channel?.name ||
			"播客",
		album_id:
			episode.post?.collections?.[0]?.id ||
			episode.collections?.[0]?.id ||
			episode.channel_id,
		year: new Date(episode.created_at || "").getFullYear() || 0,
		release_date: episode.created_at || "",
		lyrics: episode.post?.content || "",
		audio_url: resolveUploadedMediaUrl(episode.audio_url),
		cover_url: resolveUploadedMediaUrl(episodeCover(episode)),
		track_number: episode.episode_number,
		status: "approved",
	});

	const setQueueFromCurrentItems = (items: TimelineItem[]) => {
		const podcastSongs: Song[] = items
			.filter(
				(item) => item.type === "feed_item" && item.feed_item?.enclosure_url,
			)
			.map((item) => createPodcastSong(item.feed_item))
			.filter((song): song is Song => Boolean(song));
		queue.value = podcastSongs;
	};

	const setQueueFromPodcastEpisodes = (episodes: PodcastEpisode[]) => {
		queue.value = episodes.map(createPodcastEpisodeSong);
	};

	function savePodcastProgress(completed = false) {
		const song = currentSong.value;
		if (song?.source_type !== "podcast_episode" || !song.source_id) return;
		const playerDuration = audio?.duration;
		const durationSec = Number.isFinite(playerDuration)
			? Math.floor(playerDuration || 0)
			: Math.floor(duration.value || 0);
		writePodcastProgress({
			episode_id: song.source_id,
			position_sec: Math.floor(audio?.currentTime ?? currentTime.value),
			duration_sec: durationSec,
			completed,
			last_played_at: new Date().toISOString(),
		});
		podcastTracker?.update(
			completed
				? 1
				: durationSec > 0
					? Math.floor(audio?.currentTime ?? currentTime.value) / durationSec
					: 0,
		);
	}

	const setVolume = (v: number) => {
		volume.value = v;
		if (audio) {
			audio.volume = v;
		}
	};

	const seek = (time: number) => {
		currentTime.value = time;
		if (audio) {
			audio.currentTime = time;
		}
	};

	const skip = (seconds: number) => {
		if (!audio) return;
		const audioDuration = Number.isFinite(audio.duration) && audio.duration > 0
			? audio.duration
			: duration.value;
		const targetTime = audio.currentTime + seconds;
		const newTime = audioDuration > 0
			? Math.min(targetTime, audioDuration)
			: targetTime;
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
		setQueueFromCurrentItems,
		setQueueFromPodcastEpisodes,
		setVolume,
		seek,
		skip,
		retryPlayback,
		showLyrics,
		toggleLyrics,
		showQueue,
		toggleQueue,
		isPinned,
		playbackItemKey,
		togglePinned,
	};
});
