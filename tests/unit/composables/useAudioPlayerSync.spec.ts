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
});
