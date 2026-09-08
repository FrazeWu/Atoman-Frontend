import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import MusicTagView from "../../../../src/views/music/MusicTagView.vue";

const mocks = vi.hoisted(() => ({
	getMusicTag: vi.fn(),
	listMusicSongs: vi.fn(),
	listMusicAlbums: vi.fn(),
	playSong: vi.fn(),
}));

vi.mock("@/api/musicV1", () => ({
	getMusicTag: mocks.getMusicTag,
	listMusicSongs: mocks.listMusicSongs,
	listMusicAlbums: mocks.listMusicAlbums,
}));

vi.mock("@/stores/player", () => ({
	usePlayerStore: () => ({ playSong: mocks.playSong }),
}));

async function mountView(query: Record<string, string> = {}) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: "/music/tags/:tagId", component: MusicTagView },
			{ path: "/music/song/:songId", component: { template: "<div />" } },
			{ path: "/music/album/:albumId", component: { template: "<div />" } },
		],
	});
	await router.push({ path: "/music/tags/tag-1", query });
	await router.isReady();
	const wrapper = mount(MusicTagView, {
		global: {
			plugins: [router],
			stubs: {
				MusicAlbumCard: {
					props: ["album"],
					template: '<button data-testid="album-card" type="button" @click="$emit(\'click\')">{{ album.title }}</button>',
				},
			},
		},
	});
	return { router, wrapper };
}

describe("MusicTagView.vue", () => {
	beforeEach(() => {
		mocks.getMusicTag.mockReset();
		mocks.listMusicSongs.mockReset();
		mocks.listMusicAlbums.mockReset();
		mocks.playSong.mockReset();
		mocks.getMusicTag.mockResolvedValue({ id: "tag-1", name: "治愈", kind: "mood" });
		mocks.listMusicSongs.mockResolvedValue({
			data: [{
				id: "song-1",
				title: "Song 1",
				audio_url: "/song-1.mp3",
				entry_status: "open",
				artists: [{ id: "artist-1", name: "Artist 1" }],
				album: { id: "album-1", title: "Album 1" },
			}],
			meta: { page: 1, page_size: 20, total: 1, has_more: false },
		});
		mocks.listMusicAlbums.mockResolvedValue({
			data: [{
				id: "album-1",
				title: "Album 1",
				entry_status: "open",
				artists: [{ id: "artist-1", name: "Artist 1" }],
			}],
			meta: { page: 1, page_size: 20, total: 1, has_more: false },
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads the tag and shows songs by default", async () => {
		const { wrapper } = await mountView();
		await flushPromises();

		expect(wrapper.text()).toContain("情绪标签");
		expect(wrapper.text()).toContain("治愈");
		expect(wrapper.get('[data-testid="tag-song-song-1"]').text()).toContain("Song 1");
		expect(mocks.listMusicSongs).toHaveBeenCalledWith({
			tag_id: "tag-1",
			page: 1,
			page_size: 20,
			sort: "-release_date",
		});
		expect(mocks.listMusicAlbums).not.toHaveBeenCalled();
	});

	it("switches to albums and keeps the selected view in the URL", async () => {
		const { router, wrapper } = await mountView();
		await flushPromises();

		await wrapper.get('[data-testid="tag-view-albums"]').trigger("click");
		await flushPromises();

		expect(router.currentRoute.value.query.view).toBe("albums");
		expect(wrapper.get('[data-testid="album-card"]').text()).toContain("Album 1");
		expect(mocks.listMusicAlbums).toHaveBeenCalledWith({
			tag_id: "tag-1",
			page: 1,
			page_size: 20,
			sort: "-release_date",
		});
	});

	it("starts with albums when the URL requests albums", async () => {
		await mountView({ view: "albums" });
		await flushPromises();

		expect(mocks.listMusicAlbums).toHaveBeenCalledTimes(1);
		expect(mocks.listMusicSongs).not.toHaveBeenCalled();
	});
});
