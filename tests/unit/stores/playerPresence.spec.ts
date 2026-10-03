import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerPresenceStore } from "../../../src/stores/playerPresence";

describe("player presence store", () => {
	beforeEach(() => {
		localStorage.clear();
		setActivePinia(createPinia());
	});

	it("restores visibility from a persisted playable song", () => {
		localStorage.setItem(
			"playbackState",
			JSON.stringify({
				song: { id: "song-1", audio_url: "https://audio.test/song.mp3" },
			}),
		);

		const presence = usePlayerPresenceStore();

		expect(presence.hasCurrentTrack).toBe(true);
	});

	it("clears visibility and increments the lyrics close request", () => {
		const presence = usePlayerPresenceStore();

		presence.setHasCurrentTrack(true);
		presence.requestLyricsClose();
		presence.setHasCurrentTrack(false);

		expect(presence.hasCurrentTrack).toBe(false);
		expect(presence.lyricsCloseRequest).toBe(1);
	});
});
