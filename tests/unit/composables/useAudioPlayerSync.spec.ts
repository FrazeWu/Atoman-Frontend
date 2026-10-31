import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAudioPlayerSync } from "@/composables/useAudioPlayerSync";

describe("useAudioPlayerSync", () => {
	let listeners: Array<(event: any) => void> = [];
	let originalBroadcastChannel: any;

	beforeEach(() => {
		listeners = [];
		originalBroadcastChannel = globalThis.BroadcastChannel;

		globalThis.BroadcastChannel = class MockBroadcastChannel {
			name: string;
			onmessage: ((event: any) => void) | null = null;
			onmessageerror: ((event: any) => void) | null = null;

			constructor(name: string) {
				this.name = name;
				listeners.push((event: any) => {
					this.onmessage?.(event);
				});
			}

			postMessage(data: any) {
				for (const listener of listeners) {
					listener({ data });
				}
			}

			close() {
				listeners = listeners.filter((l) => l !== this.onmessage);
			}
		} as any;
	});

	afterEach(() => {
		globalThis.BroadcastChannel = originalBroadcastChannel;
	});

	it("creates a unique tabId and sends play requests with timestamp", () => {
		const sync1 = useAudioPlayerSync();
		const sync2 = useAudioPlayerSync();

		expect(sync1.tabId).toBeTruthy();
		expect(sync2.tabId).toBeTruthy();
		expect(sync1.tabId).not.toBe(sync2.tabId);

		const foreignPlayCallback = vi.fn();
		sync2.setForeignPlayRequestCallback(foreignPlayCallback);

		sync1.broadcastPlayRequest();

		expect(foreignPlayCallback).toHaveBeenCalledTimes(1);
		const callArg = foreignPlayCallback.mock.calls[0][0];
		expect(callArg.tabId).toBe(sync1.tabId);
		expect(typeof callArg.timestamp).toBe("number");
	});

	it("filters out self broadcasts without triggering foreign callback", () => {
		const sync = useAudioPlayerSync();
		const foreignPlayCallback = vi.fn();
		sync.setForeignPlayRequestCallback(foreignPlayCallback);

		sync.broadcastPlayRequest();

		expect(foreignPlayCallback).not.toHaveBeenCalled();
	});

	it("falls back to localStorage storage event when BroadcastChannel is unavailable", () => {
		// Disable BroadcastChannel
		// @ts-expect-error test mock
		delete globalThis.BroadcastChannel;

		const sync1 = useAudioPlayerSync();
		const sync2 = useAudioPlayerSync();

		const foreignCallback = vi.fn();
		sync2.setForeignPlayRequestCallback(foreignCallback);

		sync1.broadcastPlayRequest();

		const saved = localStorage.getItem("__atoman_audio_sync__");
		expect(saved).toBeTruthy();
		const parsed = JSON.parse(saved!);
		expect(parsed.tabId).toBe(sync1.tabId);
		expect(parsed.type).toBe("PLAY_REQUEST");

		// Simulate storage event dispatched to window
		window.dispatchEvent(
			new StorageEvent("storage", {
				key: "__atoman_audio_sync__",
				newValue: saved,
			}),
		);

		expect(foreignCallback).toHaveBeenCalledTimes(1);
		expect(foreignCallback.mock.calls[0][0].tabId).toBe(sync1.tabId);
	});

	describe("MediaSession support", () => {
		let originalMediaSession: any;
		let originalMediaMetadata: any;
		let mockMediaSession: any;

		beforeEach(() => {
			mockMediaSession = {
				playbackState: "none",
				metadata: null,
				setActionHandler: vi.fn(),
				setPositionState: vi.fn(),
			};
			originalMediaSession = (navigator as any).mediaSession;
			originalMediaMetadata = (globalThis as any).MediaMetadata;

			Object.defineProperty(navigator, "mediaSession", {
				configurable: true,
				value: mockMediaSession,
			});

			(globalThis as any).MediaMetadata = class MockMediaMetadata {
				title: string;
				artist: string;
				album: string;
				artwork: any[];
				constructor(init: any) {
					this.title = init.title;
					this.artist = init.artist;
					this.album = init.album;
					this.artwork = init.artwork;
				}
			};
		});

		afterEach(() => {
			if (originalMediaSession !== undefined) {
				Object.defineProperty(navigator, "mediaSession", {
					configurable: true,
					value: originalMediaSession,
				});
			} else {
				Reflect.deleteProperty(navigator, "mediaSession");
			}

			if (originalMediaMetadata !== undefined) {
				(globalThis as any).MediaMetadata = originalMediaMetadata;
			} else {
				Reflect.deleteProperty(globalThis, "MediaMetadata");
			}
		});

		it("registers action handlers in setupMediaSession", () => {
			const sync = useAudioPlayerSync();
			const play = vi.fn();
			const pause = vi.fn();
			const stop = vi.fn();
			const previoustrack = vi.fn();
			const nexttrack = vi.fn();
			const seekto = vi.fn();
			const skip = vi.fn();

			sync.setupMediaSession({
				play,
				pause,
				stop,
				previoustrack,
				nexttrack,
				seekto,
				skip,
			});

			expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("play", play);
			expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("pause", pause);
			expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("stop", stop);
			expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("previoustrack", previoustrack);
			expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("nexttrack", nexttrack);
			expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekto", seekto);
			expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekbackward", expect.any(Function));
			expect(mockMediaSession.setActionHandler).toHaveBeenCalledWith("seekforward", expect.any(Function));

			// Test skip invocation via seekbackward/forward
			const seekBackwardHandler = mockMediaSession.setActionHandler.mock.calls.find(
				(call: any[]) => call[0] === "seekbackward",
			)?.[1];
			seekBackwardHandler({ seekOffset: 15 });
			expect(skip).toHaveBeenCalledWith(-15);

			const seekForwardHandler = mockMediaSession.setActionHandler.mock.calls.find(
				(call: any[]) => call[0] === "seekforward",
			)?.[1];
			seekForwardHandler({});
			expect(skip).toHaveBeenCalledWith(10);
		});

		it("updates playback state", () => {
			const sync = useAudioPlayerSync();
			sync.updateMediaSessionPlaybackState("playing");
			expect(mockMediaSession.playbackState).toBe("playing");

			sync.updateMediaSessionPlaybackState("paused");
			expect(mockMediaSession.playbackState).toBe("paused");
		});

		it("updates metadata with artwork formats", () => {
			const sync = useAudioPlayerSync();
			sync.updateMediaSessionMetadata({
				title: "Test Song",
				artist: "Test Artist",
				album: "Test Album",
				artworkUrl: "https://example.com/cover.png",
			});

			expect(mockMediaSession.metadata).toBeTruthy();
			expect(mockMediaSession.metadata.title).toBe("Test Song");
			expect(mockMediaSession.metadata.artist).toBe("Test Artist");
			expect(mockMediaSession.metadata.album).toBe("Test Album");
			expect(mockMediaSession.metadata.artwork.length).toBeGreaterThan(0);
		});

		it("updates and sanitizes position state", () => {
			const sync = useAudioPlayerSync();
			sync.updateMediaSessionPosition({
				duration: 200,
				position: 50,
				playbackRate: 1.5,
			});

			expect(mockMediaSession.setPositionState).toHaveBeenCalledWith({
				duration: 200,
				position: 50,
				playbackRate: 1.5,
			});

			// When invalid, calls setPositionState without arguments to clear
			sync.updateMediaSessionPosition(null);
			expect(mockMediaSession.setPositionState).toHaveBeenCalledWith();
		});

		it("clears media session completely", () => {
			const sync = useAudioPlayerSync();
			mockMediaSession.playbackState = "playing";
			mockMediaSession.metadata = { title: "Song" };

			sync.clearMediaSession();

			expect(mockMediaSession.playbackState).toBe("none");
			expect(mockMediaSession.metadata).toBeNull();
			expect(mockMediaSession.setPositionState).toHaveBeenCalledWith();
		});
	});
});
