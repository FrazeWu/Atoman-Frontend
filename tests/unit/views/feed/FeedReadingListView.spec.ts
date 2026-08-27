import { config, flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import FeedReadingListView from "../../../../src/views/feed/FeedReadingListView.vue";
import { useAuthStore } from "../../../../src/stores/auth";
import { useFeedStore } from "../../../../src/stores/feed";

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
	RouterLink: { template: "<a><slot /></a>" },
	useRoute: () => ({ query: routeQuery }),
	useRouter: () => ({ push: routerPush, replace: routerReplace }),
}));

vi.mock("@/stores/player", () => ({ usePlayerStore: () => player }));

describe("FeedReadingListView", () => {
	let pinia: ReturnType<typeof createPinia>;

	beforeEach(() => {
		routerPush.mockReset();
		routerReplace.mockReset();
		Object.keys(routeQuery).forEach((key) => delete routeQuery[key]);
		pinia = createPinia();
		setActivePinia(pinia);
		config.global.plugins = [pinia];
		window.history.replaceState(null, "", "/reading-list?site=feed");

		const authStore = useAuthStore();
		authStore.token = "token";
		authStore.user = { username: "fafa", email: "fafa@example.com" };
		authStore.isAuthenticated = true;
	});

	it("renders entries from nested reading-list response data", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						data: {
							items: [
								{
									feed_item_id: "feed-item-1",
									created_at: "2026-06-16T00:00:00Z",
									feed_item: {
										id: "feed-item-1",
										feed_source_id: "source-1",
										feed_source: { id: "source-1", title: "来源" },
										guid: "feed-item-1",
										title: "稍后读条目",
										link: "https://example.com/item",
										summary: "摘要",
										author: "作者",
										published_at: "2026-06-16T00:00:00Z",
										fetched_at: "2026-06-16T00:00:00Z",
									},
								},
							],
							page: 1,
							total: 1,
						},
					}),
					{ status: 200 },
				),
		);

		const wrapper = mount(FeedReadingListView, {
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
					FeedArticleSheet: true,
				},
			},
		});

		await flushPromises();

		expect(wrapper.text()).toContain("稍后读条目");
		expect(wrapper.text()).not.toContain("阅读列表为空");
	});

	it("renders entries from unified reading-list response data", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						data: [
							{
								feed_item_id: "feed-item-1",
								created_at: "2026-06-16T00:00:00Z",
								feed_item: {
									id: "feed-item-1",
									feed_source_id: "source-1",
									feed_source: { id: "source-1", title: "来源" },
									guid: "feed-item-1",
									title: "统一分页待读条目",
									link: "https://example.com/item",
									summary: "摘要",
									author: "作者",
									published_at: "2026-06-16T00:00:00Z",
									fetched_at: "2026-06-16T00:00:00Z",
								},
							},
						],
						meta: { page: 1, page_size: 20, total: 1, has_more: false },
					}),
					{ status: 200 },
				),
		);

		const wrapper = mount(FeedReadingListView, {
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
					FeedArticleSheet: true,
				},
			},
		});

		await flushPromises();

		expect(wrapper.text()).toContain("统一分页待读条目");
		expect(wrapper.text()).not.toContain("阅读列表为空");
	});

	it("opens the first article through the route with adjacent reading-list items", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						data: [
							{
								feed_item_id: "feed-item-nav-1",
								created_at: "2026-06-16T00:00:00Z",
								feed_item: {
									id: "feed-item-nav-1",
									feed_source_id: "source-1",
									feed_source: { id: "source-1", title: "来源" },
									guid: "feed-item-nav-1",
									title: "列表第一篇",
									link: "https://example.com/1",
									summary: "摘要 1",
									author: "作者",
									published_at: "2026-06-16T00:00:00Z",
									fetched_at: "2026-06-16T00:00:00Z",
								},
							},
							{
								feed_item_id: "feed-item-nav-2",
								created_at: "2026-06-15T00:00:00Z",
								feed_item: {
									id: "feed-item-nav-2",
									feed_source_id: "source-1",
									feed_source: { id: "source-1", title: "来源" },
									guid: "feed-item-nav-2",
									title: "列表第二篇",
									link: "https://example.com/2",
									summary: "摘要 2",
									author: "作者",
									published_at: "2026-06-15T00:00:00Z",
									fetched_at: "2026-06-15T00:00:00Z",
								},
							},
						],
						meta: { page: 1, page_size: 20, total: 2, has_more: false },
					}),
					{ status: 200 },
				),
		);

		const wrapper = mount(FeedReadingListView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PEmpty: true,
					BlogItemCard: {
						props: ["item"],
						emits: ["click"],
						template:
							'<article class="p-entry" @click="$emit(\'click\')"><h3>{{ item?.title }}</h3></article>',
					},
					PContentCard: {
						props: ["title", "summary"],
						template:
							'<article class="p-entry" @click="$emit(\'click\')"><h3>{{ title }}</h3><slot name="actions" /></article>',
					},
					PBadge: true,
					PClip: true,
					PPress: true,
					PShortcutHints: true,
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
				path: "/feed/item/feed-item-nav-1",
				state: expect.objectContaining({
					feedArticleBrowser: expect.objectContaining({
						article: expect.objectContaining({
							feed_item: expect.objectContaining({ id: "feed-item-nav-1" }),
						}),
						articles: expect.arrayContaining([
							expect.objectContaining({
								feed_item: expect.objectContaining({ id: "feed-item-nav-1" }),
							}),
							expect.objectContaining({
								feed_item: expect.objectContaining({ id: "feed-item-nav-2" }),
							}),
						]),
					}),
				}),
			}),
		);
	});

	it("marks an unread reading-list item as read when opening it", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						data: [
							{
								feed_item_id: "feed-item-unread-1",
								created_at: "2026-06-16T00:00:00Z",
								is_read: false,
								feed_item: {
									id: "feed-item-unread-1",
									feed_source_id: "source-1",
									feed_source: { id: "source-1", title: "来源" },
									guid: "feed-item-unread-1",
									title: "待读文章",
									link: "https://example.com/unread",
									summary: "摘要",
									author: "作者",
									published_at: "2026-06-16T00:00:00Z",
									fetched_at: "2026-06-16T00:00:00Z",
								},
							},
						],
						meta: { page: 1, page_size: 20, total: 1, has_more: false },
					}),
					{ status: 200 },
				),
		);
		const feedStore = useFeedStore();
		const markItemsRead = vi.spyOn(feedStore, "markItemsRead");
		const fetchSubscriptions = vi.spyOn(feedStore, "fetchSubscriptions");

		const wrapper = mount(FeedReadingListView, {
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
				},
			},
		});

		await flushPromises();
		await wrapper.get(".p-entry").trigger("click");
		await flushPromises();

		expect(markItemsRead).toHaveBeenCalledWith(["feed-item-unread-1"]);
		expect(fetchSubscriptions).toHaveBeenCalled();
	});

	it("does not refresh subscriptions when marking a reading-list item read fails", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						data: [
							{
								feed_item_id: "feed-item-read-fail-1",
								created_at: "2026-06-16T00:00:00Z",
								is_read: false,
								feed_item: {
									id: "feed-item-read-fail-1",
									feed_source_id: "source-1",
									feed_source: { id: "source-1", title: "来源" },
									guid: "feed-item-read-fail-1",
									title: "标记失败待读文章",
									link: "https://example.com/read-fail",
									summary: "摘要",
									author: "作者",
									published_at: "2026-06-16T00:00:00Z",
									fetched_at: "2026-06-16T00:00:00Z",
								},
							},
						],
						meta: { page: 1, page_size: 20, total: 1, has_more: false },
					}),
					{ status: 200 },
				),
		);
		const feedStore = useFeedStore();
		vi.spyOn(feedStore, "markItemsRead").mockResolvedValue(false);
		const fetchSubscriptions = vi.spyOn(feedStore, "fetchSubscriptions");

		const wrapper = mount(FeedReadingListView, {
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
				},
			},
		});

		await flushPromises();
		await wrapper.get(".p-entry").trigger("click");
		await flushPromises();

		expect(feedStore.markItemsRead).toHaveBeenCalledWith([
			"feed-item-read-fail-1",
		]);
		expect(fetchSubscriptions).not.toHaveBeenCalled();
	});
});
