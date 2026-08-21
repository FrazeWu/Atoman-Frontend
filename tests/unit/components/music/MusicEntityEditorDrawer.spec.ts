import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import MusicEntityEditorDrawer from "../../../../src/components/music/MusicEntityEditorDrawer.vue";

const drawerState = ref({
	artistId: null as string | null,
	albumId: null as string | null,
	musicEditor: null as null | {
		entity: "song";
		mode: "edit";
		id: string;
	},
});

const mocks = vi.hoisted(() => ({
	closeMusicEditor: vi.fn(),
	refreshSong: vi.fn(),
	refreshAlbum: vi.fn(),
	refreshArtist: vi.fn(),
	openMusicCreationFlow: vi.fn(),
	convertMusicSongToAlbum: vi.fn(),
	routerReplace: vi.fn(),
	closeMusicCreationFlow: vi.fn(),
	getMusicSongDetail: vi.fn(),
	uploadMusicAsset: vi.fn(),
	uploadMusicAssetWithProgress: vi.fn(),
	submitSongRevision: vi.fn(),
	queueMusicSongAudioReplacement: vi.fn(),
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		state: drawerState,
		closeMusicEditor: mocks.closeMusicEditor,
		refreshSong: mocks.refreshSong,
		refreshAlbum: mocks.refreshAlbum,
		refreshArtist: mocks.refreshArtist,
		openMusicCreationFlow: mocks.openMusicCreationFlow,
		closeMusicCreationFlow: mocks.closeMusicCreationFlow,
		isLayerActive: vi.fn(() => true),
		isLayerShifted: vi.fn(() => false),
		isTopLayer: vi.fn(() => true),
		returnToLayer: vi.fn(),
	}),
}));

vi.mock("vue-router", () => ({
	useRouter: () => ({ replace: mocks.routerReplace }),
}));

vi.mock("@/components/ui/PSheet.vue", () => ({
	default: {
		props: ["show"],
		template: '<div v-if="show"><slot /></div>',
	},
}));

vi.mock("@/components/ui/PButton.vue", () => ({
	default: { template: "<button><slot /></button>" },
}));

vi.mock("@/components/music/MusicCreationContributorPicker.vue", () => ({
	default: {
		props: ["modelValue"],
		template: '<div data-testid="song-contributors" />',
	},
}));

vi.mock("@/api/musicV1", () => ({
	convertMusicSongToAlbum: mocks.convertMusicSongToAlbum,
	getMusicSongDetail: mocks.getMusicSongDetail,
	submitSongRevision: mocks.submitSongRevision,
	queueMusicSongAudioReplacement: mocks.queueMusicSongAudioReplacement,
	uploadMusicAsset: mocks.uploadMusicAsset,
	uploadMusicAssetWithProgress: mocks.uploadMusicAssetWithProgress,
}));

