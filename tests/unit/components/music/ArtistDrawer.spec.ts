// web/tests/unit/ArtistDrawer.spec.ts
import { nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { ApiErrorResponseError } from "../../../../src/api/client";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import ArtistDrawer from "../../../../src/components/music/ArtistDrawer.vue";

vi.mock("@/components/ui/PSheet.vue", () => ({
	default: {
		template: '<div><slot name="header" /><slot /></div>',
	},
}));

const drawerState = ref({ artistId: "1", artistRefreshToken: 0 });
const musicDrawerMocks = vi.hoisted(() => ({
	openNestedAction: vi.fn(),
	openArtist: vi.fn(),
	openAlbum: vi.fn(),
	openSong: vi.fn(),
	openMusicEditor: vi.fn(),
	openMusicCreationFlow: vi.fn(),
	requireLogin: vi.fn(),
	isAuthenticated: { value: true },
}));

const playerMocks = vi.hoisted(() => ({
	currentSong: null as null | { id?: string; source_id?: string },
	isPlaying: false,
	playAlbum: vi.fn(),
	togglePlay: vi.fn(),
}));

vi.mock("@/stores/player", () => ({
	usePlayerStore: () => playerMocks,
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		state: drawerState,
		closeArtist: vi.fn(),
		isArtistShifted: ref(false),
		openNestedAction: musicDrawerMocks.openNestedAction,
		openArtist: musicDrawerMocks.openArtist,
		openAlbum: musicDrawerMocks.openAlbum,
		openSong: musicDrawerMocks.openSong,
		returnToLayer: vi.fn(),
		isLayerActive: () => true,
		isLayerShifted: () => false,
		isTopLayer: () => true,
		openMusicEditor: musicDrawerMocks.openMusicEditor,
		openMusicCreationFlow: musicDrawerMocks.openMusicCreationFlow,
	}),
}));

vi.mock("@/composables/useLoginRedirect", () => ({
	useLoginRedirect: () => ({
		isAuthenticated: musicDrawerMocks.isAuthenticated,
		requireLogin: musicDrawerMocks.requireLogin,
	}),
}));

const {
	getMusicArtist,
	listMusicAlbums,
	listMusicSongs,
	listArtistContributors,
	listArtistBookmarks,
	createArtistBookmark,
	deleteArtistBookmark,
} = vi.hoisted(() => ({
	getMusicArtist: vi.fn(),
	listMusicAlbums: vi.fn(),
	listMusicSongs: vi.fn(),
	listArtistContributors: vi.fn(),
	listArtistBookmarks: vi.fn(),
	createArtistBookmark: vi.fn(),
	deleteArtistBookmark: vi.fn(),
}));

vi.mock("@/api/musicV1", () => ({
	getMusicArtist,
	listMusicAlbums,
	listMusicSongs,
	listArtistContributors,
	listArtistBookmarks,
	createArtistBookmark,
	deleteArtistBookmark,
}));

