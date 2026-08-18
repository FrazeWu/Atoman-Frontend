import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest resolves the alias through Vite; this test is outside the Vue TS project.
import { useAuthStore } from "@/stores/auth";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import LibraryView from "@/views/music/LibraryView.vue";

const mocks = vi.hoisted(() => ({
	listMusicLibrary: vi.fn(),
	deleteAlbumBookmark: vi.fn(),
	deleteArtistBookmark: vi.fn(),
	deletePlaylistBookmark: vi.fn(),
	listMusicPlaylists: vi.fn(),
	removeMusicSongFromLater: vi.fn(),
	openAlbum: vi.fn(),
	openArtist: vi.fn(),
	openPlaylist: vi.fn(),
	playSong: vi.fn(),
	playAlbum: vi.fn(),
	addToQueue: vi.fn(),
}));

vi.mock("@/api/musicV1", () => ({
	listMusicLibrary: mocks.listMusicLibrary,
	deleteAlbumBookmark: mocks.deleteAlbumBookmark,
	deleteArtistBookmark: mocks.deleteArtistBookmark,
	deletePlaylistBookmark: mocks.deletePlaylistBookmark,
	listMusicPlaylists: mocks.listMusicPlaylists,
	removeMusicSongFromLater: mocks.removeMusicSongFromLater,
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		openAlbum: mocks.openAlbum,
		openArtist: mocks.openArtist,
		openPlaylist: mocks.openPlaylist,
	}),
}));

vi.mock("@/stores/player", () => ({
	usePlayerStore: () => ({
		playSong: mocks.playSong,
		playAlbum: mocks.playAlbum,
		addToQueue: mocks.addToQueue,
	}),
}));

vi.mock("@/components/ui/PPageHeader.vue", () => ({
	default: {
		props: ["title"],
		template: '<header><h1>{{ title }}</h1><slot name="action" /></header>',
	},
}));

vi.mock("@/components/ui/PSegmentedControl.vue", () => ({
	default: {
		name: "PSegmentedControl",
		props: ["modelValue", "options"],
		emits: ["update:modelValue"],
		template:
			'<button v-for="option in options" :key="option.value" :data-option="option.value" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button>',
	},
}));

let pinia: ReturnType<typeof createPinia>;

const mountLibraryView = () =>
	mount(LibraryView, {
		global: { plugins: [pinia] },
	});