describe("MusicEntityEditorDrawer.vue", () => {
	const mountedWrappers: VueWrapper[] = [];

	function mountDrawer() {
		const wrapper = mount(MusicEntityEditorDrawer);
		mountedWrappers.push(wrapper);
		return wrapper;
	}

	beforeEach(() => {
		drawerState.value = { artistId: null, albumId: null, musicEditor: null };
		Object.values(mocks).forEach((mock) => mock.mockReset());
		mocks.getMusicSongDetail.mockResolvedValue({
			song: {
				id: "song-1",
				title: "Original Song",
				track_number: 2,
				disc_number: 1,
				lyrics: "Lyrics",
			},
			artists: [
				{ id: "artist-1", name: "Test Artist", role: "primary", position: 1 },
			],
			bookmarked: false,
			playable: true,
		});
		mocks.uploadMusicAsset.mockResolvedValue({
			id: "asset-cover-1",
			url: "https://assets.example.test/audio/new.mp3",
			key: "music/audio/new.mp3",
			content_type: "audio/mpeg",
			size: 1,
		});
		mocks.uploadMusicAssetWithProgress.mockResolvedValue({
			id: "asset-audio-1",
			url: "https://assets.example.test/audio/new.mp3",
			key: "music/audio/new.mp3",
			content_type: "audio/mpeg",
			size: 1,
		});
		mocks.submitSongRevision.mockResolvedValue({ status: "approved" });
		mocks.convertMusicSongToAlbum.mockResolvedValue({
			entity_type: "album",
			id: "album-2",
		});
		mocks.queueMusicSongAudioReplacement.mockResolvedValue({
			status: "pending",
		});
	});

	afterEach(() => {
		mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount());
	});

	it("submits song metadata and credits through a song revision", async () => {
		drawerState.value.musicEditor = {
			entity: "song",
			mode: "edit",
			id: "song-1",
		};
		const wrapper = mountDrawer();
		await flushPromises();

		wrapper
			.findAllComponents({ name: "PInput" })[0]
			?.vm.$emit("update:modelValue", "Updated Song");
		await nextTick();
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "保存歌曲")
			?.trigger("click");
		await flushPromises();

		expect(mocks.submitSongRevision).toHaveBeenCalledWith(
			"song-1",
			expect.objectContaining({
				title: "Updated Song",
				description: "",
				sources: [],
				artist_credits: [
					{
						artist_id: "artist-1",
						position: 1,
						roles: [{ role: "primary" }],
					},
				],
			}),
		);
		const submitted = mocks.submitSongRevision.mock.calls[0]?.[1];
		expect(submitted).not.toHaveProperty("track_number");
		expect(submitted).not.toHaveProperty("disc_number");
		expect(submitted).not.toHaveProperty("lyrics");
		expect(wrapper.find('textarea[aria-label="歌词"]').exists()).toBe(false);
		expect(mocks.refreshSong).toHaveBeenCalled();
	});

	it("renders an album track description as a normal editable field", async () => {
		mocks.getMusicSongDetail.mockResolvedValueOnce({
			song: {
				id: "song-1",
				title: "Album Track",
				description: "Track description",
				album: { id: "album-1", title: "Parent Album" },
			},
			artists: [
				{ id: "artist-1", name: "Test Artist", role: "primary", position: 1 },
			],
			playable: true,
		});
		drawerState.value.musicEditor = {
			entity: "song",
			mode: "edit",
			id: "song-1",
		};
		const wrapper = mountDrawer();
		await flushPromises();

		expect(wrapper.find('[data-testid="song-editor-description-toggle"]').exists()).toBe(false);
		expect(wrapper.get('[data-testid="song-editor-description"]').element).toHaveProperty(
			"value",
			"Track description",
		);
	});

	it("submits standalone release metadata without an inline lyrics draft", async () => {
		mocks.getMusicSongDetail.mockResolvedValueOnce({
			song: {
				id: "song-1",
				title: "Standalone Song",
				description: "Optional",
				release_type: "single",
				release_date: "2025-01-02",
				release_date_precision: "day",
				cover_url: "https://assets.example.test/song.jpg",
				sources: [{ type: "url", url: "https://example.test/song" }],
			},
			artists: [
				{ id: "artist-1", name: "Test Artist", role: "primary", position: 1 },
			],
			playable: true,
		});
		drawerState.value.musicEditor = {
			entity: "song",
			mode: "edit",
			id: "song-1",
		};
		const wrapper = mountDrawer();
		await flushPromises();

		expect(wrapper.text()).not.toContain("歌词");
		expect(wrapper.text()).not.toContain("碟号");
		expect(wrapper.text()).not.toContain("曲序");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "保存歌曲")
			?.trigger("click");
		await flushPromises();

		expect(mocks.submitSongRevision).toHaveBeenCalledWith(
			"song-1",
			expect.objectContaining({
				title: "Standalone Song",
				description: "Optional",
				release_type: "single",
				release_date: "2025-01-02",
				sources: [{ type: "url", url: "https://example.test/song" }],
			}),
		);
	});

	it("converts a standalone song to an album type in one command", async () => {
		mocks.getMusicSongDetail.mockResolvedValueOnce({
			song: {
				id: "song-1",
				title: "Standalone Song",
				description: "Optional",
				release_type: "single",
				release_date: "2025-01-02",
				cover_url: "https://assets.example.test/song.jpg",
				sources: [{ type: "url", url: "https://example.test/song" }],
			},
			artists: [
				{ id: "artist-1", name: "Test Artist", role: "primary", position: 1 },
			],
			playable: true,
		});
		drawerState.value.musicEditor = {
			entity: "song",
			mode: "edit",
			id: "song-1",
		};
		const wrapper = mountDrawer();
		await flushPromises();
		wrapper
			.findComponent({ name: "PSelect" })
			.vm.$emit("update:modelValue", "album");
		await nextTick();

		await wrapper
			.findAll("button")
			.find((button) => button.text() === "保存并转为专辑")
			?.trigger("click");
		await flushPromises();

		expect(mocks.convertMusicSongToAlbum).toHaveBeenCalledWith(
			"song-1",
			expect.objectContaining({
				title: "Standalone Song",
				release_type: "album",
				cover_url: "https://assets.example.test/song.jpg",
			}),
		);
		expect(mocks.submitSongRevision).not.toHaveBeenCalled();
		expect(mocks.routerReplace).toHaveBeenCalledWith("/music/album/album-2");
	});

	it("keeps the saved metadata result clear when audio replacement queueing fails", async () => {
		mocks.queueMusicSongAudioReplacement.mockRejectedValue(
			new Error("queue unavailable"),
		);
		drawerState.value.musicEditor = {
			entity: "song",
			mode: "edit",
			id: "song-1",
		};
		const wrapper = mountDrawer();
		await flushPromises();

		const audioFile = new File(["audio"], "replacement.mp3", {
			type: "audio/mpeg",
		});
		const audioInput = wrapper.find('input[accept="audio/*"]');
		Object.defineProperty(audioInput.element, "files", { value: [audioFile] });
		await audioInput.trigger("change");
		await wrapper
			.findAll("button")
			.find((button) => button.text() === "保存歌曲")
			?.trigger("click");
		await flushPromises();

		expect(mocks.uploadMusicAssetWithProgress).toHaveBeenCalledWith(
			audioFile,
			"music.audio",
			expect.objectContaining({
				signal: expect.any(AbortSignal),
				timeoutMs: 5 * 60 * 1000,
			}),
		);
		expect(mocks.submitSongRevision).toHaveBeenCalled();
		expect(mocks.queueMusicSongAudioReplacement).toHaveBeenCalled();
		expect(mocks.refreshSong).toHaveBeenCalled();
		expect(mocks.closeMusicEditor).not.toHaveBeenCalled();
		expect(wrapper.text()).toContain(
			"歌曲资料已保存，但音频替换提交失败，请重试",
		);
	});
});
