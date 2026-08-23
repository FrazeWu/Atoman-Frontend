// @ts-nocheck
import { nextTick } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import MusicCreationAlbumDetailsStep from "../../../../src/components/music/MusicCreationAlbumDetailsStep.vue";
import { useMusicDrawers } from "../../../../src/composables/useMusicDrawers";
import {
	listMusicArtists,
	uploadMusicAsset,
	uploadMusicAssetWithProgress,
} from "../../../../src/api/musicV1";

vi.mock("@/api/musicV1", () => ({
	uploadMusicAsset: vi.fn(),
	uploadMusicAssetWithProgress: vi.fn(),
	listMusicArtists: vi.fn(),
	SUPPORTED_ARCHIVE_ACCEPT: ".zip,.rar,.7z",
	SUPPORTED_AUDIO_ACCEPT: ".mp3,.flac,.wav",
}));

vi.mock("music-metadata-browser", () => ({
	parseBlob: vi.fn(),
}));

vi.mock("@/components/music/MusicSquareImageCropSheet.vue", () => ({
	default: {
		props: ["show"],
		emits: ["confirm", "cancel"],
		template: `
      <div v-if="show" data-testid="music-square-crop-sheet">
        <button data-testid="music-square-crop-confirm" @click="$emit('confirm', { type: 'image/png', name: 'cover-cropped.png' })">confirm</button>
        <button data-testid="music-square-crop-cancel" @click="$emit('cancel')">cancel</button>
      </div>
    `,
	},
}));

vi.mock("@/components/music/MusicSongLyricsEditorDrawer.vue", () => ({
	default: {
		props: ["show", "songId", "songTitle"],
		template: `
      <div v-if="show" data-testid="existing-song-lyrics-editor" :data-song-id="songId">
        <button data-testid="existing-song-lyrics-save" @click="$emit('saved', { song_id: songId, content: '[00:01.00]Updated' })">save</button>
      </div>
    `,
	},
}));

