import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorResponseError } from "../../../../src/api/client";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import AlbumDrawer from "../../../../src/components/music/AlbumDrawer.vue";

vi.mock("@/components/ui/PSheet.vue", () => ({
	default: {
		name: "PSheet",
		props: ["show", "title", "isShifted", "isTopLayer"],
		template: "<div><slot /></div>",
	},
}));

vi.mock("@/components/ui/PDiscussionFAB.vue", () => ({
	default: {
		props: ["count"],
		template:
			'<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>',
	},
}));

vi.mock("@/components/comment/CommentSideSheet.vue", () => ({
	default: {
		name: "CommentSideSheet",
		props: ["show", "title", "target", "isShifted", "isTopLayer"],
		emits: ["close", "mode-change", "count-change"],
		template: '<section data-test="album-comment-side-sheet"><slot /></section>',
	},
}));

const {
	openNestedAction,
	openMusicEditor,
	openMusicCreationFlow,
	openAlbum,
	openArtist,
	refreshPlaylists,
	getMusicAlbum,
	playAlbum,
	togglePlay,
	currentSong,
	isPlaying,
	listAlbumBookmarks,
	listAlbumContributors,
	createAlbumBookmark,
	deleteAlbumBookmark,
	listMusicPlaylists,
	addMusicPlaylistSong,
	requireLogin,
	isAuthenticated,
} = vi.hoisted(() => ({
	openNestedAction: vi.fn(),
	openMusicEditor: vi.fn(),
	openMusicCreationFlow: vi.fn(),
	openAlbum: vi.fn(),
	openArtist: vi.fn(),
	refreshPlaylists: vi.fn(),
	getMusicAlbum: vi.fn(),
	playAlbum: vi.fn(),
	togglePlay: vi.fn(),
	currentSong: { value: null as { id: string; source_id?: string } | null },
	isPlaying: { value: false },
	listAlbumBookmarks: vi.fn(),
	listAlbumContributors: vi.fn(),
	createAlbumBookmark: vi.fn(),
	deleteAlbumBookmark: vi.fn(),
	listMusicPlaylists: vi.fn(() => Promise.resolve({ data: [] })),
	addMusicPlaylistSong: vi.fn(() => Promise.resolve({})),
	requireLogin: vi.fn(),
	isAuthenticated: { value: true },
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		state: { value: { albumId: "1" } },
		closeAlbum: vi.fn(),
		isAlbumShifted: { value: false },
		isLayerActive: () => true,
		isLayerShifted: () => false,
		isTopLayer: () => true,
		openNestedAction,
		openMusicEditor,
		openMusicCreationFlow,
		openAlbum,
		openArtist,
		refreshPlaylists,
	}),
}));

vi.mock("@/composables/useLoginRedirect", () => ({
	useLoginRedirect: () => ({ isAuthenticated, requireLogin }),
}));

vi.mock("@/api/musicV1", () => ({
	getMusicAlbum,
	listAlbumBookmarks,
	listAlbumContributors,
	createAlbumBookmark,
	deleteAlbumBookmark,
	listMusicPlaylists,
	addMusicPlaylistSong,
}));

vi.mock("@/stores/player", () => ({
	usePlayerStore: () => ({
		playAlbum,
		togglePlay,
		get currentSong() {
			return currentSong.value;
		},
		get isPlaying() {
			return isPlaying.value;
		},
	}),
}));

