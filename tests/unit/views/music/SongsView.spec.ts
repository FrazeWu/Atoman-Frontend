import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import SongsView from "../../../../src/views/music/SongsView.vue";

const mocks = vi.hoisted(() => ({
	searchMusic: vi.fn(),
	listMusicPlaylistSongs: vi.fn(),
	getMusicArtist: vi.fn(),
	recordMusicSearchInteraction: vi.fn(),
	openAlbum: vi.fn(),
	openArtist: vi.fn(),
	openPlaylist: vi.fn(),
	playSong: vi.fn(),
	playAlbum: vi.fn(),
	addToQueue: vi.fn(),
}));

vi.mock("@/api/musicV1", () => ({
	searchMusic: mocks.searchMusic,
	listMusicPlaylistSongs: mocks.listMusicPlaylistSongs,
	getMusicArtist: mocks.getMusicArtist,
	recordMusicSearchInteraction: mocks.recordMusicSearchInteraction,
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

describe("SongsView", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Object.values(mocks).forEach((mock) => mock.mockReset());
		mocks.searchMusic.mockResolvedValue({
			songs: [
				{
					id: "song-1",
					title: "Song 1",
					audio_url: "/song-1.mp3",
					entry_status: "open",
					artists: [{ id: "artist-1", name: "Artist 1" }],
					album: { id: "album-1", title: "Album 1" },
				},
			],
			albums: [],
			artists: [],
			playlists: [],
			meta: {
				page: 1,
				page_size: 20,
				totals: { song: 1, album: 0, artist: 0, playlist: 0 },
				has_more: { song: false, album: false, artist: false, playlist: false },
			},
		});
	});

	afterEach(() => vi.useRealTimers());

	it("links the song and opens its artist and album details", async () => {
		const wrapper = mount(SongsView, {
			global: {
				stubs: {
					RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
				},
			},
		});
		await wrapper.get('input[type="search"]').setValue("Song");
		await vi.advanceTimersByTimeAsync(250);
		await flushPromises();

		expect(wrapper.find(".song-result").exists()).toBe(true);
		await wrapper
			.get('[data-testid="song-result-artist-artist-1"]')
			.trigger("click");
		await wrapper
			.get('[data-testid="song-result-album-album-1"]')
			.trigger("click");

		expect(mocks.openArtist).toHaveBeenCalledWith("artist-1");
		expect(mocks.openAlbum).toHaveBeenCalledWith("album-1");
	});

	it("plays searchable albums, artists, and playlists from their first available track", async () => {
		mocks.searchMusic.mockResolvedValueOnce({
			songs: [],
			albums: [
				{
					id: "album-1",
					title: "Album 1",
					entry_status: "open",
					artists: [{ id: "artist-1", name: "Artist 1" }],
					songs: [
						{
							id: "album-song",
							title: "Album Song",
							audio_url: "/album-song.mp3",
						},
					],
				},
			],
			artists: [{ id: "artist-1", name: "Artist 1", entry_status: "open" }],
			playlists: [{ id: "playlist-1", name: "Playlist 1", song_count: 1 }],
			meta: {
				page: 1,
				page_size: 20,
				totals: { song: 0, album: 1, artist: 1, playlist: 1 },
				has_more: { song: false, album: false, artist: false, playlist: false },
			},
		});
		mocks.listMusicPlaylistSongs.mockResolvedValue({
			data: [
				{
					id: "playlist-song",
					title: "Playlist Song",
					audio_url: "/playlist-song.mp3",
					entry_status: "open",
				},
			],
			meta: { page: 1, page_size: 200, total: 1, has_more: false },
		});
		mocks.getMusicArtist.mockResolvedValue({
			id: "artist-1",
			name: "Artist 1",
			entry_status: "open",
			albums: [
				{
					id: "artist-album",
					title: "Artist Album",
					entry_status: "open",
					songs: [
						{
							id: "artist-song",
							title: "Artist Song",
							audio_url: "/artist-song.mp3",
						},
					],
				},
			],
		});

		const wrapper = mount(SongsView, {
			global: {
				stubs: {
					RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
				},
			},
		});
		await wrapper.get('input[type="search"]').setValue("Album");
		await vi.advanceTimersByTimeAsync(250);
		await flushPromises();

		await wrapper
			.get('[data-testid="search-album-play-album-1"]')
			.trigger("click");
		await wrapper
			.get('[data-testid="search-artist-play-artist-1"]')
			.trigger("click");
		await wrapper
			.get('[data-testid="search-playlist-play-playlist-1"]')
			.trigger("click");
		await flushPromises();

		expect(mocks.playAlbum).toHaveBeenCalledWith([
			expect.objectContaining({ id: "album-song" }),
		]);
		expect(mocks.playAlbum).toHaveBeenCalledWith([
			expect.objectContaining({ id: "artist-song" }),
		]);
		expect(mocks.playAlbum).toHaveBeenCalledWith([
			expect.objectContaining({ id: "playlist-song" }),
		]);
	});

	it("aborts an obsolete search request when the query changes", async () => {
		let firstSignal: AbortSignal | undefined;
		mocks.searchMusic.mockImplementation(
			(keyword: string, options: { signal?: AbortSignal }) => {
				if (keyword === "First") {
					firstSignal = options.signal;
					return new Promise((_resolve, reject) =>
						options.signal?.addEventListener("abort", () =>
							reject(new DOMException("Aborted", "AbortError")),
						),
					);
				}
				return Promise.resolve({
					songs: [],
					albums: [],
					artists: [],
					playlists: [],
					meta: {
						page: 1,
						page_size: 20,
						totals: { song: 0, album: 0, artist: 0, playlist: 0 },
						has_more: {
							song: false,
							album: false,
							artist: false,
							playlist: false,
						},
					},
				});
			},
		);
		const wrapper = mount(SongsView, {
			global: {
				stubs: {
					RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
				},
			},
		});
		await wrapper.get('input[type="search"]').setValue("First");
		await vi.advanceTimersByTimeAsync(250);
		await wrapper.get('input[type="search"]').setValue("Second");
		expect(firstSignal?.aborted).toBe(true);
		await vi.advanceTimersByTimeAsync(250);
		await flushPromises();
		expect(mocks.searchMusic).toHaveBeenLastCalledWith(
			"Second",
			expect.objectContaining({ page: 1, page_size: 20 }),
		);
	});
});
