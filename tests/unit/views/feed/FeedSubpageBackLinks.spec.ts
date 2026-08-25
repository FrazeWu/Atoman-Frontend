import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import FeedItemDetailView from "../../../../src/views/feed/FeedItemDetailView.vue";
// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import FeedStatsView from "../../../../src/views/feed/FeedStatsView.vue";

const { apiRequestResult, readFeedArticleRouteState } = vi.hoisted(() => ({
	apiRequestResult: vi.fn(),
	readFeedArticleRouteState: vi.fn(),
}));

vi.mock("@/api/client", () => ({ apiRequestResult }));
vi.mock("@/composables/feed/feedArticleRouteState", () => ({
	feedArticleRouteState: (state: unknown) => state,
	readFeedArticleRouteState,
}));
vi.mock("@/composables/useApi", () => ({
	useApi: () => ({ url: "/api/v1" }),
	useApiUrl: () => "/api/v1",
}));

vi.mock("chart.js/auto", () => ({
	default: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("vue-router", () => ({
	RouterLink: {
		name: "RouterLink",
		props: ["to"],
		template: '<a :href="to"><slot /></a>',
	},
	useRoute: () => ({ params: { id: "feed-item-1" } }),
	useRouter: () => ({ push: vi.fn() }),
}));

const stubs = {
	PBadge: true,
	PEmpty: true,
	PEntry: {
		props: ["title", "summary"],
		template: '<article><slot name="visual" /><slot name="meta" /></article>',
	},
	PPageHeader: { template: '<header><slot /><slot name="action" /></header>' },
	PPress: {
		props: ["label"],
		template: '<button type="button">{{ label }}</button>',
	},
	PTab: true,
};

describe("Feed subpage back links", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		apiRequestResult.mockReset();
		readFeedArticleRouteState.mockReset();
		readFeedArticleRouteState.mockReturnValue(null);
	});

	it("renders the item-detail error state without restoring the legacy full-page article", async () => {
		const wrapper = mount(FeedItemDetailView, { global: { stubs } });

		await vi.waitFor(() => {
			expect(wrapper.findComponent({ name: "PEmpty" }).exists()).toBe(true);
		});
	});

	it("hydrates a restored timeline item with detail-only reader variants", async () => {
		const restoredItem = {
			id: "feed-item-1",
			feed_source_id: "source-1",
			guid: "guid-1",
			title: "Restored item",
			link: "https://example.com/post",
			summary: "<p>summary</p>",
			published_at: "2026-06-20T00:00:00Z",
			fetched_at: "2026-06-20T00:00:00Z",
		};
		readFeedArticleRouteState.mockReturnValue({
			article: {
				type: "feed_item",
				feed_item: restoredItem,
				published_at: restoredItem.published_at,
				is_read: true,
			},
			articles: [],
			source: null,
			sourceArticles: [],
		});
		apiRequestResult.mockResolvedValue({
			ok: true,
			data: {
				data: {
					item: restoredItem,
					reader: {
						default_variant: "full_text",
						rss: { html: "<p>RSS original content</p>" },
						full_text: {
							status: "success",
							html: "<p>crawled full text</p>",
						},
					},
				},
			},
		});

		const wrapper = mount(FeedItemDetailView, {
			global: {
				stubs: {
					...stubs,
					FeedArticleSheet: {
						props: ["article", "reader"],
						template:
							'<section data-test="feed-item-detail">{{ reader?.rss?.html }}</section>',
					},
					FeedSourceArticlesSheet: true,
				},
			},
		});

		await vi.waitFor(() => {
			expect(wrapper.get('[data-test="feed-item-detail"]').text()).toContain(
				"RSS original content",
			);
		});
		expect(apiRequestResult).toHaveBeenCalledWith(
			"/api/v1/feed/items/feed-item-1",
			expect.any(Object),
		);
	});

	it("points stats back to the feed module root", async () => {
		const wrapper = mount(FeedStatsView, { global: { stubs } });

		await vi.waitFor(() => {
			const backLinks = wrapper
				.findAllComponents({ name: "RouterLink" })
				.filter(
					(link) =>
						link.text().includes("返回订阅") || link.text().includes("BACK TO FEED"),
				);

			expect(backLinks).not.toHaveLength(0);
			expect(backLinks.every((link) => link.props("to") === "/feed")).toBe(true);
		});
	});
});
