import { config, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../../src/stores/auth";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import DiscoverView from "../../../../src/views/music/DiscoverView.vue";

const mocks = vi.hoisted(() => ({
	getMusicHome: vi.fn(),
	listMusicAlbumImports: vi.fn(),
	listMusicAlbums: vi.fn(),
	listMusicArtists: vi.fn(),
	listRecommendedArtists: vi.fn(),
	listPublicMusicPlaylists: vi.fn(),
	listPlaylistBookmarks: vi.fn(),
	listAlbumBookmarks: vi.fn(),
	listArtistBookmarks: vi.fn(),
	createPlaylistBookmark: vi.fn(),
	deletePlaylistBookmark: vi.fn(),
	createAlbumBookmark: vi.fn(),
	deleteAlbumBookmark: vi.fn(),
	createArtistBookmark: vi.fn(),
	deleteArtistBookmark: vi.fn(),
	push: vi.fn(),
	openAlbum: vi.fn(),
	openArtist: vi.fn(),
	openPlaylist: vi.fn(),
	openMusicCreationFlow: vi.fn(),
	requireLogin: vi.fn(),
	playSong: vi.fn(),
	resumeSong: vi.fn(),
	routeQuery: {} as Record<string, string>,
}));

vi.mock("@/api/musicV1", () => ({
	getMusicHome: mocks.getMusicHome,
	listMusicAlbumImports: mocks.listMusicAlbumImports,
	listMusicAlbums: mocks.listMusicAlbums,
	listMusicArtists: mocks.listMusicArtists,
	listRecommendedArtists: mocks.listRecommendedArtists,
	listPublicMusicPlaylists: mocks.listPublicMusicPlaylists,
	listPlaylistBookmarks: mocks.listPlaylistBookmarks,
	listAlbumBookmarks: mocks.listAlbumBookmarks,
	listArtistBookmarks: mocks.listArtistBookmarks,
	createPlaylistBookmark: mocks.createPlaylistBookmark,
	deletePlaylistBookmark: mocks.deletePlaylistBookmark,
	createAlbumBookmark: mocks.createAlbumBookmark,
	deleteAlbumBookmark: mocks.deleteAlbumBookmark,
	createArtistBookmark: mocks.createArtistBookmark,
	deleteArtistBookmark: mocks.deleteArtistBookmark,
}));

vi.mock("vue-router", () => ({
	useRouter: () => ({
		push: mocks.push,
	}),
	useRoute: () => ({ query: mocks.routeQuery }),
	RouterLink: {
		props: ["to"],
		template: "<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
	},
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		openAlbum: mocks.openAlbum,
		closeAlbum: vi.fn(),
		openArtist: mocks.openArtist,
		closeArtist: vi.fn(),
		openPlaylist: mocks.openPlaylist,
		openMusicCreationFlow: mocks.openMusicCreationFlow,
		closeMusicCreationFlow: vi.fn(),
		openMusicEditor: vi.fn(),
		closeMusicEditor: vi.fn(),
	}),
}));

vi.mock("@/composables/useLoginRedirect", () => ({
	useLoginRedirect: () => ({ requireLogin: mocks.requireLogin }),
}));

vi.mock("@/stores/player", () => ({
	usePlayerStore: () => ({
		playSong: mocks.playSong,
		resumeSong: mocks.resumeSong,
	}),
}));

