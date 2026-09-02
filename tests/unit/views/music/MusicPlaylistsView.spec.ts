import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../../src/stores/auth";
// @ts-expect-error Vitest resolves Vue SFCs through Vite; this test is outside the Vue TS project.
import MusicPlaylistsView from "../../../../apps/mobile/MusicPlaylistsView.vue";

const mocks = vi.hoisted(() => ({
	listMusicPlaylists: vi.fn(),
	listPlaylistBookmarks: vi.fn(),
	deletePlaylistBookmark: vi.fn(),
	createMusicPlaylist: vi.fn(),
	openPlaylist: vi.fn(),
}));

vi.mock("@/api/musicV1", () => ({
	listMusicPlaylists: mocks.listMusicPlaylists,
	listPlaylistBookmarks: mocks.listPlaylistBookmarks,
	deletePlaylistBookmark: mocks.deletePlaylistBookmark,
	createMusicPlaylist: mocks.createMusicPlaylist,
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({ openPlaylist: mocks.openPlaylist }),
}));

vi.mock("@/components/music", () => ({
	MusicPlaylistCard: {
		inheritAttrs: false,
		props: ["playlist"],
		emits: ["click", "toggle-bookmark"],
		template:
			'<button v-bind="$attrs" @click="$emit(\'click\')" @contextmenu.prevent="$emit(\'toggle-bookmark\')">{{ playlist.title }}</button>',
	},
}));

vi.mock("@/components/ui/PPageHeader.vue", () => ({
	default: {
		props: ["title"],
		template: '<header><h1>{{ title }}</h1><slot name="action" /></header>',
	},
}));

const pinia = createPinia();

function mountView() {
	return mount(MusicPlaylistsView, {
		global: {
			plugins: [pinia],
			stubs: { RouterLink: { template: "<a><slot /></a>" } },
		},
	});
}

describe("MusicPlaylistsView", () => {
	beforeEach(() => {
		setActivePinia(pinia);
		const authStore = useAuthStore(pinia);
		authStore.user = {
			uuid: "playlist-user",
			username: "playlist-user",
			email: "playlist@example.test",
		};
		authStore.isAuthenticated = true;
		mocks.listMusicPlaylists.mockReset();
		mocks.listPlaylistBookmarks.mockReset();
		mocks.deletePlaylistBookmark.mockReset();
		mocks.openPlaylist.mockReset();
	});

	it("separates owned and bookmarked playlists and hides system playlists", async () => {
		mocks.listMusicPlaylists.mockResolvedValue({
			data: [
				{ id: "owned-1", name: "我的夜行歌单", kind: "user", song_count: 3 },
				{ id: "favorite-1", name: "最爱", kind: "favorite", song_count: 2 },
			],
		});
		mocks.listPlaylistBookmarks.mockResolvedValue({
			data: [
				{
					id: "bookmark-1",
					playlist_id: "saved-1",
					playlist: {
						id: "saved-1",
						name: "通勤收藏",
						kind: "user",
						song_count: 5,
					},
				},
			],
		});

		const wrapper = mountView();
		await flushPromises();

		expect(wrapper.get("h1").text()).toBe("歌单");
		expect(wrapper.get("#owned-playlists-title").text()).toContain("我创建的");
		expect(wrapper.get("#bookmarked-playlists-title").text()).toContain(
			"我收藏的",
		);
		expect(wrapper.text()).toContain("我的夜行歌单");
		expect(wrapper.text()).toContain("通勤收藏");
		expect(wrapper.text()).toContain("最爱");
		expect(wrapper.findAll('[data-testid="owned-playlist-card"]')).toHaveLength(
			2,
		);
		expect(
			wrapper.findAll('[data-testid="bookmarked-playlist-card"]'),
		).toHaveLength(1);
	});

	it("shows the login state without requesting playlists", async () => {
		const authStore = useAuthStore(pinia);
		authStore.user = null;
		authStore.isAuthenticated = false;

		const wrapper = mountView();
		await flushPromises();

		expect(wrapper.text()).toContain("登录后查看歌单");
		expect(mocks.listMusicPlaylists).not.toHaveBeenCalled();
		expect(mocks.listPlaylistBookmarks).not.toHaveBeenCalled();
	});

	it("renders empty owned and bookmarked sections", async () => {
		mocks.listMusicPlaylists.mockResolvedValue({ data: [] });
		mocks.listPlaylistBookmarks.mockResolvedValue({ data: [] });

		const wrapper = mountView();
		await flushPromises();

		expect(wrapper.text()).toContain("还没有创建歌单");
		expect(wrapper.text()).toContain("还没有收藏歌单");
	});

	it("recovers from a load error through the refresh action", async () => {
		mocks.listMusicPlaylists
			.mockRejectedValueOnce(new Error("playlists unavailable"))
			.mockResolvedValueOnce({
				data: [
					{ id: "owned-1", name: "恢复后的歌单", kind: "user", song_count: 1 },
				],
			});
		mocks.listPlaylistBookmarks.mockResolvedValue({ data: [] });

		const wrapper = mountView();
		await flushPromises();
		expect(wrapper.get('[role="alert"]').text()).toContain("歌单加载失败");

		await wrapper.get('[aria-label="刷新歌单"]').trigger("click");
		await flushPromises();

		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
		expect(wrapper.text()).toContain("恢复后的歌单");
		expect(mocks.listMusicPlaylists).toHaveBeenCalledTimes(2);
	});

	it("offers a create playlist action from the page", async () => {
		mocks.listMusicPlaylists.mockResolvedValue({ data: [] });
		mocks.listPlaylistBookmarks.mockResolvedValue({ data: [] });
		mocks.createMusicPlaylist.mockResolvedValue({ id: "created-1" });

		const wrapper = mountView();
		await flushPromises();
		await wrapper.get('[data-testid="create-playlist"]').trigger("click");

		expect(wrapper.get('[data-testid="create-playlist-form"]').exists()).toBe(true);
		await wrapper.get('[data-testid="create-playlist-name"]').setValue("通勤歌单");
		await wrapper.get('[data-testid="create-playlist-submit"]').trigger("click");
		await flushPromises();

		expect(mocks.createMusicPlaylist).toHaveBeenCalledWith({
			name: "通勤歌单",
			is_public: false,
		});
	});
	it("removes a bookmarked playlist and updates the list", async () => {
		mocks.listMusicPlaylists.mockResolvedValue({ data: [] });
		mocks.listPlaylistBookmarks.mockResolvedValue({
			data: [
				{
					id: "bookmark-1",
					playlist_id: "saved-1",
					playlist: {
						id: "saved-1",
						name: "待取消收藏",
						kind: "user",
						song_count: 2,
					},
				},
			],
		});
		mocks.deletePlaylistBookmark.mockResolvedValue({});

		const wrapper = mountView();
		await flushPromises();
		await wrapper
			.get('[data-testid="bookmarked-playlist-card"]')
			.trigger("contextmenu");
		await flushPromises();

		expect(mocks.deletePlaylistBookmark).toHaveBeenCalledWith("saved-1");
		expect(
			wrapper.find('[data-testid="bookmarked-playlist-card"]').exists(),
		).toBe(false);
	});
});
