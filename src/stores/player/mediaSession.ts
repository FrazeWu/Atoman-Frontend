import type { Song } from "@/types";

export interface CreatePlayerMediaSessionOptions {
	getCurrentSong: () => Song | null;
	getIsPlaying: () => boolean;
	getCurrentTime: () => number;
	getDuration: () => number;
	getPlaybackRate: () => number;
	setCurrentTime: (time: number) => void;
	getAudio: () => HTMLAudioElement | null;
	setupMediaSession: (handlers: any) => void;
	updateMediaSessionPosition: (pos: { duration: number; playbackRate: number; position: number }) => void;
	updateMediaSessionPlaybackState: (state: "playing" | "paused" | "none") => void;
	updateMediaSessionMetadata: (meta: { title: string; artist?: string; album?: string; artworkUrl?: string }) => void;
	attemptPlay: (audio: HTMLAudioElement) => void;
	shouldPauseAudio: (audio: HTMLAudioElement) => boolean;
	pauseCurrentAudio: (audio: HTMLAudioElement) => void;
	seek: (time: number) => void;
	skip: (seconds: number) => void;
	playPrevious: () => void;
	playNext: () => void;
}

export function createPlayerMediaSession(options: CreatePlayerMediaSessionOptions) {
	const registerMediaSessionHandlers = (playerTarget?: HTMLAudioElement | null) => {
		const targetAudio = playerTarget || options.getAudio();
		const isIOS =
			typeof navigator !== "undefined" &&
			(/iPad|iPhone|iPod/.test(navigator.userAgent) ||
				(navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1));

		const isPodcast = options.getCurrentSong()?.source_type === "podcast_episode";
		const allowSeekButtons = !isIOS || isPodcast;

		options.setupMediaSession({
			play: () => {
				if (options.getCurrentSong() && !options.getIsPlaying() && targetAudio) {
					options.attemptPlay(targetAudio);
				}
			},
			pause: () => {
				if (targetAudio && options.shouldPauseAudio(targetAudio)) {
					options.pauseCurrentAudio(targetAudio);
				}
			},
			stop: () => {
				if (targetAudio && options.shouldPauseAudio(targetAudio)) {
					options.pauseCurrentAudio(targetAudio);
				}
				options.seek(0);
				options.updateMediaSessionPlaybackState("none");
			},
			previoustrack: () => {
				if (options.getCurrentTime() > 3) {
					options.seek(0);
					options.updateMediaSessionPosition({
						duration: options.getDuration(),
						playbackRate: options.getPlaybackRate(),
						position: 0,
					});
					return;
				}
				options.playPrevious();
			},
			nexttrack: options.playNext,
			seekto: (details: { seekTime?: number; fastSeek?: boolean }) => {
				if (details.seekTime !== undefined) {
					if (details.fastSeek && targetAudio && typeof (targetAudio as any).fastSeek === "function") {
						try {
							(targetAudio as any).fastSeek(details.seekTime);
							options.setCurrentTime(details.seekTime);
						} catch {
							options.seek(details.seekTime);
						}
					} else {
						options.seek(details.seekTime);
					}
					options.updateMediaSessionPosition({
						duration: options.getDuration(),
						playbackRate: options.getPlaybackRate(),
						position: details.seekTime,
					});
				}
			},
			seekbackward: allowSeekButtons
				? (details: { seekOffset?: number }) => {
						const offset = details.seekOffset || (isPodcast ? 15 : 10);
						options.skip(-offset);
						options.updateMediaSessionPosition({
							duration: options.getDuration(),
							playbackRate: options.getPlaybackRate(),
							position: options.getCurrentTime(),
						});
					}
				: null,
			seekforward: allowSeekButtons
				? (details: { seekOffset?: number }) => {
						const offset = details.seekOffset || (isPodcast ? 15 : 10);
						options.skip(offset);
						options.updateMediaSessionPosition({
							duration: options.getDuration(),
							playbackRate: options.getPlaybackRate(),
							position: options.getCurrentTime(),
						});
					}
				: null,
			skip: (seconds: number) => {
				options.skip(seconds);
				options.updateMediaSessionPosition({
					duration: options.getDuration(),
					playbackRate: options.getPlaybackRate(),
					position: options.getCurrentTime(),
				});
			},
		});
	};

	const syncMediaSessionMetadata = (song: Song | null) => {
		if (!song) return;
		options.updateMediaSessionMetadata({
			title: song.title,
			artist: song.artist,
			album: song.album || undefined,
			artworkUrl: song.cover_url || undefined,
		});
	};

	return {
		registerMediaSessionHandlers,
		syncMediaSessionMetadata,
	};
}
