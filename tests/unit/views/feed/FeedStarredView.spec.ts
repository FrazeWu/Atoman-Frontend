import { config, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import FeedStarredView from "../../../../src/views/feed/FeedStarredView.vue";
import { useAuthStore } from "../../../../src/stores/auth";
import { useFeedStore } from "../../../../src/stores/feed";
import { usePlayerStore } from "../../../../src/stores/player";

const { routeQuery, routerPush, routerReplace, player } = vi.hoisted(() => ({
	routeQuery: {} as Record<string, string | undefined>,
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	player: {
		currentSong: null,
		isPlaying: false,
		setQueueFromCurrentItems: vi.fn(),
		createPodcastSong: vi.fn((item) => item),
		playQueuedSong: vi.fn(),
	},
}));

vi.mock("vue-router", () => ({
	useRoute: () => ({ query: routeQuery }),
	useRouter: () => ({ push: routerPush, replace: routerReplace }),
}));

vi.mock("@/stores/player", () => ({ usePlayerStore: () => player }));

describe("FeedStarredView", () => {
	let pinia: ReturnType<typeof createPinia>;

	beforeEach(() => {
		routerPush.mockReset();
		routerReplace.mockReset();
		Object.keys(routeQuery).forEach((key) => delete routeQuery[key]);
		pinia = createPinia();
		setActivePinia(pinia);
		config.global.plugins = [pinia];

		const feedStore = useFeedStore();
		vi.spyOn(feedStore, "fetchStarGroups").mockResolvedValue(undefined);

		const authStore = useAuthStore();
		authStore.token = "token";
		authStore.user = { username: "fafa", email: "fafa@example.com" };
		authStore.isAuthenticated = true;
	});

	it("treats loaded starred entries as already starred before unstar", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								id: "feed-item-1",
								feed_source_id: "source-1",
								guid: "feed-item-1",
								title: "收藏条目",
								link: "https://example.com/item",
								summary: "摘要",
								author: "作者",
								published_at: "2026-06-16T00:00:00Z",
								fetched_at: "2026-06-16T00:00:00Z",
							},
						],
						total: 1,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: { starred: false } }), {
					status: 200,
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
			);

		const wrapper = mount(FeedStarredView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PEmpty: true,
					PContentCard: {
						props: ["title", "summary"],
						template:
							'<article><h3>{{ title }}</h3><slot name="actions" /></article>',
					},
					PBadge: true,
					PClip: {
						props: ["label"],
						emits: ["click"],
						template: "<button @click=\"$emit('click')\">{{ label }}</button>",
					},
					PButton: true,
					PShortcutHints: true,
					FeedArticleSheet: true,
					FeedTimelineFooter: true,
				},
			},
		});

		await flushPromises();
		const feedStore = useFeedStore();
		expect(feedStore.starredItemIds.has("feed-item-1")).toBe(true);

		await wrapper.get("article button").trigger("click");
		await flushPromises();

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/feed/timeline/star",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ feed_item_id: "feed-item-1" }),
				credentials: "include",
			}),
		);
		await vi.waitFor(() =>
			expect(feedStore.starredItemIds.has("feed-item-1")).toBe(false),
		);
	});

	it("plays a podcast from the starred article sheet", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								id: "feed-item-1",
								feed_source_id: "source-1",
								guid: "feed-item-1",
								title: "收藏播客",
								link: "https://example.com/item",
								summary: "摘要",
								author: "作者",
								source_title: "收藏来源",
								enclosure_url: "https://cdn.example.com/audio.mp3",
								enclosure_type: "audio/mpeg",
								published_at: "2026-06-16T00:00:00Z",
								fetched_at: "2026-06-16T00:00:00Z",
							},
						],
						total: 1,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

		const wrapper = mount(FeedStarredView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PEmpty: true,
					PContentCard: {
						props: ["title", "summary"],
						template:
							'<article><h3>{{ title }}</h3><slot name="actions" /></article>',
					},
					PBadge: true,
					PClip: true,
					PPress: true,
					PShortcutHints: true,
					FeedArticleSheet: {
						name: "FeedArticleSheet",
						emits: ["play-podcast", "close"],
						template:
							"<button data-test=\"sheet-play\" @click=\"$emit('play-podcast', { id: 'feed-item-1', title: '收藏播客', enclosure_url: 'https://cdn.example.com/audio.mp3', published_at: '2026-06-16T00:00:00Z', author: '作者', feed_source: { title: '收藏来源' } })\">play</button>",
					},
					FeedTimelineFooter: true,
				},
			},
		});

		await flushPromises();

		const playerStore = usePlayerStore();
		const setQueueSpy = vi.spyOn(playerStore, "setQueueFromCurrentItems");
		const createPodcastSongSpy = vi.spyOn(playerStore, "createPodcastSong");
		const playQueuedSongSpy = vi
			.spyOn(playerStore, "playQueuedSong")
			.mockImplementation(() => {});

		await wrapper.get('[data-test="sheet-play"]').trigger("click");

		expect(setQueueSpy).toHaveBeenCalled();
		expect(createPodcastSongSpy).toHaveBeenCalledWith(
			expect.objectContaining({ id: "feed-item-1" }),
		);
		expect(playQueuedSongSpy).toHaveBeenCalled();
	});

	it("returns to the feed module root from the header action", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

		const wrapper = mount(FeedStarredView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PEmpty: true,
					PContentCard: true,
					PBadge: true,
					PClip: true,
					PPress: {
						props: ["label"],
						template:
							'<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
					},
					PShortcutHints: true,
					FeedArticleSheet: true,
					FeedTimelineFooter: true,
				},
			},
		});

		await flushPromises();
		await wrapper.get("header button").trigger("click");

		expect(routerPush).toHaveBeenCalledWith("/feed");
	});

	it("opens the first starred article through the route with adjacent items", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								id: "feed-item-star-nav-1",
								feed_source_id: "source-1",
								guid: "feed-item-star-nav-1",
								title: "收藏第一篇",
								link: "https://example.com/1",
								summary: "摘要 1",
								author: "作者",
								source_title: "收藏来源",
								published_at: "2026-06-16T00:00:00Z",
								fetched_at: "2026-06-16T00:00:00Z",
							},
							{
								id: "feed-item-star-nav-2",
								feed_source_id: "source-1",
								guid: "feed-item-star-nav-2",
								title: "收藏第二篇",
								link: "https://example.com/2",
								summary: "摘要 2",
								author: "作者",
								source_title: "收藏来源",
								published_at: "2026-06-15T00:00:00Z",
								fetched_at: "2026-06-15T00:00:00Z",
							},
						],
						total: 2,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

		const wrapper = mount(FeedStarredView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PEmpty: true,
					PContentCard: {
						props: ["title", "summary"],
						template:
							'<article class="p-entry" @click="$emit(\'click\')"><h3>{{ title }}</h3><slot name="actions" /></article>',
					},
					PBadge: true,
					PClip: true,
					PPress: true,
					PShortcutHints: true,
					FeedTimelineFooter: true,
					FeedArticleSheet: {
						name: "FeedArticleSheet",
						props: ["show", "article", "hasPrevious", "hasNext"],
						template: `
              <section v-if="show" data-test="sheet-probe">
                <h2 data-test="sheet-title">{{ article?.feed_item?.title }}</h2>
                <button v-if="hasPrevious" data-test="sheet-prev" @click="$emit('previous')">prev</button>
                <button v-if="hasNext" data-test="sheet-next" @click="$emit('next')">next</button>
              </section>
            `,
					},
				},
			},
		});

		await flushPromises();

		await wrapper.findAll(".p-entry")[0]?.trigger("click");
		await flushPromises();

		expect(routerPush).toHaveBeenCalledWith(
			expect.objectContaining({
				path: "/feed/item/feed-item-star-nav-1",
				state: expect.objectContaining({
					feedArticleBrowser: expect.objectContaining({
						article: expect.objectContaining({
							feed_item: expect.objectContaining({
								id: "feed-item-star-nav-1",
							}),
						}),
						articles: expect.arrayContaining([
							expect.objectContaining({
								feed_item: expect.objectContaining({
									id: "feed-item-star-nav-1",
								}),
							}),
							expect.objectContaining({
								feed_item: expect.objectContaining({
									id: "feed-item-star-nav-2",
								}),
							}),
						]),
					}),
				}),
			}),
		);
	});

	it("marks an unread starred item as read when opening it", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								id: "feed-item-star-unread-1",
								feed_source_id: "source-1",
								guid: "feed-item-star-unread-1",
								title: "未读收藏",
								link: "https://example.com/unread-star",
								summary: "摘要",
								author: "作者",
								source_title: "收藏来源",
								published_at: "2026-06-16T00:00:00Z",
								fetched_at: "2026-06-16T00:00:00Z",
								is_read: false,
							},
						],
						total: 1,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

		const feedStore = useFeedStore();
		const markItemsRead = vi
			.spyOn(feedStore, "markItemsRead")
			.mockResolvedValue(true);
		const fetchSubscriptions = vi.spyOn(feedStore, "fetchSubscriptions");

		const wrapper = mount(FeedStarredView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PEmpty: true,
					PContentCard: {
						props: ["title", "summary"],
						template:
							'<article class="p-entry" @click="$emit(\'click\')"><h3>{{ title }}</h3><slot name="actions" /></article>',
					},
					PBadge: true,
					PClip: true,
					PPress: true,
					PShortcutHints: true,
					FeedArticleSheet: true,
					FeedTimelineFooter: true,
				},
			},
		});

		await flushPromises();
		await wrapper.get(".p-entry").trigger("click");
		await flushPromises();

		expect(markItemsRead).toHaveBeenCalledWith(["feed-item-star-unread-1"]);
		expect(fetchSubscriptions).toHaveBeenCalled();
	});

	it("does not refresh subscriptions when marking a starred item read fails", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								id: "feed-item-star-read-fail-1",
								feed_source_id: "source-1",
								guid: "feed-item-star-read-fail-1",
								title: "标记失败收藏",
								link: "https://example.com/read-fail-star",
								summary: "摘要",
								author: "作者",
								source_title: "收藏来源",
								published_at: "2026-06-16T00:00:00Z",
								fetched_at: "2026-06-16T00:00:00Z",
								is_read: false,
							},
						],
						total: 1,
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: [] }), { status: 200 }),
			);

		const feedStore = useFeedStore();
		vi.spyOn(feedStore, "markItemsRead").mockResolvedValue(false);
		const fetchSubscriptions = vi.spyOn(feedStore, "fetchSubscriptions");

		const wrapper = mount(FeedStarredView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PEmpty: true,
					PContentCard: {
						props: ["title", "summary"],
						template:
							'<article class="p-entry" @click="$emit(\'click\')"><h3>{{ title }}</h3><slot name="actions" /></article>',
					},
					PBadge: true,
					PClip: true,
					PPress: true,
					PShortcutHints: true,
					FeedArticleSheet: true,
					FeedTimelineFooter: true,
				},
			},
		});

		await flushPromises();
		await wrapper.get(".p-entry").trigger("click");
		await flushPromises();

		expect(feedStore.markItemsRead).toHaveBeenCalledWith([
			"feed-item-star-read-fail-1",
		]);
		expect(fetchSubscriptions).not.toHaveBeenCalled();
	});
	it("shows a load error instead of an empty state when starred items fail", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ error: "failed" }), { status: 500 }),
		);

		const wrapper = mount(FeedStarredView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PEmpty: {
						props: ["title", "description"],
						template: '<div>{{ title }} {{ description }}</div>',
					},
					PContentCard: true,
					PBadge: true,
					PClip: true,
					PButton: true,
					PShortcutHints: true,
					FeedArticleSheet: true,
					FeedTimelineFooter: true,
				},
			},
		});

		await flushPromises();
		expect(wrapper.text()).toContain("收藏加载失败");
		expect(wrapper.text()).not.toContain("暂无收藏文章");
	});
});
