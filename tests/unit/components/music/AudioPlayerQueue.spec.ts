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
		const tabs = wrapper.findAll('[role="tab"]');
		expect(tabs[0]!.attributes("tabindex")).toBe("0");
		expect(tabs[1]!.attributes("tabindex")).toBe("0");
		expect(document.activeElement).toBe(tabs[0]!.element);

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
		expect(source).not.toContain("prefers-reduced-motion: reduce");
	});

	it("reorders queue items directly when changing sequence number in the sequence input", async () => {
		const player = usePlayerStore();
		player.queue = [
			{ id: "song-1", title: "Song 1", artist: "Artist", audio_url: "/1.mp3" },
			{ id: "song-2", title: "Song 2", artist: "Artist", audio_url: "/2.mp3" },
			{ id: "song-3", title: "Song 3", artist: "Artist", audio_url: "/3.mp3" },
		] as Song[];

		const wrapper = mount(AudioPlayerQueue);
		const inputs = wrapper.findAll(".q-sequence__input");
		expect(inputs.length).toBeGreaterThanOrEqual(1);

		// Change item 1 to position 3
		const firstInput = inputs[0]!;
		firstInput.element.value = "3";
		await firstInput.trigger("change");

		expect(player.queue.map((s: Song) => s.id)).toEqual([
			"song-2",
			"song-3",
			"song-1",
		]);
		wrapper.unmount();
	});

	it("displaces neighboring rows up or down during dragover", async () => {
		const player = usePlayerStore();
		player.queue = [
			{ id: "song-1", title: "Song 1", artist: "Artist", audio_url: "/1.mp3" },
			{ id: "song-2", title: "Song 2", artist: "Artist", audio_url: "/2.mp3" },
			{ id: "song-3", title: "Song 3", artist: "Artist", audio_url: "/3.mp3" },
		] as Song[];

		const wrapper = mount(AudioPlayerQueue);
		const items = wrapper.findAll(".queue-item");
		expect(items).toHaveLength(3);

		const dataTransfer = { dropEffect: "move", setData: vi.fn(), setDragImage: vi.fn() };
		await wrapper.findAll(".q-drag")[0]!.trigger("dragstart", { dataTransfer });

		// Dragging item 0 downwards over slot 2
		await wrapper
			.get('[data-testid="queue-drop-slot-2"]')
			.trigger("dragover", { dataTransfer });

		expect(items[0]!.classes()).toContain("is-dragged");
		expect(items[1]!.classes()).toContain("is-displaced-up");

		wrapper.unmount();
	});

	it("switches to history tab and replays a past song", async () => {
		const player = usePlayerStore();
		const song1 = { id: "h1", title: "History 1", audio_url: "/h1.mp3" } as Song;
		player.playedHistory = [song1];
		const playSong = vi.spyOn(player, "playSong");

		const wrapper = mount(AudioPlayerQueue);
		const tabs = wrapper.findAll(".queue-tab-btn");
		expect(tabs).toHaveLength(2);

		// Switch to history tab
		await tabs[1]!.trigger("click");
		expect(wrapper.findAll(".history-item")).toHaveLength(1);
		expect(wrapper.find(".history-item").text()).toContain("History 1");

		// Click replay button
		await wrapper.get(".q-replay-btn").trigger("click");
		expect(playSong).toHaveBeenCalledWith(song1);

		wrapper.unmount();
	});

	it("supports keyboard tab switching with Enter and Space", async () => {
		const player = usePlayerStore();
		player.playedHistory = [{ id: "h1", title: "History 1", audio_url: "/h1.mp3" } as Song];
		player.queue = [{ id: "q1", title: "Queue 1", audio_url: "/q1.mp3" } as Song];

		const wrapper = mount(AudioPlayerQueue);
		const tabs = wrapper.findAll(".queue-tab-btn");
		expect(tabs[0]!.classes()).toContain("active");

		// Switch to history with Enter
		await tabs[1]!.trigger("keydown", { key: "Enter" });
		expect(tabs[1]!.classes()).toContain("active");
		expect(tabs[1]!.attributes("aria-selected")).toBe("true");

		// Switch back to queue with Space
		await tabs[0]!.trigger("keydown", { key: " " });
		expect(tabs[0]!.classes()).toContain("active");
		expect(tabs[0]!.attributes("aria-selected")).toBe("true");

		wrapper.unmount();
	});

	it("efficiently handles a large queue of 100 songs without breaking sequence reordering", async () => {
		const player = usePlayerStore();
		const songs: Song[] = Array.from({ length: 100 }, (_, i) => ({
			id: `song-${i + 1}`,
			title: `Song ${i + 1}`,
			artist: "Artist",
			audio_url: `/${i + 1}.mp3`,
		}));
		player.queue = songs;

		const wrapper = mount(AudioPlayerQueue);
		expect(wrapper.get(".queue-badge").text()).toBe("100 首");
		const items = wrapper.findAll(".queue-item");
		expect(items.length).toBeGreaterThan(0);

		// Sequence input on first rendered item works
		const firstInput = wrapper.findAll(".q-sequence__input")[0]!;
		firstInput.element.value = "10";
		await firstInput.trigger("change");
		expect(player.queue[9]!.id).toBe("song-1");
		wrapper.unmount();
	});
});

