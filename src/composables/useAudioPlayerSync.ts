import { getCurrentInstance, onBeforeUnmount } from "vue";

export type AudioSyncMessage = { type: "PLAY_REQUEST"; tabId: string };

export function useAudioPlayerSync() {
	const channelName = "atoman_audio_sync";
	let channel: BroadcastChannel | null = null;
	const tabId = Math.random().toString(36).substring(2, 9);

	const callbacks = {
		onForeignPlayRequest: () => {},
	};

	if (typeof window !== "undefined" && "BroadcastChannel" in window) {
		channel = new BroadcastChannel(channelName);
		channel.onmessage = (event) => {
			const msg = event.data as AudioSyncMessage;
			if (msg.tabId === tabId) return;

			if (msg.type === "PLAY_REQUEST") {
				callbacks.onForeignPlayRequest();
			}
		};
	}

	const broadcastPlayRequest = () => {
		if (channel) {
			channel.postMessage({ type: "PLAY_REQUEST", tabId });
		}
	};

	const setForeignPlayRequestCallback = (cb: () => void) => {
		callbacks.onForeignPlayRequest = cb;
	};

	// Media Session API Support
	const setupMediaSession = (handlers: {
		play: () => void;
		pause: () => void;
		previoustrack: () => void;
		nexttrack: () => void;
		seekto: (details: MediaSessionActionDetails) => void;
	}) => {
		if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
			const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
				["play", handlers.play],
				["pause", handlers.pause],
				["previoustrack", handlers.previoustrack],
				["nexttrack", handlers.nexttrack],
				["seekto", handlers.seekto],
			];
			for (const [action, handler] of actions) {
				try {
					navigator.mediaSession.setActionHandler(action, handler);
				} catch {
					// Browsers expose Media Session while supporting only a subset of actions.
				}
			}
		}
	};

	const updateMediaSessionMetadata = (metadata: {
		title: string;
		artist: string;
		album: string;
		artworkUrl: string;
	}) => {
		if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
			try {
				navigator.mediaSession.metadata = new MediaMetadata({
					title: metadata.title,
					artist: metadata.artist,
					album: metadata.album,
					artwork: metadata.artworkUrl
						? [
								{
									src: metadata.artworkUrl,
									sizes: "512x512",
									type: "image/jpeg",
								},
							]
						: [],
				});
			} catch {
				// Metadata is optional on partial Media Session implementations.
			}
		}
	};

	const updateMediaSessionPosition = (state: {
		duration: number;
		playbackRate: number;
		position: number;
	}) => {
		if (
			typeof navigator !== "undefined" &&
			"mediaSession" in navigator &&
			navigator.mediaSession.setPositionState
		) {
			try {
				if (
					state.duration > 0 &&
					state.position >= 0 &&
					state.position <= state.duration
				) {
					navigator.mediaSession.setPositionState({
						duration: state.duration,
						playbackRate: state.playbackRate,
						position: state.position,
					});
				} else {
					navigator.mediaSession.setPositionState(undefined);
				}
			} catch {
				// Position state is best-effort and unsupported on some devices.
			}
		}
	};

	if (getCurrentInstance()) {
		onBeforeUnmount(() => channel?.close());
	}

	return {
		broadcastPlayRequest,
		setForeignPlayRequestCallback,
		setupMediaSession,
		updateMediaSessionMetadata,
		updateMediaSessionPosition,
	};
}