describe("ArtistDrawer.vue", () => {
	beforeEach(() => {
		drawerState.value = { artistId: "1", artistRefreshToken: 0 };
		getMusicArtist.mockReset();
		listMusicAlbums.mockReset();
		listMusicSongs.mockReset();
		listArtistContributors.mockReset();
		listArtistBookmarks.mockReset();
		createArtistBookmark.mockReset();
		deleteArtistBookmark.mockReset();
		musicDrawerMocks.openNestedAction.mockReset();
		musicDrawerMocks.openArtist.mockReset();
		musicDrawerMocks.openAlbum.mockReset();
		musicDrawerMocks.openSong.mockReset();
		musicDrawerMocks.openMusicEditor.mockReset();
		musicDrawerMocks.openMusicCreationFlow.mockReset();
		musicDrawerMocks.requireLogin.mockReset();
		playerMocks.currentSong = null;
		playerMocks.isPlaying = false;
		playerMocks.playAlbum.mockReset();
		playerMocks.togglePlay.mockReset();
		musicDrawerMocks.requireLogin.mockReturnValue(true);
		musicDrawerMocks.isAuthenticated.value = true;

		getMusicArtist.mockResolvedValue({
			id: "1",
			name: "Ye",
			legal_name: "Kanye Omari West",
			artist_form: "group",
			aliases: [{ alias: "Kanye West" }, { alias: "kanye" }],
			member_groups: {
				current: [
					{
						artist_id: "2",
						name: "Pusha T",
						image_url: "https://example.com/pusha-t.jpg",
						join_date: "2020-01-01",
						leave_date: "",
					},
				],
				former: [
					{
						artist_id: "3",
						name: "Kid Cudi",
						image_url: "",
						join_date: "2018-01-01",
						leave_date: "2022-06-30",
					},
				],
			},
			bio: "English rock band",
			entry_status: "open",
		});
		listMusicSongs.mockResolvedValue({
			data: [],
			meta: { page: 1, page_size: 100, total: 0, has_more: false },
		});
		listMusicAlbums.mockResolvedValue({
			data: [
				{
					id: "1",
					title: "The Dark Side of the Moon",
					release_date: "1973-03-01",
					songs: new Array(10).fill(null),
					album_type: "album",
					entry_status: "open",
				},
				{
					id: "2",
					title: "Wish You Were Here",
					release_date: "1975-09-12",
					songs: new Array(5).fill(null),
					album_type: "album",
					entry_status: "open",
				},
			],
			meta: { page: 1, page_size: 20, total: 2, has_more: false },
		});
		listArtistContributors.mockResolvedValue({
			data: [
				{
					user_id: "user-1",
					username: "editor",
					display_name: "Editor",
					avatar_url: "",
					revision_count: 1,
					last_contributed_at: "2026-08-09T10:00:00Z",
				},
			],
			total: 1,
		});
		listArtistBookmarks.mockResolvedValue({ data: [] });
		createArtistBookmark.mockResolvedValue({
			id: "artist-bookmark-1",
			artist_id: "1",
			created_at: "2026-07-02T00:00:00Z",
		});
		deleteArtistBookmark.mockResolvedValue({ deleted: true });
	});

	it("renders artist information and albums when artistId is present", async () => {
		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		// Check if artist title is rendered (artistId is '1' in mock)
		expect(wrapper.text()).toContain("Ye");
		expect(wrapper.text()).toContain("本名：Kanye Omari West");
		expect(wrapper.text()).toContain("曾用名：Kanye West / kanye");

		// Check if album list is rendered
		expect(
			wrapper.get('[data-testid="artist-release-type-album"]').text(),
		).toBe("专辑");
		expect(wrapper.get('[data-testid="artist-release-type-song"]').text()).toBe(
			"歌曲",
		);
		expect(wrapper.text()).toContain("The Dark Side of the Moon");
		expect(wrapper.text()).toContain("Wish You Were Here");
		expect(wrapper.text()).toContain("1973");
		expect(wrapper.text()).toContain("1975");
	});

	it("renders an artist-shaped skeleton while details load", async () => {
		getMusicArtist.mockReturnValueOnce(new Promise(() => undefined));

		const wrapper = mount(ArtistDrawer);
		await nextTick();

		expect(wrapper.find('[data-testid="artist-loading-header"]').exists()).toBe(
			true,
		);
		expect(
			wrapper
				.get('[data-testid="artist-loading-skeleton"]')
				.attributes("aria-busy"),
		).toBe("true");
		expect(wrapper.findAll(".artist-skeleton-album-row")).toHaveLength(4);
		expect(wrapper.text()).not.toContain("正在加载...");
		wrapper.unmount();
	});

	it("仅加载独立发行的单曲和泄曲", async () => {
		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();
		listMusicSongs.mockResolvedValueOnce({
			data: [
				{
					id: "song-3",
					title: "New Single",
					audio_url: "https://example.com/song-3.mp3",
					duration_sec: 215,
					release_type: "single",
					release_date: "2024-05-01",
					entry_status: "open",
				},
				{
					id: "song-4",
					title: "Undated Leak",
					release_type: "leak",
					release_date: "0001-01-01T00:00:00Z",
					entry_status: "open",
				},
			],
			meta: { page: 1, page_size: 24, total: 2, has_more: false },
		});

		await wrapper
			.get('[data-testid="artist-release-type-song"]')
			.trigger("click");
		await vi.dynamicImportSettled();

		expect(listMusicSongs).toHaveBeenLastCalledWith({
			artist_id: "1",
			release_type: "single,leak",
			sort: "-release_date",
			page: 1,
			page_size: 24,
		});
		expect(wrapper.findAll(".artist-track")).toHaveLength(2);
		expect(wrapper.text()).toContain("New Single");
		expect(wrapper.text()).toContain("Undated Leak");
		expect(wrapper.text()).not.toContain("Featured Album Track");
		expect(wrapper.text()).toContain("单曲");
		expect(wrapper.text()).toContain("泄曲");
		expect(wrapper.text()).toContain("2024/05/01");
		expect(wrapper.text()).toContain("----");
		expect(wrapper.text()).toContain("3:35");
		expect(
			wrapper
				.get('[data-testid="artist-track-play-song-4"]')
				.attributes("disabled"),
		).toBeDefined();

		await wrapper
			.get('[data-testid="artist-track-play-song-3"]')
			.trigger("click");
		expect(playerMocks.playAlbum).toHaveBeenCalledWith(
			[expect.objectContaining({ id: "song-3", title: "New Single" })],
			0,
		);

		await wrapper
			.get('[data-testid="artist-track-title-song-3"]')
			.trigger("click");
		expect(musicDrawerMocks.openSong).toHaveBeenCalledWith("song-3");
	});

	it("requests only the selected release resource when switching tabs", async () => {
		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();
		const artistCalls = getMusicArtist.mock.calls.length;
		const albumCalls = listMusicAlbums.mock.calls.length;
		const songCalls = listMusicSongs.mock.calls.length;
		const contributorCalls = listArtistContributors.mock.calls.length;
		const bookmarkCalls = listArtistBookmarks.mock.calls.length;
		const songResponse = {
			data: [],
			meta: { page: 1, page_size: 100, total: 0, has_more: false },
		};
		let resolveSongs!: (value: typeof songResponse) => void;
		listMusicSongs.mockReturnValueOnce(
			new Promise<typeof songResponse>((resolve) => {
				resolveSongs = resolve;
			}),
		);

		await wrapper
			.get('[data-testid="artist-release-type-song"]')
			.trigger("click");
		await nextTick();

		expect(getMusicArtist).toHaveBeenCalledTimes(artistCalls);
		expect(listMusicAlbums).toHaveBeenCalledTimes(albumCalls);
		expect(listMusicSongs).toHaveBeenCalledTimes(songCalls + 1);
		expect(listArtistContributors).toHaveBeenCalledTimes(contributorCalls);
		expect(listArtistBookmarks).toHaveBeenCalledTimes(bookmarkCalls);
		expect(
			wrapper.find('[data-testid="artist-loading-skeleton"]').exists(),
		).toBe(false);
		expect(
			wrapper.find('[data-testid="artist-release-loading-skeleton"]').exists(),
		).toBe(true);

		resolveSongs(songResponse);
		await vi.dynamicImportSettled();
		await wrapper
			.get('[data-testid="artist-release-type-album"]')
			.trigger("click");
		await vi.dynamicImportSettled();

		expect(getMusicArtist).toHaveBeenCalledTimes(artistCalls);
		expect(listMusicAlbums).toHaveBeenCalledTimes(albumCalls + 1);
		expect(listMusicSongs).toHaveBeenCalledTimes(songCalls + 1);
		expect(listArtistContributors).toHaveBeenCalledTimes(contributorCalls);
		expect(listArtistBookmarks).toHaveBeenCalledTimes(bookmarkCalls);
		wrapper.unmount();
	});

	it("keeps artist details visible when the song list fails", async () => {
		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();
		listMusicSongs.mockRejectedValueOnce(new Error("song list unavailable"));

		await wrapper
			.get('[data-testid="artist-release-type-song"]')
			.trigger("click");
		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain("Ye");
		expect(wrapper.text()).toContain("歌曲列表加载失败");
		expect(wrapper.text()).not.toContain("艺术家信息加载失败");
		wrapper.unmount();
	});

	it("opens artist history from the contributors block", async () => {
		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		await wrapper
			.get('[data-testid="music-contributors-open-history"]')
			.trigger("click");

		expect(listArtistContributors).toHaveBeenCalledWith("1");
		expect(musicDrawerMocks.openNestedAction).toHaveBeenCalledWith(
			"artist_history",
			{ artistId: "1", name: "Ye" },
		);
	});

	it("opens the merge target when the artist is closed with redirect_to", async () => {
		getMusicArtist.mockResolvedValueOnce({
			id: "1",
			name: "Merged Artist",
			entry_status: "closed",
			redirect_to: "artist-target",
		});
		getMusicArtist.mockResolvedValueOnce({
			id: "artist-target",
			name: "Target Artist",
			entry_status: "open",
		});

		mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		expect(musicDrawerMocks.openArtist).toHaveBeenCalledWith("artist-target");
	});

	it("renders current and former members for group artists", async () => {
		const wrapper = mount(ArtistDrawer);

		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain("现成员");
		expect(wrapper.text()).toContain("前成员");
		expect(wrapper.text()).toContain("Pusha T");
		expect(wrapper.text()).toContain("2020-01-01 - 至今");
		expect(wrapper.text()).toContain("Kid Cudi");
		expect(wrapper.text()).toContain("2018-01-01 - 2022-06-30");
	});

	it("opens the member artist page when clicking a member item", async () => {
		const wrapper = mount(ArtistDrawer);

		await vi.dynamicImportSettled();

		await wrapper.get('[data-testid="artist-member-2"]').trigger("click");

		expect(musicDrawerMocks.openArtist).toHaveBeenCalledWith("2");
	});

	it("creates an artist bookmark when clicking 订阅 and reflects the state", async () => {
		const wrapper = mount(ArtistDrawer);

		await vi.dynamicImportSettled();

		const bookmarkButton = wrapper.get(
			'[data-testid="artist-bookmark-toggle"]',
		);
		expect(bookmarkButton.text()).toContain("订阅");

		await bookmarkButton.trigger("click");
		await vi.dynamicImportSettled();

		expect(createArtistBookmark).toHaveBeenCalledWith("1");
		expect(
			wrapper.get('[data-testid="artist-bookmark-toggle"]').text(),
		).toContain("已订阅");
	});

	it("still renders artist details when bookmark lookup returns 401", async () => {
		listArtistBookmarks.mockRejectedValueOnce(
			new ApiErrorResponseError(401, "auth.unauthorized", "Login required"),
		);

		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain("Ye");
		expect(wrapper.text()).toContain("本名：Kanye Omari West");
		expect(wrapper.text()).not.toContain("艺术家信息加载失败");
	});

	it("keeps artist details visible when bookmark lookup fails", async () => {
		listArtistBookmarks.mockRejectedValueOnce(
			new Error("bookmark service unavailable"),
		);

		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain("Ye");
		expect(wrapper.text()).not.toContain("艺术家信息加载失败");
		wrapper.unmount();
	});

	it("does not request private bookmarks while a guest reads artist details", async () => {
		musicDrawerMocks.isAuthenticated.value = false;

		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain("Ye");
		expect(listArtistBookmarks).not.toHaveBeenCalled();
	});

	it("re-fetches artist data when artistRefreshToken changes", async () => {
		const wrapper = mount(ArtistDrawer);

		await vi.dynamicImportSettled();
		const artistCallsBeforeRefresh = getMusicArtist.mock.calls.length;
		const albumCallsBeforeRefresh = listMusicAlbums.mock.calls.length;

		drawerState.value = { artistId: "1", artistRefreshToken: 1 };
		await nextTick();
		await vi.dynamicImportSettled();

		expect(getMusicArtist.mock.calls.length).toBeGreaterThan(
			artistCallsBeforeRefresh,
		);
		expect(listMusicAlbums.mock.calls.length).toBeGreaterThan(
			albumCallsBeforeRefresh,
		);
		wrapper.unmount();
	});

	it("uses the fresh album list instead of cached albums embedded in artist data", async () => {
		getMusicArtist.mockResolvedValueOnce({
			id: "1",
			name: "Ye",
			albums: [
				{ id: "stale-album", title: "Stale Album", entry_status: "open" },
			],
			entry_status: "open",
		});
		listMusicAlbums.mockResolvedValueOnce({
			data: [{ id: "fresh-album", title: "Reconsider", entry_status: "open" }],
			meta: { page: 1, page_size: 100, total: 1, has_more: false },
		});

		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain("Reconsider");
		expect(wrapper.text()).not.toContain("Stale Album");
		wrapper.unmount();
	});

	it("loads the first artist album page and renders pagination", async () => {
		listMusicAlbums.mockResolvedValueOnce({
			data: [{ id: "album-1", title: "First Batch", entry_status: "open" }],
			meta: { page: 1, page_size: 24, total: 101, has_more: true },
		});

		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		expect(listMusicAlbums).toHaveBeenCalledTimes(1);
		expect(listMusicAlbums).toHaveBeenCalledWith({
			artist_id: "1",
			sort: "-release_date",
			page: 1,
			page_size: 24,
		});
		expect(wrapper.text()).toContain("First Batch");
		expect(wrapper.text()).not.toContain("Final Batch");
		expect(wrapper.findComponent({ name: "PaginationBar" }).exists()).toBe(
			true,
		);
	});

	it("opens unified artist editor from the artist detail action bar", async () => {
		const wrapper = mount(ArtistDrawer);

		await vi.dynamicImportSettled();

		await wrapper.get("button:nth-of-type(2)").trigger("click");

		expect(musicDrawerMocks.openMusicCreationFlow).toHaveBeenCalledWith({
			mode: "edit",
			entity: "artist",
			artistId: "1",
			startStep: "artist",
		});
	});

	it("opens the album creation flow with seeded artist data from the artist detail action bar", async () => {
		const wrapper = mount(ArtistDrawer);

		await vi.dynamicImportSettled();

		await wrapper.get("button:nth-of-type(3)").trigger("click");

		expect(musicDrawerMocks.openMusicCreationFlow).toHaveBeenCalledWith({
			artistId: "1",
			artistName: "Ye",
			artistLegalName: "Kanye Omari West",
			artistSource: "",
			startStep: "albumDetails",
		});
		expect(musicDrawerMocks.openMusicEditor).not.toHaveBeenCalled();
	});

	it("opens the existing album association flow from the artist detail action bar", async () => {
		const wrapper = mount(ArtistDrawer);
		await vi.dynamicImportSettled();

		await wrapper
			.get('[data-testid="artist-link-album-action"]')
			.trigger("click");

		expect(musicDrawerMocks.openNestedAction).toHaveBeenCalledWith(
			"link_album",
			{
				artistId: "1",
				artistName: "Ye",
			},
		);
	});

	it("keeps artist details visible when bookmark loading requires login", async () => {
		listArtistBookmarks.mockRejectedValueOnce(
			new ApiErrorResponseError(401, "auth.unauthorized", "Login required"),
		);

		const wrapper = mount(ArtistDrawer, {
			global: {
				stubs: {
					PSheet: { template: '<div><slot name="header" /><slot /></div>' },
				},
			},
		});

		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain("Ye");
		expect(wrapper.text()).not.toContain("艺术家信息加载失败");
	});
});