describe("LibraryView", () => {
	beforeEach(() => {
		pinia = createPinia();
		setActivePinia(pinia);
		const authStore = useAuthStore(pinia);
		authStore.user = {
			uuid: "library-user",
			username: "library-user",
			email: "library@example.test",
		};
		authStore.isAuthenticated = true;
	});

	beforeEach(() => {
		mocks.listMusicLibrary.mockReset();
		mocks.deleteAlbumBookmark.mockReset();
		mocks.deleteArtistBookmark.mockReset();
		mocks.deletePlaylistBookmark.mockReset();
		mocks.listMusicPlaylists.mockReset();
		mocks.listMusicPlaylists.mockResolvedValue({
			data: [
				{ id: "favorite-1", name: "最爱", kind: "favorite", song_count: 1 },
			],
		});
		mocks.removeMusicSongFromLater.mockReset();
		mocks.openAlbum.mockReset();
		mocks.openArtist.mockReset();
		mocks.openPlaylist.mockReset();
		mocks.playSong.mockReset();
		mocks.playAlbum.mockReset();
		mocks.addToQueue.mockReset();
	});

	it("uses 收藏 as the page name and search label", async () => {
		mocks.listMusicLibrary.mockResolvedValue({
			data: [],
			meta: { page: 1, page_size: 24, total: 0, has_more: false },
		});

		const wrapper = mountLibraryView();
		await flushPromises();

		expect(wrapper.get("h1").text()).toBe("收藏");
		expect(wrapper.get('input[type="search"]').attributes("placeholder")).toBe(
			"搜索收藏",
		);
		expect(wrapper.text()).not.toContain("音乐库");
		expect(wrapper.text()).toContain("稍后播放");
	});

	it("searches the whole library after a 250ms debounce", async () => {
		vi.useFakeTimers();
		mocks.listMusicLibrary.mockResolvedValue({
			data: [],
			meta: { page: 1, page_size: 24, total: 0, has_more: false },
		});
		const wrapper = mountLibraryView();
		await flushPromises();
		await wrapper.get('input[type="search"]').setValue("Late Registration");
		expect(mocks.listMusicLibrary).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(250);
		await flushPromises();
		expect(mocks.listMusicLibrary).toHaveBeenLastCalledWith(
			"album",
			expect.objectContaining({ q: "Late Registration", page: 1 }),
		);
		vi.useRealTimers();
	});

	it("resets old pagination before loading a different collection kind", async () => {
		let resolveArtists!: (value: unknown) => void;
		const artistRequest = new Promise((resolve) => {
			resolveArtists = resolve;
		});
		mocks.listMusicLibrary
			.mockResolvedValueOnce({
				data: [{ album: { id: "album-1", title: "Album 1" } }],
				meta: { page: 1, page_size: 24, total: 25, has_more: true },
			})
			.mockReturnValueOnce(artistRequest);

		const wrapper = mountLibraryView();
		await flushPromises();
		expect(wrapper.text()).toContain("第 1 页，共 25 条");

		await wrapper.get('[data-option="artist"]').trigger("click");
		expect(mocks.listMusicLibrary).toHaveBeenCalledTimes(2);

		resolveArtists({
			data: [
				{ artist: { id: "artist-1", name: "Artist 1", entry_status: "open" } },
			],
			meta: { page: 1, page_size: 24, total: 1, has_more: false },
		});
		await flushPromises();
		expect(wrapper.text()).toContain("Artist 1");
	});

	it("shows the favorite playlist instead of a song collection", async () => {
		mocks.listMusicLibrary.mockResolvedValue({
			data: [],
			meta: { page: 1, page_size: 24, total: 0, has_more: false },
		});
		const wrapper = mountLibraryView();
		await flushPromises();
		expect(wrapper.find('[data-option="song"]').exists()).toBe(false);
		await wrapper.get('[data-option="playlist"]').trigger("click");
		await flushPromises();
		expect(
			wrapper.get('[data-testid="library-playlist-card"]').text(),
		).toContain("最爱");
		expect(
			wrapper
				.find('[data-testid="library-playlist-card"] [aria-label="收藏"]')
				.exists(),
		).toBe(false);
	});

	it("renders album bookmarks as cards and removes them in place", async () => {
		mocks.listMusicLibrary.mockResolvedValueOnce({
			data: [
				{
					album: {
						id: "album-1",
						title: "Album 1",
						artists: [{ id: "artist-1", name: "Artist 1" }],
					},
				},
			],
			meta: { page: 1, page_size: 24, total: 1, has_more: false },
		});
		mocks.deleteAlbumBookmark.mockResolvedValue({ deleted: true });

		const wrapper = mountLibraryView();
		await flushPromises();
		const card = wrapper.get('[data-testid="library-album-card"]');
		await card.get('[aria-label="打开专辑 Album 1"]').trigger("click");
		expect(mocks.openAlbum).toHaveBeenCalledWith("album-1");

		await card.get('[aria-label="取消收藏"]').trigger("click");
		await flushPromises();
		expect(mocks.deleteAlbumBookmark).toHaveBeenCalledWith("album-1");
		expect(wrapper.find('[data-testid="library-album-card"]').exists()).toBe(
			false,
		);
	});

	it("removes a song from later playback in place", async () => {
		mocks.listMusicLibrary
			.mockResolvedValueOnce({
				data: [],
				meta: { page: 1, page_size: 24, total: 0, has_more: false },
			})
			.mockResolvedValueOnce({
				data: [
					{
						song: {
							id: "song-later",
							title: "Later Song",
							audio_url: "/later.mp3",
						},
					},
				],
				meta: { page: 1, page_size: 24, total: 1, has_more: false },
			});
		mocks.removeMusicSongFromLater.mockResolvedValue({ deleted: true });

		const wrapper = mountLibraryView();
		await flushPromises();
		await wrapper.get('[data-option="later"]').trigger("click");
		await flushPromises();

		await wrapper
			.get('[aria-label="取消稍后播放 Later Song"]')
			.trigger("click");
		await flushPromises();
		expect(mocks.removeMusicSongFromLater).toHaveBeenCalledWith("song-later");
		expect(wrapper.find('[data-testid="library-song-card"]').exists()).toBe(
			false,
		);
	});

	it("plays every playable song in the later list", async () => {
		mocks.listMusicLibrary
			.mockResolvedValueOnce({
				data: [],
				meta: { page: 1, page_size: 24, total: 0, has_more: false },
			})
			.mockResolvedValueOnce({
				data: [
					{
						song: {
							id: "song-1",
							title: "Playable",
							audio_url: "/playable.mp3",
						},
					},
					{ song: { id: "song-2", title: "Unavailable", audio_url: "" } },
				],
				meta: { page: 1, page_size: 24, total: 3, has_more: true },
			})
			.mockResolvedValueOnce({
				data: [
					{
						song: { id: "song-3", title: "Next Page", audio_url: "/next.mp3" },
					},
				],
				meta: { page: 2, page_size: 24, total: 3, has_more: false },
			});

		const wrapper = mountLibraryView();
		await flushPromises();
		expect(
			wrapper.find('[data-testid="library-later-play-all"]').exists(),
		).toBe(false);

		await wrapper.get('[data-option="later"]').trigger("click");
		await flushPromises();
		await wrapper
			.get('[data-testid="library-later-play-all"]')
			.trigger("click");
		await flushPromises();

		expect(mocks.playAlbum).toHaveBeenCalledOnce();
		expect(mocks.playAlbum).toHaveBeenCalledWith([
			expect.objectContaining({
				id: "song-1",
				title: "Playable",
				audio_url: "/playable.mp3",
			}),
		]);
		expect(mocks.addToQueue).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "song-3",
				title: "Next Page",
				audio_url: "/next.mp3",
			}),
		);
	});
});
