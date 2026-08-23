import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import type { MusicSheetLayer } from "../../../../src/components/music/musicSheetTypes";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vitest resolves Vue SFC aliases through Vite, outside the src-only tsconfig.
import MusicSheetStack from "@/components/music/MusicSheetStack.vue";
// @ts-expect-error Vitest resolves Vue/TypeScript aliases through Vite, outside the src-only tsconfig.
import { useMusicDrawers } from "@/composables/useMusicDrawers";

describe("MusicSheetStack", () => {
	beforeEach(() => useMusicDrawers().closeAll());

	it("renders repeated entity kinds as separate ordered layers", () => {
		const drawers = useMusicDrawers();
		drawers.openArtist("artist-1");
		drawers.openArtist("artist-2");
		drawers.openAlbum("album-3");

		const wrapper = mount(MusicSheetStack, {
			global: {
				stubs: {
					ArtistDrawer: {
						props: ["layer"],
						template: '<div class="artist-layer">{{ layer.key }}</div>',
					},
					AlbumDrawer: {
						props: ["layer"],
						template: '<div class="album-layer">{{ layer.key }}</div>',
					},
					PlaylistDrawer: true,
					MusicEntityEditorDrawer: true,
					MusicCreationFlowDrawer: true,
					NestedActionDrawer: true,
					MusicMergeDrawer: true,
				},
			},
		});

		expect(wrapper.findAll(".artist-layer").map((node) => node.text())).toEqual(
			["artist:artist-1", "artist:artist-2"],
		);
		expect(wrapper.get(".album-layer").text()).toBe("album:album-3");
	});

	it("keeps artist creation beneath a nested album creation flow", () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ startStep: "artist" });
		const parentKey = drawers.layers.value.at(-1)?.key;
		const parentFlow = drawers.state.value.creationFlow;
		expect(parentKey).toBeDefined();
		expect(parentFlow).not.toBeNull();
		if (!parentKey || !parentFlow) return;

		parentFlow.draft.artist.stageNames[0].name = "Draft Artist";
		drawers.openMusicCreationFlow(
			{
				artistName: "Draft Artist",
				startStep: "albumDetails",
				parentKey,
			},
			{ artistDraft: parentFlow.draft.artist },
		);

		const childKey = drawers.layers.value.at(-1)?.key;
		expect(
			drawers.layers.value.map((layer: MusicSheetLayer) => layer.key),
		).toEqual([parentKey, childKey]);
		expect(drawers.state.value.creationFlow?.parentKey).toBe(parentKey);
		expect(
			drawers.state.value.creationFlow?.draft.artist.stageNames[0].name,
		).toBe("Draft Artist");

		drawers.closeMusicCreationFlow(childKey);
		expect(
			drawers.layers.value.map((layer: MusicSheetLayer) => layer.key),
		).toEqual([parentKey]);
		expect(drawers.state.value.creationFlow).toBe(parentFlow);
		expect(
			drawers.state.value.creationFlow?.draft.artist.stageNames[0].name,
		).toBe("Draft Artist");
	});

	it("keeps the new top sheet mounted while the lower path switches", async () => {
		vi.useFakeTimers();
		const drawers = useMusicDrawers();
		const layerStub = {
			props: ["layer"],
			template:
				'<div class="sheet-layer-stub" :data-layer-key="layer.key">{{ layer.key }}</div>',
		};
		const wrapper = mount(MusicSheetStack, {
			global: {
				stubs: {
					ArtistDrawer: layerStub,
					AlbumDrawer: layerStub,
					PlaylistDrawer: layerStub,
					MusicEntityEditorDrawer: layerStub,
					MusicCreationFlowDrawer: layerStub,
					NestedActionDrawer: layerStub,
					MusicMergeDrawer: layerStub,
				},
			},
		});

		drawers.openArtist("artist-1");
		drawers.openAlbum("album-1");
		drawers.openNestedAction("revise", { albumId: "album-1" });
		drawers.openNestedAction("history", { albumId: "album-1" });
		await nextTick();

		const selector = '[data-layer-key="action:history:album-1"]';
		const topBeforeSwitch = wrapper.get(selector).element;
		expect(wrapper.findAll(".sheet-layer-stub")).toHaveLength(4);

		await vi.advanceTimersByTimeAsync(300);
		await nextTick();

		expect(wrapper.findAll(".sheet-layer-stub")).toHaveLength(2);
		expect(wrapper.get(selector).element).toBe(topBeforeSwitch);
		vi.useRealTimers();
	});
});
