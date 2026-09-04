import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Song } from "../../../../src/types";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import AudioPlayerQueue from "../../../../src/components/music/AudioPlayerQueue.vue";
import { usePlayerStore } from "../../../../src/stores/player";

describe("AudioPlayerQueue.vue", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it("closes when Escape is pressed", async () => {
		const player = usePlayerStore();
		const toggleQueue = vi.spyOn(player, "toggleQueue");
		const wrapper = mount(AudioPlayerQueue);

		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

		expect(toggleQueue).toHaveBeenCalledOnce();
		wrapper.unmount();
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

		expect(wrapper.findAll('[data-testid^="queue-drop-slot-"]')).toHaveLength(4);

		await wrapper.findAll(".q-drag")[0]!.trigger("dragstart", { dataTransfer });
		await wrapper
			.get('[data-testid="queue-drop-slot-2"]')
			.trigger("dragover", { dataTransfer });
		expect(wrapper.get('[data-testid="queue-drop-slot-2"]').classes()).toContain(
			"is-drag-over",
		);
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
	it("opens as a compact non-modal dialog and restores focus when closed", async () => {
		const player = usePlayerStore();
		player.showQueue = true;
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.focus();
		const wrapper = mount(AudioPlayerQueue);
		document.body.appendChild(wrapper.element);
		await wrapper.vm.$nextTick();

		const panel = wrapper.get(".queue-panel");
		expect(panel.attributes("role")).toBe("dialog");
		expect(panel.attributes("aria-modal")).toBe("false");
		expect(wrapper.find(".queue-backdrop").exists()).toBe(false);
		expect(document.activeElement).toBe(wrapper.get(".queue-close-btn").element);

		wrapper.unmount();
		expect(document.activeElement).toBe(trigger);
		trigger.remove();
	});

	it("keeps the base page position when it moves focus into the queue", () => {
		const source = readFileSync(
			resolve(process.cwd(), "src/components/music/AudioPlayerQueue.vue"),
			"utf8",
		);

		expect(source).toContain("{ preventScroll: true }");
	});

	it("shows the current playback mode and drag hint in the queue footer", async () => {
		const player = usePlayerStore();
		player.playbackMode = "random";
		const wrapper = mount(AudioPlayerQueue);

		expect(wrapper.get(".queue-footer").text()).toContain("随机播放");
		expect(wrapper.get(".queue-footer").text()).toContain("拖动调整顺序");

		player.playbackMode = "single";
		await wrapper.vm.$nextTick();
		expect(wrapper.get(".queue-footer").text()).toContain("单曲循环");
		wrapper.unmount();
	});

	it("expands from the player to below the topbar with a 550ms reveal", () => {
		const source = readFileSync(
			resolve(process.cwd(), "src/components/music/AudioPlayerQueue.vue"),
			"utf8",
		);

		expect(source).toMatch(
			/\.queue-panel\s*\{[^}]*top: var\(--a-topbar-height\);[^}]*bottom: calc\([^}]*6rem[^}]*\);[^}]*animation: queueReveal 550ms/,
		);
		expect(source).toContain(
			".queue-panel { animation-duration: var(--a-motion-reduced-overlay); }",
		);
	});
});
