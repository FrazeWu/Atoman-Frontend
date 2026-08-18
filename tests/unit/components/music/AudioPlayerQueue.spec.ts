import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import type { Song } from "../../../../src/types";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import AudioPlayerQueue from "../../../../src/components/music/AudioPlayerQueue.vue";
import { usePlayerStore } from "../../../../src/stores/player";

describe("AudioPlayerQueue.vue", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("inserts a dragged song into a gap instead of dropping on a song row", async () => {
		const player = usePlayerStore();
		player.queue = [
			{ id: "song-1", title: "Song 1", artist: "Artist", audio_url: "/1.mp3" },
			{ id: "song-2", title: "Song 2", artist: "Artist", audio_url: "/2.mp3" },
			{ id: "song-3", title: "Song 3", artist: "Artist", audio_url: "/3.mp3" },
		] as Song[];

		const wrapper = mount(AudioPlayerQueue);
		const dataTransfer = { dropEffect: "move" };

		expect(wrapper.findAll('[data-testid^="queue-drop-slot-"]')).toHaveLength(
			4,
		);

		await wrapper.findAll(".q-drag")[0]!.trigger("dragstart", { dataTransfer });
		await wrapper
			.get('[data-testid="queue-drop-slot-2"]')
			.trigger("dragover", { dataTransfer });
		expect(
			wrapper.get('[data-testid="queue-drop-slot-2"]').classes(),
		).toContain("is-drag-over");
		await wrapper
			.get('[data-testid="queue-drop-slot-2"]')
			.trigger("drop", { dataTransfer });

		expect(player.queue.map((song: Song) => song.id)).toEqual([
			"song-2",
			"song-1",
			"song-3",
		]);
		wrapper.unmount();
	});
});
