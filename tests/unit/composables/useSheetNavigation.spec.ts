import { nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import { useSheetNavigation } from "../../../src/composables/useSheetNavigation";

vi.mock("@/api/musicV1", () => ({
	listMusicAlbums: vi.fn(),
	listMusicArtists: vi.fn(),
	listMusicPlaylists: vi.fn(),
	listMusicSongs: vi.fn(),
}));

vi.mock("@/api/client", () => ({
	apiRequestResult: vi.fn(),
}));

vi.mock("@/composables/useApi", () => ({
	useApi: () => ({
		blog: {
			posts: "/api/v1/blog/posts",
			shortNotes: "/api/v1/short-notes",
			channels: "/api/v1/blog/channels",
			collections: "/api/v1/blog/collections",
		},
	}),
}));

vi.mock("@/stores/auth", () => ({
	useAuthStore: () => ({ token: "test-token" }),
}));

import { listMusicAlbums } from "@/api/musicV1";
import { apiRequestResult } from "@/api/client";
import { useBlogSheetNavigation } from "@/composables/useBlogSheetNavigation";
import { useMusicSheetNavigation } from "@/composables/useMusicSheetNavigation";

describe("useSheetNavigation", () => {
	it("exposes adjacent items and navigates in list order", async () => {
		const currentId = ref("item-2");
		const onNavigate = vi.fn((id: string) => {
			currentId.value = id;
		});
		const navigation = useSheetNavigation(
			currentId,
			async () => [
				{ id: "item-1", label: "第一项" },
				{ id: "item-2", label: "第二项" },
				{ id: "item-3", label: "第三项" },
			],
			onNavigate,
		);

		await nextTick();
		await vi.waitFor(() => expect(navigation.navigation.value.next?.id).toBe("item-3"));
		expect(navigation.navigation.value.previous?.label).toBe("第一项");

		navigation.navigate("next");
		expect(onNavigate).toHaveBeenCalledWith("item-3");
		expect(navigation.direction.value).toBe("next");

		await nextTick();
		expect(navigation.navigation.value.next).toBeNull();
		expect(navigation.navigation.value.previous?.id).toBe("item-2");
	});

	it("ignores a stale list response after the current item changes", async () => {
		const currentId = ref("item-1");
		const resolvers: Array<(items: Array<{ id: string; label: string }>) => void> = [];
		const loadItems = vi.fn(() => new Promise<Array<{ id: string; label: string }>>((resolve) => {
			resolvers.push(resolve);
		}));
		const navigation = useSheetNavigation(currentId, loadItems, vi.fn());

		currentId.value = "item-2";
		await nextTick();
		resolvers[0]?.([
			{ id: "item-1", label: "旧列表" },
		]);
		resolvers[1]?.([{ id: "item-2", label: "当前项" }]);
		await vi.waitFor(() => expect(loadItems).toHaveBeenCalledTimes(2));
		expect(navigation.navigation.value.previous).toBeNull();
	});

	it("does not load navigation items while the sheet is not topmost", async () => {
		const currentId = ref("item-2");
		const enabled = ref(false);
		const loadItems = vi.fn(async () => [
			{ id: "item-1", label: "第一项" },
			{ id: "item-2", label: "第二项" },
		]);
		const navigation = useSheetNavigation(currentId, loadItems, vi.fn(), enabled);

		await nextTick();
		expect(loadItems).not.toHaveBeenCalled();
		expect(navigation.navigation.value.previous).toBeNull();

		enabled.value = true;
		await vi.waitFor(() => expect(loadItems).toHaveBeenCalledTimes(1));
		expect(navigation.navigation.value.previous?.id).toBe("item-1");
	});

	it("loads the page containing a music item after the first 100 entries", async () => {
		vi.mocked(listMusicAlbums)
			.mockResolvedValueOnce({
				data: [{ id: "album-100", title: "第100张" }],
				meta: { page: 1, page_size: 100, total: 101, has_more: true },
			})
			.mockResolvedValueOnce({
				data: [{ id: "album-101", title: "第101张" }],
				meta: { page: 2, page_size: 100, total: 101, has_more: false },
			});
		const currentId = ref("album-101");
		const navigation = useMusicSheetNavigation("album", currentId, vi.fn());

		await vi.waitFor(() => expect(navigation.navigation.value.previous?.id).toBe("album-100"));
		expect(listMusicAlbums).toHaveBeenNthCalledWith(1, {
			page: 1,
			page_size: 100,
			sort: "-release_date",
		});
		expect(listMusicAlbums).toHaveBeenNthCalledWith(2, {
			page: 2,
			page_size: 100,
			sort: "-release_date",
		});
	});

	it("loads the page containing a blog item after the first 100 entries", async () => {
		vi.mocked(apiRequestResult)
			.mockResolvedValueOnce({
				ok: true,
				data: {
					data: [{ id: "post-100", title: "第100篇" }],
					meta: { page: 1, page_size: 100, total: 101, has_more: true },
				},
			})
			.mockResolvedValueOnce({
				ok: true,
				data: {
					data: [{ id: "post-101", title: "第101篇" }],
					meta: { page: 2, page_size: 100, total: 101, has_more: false },
				},
			});
		const currentId = ref("post-101");
		const navigation = useBlogSheetNavigation("post", currentId, vi.fn());

		await vi.waitFor(() => expect(navigation.navigation.value.previous?.id).toBe("post-100"));
		expect(apiRequestResult).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("page=1&page_size=100&status=published"),
			expect.anything(),
		);
		expect(apiRequestResult).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("page=2&page_size=100&status=published"),
			expect.anything(),
		);
	});
});