describe("Music DiscoverView.vue", () => {
	afterEach(() => {
		config.global.plugins = [];
		setActivePinia(undefined);
	});

	beforeEach(() => {
		mocks.getMusicHome.mockReset();
		mocks.listMusicAlbumImports.mockReset();
		mocks.listMusicAlbums.mockReset();
		mocks.listMusicArtists.mockReset();
		mocks.listRecommendedArtists.mockReset();
		mocks.listPublicMusicPlaylists.mockReset();
		mocks.listPlaylistBookmarks.mockReset();
		mocks.listAlbumBookmarks.mockReset();
		mocks.listArtistBookmarks.mockReset();
		mocks.createPlaylistBookmark.mockReset();
		mocks.deletePlaylistBookmark.mockReset();
		mocks.createAlbumBookmark.mockReset();
		mocks.deleteAlbumBookmark.mockReset();
		mocks.createArtistBookmark.mockReset();
		mocks.deleteArtistBookmark.mockReset();
		mocks.push.mockReset();
		mocks.openAlbum.mockReset();
		mocks.openArtist.mockReset();
		mocks.openPlaylist.mockReset();
		mocks.openMusicCreationFlow.mockReset();
		mocks.requireLogin.mockReset();
		mocks.playSong.mockReset();
		mocks.resumeSong.mockReset();
		mocks.requireLogin.mockReturnValue(true);
		mocks.listMusicAlbumImports.mockResolvedValue([]);
		mocks.routeQuery = {};
		const pinia = createPinia();
		config.global.plugins = [pinia];
		setActivePinia(pinia);
		const auth = useAuthStore(pinia);
		auth.isAuthenticated = true;
		auth.token = "test-token";

		mocks.getMusicHome.mockResolvedValue({
			personalized: true,
			recently_played: [
				{
					id: "history-1",
					song: {
						id: "song-1",
						title: "Runaway",
						audio_url: "/uploads/runaway.mp3",
						artists: [{ id: "artist-1", name: "Ye" }],
						album: {
							id: "album-1",
							title: "2049",
							cover_url: "/uploads/2049.jpg",
						},
					},
				},
			],
			for_you: [
				{
					id: "album-2",
					title: "Late Registration",
					reason: "基于你与 Ye 相关的记录",
					artists: [{ id: "artist-1", name: "Ye" }],
				},
			],
			for_you_reason: "基于最近播放",
			sections: [
				{
					key: "popular",
					title: "热门",
					albums: [
						{
							id: "album-3",
							title: "Graduation",
							artists: [{ id: "artist-1", name: "Ye" }],
						},
					],
				},
			],
			discover: [
				{
					type: "album",
					id: "album-1",
					title: "2049",
					image_url: "/uploads/2049.jpg",
					target_path: "/music/album/album-1",
					reason: "近期热门专辑",
					artists: [{ id: "artist-1", name: "Ye" }],
					play_count: 12,
					bookmark_count: 4,
				},
				{
					type: "playlist",
					id: "playlist-1",
					title: "Late Night Mix",
					description: "夜间循环",
					cover_url: "/uploads/late-night.jpg",
					song_count: 18,
					owner_username: "alice",
					play_count: 42,
					bookmark_count: 7,
					target_path: "/music/playlist/playlist-1",
				},
				{
					type: "artist",
					id: "artist-1",
					name: "Ye",
					title: "Ye",
					summary: "Kanye",
					image_url: "",
					target_path: "/music/artist/artist-1",
					play_count: 3,
					bookmark_count: 1,
					entry_status: "open",
				},
			],
			discover_has_more: false,
			discover_meta: { page: 1, page_size: 24, total: 3, has_more: false },
		});
		mocks.listMusicAlbums.mockResolvedValue({
			data: [
				{
					id: "album-1",
					title: "2049",
					artists: [{ id: "artist-1", name: "Ye" }],
				},
			],
			meta: { page: 1, page_size: 10, total: 1, has_more: false },
		});
		mocks.listMusicArtists.mockResolvedValue({
			data: [{ id: "artist-1", name: "Ye", legal_name: "Kanye" }],
			meta: { page: 1, page_size: 10, total: 1, has_more: false },
		});
		mocks.listRecommendedArtists.mockResolvedValue({
			data: [
				{
					id: "artist-1",
					title: "Ye",
					summary: "Kanye",
					image_url: "",
					target_path: "/music?artist=artist-1",
					play_count: 3,
					bookmark_count: 1,
				},
			],
			meta: { page: 1, page_size: 10, total: 1, has_more: false },
		});
		mocks.listPublicMusicPlaylists.mockResolvedValue({
			data: [
				{
					id: "playlist-1",
					name: "Late Night Mix",
					description: "夜间循环",
					cover_url: "/uploads/late-night.jpg",
					song_count: 18,
					owner_username: "alice",
					play_count: 42,
					bookmark_count: 7,
				},
			],
			meta: { page: 1, page_size: 10, total: 1, has_more: false },
		});
		mocks.listAlbumBookmarks.mockResolvedValue({ data: [] });
		mocks.listArtistBookmarks.mockResolvedValue({ data: [] });
		mocks.listPlaylistBookmarks.mockResolvedValue({ data: [] });
	});

	it("uses 发现 as the default page title", async () => {
		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: '<div data-testid="page-header-title">{{ title }}</div>',
					},
					PSegmentedControl: {
						props: ["options"],
						template:
							'<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>',
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();
		expect(wrapper.text()).toContain("近期热门专辑");

		expect(wrapper.get('[data-testid="page-header-title"]').text()).toBe(
			"发现",
		);
	});

	it("uses the external page title when provided", async () => {
		const wrapper = mount(DiscoverView, {
			props: {
				pageTitle: "专辑",
			},
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: '<div data-testid="page-header-title">{{ title }}</div>',
					},
					PSegmentedControl: {
						props: ["options"],
						template:
							'<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>',
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		expect(wrapper.get('[data-testid="page-header-title"]').text()).toBe(
			"专辑",
		);
	});

	it("renders album-only content when used in albums mode", async () => {
		const wrapper = mount(DiscoverView, {
			props: {
				pageTitle: "专辑",
				contentMode: "albums",
			},
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		expect(mocks.getMusicHome).not.toHaveBeenCalled();
		expect(mocks.listMusicAlbums).toHaveBeenCalledWith({
			page: 1,
			page_size: 12,
			sort: "hot",
		});
		expect(wrapper.find('[aria-label="专辑列表"]').exists()).toBe(true);
		expect(wrapper.findAll('[data-testid="discover-album-card"]')).toHaveLength(
			1,
		);
		expect(
			wrapper.findAll('[data-testid="discover-artist-card"]'),
		).toHaveLength(0);
		expect(
			wrapper.findAll('[data-testid="discover-playlist-card"]'),
		).toHaveLength(0);
		expect(wrapper.find('[data-testid="discover-album-card"]').exists()).toBe(
			true,
		);
		expect(wrapper.text()).not.toContain("Late Night Mix");
	});

	it("opens the album creation flow from the album landing page", async () => {
		const wrapper = mount(DiscoverView, {
			props: {
				pageTitle: "专辑",
				contentMode: "albums",
			},
		});
		await flushPromises();

		await wrapper.get('[data-testid="add-album"]').trigger("click");

		expect(mocks.openMusicCreationFlow).toHaveBeenCalledWith({
			startStep: "albumDetails",
		});
	});

	it("loads album pages incrementally and sends keywords to the server", async () => {
		vi.useFakeTimers();
		try {
			mocks.listMusicAlbums
				.mockResolvedValueOnce({
					data: [{ id: "album-1", title: "First", artists: [] }],
					meta: { page: 1, page_size: 12, total: 2, has_more: true },
				})
				.mockResolvedValueOnce({
					data: [{ id: "album-2", title: "Second", artists: [] }],
					meta: { page: 2, page_size: 12, total: 2, has_more: false },
				})
				.mockResolvedValueOnce({
					data: [{ id: "album-3", title: "Search Result", artists: [] }],
					meta: { page: 1, page_size: 12, total: 1, has_more: false },
				});

			const wrapper = mount(DiscoverView, { props: { contentMode: "albums" } });
			await flushPromises();
			await wrapper.get('button[title="下一页"]').trigger("click");
			await flushPromises();
			expect(
				wrapper.findAll('[data-testid="discover-album-card"]'),
			).toHaveLength(1);
			expect(mocks.listMusicAlbums).toHaveBeenNthCalledWith(2, {
				page: 2,
				page_size: 12,
				sort: "hot",
			});

			await wrapper
				.get('[data-testid="music-explore-search-input"]')
				.setValue("Search");
			await vi.advanceTimersByTimeAsync(250);
			await flushPromises();
			expect(mocks.listMusicAlbums).toHaveBeenLastCalledWith({
				q: "Search",
				page: 1,
				page_size: 12,
				sort: "hot",
			});
			expect(wrapper.text()).toContain("Search Result");
			expect(wrapper.text()).not.toContain("First");
			wrapper.unmount();
		} finally {
			vi.useRealTimers();
		}
	});

	it("shows album and artist groups in search dropdown", async () => {
		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template:
							'<div><span>{{ title }}</span><slot /><slot name="action" /></div>',
					},
					PSegmentedControl: {
						props: ["options"],
						template:
							'<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>',
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		const input = wrapper.find('[data-testid="music-explore-search-input"]');
		await input.trigger("focus");
		await input.setValue("ye");
		await flushPromises();

		expect(mocks.listMusicAlbums).toHaveBeenLastCalledWith({
			q: "ye",
			page: 1,
			page_size: 10,
			sort: "hot",
		});
		expect(mocks.listMusicArtists).toHaveBeenLastCalledWith({
			q: "ye",
			page: 1,
			page_size: 10,
		});
		expect(wrapper.text()).toContain("专辑");
		expect(wrapper.text()).toContain("艺术家");
		expect(wrapper.text()).toContain("2049");
		expect(wrapper.text()).toContain("Ye");

		const resultButtons = wrapper.findAll("button.search-result");
		await resultButtons[0].trigger("mousedown");
		expect(mocks.push).toHaveBeenCalledWith("/music/album/album-1");

		await input.trigger("focus");
		await input.setValue("ye");
		await flushPromises();
		const reopenedButtons = wrapper.findAll("button.search-result");
		await reopenedButtons[1].trigger("mousedown");
		expect(mocks.push).toHaveBeenCalledWith("/music/artist/artist-1");
	});

	it("loads discovery sections independently", async () => {
		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					PSegmentedControl: {
						props: ["options"],
						template:
							'<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>',
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		expect(mocks.getMusicHome).toHaveBeenCalledWith();
		expect(mocks.listMusicAlbums).toHaveBeenCalledWith({
			page: 1,
			page_size: 6,
			sort: "hot",
		});
		expect(mocks.listRecommendedArtists).toHaveBeenCalledWith("hot", {
			page: 1,
			page_size: 6,
		});
		expect(mocks.listPublicMusicPlaylists).toHaveBeenCalledWith({
			page: 1,
			page_size: 6,
		});
		expect(wrapper.find('[aria-label="发现分区"]').exists()).toBe(true);
		expect(wrapper.find('[aria-label="为你推荐专辑"]').exists()).toBe(true);
		expect(wrapper.find('[aria-label="发现专辑分区"]').exists()).toBe(true);
		expect(wrapper.find('[aria-label="发现歌单分区"]').exists()).toBe(true);
		expect(wrapper.find('[aria-label="发现艺人分区"]').exists()).toBe(true);
		expect(wrapper.findAll('[data-testid="discover-album-card"]')).toHaveLength(
			1,
		);
		expect(
			wrapper.findAll('[data-testid="discover-artist-card"]'),
		).toHaveLength(1);
		expect(
			wrapper.findAll('[data-testid="discover-playlist-card"]'),
		).toHaveLength(1);
		expect(wrapper.text()).toContain("2049");
		expect(wrapper.text()).toContain("Ye");
		expect(wrapper.text()).toContain("alice/Late Night Mix");
		expect(wrapper.text()).toContain("42");
		expect(wrapper.text()).toContain("7");
		expect(
			wrapper
				.get('[data-testid="discover-playlist-card"] img')
				.attributes("src"),
		).toBe("/uploads/late-night.jpg");

		const sections = wrapper
			.findAll('[data-testid="discover-section-title"]')
			.map((node) => node.text());
		expect(sections).toEqual(["专辑", "歌单", "艺人"]);
	});

	it("skips personalized home for anonymous visitors", async () => {
		const auth = useAuthStore();
		auth.isAuthenticated = false;
		auth.token = null;

		const wrapper = mount(DiscoverView);
		await flushPromises();

		expect(mocks.getMusicHome).not.toHaveBeenCalled();
		expect(mocks.listMusicAlbums).toHaveBeenCalledTimes(1);
		expect(mocks.listRecommendedArtists).toHaveBeenCalledTimes(1);
		expect(mocks.listPublicMusicPlaylists).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[aria-label="发现分区"]').exists()).toBe(true);
	});

	it("starts public discovery before personalized home resolves", async () => {
		let resolveHome!: (value: Record<string, unknown>) => void;
		mocks.getMusicHome.mockImplementationOnce(() => new Promise((resolve) => {
			resolveHome = resolve;
		}));

		mount(DiscoverView);
		await flushPromises();

		expect(mocks.listMusicAlbums).toHaveBeenCalledTimes(1);
		expect(mocks.listRecommendedArtists).toHaveBeenCalledTimes(1);
		expect(mocks.listPublicMusicPlaylists).toHaveBeenCalledTimes(1);

		resolveHome({ personalized: true, recently_played: [], for_you: [] });
		await flushPromises();
	});

	it("loads more items for only the selected discovery section", async () => {
		mocks.listMusicAlbums
			.mockResolvedValueOnce({
				data: [
					{ id: "album-1", title: "First", artists: [], entry_status: "open" },
				],
				meta: { page: 1, page_size: 6, total: 2, has_more: true },
			})
			.mockResolvedValueOnce({
				data: [
					{
						id: "album-more",
						title: "Second",
						artists: [],
						entry_status: "open",
					},
				],
				meta: { page: 2, page_size: 6, total: 2, has_more: false },
			});

		const wrapper = mount(DiscoverView);
		await flushPromises();

		await wrapper
			.get('[data-testid="discover-albums-load-more"]')
			.trigger("click");
		await flushPromises();

		expect(mocks.listMusicAlbums).toHaveBeenNthCalledWith(2, {
			page: 2,
			page_size: 6,
			sort: "hot",
		});
		expect(mocks.listRecommendedArtists).toHaveBeenCalledTimes(1);
		expect(mocks.listPublicMusicPlaylists).toHaveBeenCalledTimes(1);
		expect(wrapper.findAll('[data-testid="discover-album-card"]')).toHaveLength(
			2,
		);
		expect(
			wrapper.findAll('[data-testid="discover-artist-card"]'),
		).toHaveLength(1);
		expect(
			wrapper.findAll('[data-testid="discover-playlist-card"]'),
		).toHaveLength(1);
	});

	it("keeps the latest home response when authentication changes during loading", async () => {
		let resolveFirst!: (value: Record<string, unknown>) => void;
		const first = new Promise<Record<string, unknown>>((resolve) => {
			resolveFirst = resolve;
		});
		mocks.getMusicHome.mockReturnValueOnce(first).mockResolvedValueOnce({
			personalized: true,
			recently_played: [],
			for_you: [],
			sections: [],
			discover: [
				{
					type: "artist",
					id: "artist-new",
					name: "Current Artist",
					title: "Current Artist",
				},
			],
			discover_has_more: false,
			discover_meta: { page: 1, page_size: 24, total: 1, has_more: false },
		});
		mocks.listRecommendedArtists.mockResolvedValue({
			data: [
				{
					id: "artist-new",
					title: "Current Artist",
					summary: "",
					image_url: "",
					target_path: "/music/artist/artist-new",
				},
			],
			meta: { page: 1, page_size: 6, total: 1, has_more: false },
		});
		const pinia = createPinia();
		setActivePinia(pinia);
		const wrapper = mount(DiscoverView, { global: { plugins: [pinia] } });
		const auth = useAuthStore();
		auth.isAuthenticated = true;
		auth.token = "new-token";
		await flushPromises();
		expect(wrapper.text()).toContain("Current Artist");

		resolveFirst({
			personalized: false,
			recently_played: [],
			for_you: [],
			sections: [],
			discover: [
				{
					type: "artist",
					id: "artist-old",
					name: "Obsolete Artist",
					title: "Obsolete Artist",
				},
			],
			discover_has_more: false,
			discover_meta: { page: 1, page_size: 24, total: 1, has_more: false },
		});
		await flushPromises();
		expect(wrapper.text()).toContain("Current Artist");
		expect(wrapper.text()).not.toContain("Obsolete Artist");
	});

	it("shows personalized albums without restoring the legacy public sections", async () => {
		const wrapper = mount(DiscoverView);
		await flushPromises();

		expect(mocks.getMusicHome).toHaveBeenCalledTimes(1);
		expect(wrapper.text()).toContain("最近播放");
		expect(wrapper.text()).toContain("Runaway");
		expect(wrapper.text()).toContain("为你推荐");
		expect(wrapper.text()).toContain("基于你与 Ye 相关的记录");
		expect(wrapper.text()).not.toContain("Graduation");
		expect(wrapper.find("button button").exists()).toBe(false);

		await wrapper
			.get('[aria-label="打开专辑 Late Registration"]')
			.trigger("click");
		expect(mocks.openAlbum).toHaveBeenCalledWith("album-2");

		await wrapper.get('[aria-label="打开艺人 Ye"]').trigger("click");
		expect(mocks.openArtist).toHaveBeenCalledWith("artist-1");

		await wrapper.get('[data-testid="recent-song-play"]').trigger("click");
		expect(mocks.playSong).toHaveBeenCalledWith(
			expect.objectContaining({ id: "song-1" }),
		);

		await wrapper
			.get('[data-testid="recent-song-artist-artist-1"]')
			.trigger("click");
		await wrapper
			.get('[data-testid="recent-song-album-album-1"]')
			.trigger("click");
		expect(mocks.openArtist).toHaveBeenCalledWith("artist-1");
		expect(mocks.openAlbum).toHaveBeenCalledWith("album-1");
	});

	it("shows personalized albums in one batch and cycles through the remaining recommendations", async () => {
		mocks.getMusicHome.mockResolvedValueOnce({
			personalized: true,
			recently_played: [],
			for_you: Array.from({ length: 8 }, (_, index) => ({
				id: `album-${index + 1}`,
				title: `Recommended Album ${index + 1}`,
				artists: [{ id: "artist-1", name: "Ye" }],
			})),
			sections: [],
			discover: [],
			discover_has_more: false,
			discover_meta: {
				page: 1,
				page_size: 24,
				total: 0,
				has_more: false,
			},
		});

		const wrapper = mount(DiscoverView);
		await flushPromises();

		expect(
			wrapper.findAll('[data-testid="personalized-album-card"]'),
		).toHaveLength(6);
		expect(wrapper.text()).toContain("Recommended Album 1");
		expect(wrapper.text()).not.toContain("Recommended Album 7");

		await wrapper.get('[data-testid="for-you-next-batch"]').trigger("click");

		expect(
			wrapper.findAll('[data-testid="personalized-album-card"]'),
		).toHaveLength(2);
		expect(wrapper.text()).toContain("Recommended Album 7");
		expect(wrapper.text()).not.toContain("Recommended Album 1");

		await wrapper.get('[data-testid="for-you-next-batch"]').trigger("click");

		expect(wrapper.text()).toContain("Recommended Album 1");
	});

	it("merges continue listening into the recent playback section", async () => {
		mocks.getMusicHome.mockResolvedValueOnce({
			personalized: true,
			continue_listening: {
				position_seconds: 42.5,
				song: {
					id: "song-continue",
					title: "Ghost Town",
					audio_url: "/uploads/ghost-town.mp3",
					artists: [{ id: "artist-1", name: "Ye" }],
					album: { id: "album-3", title: "ye" },
				},
			},
			recently_played: [
				{
					id: "history-continue",
					song: {
						id: "song-continue",
						title: "Ghost Town",
						audio_url: "/uploads/ghost-town.mp3",
					},
				},
				{
					id: "history-1",
					song: {
						id: "song-1",
						title: "Runaway",
						audio_url: "/uploads/runaway.mp3",
					},
				},
			],
			for_you: [],
			sections: [],
			discover: [],
			discover_has_more: false,
			discover_meta: { page: 1, page_size: 24, total: 0, has_more: false },
		});

		const wrapper = mount(DiscoverView);
		await flushPromises();

		expect(wrapper.findAll("#recently-played-title")).toHaveLength(1);
		expect(wrapper.find("#continue-listening-title").exists()).toBe(false);
		expect(wrapper.findAll(".recently-played-item")).toHaveLength(2);
		expect(wrapper.findAll(".recently-played-item")[0]?.text()).toContain(
			"从 0:42 继续",
		);
		expect(wrapper.findAll(".recently-played-item")[0]?.text()).toContain(
			"Ghost Town",
		);
		expect(wrapper.findAll(".recently-played-item")[1]?.text()).toContain(
			"Runaway",
		);

		await wrapper.get('[data-testid="continue-song-play"]').trigger("click");
		await wrapper
			.get('[data-testid="continue-song-artist-artist-1"]')
			.trigger("click");
		await wrapper
			.get('[data-testid="continue-song-album-album-3"]')
			.trigger("click");
		expect(mocks.resumeSong).toHaveBeenCalledWith(
			expect.objectContaining({ id: "song-continue" }),
			42.5,
		);
		expect(mocks.openArtist).toHaveBeenCalledWith("artist-1");
		expect(mocks.openAlbum).toHaveBeenCalledWith("album-3");
	});

	it("does not repeat personalized albums in the public discover section", async () => {
		mocks.getMusicHome.mockResolvedValueOnce({
			personalized: true,
			recently_played: [],
			for_you: [
				{
					id: "album-1",
					title: "2049",
					artists: [{ id: "artist-1", name: "Ye" }],
				},
			],
			sections: [],
			discover: [
				{
					type: "album",
					id: "album-1",
					title: "2049",
					target_path: "/music/album/album-1",
					artists: [{ id: "artist-1", name: "Ye" }],
				},
			],
			discover_has_more: false,
			discover_meta: { page: 1, page_size: 24, total: 1, has_more: false },
		});

		const wrapper = mount(DiscoverView);
		await flushPromises();

		expect(
			wrapper.findAll('[data-testid="personalized-album-card"]'),
		).toHaveLength(1);
		expect(wrapper.findAll('[data-testid="discover-album-card"]')).toHaveLength(
			0,
		);
		expect(wrapper.find('[aria-label="发现专辑分区"]').exists()).toBe(false);
	});

	it("hides the playlist section when public playlists are empty", async () => {
		mocks.listPublicMusicPlaylists.mockResolvedValueOnce({
			data: [],
			meta: { page: 1, page_size: 6, total: 0, has_more: false },
		});
		mocks.getMusicHome.mockResolvedValueOnce({
			personalized: false,
			recently_played: [],
			for_you: [],
			sections: [],
			discover: [
				{
					type: "album",
					id: "album-1",
					title: "2049",
					target_path: "/music/album/album-1",
					artists: [{ id: "artist-1", name: "Ye" }],
				},
				{
					type: "artist",
					id: "artist-1",
					name: "Ye",
					target_path: "/music/artist/artist-1",
					entry_status: "open",
				},
			],
			discover_has_more: false,
			discover_meta: { page: 1, page_size: 24, total: 2, has_more: false },
		});

		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					PSegmentedControl: {
						props: ["options"],
						template:
							'<div><button v-for="o in options" :key="o.value">{{ o.label }}</button></div>',
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		expect(wrapper.find('[aria-label="发现歌单分区"]').exists()).toBe(false);
		expect(
			wrapper.findAll('[data-testid="discover-playlist-card"]'),
		).toHaveLength(0);
		expect(
			wrapper.findAll('[data-testid="discover-playlist-placeholder"]'),
		).toHaveLength(0);
	});

	it("opens playlist route when clicking a discover playlist card", async () => {
		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		await wrapper
			.get('[data-testid="discover-playlist-card"]')
			.trigger("click");

		expect(mocks.push).toHaveBeenCalledWith("/music/playlist/playlist-1");
		expect(mocks.openPlaylist).not.toHaveBeenCalled();
	});

	it("opens album drawer when clicking a discover album card", async () => {
		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		await wrapper
			.get(
				'[aria-label="发现专辑分区"] [data-testid="discover-album-card"] .cover-action',
			)
			.trigger("click");

		expect(mocks.openAlbum).toHaveBeenCalledWith("album-1");
		expect(mocks.push).not.toHaveBeenCalledWith("/music?album=album-1");
	});

	it("opens artist drawer when clicking a discover artist card", async () => {
		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		await wrapper.get('[data-testid="discover-artist-card"]').trigger("click");

		expect(mocks.openArtist).toHaveBeenCalledWith("artist-1");
		expect(mocks.push).not.toHaveBeenCalledWith("/music?artist=artist-1");
	});

	it("toggles playlist bookmark from the discover feed", async () => {
		mocks.createPlaylistBookmark.mockResolvedValue({
			id: "playlist-bookmark-1",
			playlist_id: "playlist-1",
			created_at: "2026-07-05T00:00:00Z",
		});

		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		const playlistCard = wrapper.find('[data-testid="discover-playlist-card"]');
		expect(playlistCard.find('button[aria-label="收藏"]').exists()).toBe(true);

		await playlistCard.find('button[aria-label="收藏"]').trigger("click");

		expect(mocks.createPlaylistBookmark).toHaveBeenCalledWith("playlist-1");
		expect(wrapper.text()).toContain("收藏 8");
	});

	it("routes guests to login instead of silently failing to bookmark an album", async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		useAuthStore().isAuthenticated = false;
		mocks.requireLogin.mockReturnValue(false);

		const wrapper = mount(DiscoverView, {
			props: {
				pageTitle: "专辑",
				contentMode: "albums",
			},
			global: {
				plugins: [pinia],
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		await wrapper
			.get('[data-testid="discover-album-card"] button[aria-label="收藏"]')
			.trigger("click");

		expect(mocks.requireLogin).toHaveBeenCalled();
		expect(mocks.createAlbumBookmark).not.toHaveBeenCalled();
	});

	it("toggles artist bookmark from the discover feed", async () => {
		mocks.createArtistBookmark.mockResolvedValue({
			id: "artist-bookmark-1",
			artist_id: "artist-1",
			created_at: "2026-07-05T00:00:00Z",
		});

		const wrapper = mount(DiscoverView, {
			global: {
				stubs: {
					PPageHeader: {
						props: ["title"],
						template: "<div><span>{{ title }}</span></div>",
					},
					RouterLink: {
						props: ["to"],
						template:
							"<a :href=\"typeof to === 'string' ? to : '#'\"><slot /></a>",
					},
				},
			},
		});
		await flushPromises();

		const artistCard = wrapper.find('[data-testid="discover-artist-card"]');
		expect(artistCard.find('button[aria-label="收藏"]').exists()).toBe(true);

		await artistCard.find('button[aria-label="收藏"]').trigger("click");

		expect(mocks.createArtistBookmark).toHaveBeenCalledWith("artist-1");
	});
});