describe("AlbumDrawer.vue", () => {
	beforeEach(() => {
		openNestedAction.mockReset();
		openMusicEditor.mockReset();
		openMusicCreationFlow.mockReset();
		openAlbum.mockReset();
		openArtist.mockReset();
		refreshPlaylists.mockReset();
		getMusicAlbum.mockReset();
		playAlbum.mockReset();
		togglePlay.mockReset();
		currentSong.value = null;
		isPlaying.value = false;
		listAlbumBookmarks.mockReset();
		listAlbumContributors.mockReset();
		listMusicPlaylists.mockReset();
		addMusicPlaylistSong.mockReset();
		createAlbumBookmark.mockReset();
		deleteAlbumBookmark.mockReset();
		requireLogin.mockReset();
		requireLogin.mockReturnValue(true);
		isAuthenticated.value = true;
		getMusicAlbum.mockResolvedValue({
			id: "1",
			title: "Test Album",
			release_date: "2024-01-01",
			album_type: "album",
			entry_status: "open",
			songs: [
				{
					id: "101",
					title: "First Song",
					track_number: 1,
					audio_url: "https://cdn.test/1.mp3",
				},
				{
					id: "102",
					title: "Second Song",
					track_number: 2,
					audio_url: "https://cdn.test/2.mp3",
				},
			],
		});
		listAlbumBookmarks.mockResolvedValue({ data: [] });
		listAlbumContributors.mockResolvedValue({
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
		createAlbumBookmark.mockResolvedValue({
			id: "album-bookmark-1",
			album_id: "1",
			created_at: "2026-07-02T00:00:00Z",
		});
		deleteAlbumBookmark.mockResolvedValue({ deleted: true });
		listMusicPlaylists.mockResolvedValue({ data: [] });
	});

	function paginated<T>(data: T[], page: number, hasMore = false) {
		return {
			data,
			meta: {
				page,
				page_size: data.length,
				total: data.length,
				has_more: hasMore,
			},
		};
	}

	it("does not render redundant sheet headings", () => {
		const wrapper = mount(AlbumDrawer, {});
		expect(wrapper.text()).not.toContain("Album Notes");
		expect(wrapper.text()).not.toContain("专辑详情");
	});

	it("renders an album-shaped skeleton while details load", async () => {
		getMusicAlbum.mockReturnValueOnce(new Promise(() => undefined));

		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		expect(
			wrapper
				.get('[data-testid="album-loading-skeleton"]')
				.attributes("aria-busy"),
		).toBe("true");
		expect(wrapper.find(".album-loading-skeleton .album-meta-row").exists()).toBe(
			true,
		);
		expect(wrapper.findAll(".album-skeleton-track")).toHaveLength(5);
		expect(wrapper.text()).not.toContain("正在加载专辑...");
		wrapper.unmount();
	});

	it("collapses track details by default", async () => {
		const wrapper = mount(AlbumDrawer);
		await flushPromises();
		expect(
			wrapper.find('[data-testid="album-track-display-detailed"]').exists(),
		).toBe(false);
		expect(wrapper.findAll(".track-specification")).toHaveLength(0);
		expect(
			wrapper.get('[data-testid="track-details-101"]').attributes("aria-expanded"),
		).toBe("false");
	});

	it("keeps track ratings with the other track metadata", async () => {
		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		const track = wrapper.get(".track");
		expect(track.get(".track-meta").find(".track-rating").exists()).toBe(true);
		expect(track.findAll(".track-rating")).toHaveLength(1);
	});

	it("shows a short album description without a collapse control", async () => {
		getMusicAlbum.mockResolvedValueOnce({
			id: "1",
			title: "Test Album",
			description: "Album notes",
			entry_status: "open",
			songs: [],
		});
		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		expect(wrapper.get("#album-description").text()).toBe("Album notes");
		expect(
			wrapper.find('[data-testid="album-description-toggle"]').exists(),
		).toBe(false);
	});
	it("renders every track returned by album details without pagination", async () => {
		getMusicAlbum.mockResolvedValue({
			id: "1",
			title: "Complete Album",
			entry_status: "open",
			songs: Array.from({ length: 21 }, (_, index) => ({
				id: `song-${index + 1}`,
				title: `Track ${index + 1}`,
				track_number: index + 1,
				audio_url: `https://cdn.test/${index + 1}.mp3`,
			})),
		});

		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		expect(wrapper.findAll(".track")).toHaveLength(21);
		expect(wrapper.text()).toContain("21 首");
		expect(wrapper.findComponent({ name: "PaginationBar" }).exists()).toBe(false);
	});

	it("opens album comments through the unified side sheet and keeps its count synchronized", async () => {
		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		await wrapper.get('[data-test="discussion-fab"]').trigger("click");

		expect(openNestedAction).not.toHaveBeenCalled();
		const commentSheet = wrapper.getComponent({ name: "CommentSideSheet" });
		expect(commentSheet.props()).toMatchObject({
			show: true,
			title: "专辑评论-Test Album",
			target: { kind: "music_album", resourceId: "1" },
		});

		commentSheet.vm.$emit("count-change", 3);
		await flushPromises();
		expect(wrapper.get('[data-test="discussion-fab"]').text()).toContain("(3)");

		commentSheet.vm.$emit("mode-change", "full");
		await flushPromises();
		const albumSheet = wrapper.getComponent({ name: "PSheet" });
		expect(albumSheet.props()).toMatchObject({ isShifted: true, isTopLayer: false });

		commentSheet.vm.$emit("close");
		await flushPromises();
		expect(commentSheet.props("show")).toBe(false);
		expect(albumSheet.props()).toMatchObject({ isShifted: false, isTopLayer: true });
	});

	it("opens album history from the contributors block", async () => {
		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		await wrapper
			.get('[data-testid="music-contributors-open-history"]')
			.trigger("click");

		expect(listAlbumContributors).toHaveBeenCalledWith("1");
		expect(openNestedAction).toHaveBeenCalledWith("history", { albumId: "1", title: "Test Album" });
	});

	it("groups and displays fixed and custom album creator roles", async () => {
		getMusicAlbum.mockResolvedValue({
			id: "1",
			title: "Credits Album",
			entry_status: "open",
			artists: [{ id: "artist-1", name: "Creator" }],
			artist_credits: [
				{
					album_id: "1",
					artist_id: "artist-1",
					artist: { id: "artist-1", name: "Creator", entry_status: "open" },
					role: "primary",
					position: 1,
				},
				{
					album_id: "1",
					artist_id: "artist-1",
					artist: { id: "artist-1", name: "Creator", entry_status: "open" },
					role: "producer",
					position: 1,
				},
				{
					album_id: "1",
					artist_id: "artist-1",
					artist: { id: "artist-1", name: "Creator", entry_status: "open" },
					role: "custom",
					custom_role: "Mix Engineer",
					position: 1,
				},
			],
			songs: [],
		});

		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		expect(wrapper.text()).toContain("主艺术家、制作人、Mix Engineer");
	});

	it("does not request private music data while a guest reads an album", async () => {
		isAuthenticated.value = false;
		const wrapper = mount(AlbumDrawer);

		await flushPromises();

		expect(wrapper.text()).toContain("Test Album");
		expect(listAlbumBookmarks).not.toHaveBeenCalled();
		expect(listMusicPlaylists).not.toHaveBeenCalled();
	});

	it("opens the merge target when the album is closed with redirect_to", async () => {
		getMusicAlbum.mockResolvedValueOnce({
			id: "1",
			title: "Merged Album",
			entry_status: "closed",
			redirect_to: "album-target",
			songs: [],
		});
		getMusicAlbum.mockResolvedValueOnce({
			id: "album-target",
			title: "Target Album",
			entry_status: "open",
			songs: [],
		});

		mount(AlbumDrawer);
		await flushPromises();

		expect(openAlbum).toHaveBeenCalledWith("album-target");
	});

	it("plays album songs through the player when clicking play album", async () => {
		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();

		await wrapper.get("button.p-button--primary").trigger("click");

		expect(playAlbum).toHaveBeenCalledTimes(1);
		expect(playAlbum).toHaveBeenCalledWith([
			expect.objectContaining({
				id: "101",
				title: "First Song",
				audio_url: "https://cdn.test/1.mp3",
				album: "Test Album",
			}),
			expect.objectContaining({
				id: "102",
				title: "Second Song",
				audio_url: "https://cdn.test/2.mp3",
				album: "Test Album",
			}),
		]);
	});

	it("plays a single track from the album queue at the clicked index", async () => {
		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();
		await wrapper.get('[data-testid="track-play-102"]').trigger("click");

		expect(playAlbum).toHaveBeenCalledTimes(1);
		expect(playAlbum).toHaveBeenCalledWith(
			[
				expect.objectContaining({ id: "101", title: "First Song" }),
				expect.objectContaining({ id: "102", title: "Second Song" }),
			],
			1,
		);
	});

	it("pauses the current track and updates its action label", async () => {
		currentSong.value = { id: "102" };
		isPlaying.value = true;
		const wrapper = mount(AlbumDrawer);

		await flushPromises();
		const action = wrapper.get('[data-testid="track-play-102"]');
		expect(action.attributes("aria-label")).toBe("暂停 Second Song");
		await action.trigger("click");

		expect(togglePlay).toHaveBeenCalledTimes(1);
		expect(playAlbum).not.toHaveBeenCalled();
	});

	it("disables play button for tracks without audio", async () => {
		getMusicAlbum.mockResolvedValue({
			id: "1",
			title: "Test Album",
			release_date: "2024-01-01",
			album_type: "album",
			entry_status: "open",
			songs: [
				{
					id: "101",
					title: "Playable Song",
					track_number: 1,
					audio_url: "https://cdn.test/1.mp3",
				},
				{
					id: "102",
					title: "Missing Audio Song",
					track_number: 2,
					audio_url: "",
				},
			],
		});

		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();

		expect(
			wrapper.get('[data-testid="track-play-101"]').attributes("disabled"),
		).toBeUndefined();
		expect(
			wrapper.get('[data-testid="track-play-102"]').attributes("disabled"),
		).toBeDefined();
		expect(wrapper.text()).toContain("无音频");
	});

	it("supports uuid song ids for playable tracks", async () => {
		getMusicAlbum.mockResolvedValue({
			id: "album-uuid",
			title: "UUID Album",
			release_date: "2024-01-01",
			album_type: "album",
			entry_status: "open",
			songs: [
				{
					id: "019f-song-a",
					title: "UUID Song A",
					track_number: 1,
					audio_url: "https://cdn.test/a.wav",
				},
				{
					id: "019f-song-b",
					title: "UUID Song B",
					track_number: 2,
					audio_url: "https://cdn.test/b.wav",
				},
			],
		});

		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();
		await wrapper.get('[data-testid="track-play-019f-song-b"]').trigger("click");

		expect(playAlbum).toHaveBeenCalledWith(
			[
				expect.objectContaining({ id: "019f-song-a", title: "UUID Song A" }),
				expect.objectContaining({ id: "019f-song-b", title: "UUID Song B" }),
			],
			1,
		);
	});

	it("does not show hard-coded discussion count or fake track durations when data is absent", async () => {
		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();

		expect(wrapper.get('[data-test="discussion-fab"]').text()).toBe("讨论");
		expect(wrapper.text()).not.toContain("03:45");
		expect(wrapper.find(".track-time").exists()).toBe(false);
	});

	it("keeps album details visible when bookmark loading requires login", async () => {
		listAlbumBookmarks.mockRejectedValueOnce(
			new ApiErrorResponseError(401, "auth.unauthorized", "Login required"),
		);

		const wrapper = mount(AlbumDrawer, {
			global: {
				stubs: {
					PSheet: { template: "<div><slot /></div>" },
					PDiscussionFAB: {
						props: ["count"],
						template:
							'<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>',
					},
				},
			},
		});

		await flushPromises();

		expect(wrapper.text()).toContain("Test Album");
		expect(wrapper.text()).not.toContain("专辑信息加载失败");
	});

	it("finds the album bookmark on a later page", async () => {
		listAlbumBookmarks
			.mockResolvedValueOnce(paginated([], 1, true))
			.mockResolvedValueOnce(paginated([{ album_id: "1" }], 2));

		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		expect(listAlbumBookmarks).toHaveBeenNthCalledWith(1, {
			page: 1,
			page_size: 100,
		});
		expect(listAlbumBookmarks).toHaveBeenNthCalledWith(2, {
			page: 2,
			page_size: 100,
		});
		expect(wrapper.get('[data-testid="album-bookmark-toggle"]').text()).toContain(
			"已订阅",
		);
	});

	it("paginates playlists in the add-to-playlist menu", async () => {
		listMusicPlaylists.mockImplementation(((
			filters: { page?: number; page_size?: number } = {},
		) => {
			if (filters.page === 2)
				return Promise.resolve(
					paginated([{ id: "playlist-2", name: "第二歌单" }], 2),
				);
			if (filters.page_size === 100)
				return Promise.resolve(
					paginated(
						[{ id: "favorite-playlist", name: "最爱", kind: "favorite" }],
						1,
					),
				);
			return Promise.resolve(
				paginated([{ id: "playlist-1", name: "第一歌单" }], 1, true),
			);
		}) as never);

		const wrapper = mount(AlbumDrawer);
		await flushPromises();
		await wrapper.get(".track-add-btn").trigger("click");

		expect(wrapper.text()).toContain("第一歌单");
		await wrapper.get('[aria-label="下一页歌单"]').trigger("click");
		await flushPromises();

		expect(listMusicPlaylists).toHaveBeenCalledWith({ page: 2, page_size: 20 });
		expect(wrapper.text()).toContain("第二歌单");
		expect(wrapper.text()).not.toContain("第一歌单");
	});

	it("closes the add-to-playlist menu after a successful add", async () => {
		listMusicPlaylists.mockResolvedValue(
			paginated([{ id: "playlist-1", name: "第一歌单" }], 1) as never,
		);
		addMusicPlaylistSong.mockResolvedValue({});

		const wrapper = mount(AlbumDrawer);
		await flushPromises();
		await wrapper.get(".track-add-btn").trigger("click");
		expect(wrapper.find(".track-add-menu").exists()).toBe(true);

		await wrapper.get(".track-add-menu-item").trigger("click");
		await flushPromises();

		expect(addMusicPlaylistSong).toHaveBeenCalledWith("playlist-1", "101");
		expect(wrapper.find(".track-add-menu").exists()).toBe(false);
	});

	it("keeps the album visible when an extra request fails", async () => {
		listAlbumContributors.mockRejectedValueOnce(
			new Error("contributors unavailable"),
		);
		listAlbumBookmarks.mockRejectedValueOnce(new Error("bookmarks unavailable"));

		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		expect(wrapper.text()).toContain("Test Album");
		expect(wrapper.text()).not.toContain("专辑信息加载失败");
	});

	it("offers retry when the album request fails", async () => {
		getMusicAlbum
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValueOnce({
				id: "1",
				title: "Recovered Album",
				entry_status: "open",
				songs: [],
			});

		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		expect(wrapper.find('[data-testid="album-retry"]').exists()).toBe(true);
		await wrapper.get('[data-testid="album-retry"]').trigger("click");
		await flushPromises();

		expect(wrapper.text()).toContain("Recovered Album");
	});

	it("shows discussion count and track durations when real data exists", async () => {
		getMusicAlbum.mockResolvedValue({
			id: "1",
			title: "Test Album",
			release_date: "2024-01-01",
			album_type: "album",
			entry_status: "open",
			discussion_count: 7,
			songs: [
				{
					id: "song-1",
					title: "First Song",
					track_number: 1,
					duration_sec: 125,
				},
			],
		});

		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();

		expect(wrapper.get('[data-test="discussion-fab"]').text()).toBe("讨论(7)");
		expect(wrapper.get(".track-time").text()).toBe("2:05");
	});

	it("shows audio specifications and lyrics status after expanding a track", async () => {
		getMusicAlbum.mockResolvedValue({
			id: "1",
			title: "Archive Album",
			entry_status: "open",
			songs: [
				{
					id: "song-1",
					title: "Master",
					track_number: 1,
					audio_url: "https://cdn.test/master.mp3",
					source_file_name: "01 - Master.flac",
					source_container: "flac",
					source_bit_depth: 24,
					source_sample_rate_hz: 96000,
					source_channels: 2,
					source_size_bytes: 95 * 1024 * 1024,
					source_lossless: true,
					playback_container: "mp3",
					playback_bitrate_kbps: 320,
					lyrics: "第一行歌词",
				},
			],
		});

		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		expect(wrapper.text()).not.toContain("01 - Master.flac");
		await wrapper.get('[data-testid="track-details-song-1"]').trigger("click");

		expect(wrapper.text()).toContain(
			"FLAC · 无损 · 24-bit · 96 kHz · 2 ch · 95.0 MB",
		);
		expect(wrapper.text()).toContain("MP3 · 320 kbps");
		expect(wrapper.text()).toContain("歌词已上传");
		expect(
			wrapper.get('[data-testid="track-edit-lyrics-song-1"]').text(),
		).toContain("编辑歌词");
		expect(wrapper.text()).not.toContain("01 - Master.flac");
	});

	it("opens unified album editor from the more menu", async () => {
		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();

		await wrapper.get(".album-more-trigger").trigger("click");
		await wrapper.get('[data-testid="album-edit-action"]').trigger("click");

		expect(openMusicCreationFlow).toHaveBeenCalledWith({
			mode: "edit",
			entity: "album",
			albumId: "1",
			startStep: "albumDetails",
		});
	});

	it("uses song cover as fallback when album cover is missing", async () => {
		getMusicAlbum.mockResolvedValue({
			id: "1",
			title: "Test Album",
			release_date: "2024-01-01",
			album_type: "album",
			entry_status: "open",
			songs: [
				{
					id: "101",
					title: "First Song",
					track_number: 1,
					audio_url: "https://cdn.test/1.mp3",
					cover_url: "https://cdn.test/cover.jpg",
				},
			],
		});

		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();

		expect(wrapper.get(".album-cover-img").attributes("src")).toBe(
			"https://cdn.test/cover.jpg",
		);
	});

	it("falls back to cover placeholder text when album image fails to load", async () => {
		getMusicAlbum.mockResolvedValue({
			id: "1",
			title: "Test Album",
			cover_url: "https://cdn.test/broken-cover.jpg",
			release_date: "2024-01-01",
			album_type: "album",
			entry_status: "open",
			songs: [],
		});

		const wrapper = mount(AlbumDrawer, {});

		await flushPromises();
		await wrapper.get(".album-cover-img").trigger("error");

		expect(wrapper.find(".album-cover-img").exists()).toBe(false);
		expect(wrapper.get(".album-cover").text()).toContain("暂无封面");
	});

	it("creates an album bookmark when clicking 订阅 and reflects the new state", async () => {
		const wrapper = mount(AlbumDrawer, {
			global: {
				stubs: {
					PSheet: { template: "<div><slot /></div>" },
					PDiscussionFAB: {
						props: ["count"],
						template:
							'<button data-test="discussion-fab">讨论<span v-if="count !== undefined">({{ count }})</span></button>',
					},
				},
			},
		});

		await flushPromises();

		const bookmarkButton = wrapper.get('[data-testid="album-bookmark-toggle"]');
		expect(bookmarkButton.text()).toContain("订阅");

		await bookmarkButton.trigger("click");
		await flushPromises();

		expect(createAlbumBookmark).toHaveBeenCalledWith("1");
		expect(wrapper.get('[data-testid="album-bookmark-toggle"]').text()).toContain(
			"已订阅",
		);
	});

	it("keeps the latest album visible when an earlier request finishes later", async () => {
		let resolveFirst!: (album: Record<string, unknown>) => void;
		const firstRequest = new Promise<Record<string, unknown>>((resolve) => {
			resolveFirst = resolve;
		});
		getMusicAlbum.mockReturnValueOnce(firstRequest).mockResolvedValueOnce({
			id: "album-b",
			title: "Album B",
			entry_status: "open",
			songs: [],
		});

		const wrapper = mount(AlbumDrawer, {
			props: {
				layer: {
					key: "album-a",
					kind: "album",
					title: "专辑详情",
					payload: { albumId: "album-a" },
				},
			},
		});
		await wrapper.setProps({
			layer: {
				key: "album-b",
				kind: "album",
				title: "专辑详情",
				payload: { albumId: "album-b" },
			},
		});
		await flushPromises();

		resolveFirst({
			id: "album-a",
			title: "Album A",
			entry_status: "open",
			songs: [],
		});
		await flushPromises();

		expect(wrapper.text()).toContain("Album B");
		expect(wrapper.text()).not.toContain("Album A");
	});

	it("clears the previous album while switching albums", async () => {
		let resolveSecond!: (album: Record<string, unknown>) => void;
		getMusicAlbum
			.mockResolvedValueOnce({
				id: "album-a",
				title: "Album A",
				entry_status: "open",
				songs: [{ id: "song-a", title: "Song A" }],
			})
			.mockReturnValueOnce(
				new Promise<Record<string, unknown>>((resolve) => {
					resolveSecond = resolve;
				}),
			);

		const wrapper = mount(AlbumDrawer, {
			props: {
				layer: {
					key: "album-a",
					kind: "album",
					title: "专辑详情",
					payload: { albumId: "album-a" },
				},
			},
		});
		await flushPromises();
		expect(wrapper.text()).toContain("Song A");

		await wrapper.setProps({
			layer: {
				key: "album-b",
				kind: "album",
				title: "专辑详情",
				payload: { albumId: "album-b" },
			},
		});

		expect(wrapper.text()).not.toContain("Song A");
		expect(wrapper.find('[data-testid="album-loading-skeleton"]').exists()).toBe(
			true,
		);
		expect(wrapper.findAll(".album-skeleton-track")).toHaveLength(5);
		resolveSecond({
			id: "album-b",
			title: "Album B",
			entry_status: "open",
			songs: [],
		});
		await flushPromises();
	});

	it("does not apply a delayed album bookmark result after switching albums", async () => {
		let resolveBookmark!: () => void;
		createAlbumBookmark.mockReturnValueOnce(
			new Promise<void>((resolve) => {
				resolveBookmark = resolve;
			}),
		);
		getMusicAlbum
			.mockResolvedValueOnce({
				id: "album-a",
				title: "Album A",
				entry_status: "open",
				songs: [],
			})
			.mockResolvedValueOnce({
				id: "album-b",
				title: "Album B",
				entry_status: "open",
				songs: [],
			});

		const wrapper = mount(AlbumDrawer, {
			props: {
				layer: {
					key: "album-a",
					kind: "album",
					title: "专辑详情",
					payload: { albumId: "album-a" },
				},
			},
		});
		await flushPromises();
		void wrapper.get('[data-testid="album-bookmark-toggle"]').trigger("click");

		await wrapper.setProps({
			layer: {
				key: "album-b",
				kind: "album",
				title: "专辑详情",
				payload: { albumId: "album-b" },
			},
		});
		await flushPromises();
		expect(
			wrapper.get('[data-testid="album-bookmark-toggle"]').attributes("disabled"),
		).toBeUndefined();
		resolveBookmark();
		await flushPromises();

		expect(wrapper.text()).toContain("Album B");
		expect(wrapper.get('[data-testid="album-bookmark-toggle"]').text()).toBe(
			"订阅",
		);
	});

	it("shows feedback when album bookmark update fails", async () => {
		createAlbumBookmark.mockRejectedValueOnce(new Error("network"));
		vi.spyOn(console, "error").mockImplementation(() => {});
		const wrapper = mount(AlbumDrawer);
		await flushPromises();

		await wrapper.get('[data-testid="album-bookmark-toggle"]').trigger("click");
		await flushPromises();

		expect(document.body.textContent).toContain("订阅失败");
	});
});