describe("MusicCreationAlbumDetailsStep.vue", () => {
	beforeEach(() => {
		const drawers = useMusicDrawers();
		drawers.closeAll();
		vi.mocked(uploadMusicAsset).mockReset();
		vi.mocked(uploadMusicAssetWithProgress).mockReset();
		vi.mocked(listMusicArtists).mockReset();
		vi.stubGlobal("URL", {
			createObjectURL: vi.fn(() => "blob:album-cover-preview"),
			revokeObjectURL: vi.fn(),
		});
	});

	afterEach(() => vi.unstubAllGlobals());

	it("wraps track actions on narrow screens without squeezing the title", () => {
		const source = readFileSync(
			resolve(
				process.cwd(),
				"src/components/music/MusicCreationAlbumDetailsStep.vue",
			),
			"utf8",
		);
		const rowDefinitions = source.match(/\.track-row\s*\{/g) ?? [];

		expect(rowDefinitions).toHaveLength(2);
		expect(source).toMatch(/\.track-row\s*\{[\s\S]*?display:\s*flex;/);
		expect(source).toMatch(
			/@media \(max-width: 640px\)[\s\S]*?\.track-row\s*\{[\s\S]*?flex-wrap:\s*wrap;/,
		);
	});

	it("reflows album metadata from the available drawer width", () => {
		const source = readFileSync(
			resolve(
				process.cwd(),
				"src/components/music/MusicCreationAlbumDetailsStep.vue",
			),
			"utf8",
		);

		expect(source).toContain("container: album-details / inline-size");
		expect(source).toMatch(
			/@container album-details \(max-width: 62rem\)[\s\S]*?\.album-details-step__header-main\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
		);
		expect(source).toMatch(
			/\.album-details-step__basic-fields\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
		);
		expect(source).toMatch(
			/\.album-details-step__basic-field :deep\(\.birth-date-field\)\s*\{[\s\S]*?min-inline-size:\s*0;/,
		);
		expect(source).toMatch(
			/@container album-details \(max-width: 32rem\)[\s\S]*?\.p-date-input-container\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
		);
	});

	it.each([
		["专辑", "album"],
		["歌曲", "single"],
	])(
		"renders the %s description as a normal editable field",
		async (_label, type) => {
			const drawers = useMusicDrawers();
			drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
			drawers.setMusicCreationStep("albumDetails");
			const flow = drawers.state.value.creationFlow;
			if (!flow) throw new Error("creation flow missing");
			flow.draft.albumDetails.type = type;
			flow.draft.albumDetails.bio = "Existing description";

			const wrapper = mount(MusicCreationAlbumDetailsStep);
			expect(
				wrapper.find('[data-testid="album-details-bio-toggle"]').exists(),
			).toBe(false);
			expect(
				wrapper.get('[data-testid="album-details-bio-input"]').element,
			).toHaveProperty("value", "Existing description");
		},
	);

	it("keeps text editing separate from drag sorting", () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.tracks = [{ id: "track-1", sequence: 1, title: "Track title" }];
		const wrapper = mount(MusicCreationAlbumDetailsStep);

		expect(
			wrapper
				.get('[data-testid="album-track-row-track-1"]')
				.attributes("draggable"),
		).toBeUndefined();
		expect(
			wrapper
				.get('[data-testid="album-track-drag-handle-track-1"]')
				.attributes("draggable"),
		).toBe("true");
		expect(
			wrapper
				.get('[data-testid="album-track-title-input"]')
				.element.closest(".track-row__input"),
		).not.toBeNull();
	});

	it("keeps the empty standalone track list actionable and only warns for multiple tracks", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");
		flow.draft.tracks = [];

		const wrapper = mount(MusicCreationAlbumDetailsStep);
		flow.draft.albumDetails.type = "single";
		await nextTick();
		expect(wrapper.find(".track-adjustment").exists()).toBe(true);
		expect(
			wrapper.find('[data-testid="album-details-single-track-error"]').exists(),
		).toBe(false);

		flow.draft.tracks.push({ id: "track-1", sequence: 1, title: "Only Song" });
		await nextTick();
		expect(wrapper.find(".track-adjustment").exists()).toBe(false);

		flow.draft.albumDetails.type = "leak";
		await nextTick();
		expect(wrapper.find(".track-adjustment").exists()).toBe(false);

		flow.draft.tracks.push({
			id: "track-2",
			sequence: 2,
			title: "Second Song",
		});
		await nextTick();
		expect(wrapper.find(".track-adjustment").exists()).toBe(true);
		expect(
			wrapper.get('[data-testid="album-details-single-track-error"]').text(),
		).toContain("只能包含一首歌曲");

		flow.draft.albumDetails.type = "ep";
		await nextTick();
		expect(wrapper.find(".track-adjustment").exists()).toBe(true);
		expect(
			wrapper.find('[data-testid="album-details-single-track-error"]').exists(),
		).toBe(false);
	});

	it("adds a lyric upload action to every new album track", () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");
		flow.draft.tracks = [
			{ id: "track-lyrics", sequence: 1, title: "Track title" },
		];

		const wrapper = mount(MusicCreationAlbumDetailsStep);
		expect(
			wrapper.get('[data-testid="album-track-lyrics-track-lyrics"]').text(),
		).toContain("上传歌词");
	});

	it("shows an extracted title and upload progress for a new audio track", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		const { parseBlob } = await import("music-metadata-browser");
		vi.mocked(parseBlob).mockResolvedValue({
			common: { title: "标签曲名" },
		} as never);
		let resolveUpload:
			| ((value: {
					url: string;
					key: string;
					content_type: string;
					size: number;
			  }) => void)
			| undefined;
		vi.mocked(uploadMusicAssetWithProgress).mockImplementationOnce(
			async (_file, _purpose, options) => {
				options?.onProgress?.({ loaded: 6, total: 12 });
				return new Promise((resolve) => {
					resolveUpload = resolve;
				});
			},
		);

		const wrapper = mount(MusicCreationAlbumDetailsStep);
		const input = wrapper.get('[data-testid="album-track-audio-input"]');
		const file = new File(["audio"], "01 - fallback.mp3", {
			type: "audio/mpeg",
		});
		Object.defineProperty(input.element, "files", {
			configurable: true,
			value: [file],
		});

		await wrapper.get(".track-adjustment__add-btn").trigger("click");
		await input.trigger("change");
		await flushPromises();

		const pendingTrack = flow.draft.tracks[0];
		expect(pendingTrack).toMatchObject({
			title: "标签曲名",
			audioFileName: "01 - fallback.mp3",
			uploadProgress: 50,
		});
		expect(
			wrapper
				.get(`[data-testid="album-track-upload-${pendingTrack?.id}"]`)
				.text(),
		).toContain("50%");

		resolveUpload?.({
			url: "https://audio.example/new-track.mp3",
			key: "music/audio/new-track.mp3",
			content_type: "audio/mpeg",
			size: 12,
		});
		await flushPromises();
		expect(flow.draft.tracks[0]).toMatchObject({
			audioUrl: "https://audio.example/new-track.mp3",
			audioKey: "music/audio/new-track.mp3",
		});
		expect(flow.draft.tracks[0]?.uploadProgress).toBeUndefined();
	});

	it("aborts an in-flight upload when its pending track is removed", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		let signal: AbortSignal | undefined;
		vi.mocked(uploadMusicAssetWithProgress).mockImplementationOnce(
			async (_file, _purpose, options) => {
				signal = options?.signal;
				return new Promise(() => undefined);
			},
		);
		const wrapper = mount(MusicCreationAlbumDetailsStep);
		const input = wrapper.get('[data-testid="album-track-audio-input"]');
		Object.defineProperty(input.element, "files", {
			configurable: true,
			value: [new File(["audio"], "pending.mp3", { type: "audio/mpeg" })],
		});

		await wrapper.get(".track-adjustment__add-btn").trigger("click");
		await input.trigger("change");
		await flushPromises();

		const trackId = flow.draft.tracks[0]?.id;
		expect(trackId).toBeTruthy();
		expect(signal?.aborted).toBe(false);
		await wrapper
			.get(`[data-testid="album-track-delete-${trackId}"]`)
			.trigger("click");
		expect(signal?.aborted).toBe(true);
		expect(flow.draft.tracks).toHaveLength(0);
	});

	it("aborts in-flight uploads when the creation step unmounts", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");
		let signal: AbortSignal | undefined;
		vi.mocked(uploadMusicAssetWithProgress).mockImplementationOnce(
			async (_file, _purpose, options) => {
				signal = options?.signal;
				return new Promise(() => undefined);
			},
		);
		const wrapper = mount(MusicCreationAlbumDetailsStep);
		const input = wrapper.get('[data-testid="album-track-audio-input"]');
		Object.defineProperty(input.element, "files", {
			configurable: true,
			value: [new File(["audio"], "pending.mp3", { type: "audio/mpeg" })],
		});

		await wrapper.get(".track-adjustment__add-btn").trigger("click");
		await input.trigger("change");
		await flushPromises();
		wrapper.unmount();

		expect(signal?.aborted).toBe(true);
	});

	it("uploads audio before adding a new track and uses the file name as its initial title", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		const { parseBlob } = await import("music-metadata-browser");
		vi.mocked(parseBlob).mockRejectedValueOnce(
			new Error("metadata unavailable"),
		);
		vi.mocked(uploadMusicAssetWithProgress).mockResolvedValue({
			url: "https://audio.example/new-track.mp3",
			key: "music/audio/new-track.mp3",
			content_type: "audio/mpeg",
			size: 12,
		});
		const wrapper = mount(MusicCreationAlbumDetailsStep);
		const input = wrapper.get('[data-testid="album-track-audio-input"]');
		const file = new File(["audio"], "new-track.mp3", { type: "audio/mpeg" });
		Object.defineProperty(input.element, "files", {
			configurable: true,
			value: [file],
		});

		await wrapper.get(".track-adjustment__add-btn").trigger("click");
		await input.trigger("change");
		await flushPromises();

		expect(uploadMusicAssetWithProgress).toHaveBeenCalledWith(
			file,
			"music.audio",
			expect.objectContaining({ onProgress: expect.any(Function) }),
		);
		expect(flow.draft.tracks).toEqual([
			expect.objectContaining({
				title: "new-track",
				audioUrl: "https://audio.example/new-track.mp3",
				audioKey: "music/audio/new-track.mp3",
				audioFileName: "new-track.mp3",
				origin: "manual",
			}),
		]);
	});

	it("uploads replacement audio for an existing track without adding another row", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({
			mode: "edit",
			entity: "album",
			albumId: "album-1",
			startStep: "albumDetails",
		});
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");
		flow.draft.tracks = [
			{
				id: "track-existing",
				songId: "song-1",
				sequence: 1,
				title: "Existing track",
				audioUrl: "https://audio.example/old.mp3",
				origin: "existing",
			},
		];
		vi.mocked(uploadMusicAssetWithProgress).mockResolvedValue({
			url: "https://audio.example/replaced.flac",
			key: "music/audio/replaced.flac",
			content_type: "audio/flac",
			size: 12,
		});
		const wrapper = mount(MusicCreationAlbumDetailsStep);
		const input = wrapper.get('[data-testid="album-track-audio-input"]');
		const file = new File(["audio"], "replaced.flac", { type: "audio/flac" });
		Object.defineProperty(input.element, "files", {
			configurable: true,
			value: [file],
		});

		await wrapper
			.get('[data-testid="album-track-audio-track-existing"]')
			.trigger("click");
		await input.trigger("change");
		await flushPromises();

		expect(flow.draft.tracks).toHaveLength(1);
		expect(uploadMusicAssetWithProgress).toHaveBeenCalledWith(
			file,
			"music.audio",
			expect.objectContaining({
				signal: expect.any(AbortSignal),
				timeoutMs: 5 * 60 * 1000,
			}),
		);
		expect(flow.draft.tracks).toMatchObject([
			{
				id: "track-existing",
				audioUrl: "https://audio.example/replaced.flac",
				audioKey: "music/audio/replaced.flac",
				audioFileName: "replaced.flac",
			},
		]);
	});

	it("uses the structured lyric editor for an existing album track", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({
			mode: "edit",
			entity: "album",
			albumId: "album-1",
			startStep: "albumDetails",
		});
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");
		flow.draft.tracks = [
			{
				id: "existing-track",
				songId: "song-1",
				sequence: 1,
				title: "Existing track",
				lyrics: "[00:01.00]Original",
			},
		];

		const wrapper = mount(MusicCreationAlbumDetailsStep);
		expect(
			wrapper.get('[data-testid="album-track-lyrics-existing-track"]').text(),
		).toContain("编辑歌词");
		await wrapper
			.get('[data-testid="album-track-lyrics-existing-track"]')
			.trigger("click");
		expect(
			wrapper
				.get('[data-testid="existing-song-lyrics-editor"]')
				.attributes("data-song-id"),
		).toBe("song-1");

		await wrapper
			.get('[data-testid="existing-song-lyrics-save"]')
			.trigger("click");
		expect(flow.draft.tracks[0]?.lyrics).toBe("[00:01.00]Updated");
		expect(
			wrapper.find('[data-testid="existing-song-lyrics-editor"]').exists(),
		).toBe(false);
	});

	it("renders album details fields in the confirmed order and shows seeded draft values", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.albumDetails = {
			coverUrl: "https://img.example/late-registration.jpg",
			title: "Late Registration",
			contributors: [],
			releaseDateParts: {
				year: "2005",
				month: "08",
				day: "30",
			},
			releaseDate: "2005-08-30",
			releaseYear: "2005",
			type: "album",
			bio: "second studio album",
			source: "https://en.wikipedia.org/wiki/Late_Registration",
		};
		flow.draft.tracks = [
			{
				id: "track-1",
				sequence: 1,
				title: "Wake Up Mr. West",
				audioUrl: "https://audio/1.mp3",
			},
			{
				id: "track-2",
				sequence: 2,
				title: "Heard Em Say",
				audioUrl: "https://audio/2.mp3",
			},
			{
				id: "track-3",
				sequence: 3,
				title: "Touch the Sky",
				audioUrl: "https://audio/3.mp3",
			},
		];

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		const fieldOrder = wrapper
			.findAll('[data-testid="album-details-field"]')
			.map((node) => node.attributes("data-field"));
		expect(fieldOrder).toEqual([
			"cover",
			"name",
			"date",
			"type",
			"bio",
			"contributors",
			"track-adjustment",
			"source",
		]);

		const basicFields = wrapper.get(
			'[data-testid="album-details-basic-fields"]',
		);
		expect(basicFields.find('[data-field="name"]').exists()).toBe(true);
		expect(basicFields.find('[data-field="date"]').exists()).toBe(true);
		expect(basicFields.find('[data-field="type"]').exists()).toBe(true);
		expect(
			wrapper
				.get(".album-details-step__content-grid")
				.find('[data-field="contributors"]')
				.exists(),
		).toBe(false);
		expect(
			wrapper.get(".album-details-step__contributor-field").text(),
		).toContain("搜索其他艺人");

		expect(
			wrapper.get('[data-testid="album-details-progress-label"]').text(),
		).toContain("第 3 步");
		expect(
			wrapper.get('[data-testid="album-details-progress-value"]').text(),
		).toContain("3 / 3");
		expect(
			wrapper
				.findAll('[data-testid="album-details-step-label"]')
				.map((node) => node.text()),
		).toEqual(["1 创建艺术家", "2 专辑名 + 批量上传", "3 详细信息"]);
		expect(
			wrapper.get('[data-testid="album-details-title-input"]').element,
		).toHaveValue("Late Registration");
		expect(
			wrapper.get('[data-testid="album-details-date-input"]').element,
		).toHaveValue("2005/08/30");
		expect(
			wrapper.get('[data-testid="album-details-type-input"]').element,
		).toHaveValue("album");
		expect(
			wrapper.find('[data-testid="album-details-bio-toggle"]').exists(),
		).toBe(false);
		expect(
			wrapper.get('[data-testid="album-details-bio-input"]').element,
		).toHaveValue("second studio album");
		expect(
			wrapper.get('[data-testid="album-details-source-input"]').element,
		).toHaveValue("https://en.wikipedia.org/wiki/Late_Registration");
		expect(
			wrapper.get('[data-testid="album-details-track-count"]').text(),
		).toContain("3 首");
		expect(wrapper.findAll('img[alt="封面预览"]')).toHaveLength(1);
		expect(
			wrapper.get('[data-testid="album-details-cover-change-button"]').text(),
		).toContain("更换封面");
		expect(wrapper.find(".cover-preview").exists()).toBe(false);
	});

	it("shows required markers for mandatory album fields", () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		expect(wrapper.text()).toContain("上传专辑");
		expect(wrapper.text()).toContain("封面*");
		expect(wrapper.text()).toContain("专辑名*");
		expect(wrapper.text()).toContain("日期*");
		expect(wrapper.text()).toContain("类型*");
		expect(wrapper.text()).toContain("信息来源/修改原因*");
	});

	it("searches existing artists, adds contributors, and allows removing unlocked contributors", async () => {
		vi.mocked(listMusicArtists).mockResolvedValue({
			data: [
				{
					id: "artist-1",
					name: "Bladee",
					image_url: "https://img.example/bladee.png",
					sources: [{ type: "url", url: "https://example.test/bladee" }],
					entry_status: "open",
				},
				{
					id: "artist-2",
					name: "Ecco2k",
					image_url: "https://img.example/ecco2k.png",
					members: "2",
					entry_status: "open",
				},
			],
			meta: { page: 1, page_size: 20, total: 2, has_more: false },
		});

		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({
			artistId: "artist-seeded",
			artistName: "Seeded Artist",
		});
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.albumDetails.contributors = [];

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		await wrapper
			.get('[data-testid="album-contributor-search-input"]')
			.setValue("blade");
		await flushPromises();
		await wrapper
			.get('[data-testid="album-contributor-option-artist-1"]')
			.trigger("mousedown");
		await flushPromises();

		expect(flow.draft.albumDetails.contributors).toEqual([
			expect.objectContaining({
				artistId: "artist-1",
				name: "Bladee",
				avatarUrl: "https://img.example/bladee.png",
				source: "https://example.test/bladee",
				kind: "person",
				locked: false,
			}),
		]);
		expect(
			wrapper.get('[data-testid="album-contributor-chip-artist-1"]').text(),
		).toContain("Bladee");
		expect(
			wrapper.get('[data-testid="album-contributor-chip-artist-1"]').text(),
		).toContain("个人");

		await wrapper
			.get('[data-testid="album-contributor-remove-artist-1"]')
			.trigger("click");

		expect(flow.draft.albumDetails.contributors).toEqual([]);
	});

	it("keeps the new artist contributor locked in the first-album flow", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow();
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.artist.kind = "group";
		flow.draft.artist.stageNames[0].name = "Sweet Trip";

		const wrapper = mount(MusicCreationAlbumDetailsStep);
		await flushPromises();

		expect(flow.draft.albumDetails.contributors).toEqual([
			expect.objectContaining({
				artistId: null,
				name: "Sweet Trip",
				kind: "group",
				locked: true,
			}),
		]);
		expect(
			wrapper.get('[data-testid="album-contributor-chip-new-artist"]').text(),
		).toContain("Sweet Trip");
		expect(
			wrapper.get('[data-testid="album-contributor-chip-new-artist"]').text(),
		).toContain("组合");
		expect(
			wrapper
				.find('[data-testid="album-contributor-remove-new-artist"]')
				.exists(),
		).toBe(false);

		const fixedRoles = wrapper.get(".credit-roles__fixed");
		const customRole = wrapper.get(".credit-roles__custom-add");
		expect(fixedRoles.findAll(".credit-role-option")).toHaveLength(13);
		expect(fixedRoles.element.parentElement).toBe(
			customRole.element.parentElement,
		);
		expect(fixedRoles.element.nextElementSibling).toBe(customRole.element);
	});

	it("uses releaseDateParts as the primary release date draft and derives legacy fields", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		await wrapper
			.get('[data-testid="album-details-date-input"]')
			.setValue("2005/08/30");

		expect(flow.draft.albumDetails.releaseDateParts).toEqual({
			year: "2005",
			month: "08",
			day: "30",
		});
		expect(flow.draft.albumDetails.releaseDate).toBe("2005-08-30");
		expect(flow.draft.albumDetails.releaseYear).toBe("2005");
	});

	it("backfills releaseDateParts.year from legacy releaseYear when releaseDate is missing", () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.albumDetails.releaseDateParts = {
			year: "",
			month: "",
			day: "",
		};
		flow.draft.albumDetails.releaseDate = "";
		flow.draft.albumDetails.releaseYear = "2007";

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		expect(
			wrapper
				.get('[data-testid="album-details-date-input"]')
				.attributes("placeholder"),
		).toBe("yyyy/mm/dd");
		expect(flow.draft.albumDetails.releaseDateParts).toEqual({
			year: "2007",
			month: "",
			day: "",
		});
		expect(flow.draft.albumDetails.releaseDate).toBe("2007/--/--");
		expect(flow.draft.albumDetails.releaseYear).toBe("2007");
	});

	it("supports track move up, move down, and delete within the draft while keeping visible sequence labels", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.tracks = [
			{
				id: "track-1",
				sequence: 1,
				title: "Wake Up Mr. West",
				audioUrl: "https://audio/1.mp3",
			},
			{
				id: "track-2",
				sequence: 2,
				title: "Heard Em Say",
				audioUrl: "https://audio/2.mp3",
			},
			{
				id: "track-3",
				sequence: 3,
				title: "Touch the Sky",
				audioUrl: "https://audio/3.mp3",
			},
		];

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		expect(
			wrapper
				.findAll('[data-testid="album-track-sequence"]')
				.map((node) => node.text()),
		).toEqual(["01", "02", "03"]);
		expect(
			wrapper
				.findAll('[data-testid="album-track-title-input"]')
				.map((node) => (node.element as HTMLInputElement).value),
		).toEqual(["Wake Up Mr. West", "Heard Em Say", "Touch the Sky"]);

		await wrapper
			.get('[data-testid="album-track-move-up-track-2"]')
			.trigger("click");

		expect(flow.draft.tracks.map((track) => track.id)).toEqual([
			"track-2",
			"track-1",
			"track-3",
		]);
		expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2, 3]);
		expect(
			wrapper
				.findAll('[data-testid="album-track-title-input"]')
				.map((node) => (node.element as HTMLInputElement).value),
		).toEqual(["Heard Em Say", "Wake Up Mr. West", "Touch the Sky"]);
		expect(
			wrapper
				.findAll('[data-testid="album-track-sequence"]')
				.map((node) => node.text()),
		).toEqual(["01", "02", "03"]);

		await wrapper
			.get('[data-testid="album-track-move-down-track-2"]')
			.trigger("click");

		expect(flow.draft.tracks.map((track) => track.id)).toEqual([
			"track-1",
			"track-2",
			"track-3",
		]);
		expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2, 3]);

		await wrapper
			.get('[data-testid="album-track-delete-track-2"]')
			.trigger("click");

		expect(flow.draft.tracks.map((track) => track.id)).toEqual([
			"track-1",
			"track-3",
		]);
		expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2]);
		expect(
			wrapper
				.findAll('[data-testid="album-track-sequence"]')
				.map((node) => node.text()),
		).toEqual(["01", "02"]);
	});

	it("inserts a dragged track into the gap before the first track", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.tracks = [
			{ id: "track-1", sequence: 1, title: "A" },
			{ id: "track-2", sequence: 2, title: "B" },
			{ id: "track-3", sequence: 3, title: "C" },
		];

		const wrapper = mount(MusicCreationAlbumDetailsStep);
		const dataTransfer = {
			setData: vi.fn(),
			getData: vi.fn(() => "track-3"),
			dropEffect: "move",
			effectAllowed: "move",
		};

		await wrapper
			.get('[data-testid="album-track-drag-handle-track-3"]')
			.trigger("dragstart", { dataTransfer });
		await wrapper
			.get('[data-testid="album-track-drop-slot-0"]')
			.trigger("dragover", { preventDefault: vi.fn(), dataTransfer });
		await wrapper
			.get('[data-testid="album-track-drop-slot-0"]')
			.trigger("drop", { preventDefault: vi.fn(), dataTransfer });

		expect(flow.draft.tracks.map((track) => track.id)).toEqual([
			"track-3",
			"track-1",
			"track-2",
		]);
		expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2, 3]);
		expect(
			wrapper
				.findAll('[data-testid="album-track-sequence"]')
				.map((node) => node.text()),
		).toEqual(["01", "02", "03"]);
		expect(flow.tracksCustomized).toBe(true);
	});

	it("inserts a dragged track into the gap after the target track", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.tracks = [
			{ id: "track-1", sequence: 1, title: "A" },
			{ id: "track-2", sequence: 2, title: "B" },
			{ id: "track-3", sequence: 3, title: "C" },
		];

		const wrapper = mount(MusicCreationAlbumDetailsStep);
		const dataTransfer = {
			setData: vi.fn(),
			getData: vi.fn(() => "track-1"),
			dropEffect: "move",
			effectAllowed: "move",
		};

		await wrapper
			.get('[data-testid="album-track-drag-handle-track-1"]')
			.trigger("dragstart", { dataTransfer });
		await wrapper
			.get('[data-testid="album-track-drop-slot-2"]')
			.trigger("dragover", { preventDefault: vi.fn(), dataTransfer });
		await wrapper
			.get('[data-testid="album-track-drop-slot-2"]')
			.trigger("drop", { preventDefault: vi.fn(), dataTransfer });

		expect(flow.draft.tracks.map((track) => track.id)).toEqual([
			"track-2",
			"track-1",
			"track-3",
		]);
		expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2, 3]);
	});

	it("renders a minimal non-dead-end footer with back, finish, and close affordances", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.albumDetails.title = "Late Registration";
		flow.draft.tracks = [
			{
				id: "track-1",
				sequence: 1,
				title: "Wake Up Mr. West",
				audioUrl: "https://audio/1.mp3",
			},
		];

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		expect(
			wrapper.get('[data-testid="album-details-footer"]').text(),
		).toContain("返回上一步");
		expect(
			wrapper.get('[data-testid="album-details-footer"]').text(),
		).toContain("完成");
		expect(
			wrapper.get('[data-testid="album-details-footer"]').text(),
		).toContain("关闭");

		await wrapper
			.get('[data-testid="album-details-back-button"]')
			.trigger("click");
		expect(drawers.state.value.creationFlow?.step).toBe("artist");

		drawers.setMusicCreationStep("albumDetails");
		await wrapper
			.get('[data-testid="album-details-close-button"]')
			.trigger("click");
		expect(drawers.state.value.creationFlow).toBeNull();
	});

	it("在上传中也展示详情表单，并在顶部显示导入进度", () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.albumImport.archiveName = "graduation.zip";
		flow.draft.albumImport.status = "uploading";
		flow.draft.albumImport.uploadProgress = 37;
		flow.draft.albumImport.uploadSpeed = 128 * 1024;

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		expect(wrapper.get('[data-testid="album-import-status"]').text()).toContain(
			"graduation.zip",
		);
		expect(wrapper.get('[data-testid="album-import-status"]').text()).toContain(
			"上传进度 37%",
		);
		expect(wrapper.get('[data-testid="album-import-status"]').text()).toContain(
			"128 KB/s",
		);
		expect(
			wrapper.get('[data-testid="album-details-title-input"]').exists(),
		).toBe(true);
	});

	it("opens square crop sheet before applying manual album cover preview", async () => {
		let resolveUpload: ((value: { key: string; url: string }) => void) | null =
			null;
		vi.mocked(uploadMusicAsset).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveUpload = resolve;
				}),
		);

		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");

		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		const wrapper = mount(MusicCreationAlbumDetailsStep);

		const input = wrapper.get('[data-testid="album-details-cover-input"]')
			.element as HTMLInputElement;
		const file = new File(["cover"], "cover.png", { type: "image/png" });
		Object.defineProperty(input, "files", {
			configurable: true,
			value: [file],
		});

		await wrapper
			.get('[data-testid="album-details-cover-input"]')
			.trigger("change");

		expect(
			wrapper.find('[data-testid="music-square-crop-sheet"]').exists(),
		).toBe(true);
		expect(vi.mocked(uploadMusicAsset)).not.toHaveBeenCalled();
		expect(flow.draft.albumDetails.coverUrl).toBe("");

		await wrapper
			.get('[data-testid="music-square-crop-confirm"]')
			.trigger("click");

		expect(
			wrapper.find('[data-testid="music-square-crop-sheet"]').exists(),
		).toBe(false);
		expect(wrapper.get('img[alt="封面预览"]').attributes("src")).toBe(
			"blob:album-cover-preview",
		);
		expect(wrapper.text()).toContain("正在上传封面...");
		expect(flow.assetUploading).toBe(true);
		expect(vi.mocked(uploadMusicAsset)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(uploadMusicAsset).mock.calls[0]?.[1]).toBe("music.cover");

		resolveUpload?.({
			key: "music/cover-cropped.png",
			url: "https://img.example/cover-cropped.png",
		});
		await flushPromises();

		expect(flow.draft.albumDetails.coverUrl).toBe(
			"https://img.example/cover-cropped.png",
		);
		expect(flow.assetUploading).toBe(false);
	});

	it("识别封面在确认裁剪前保持待选状态，并可在取消后重新打开", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		const wrapper = mount(MusicCreationAlbumDetailsStep);
		flow.draft.albumImport.derivedCover =
			"https://img.example/imported-cover.jpg";
		await flushPromises();

		expect(flow.draft.albumDetails.coverUrl).toBe("");
		expect(
			wrapper.find('[data-testid="music-square-crop-sheet"]').exists(),
		).toBe(true);

		await wrapper
			.get('[data-testid="music-square-crop-cancel"]')
			.trigger("click");
		await wrapper
			.get('[data-testid="album-details-imported-cover-action"]')
			.trigger("click");
		await flushPromises();

		expect(
			wrapper.find('[data-testid="music-square-crop-sheet"]').exists(),
		).toBe(true);
	});

	it("已有封面时不自动打开识别封面裁剪", async () => {
		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({ artistId: "artist-seeded" });
		drawers.setMusicCreationStep("albumDetails");
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.albumDetails.coverUrl = "https://img.example/manual-cover.jpg";
		const wrapper = mount(MusicCreationAlbumDetailsStep);

		flow.draft.albumImport.derivedCover =
			"https://img.example/imported-cover.jpg";
		await flushPromises();

		expect(
			wrapper.find('[data-testid="music-square-crop-sheet"]').exists(),
		).toBe(false);
		expect(wrapper.get('img[alt="封面预览"]').attributes("src")).toBe(
			"https://img.example/manual-cover.jpg",
		);
		expect(
			wrapper
				.find('[data-testid="album-details-imported-cover-callout"]')
				.exists(),
		).toBe(true);
	});
});
