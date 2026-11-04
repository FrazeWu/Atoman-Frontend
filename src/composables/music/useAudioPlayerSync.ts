import {
	buildMediaSessionArtwork,
	sanitizeMediaPositionState,
} from "@/utils/mediaSession";

export type AudioSyncMessage = {
	type: "PLAY_REQUEST";
	tabId: string;
	timestamp: number;
};

export type MediaSessionHandlers = {
	play: () => void;
	pause: () => void;
	stop?: (() => void) | null;
	previoustrack?: (() => void) | null;
	nexttrack?: (() => void) | null;
	seekto?: ((details: MediaSessionActionDetails) => void) | null;
	seekbackward?: ((details: MediaSessionActionDetails) => void) | null;
	seekforward?: ((details: MediaSessionActionDetails) => void) | null;
	skip?: ((seconds: number) => void) | null;
};

const STORAGE_SYNC_KEY = "__atoman_audio_sync__";

export function useAudioPlayerSync() {
	const channelName = "atoman_audio_sync";
	let channel: BroadcastChannel | null = null;
	const tabId = Math.random().toString(36).substring(2, 9);
	let storageListener: ((e: StorageEvent) => void) | null = null;

	const callbacks = {
		onForeignPlayRequest: (_meta: { tabId: string; timestamp: number }) => {},
	};

	const handleIncomingMessage = (msg: AudioSyncMessage | null | undefined) => {
		if (!msg || typeof msg !== "object") return;
		if (msg.tabId === tabId) return; // 过滤本标签页广播

		if (msg.type === "PLAY_REQUEST") {
			callbacks.onForeignPlayRequest({
				tabId: msg.tabId,
				timestamp: typeof msg.timestamp === "number" ? msg.timestamp : Date.now(),
			});
		}
	};

	const getChannel = (): BroadcastChannel | null => {
		if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
			return null;
		}
		if (!channel) {
			try {
				channel = new BroadcastChannel(channelName);
				channel.onmessage = (event) => {
					handleIncomingMessage(event.data as AudioSyncMessage);
				};
				channel.onmessageerror = () => {
					// 忽略无法反序列化的畸形消息
				};
			} catch {
				channel = null;
			}
		}
		return channel;
	};

	// 尝试初始化 Channel 与 Storage 监听
	if (typeof window !== "undefined") {
		getChannel();
		storageListener = (event: StorageEvent) => {
			if (event.key !== STORAGE_SYNC_KEY || !event.newValue) return;
			try {
				const msg = JSON.parse(event.newValue) as AudioSyncMessage;
				handleIncomingMessage(msg);
			} catch {
				// 忽略解析失败
			}
		};
		window.addEventListener("storage", storageListener);
	}

	const broadcastPlayRequest = () => {
		const timestamp = Date.now();
		const message: AudioSyncMessage = {
			type: "PLAY_REQUEST",
			tabId,
			timestamp,
		};

		try {
			const activeChannel = getChannel();
			if (activeChannel) {
				activeChannel.postMessage(message);
			}
		} catch {
			channel = null;
		}

		// 同步写 localStorage 触发跨标签 storage 事件以保证双通道送达
		if (typeof localStorage !== "undefined") {
			try {
				localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(message));
			} catch {
				// 忽略存储配额超限等异常
			}
		}
	};

	const setForeignPlayRequestCallback = (
		cb: (meta: { tabId: string; timestamp: number }) => void,
	) => {
		callbacks.onForeignPlayRequest = cb;
	};

	const closeChannel = () => {
		try {
			channel?.close();
		} catch {
			// 忽略关闭异常
		}
		channel = null;

		if (typeof window !== "undefined" && storageListener) {
			window.removeEventListener("storage", storageListener);
			storageListener = null;
		}
	};

	// Media Session API Support
	const setupMediaSession = (handlers: MediaSessionHandlers) => {
		if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
			const actionMap: Partial<Record<MediaSessionAction, MediaSessionActionHandler | null>> = {
				play: handlers.play,
				pause: handlers.pause,
				stop: handlers.stop ?? null,
				previoustrack: handlers.previoustrack ?? null,
				nexttrack: handlers.nexttrack ?? null,
				seekto: handlers.seekto ?? null,
				seekbackward: handlers.seekbackward ?? (handlers.skip ? (details) => {
					const offset = details.seekOffset || 10;
					handlers.skip!(-offset);
				} : null),
				seekforward: handlers.seekforward ?? (handlers.skip ? (details) => {
					const offset = details.seekOffset || 10;
					handlers.skip!(offset);
				} : null),
			};

			for (const [action, handler] of Object.entries(actionMap) as [MediaSessionAction, MediaSessionActionHandler | null][]) {
				try {
					navigator.mediaSession.setActionHandler(action, handler);
				} catch {
					// Browsers expose Media Session while supporting only a subset of actions.
				}
			}
		}
	};

	const updateMediaSessionPlaybackState = (state: "playing" | "paused" | "none") => {
		if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
			try {
				navigator.mediaSession.playbackState = state;
			} catch {
				// Best-effort assignment
			}
		}
	};

	const updateMediaSessionMetadata = (metadata: {
		title: string;
		artist?: string;
		album?: string;
		artworkUrl?: string;
	}) => {
		if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
			try {
				const artwork = buildMediaSessionArtwork(metadata.artworkUrl);
				const metaPayload = {
					title: metadata.title || "",
					artist: metadata.artist || "",
					album: metadata.album || "",
					artwork,
				};
				navigator.mediaSession.metadata =
					typeof MediaMetadata !== "undefined"
						? new MediaMetadata(metaPayload)
						: (metaPayload as any);
			} catch {
				// Metadata is optional on partial Media Session implementations.
			}
		}
	};

	const updateMediaSessionPosition = (state?: {
		duration: number;
		playbackRate?: number;
		position: number;
	} | null) => {
		if (
			typeof navigator !== "undefined" &&
			"mediaSession" in navigator &&
			navigator.mediaSession.setPositionState
		) {
			try {
				const sanitized = sanitizeMediaPositionState(state);
				if (sanitized) {
					navigator.mediaSession.setPositionState(sanitized);
				} else {
					navigator.mediaSession.setPositionState();
				}
			} catch {
				// Position state is best-effort and unsupported on some devices.
			}
		}
	};

	const clearMediaSession = () => {
		if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
			try {
				navigator.mediaSession.playbackState = "none";
				navigator.mediaSession.metadata = null;
				if (navigator.mediaSession.setPositionState) {
					navigator.mediaSession.setPositionState();
				}
			} catch {
				// Best-effort cleanup
			}
		}
	};

	return {
		tabId,
		broadcastPlayRequest,
		setForeignPlayRequestCallback,
		closeChannel,
		setupMediaSession,
		updateMediaSessionPlaybackState,
		updateMediaSessionMetadata,
		updateMediaSessionPosition,
		clearMediaSession,
	};
}
