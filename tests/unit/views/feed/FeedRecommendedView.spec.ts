import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Vue SFC resolution is provided by vue-tsc and Vitest.
import FeedRecommendedView from "../../../../src/views/feed/FeedRecommendedView.vue";
import { useAuthStore } from "../../../../src/stores/auth";
import { useFeedStore } from "../../../../src/stores/feed";

const source = readFileSync(
	resolve(__dirname, "../../../../src/views/feed/FeedRecommendedView.vue"),
	"utf8",
);

const routerPush = vi.fn();
const routerReplace = vi.fn();
const publicRequestOptions = { credentials: "include" as const };
const authenticatedSourceRequestOptions = {
	credentials: "include" as const,
	headers: { Authorization: "Bearer token" },
};
const routeQuery = {
	mode: undefined as string | undefined,
	target: undefined as string | undefined,
	category: undefined as string | undefined,
	theme: undefined as string | undefined,
	scope: undefined as string | undefined,
};

const segmentedControlStub = {
	props: ["modelValue", "options"],
	template: `
    <div class="segmented">
      <button
        v-for="option in options"
        :key="option.value"
        class="segmented-option"
        @click="$emit('update:modelValue', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  `,
};

const buttonStub = {
	props: ["label", "disabled", "loading"],
	template:
		'<button class="p-button" :disabled="disabled || loading" @click="$emit(\'click\', $event)">{{ loading ? "处理中..." : label }}</button>',
};

async function applyFilter(wrapper: any, field: string, optionLabel: string) {
	await wrapper
		.get('[data-test="open-recommendation-filters"]')
		.trigger("click");
	await wrapper
		.get(`[data-test="${field}"] .p-select-trigger`)
		.trigger("click");
	const option = wrapper
		.findAll(".p-select-option")
		.find((candidate: any) => candidate.text() === optionLabel);
	expect(option).toBeDefined();
	await option!.trigger("click");
	await wrapper
		.get('[data-test="apply-recommendation-filters"]')
		.trigger("click");
	await flushPromises();
}

async function applyFilterValue(wrapper: any, field: string, value: string) {
	const draftKey: Record<string, string> = {
		mode: "filterDraftMode",
		target: "filterDraftTarget",
		category: "filterDraftCategory",
		theme: "filterDraftTheme",
		language: "filterDraftLanguage",
	};
	wrapper.vm[draftKey[field]] = value;
	await flushPromises();
	wrapper.vm.applyFilters();
	await flushPromises();
}

vi.mock("vue-router", () => ({
	useRouter: () => ({ push: routerPush, replace: routerReplace }),
	useRoute: () => ({ query: routeQuery }),
}));

describe("FeedRecommendedView", () => {
	beforeEach(() => {
		routerPush.mockReset();
		routerReplace.mockReset();
		routeQuery.mode = undefined;
		routeQuery.target = undefined;
		routeQuery.category = undefined;
		routeQuery.theme = undefined;
		routeQuery.scope = undefined;
		setActivePinia(createPinia());
	});

	it("searches shared discovery results with sources before articles", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/feed/explore/sources?")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									id: "source-search",
									title: "AI 来源",
									rss_url: "https://example.com/ai.xml",
								},
							],
							meta: { total: 1 },
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/explore?")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									type: "post",
									published_at: "2026-06-20T00:00:00Z",
									post: {
										id: "article-search",
										title: "AI 文章",
										summary: "文章摘要",
										channel: { name: "博客频道" },
									},
								},
							],
							meta: { total: 1 },
						}),
						{ status: 200 },
					);
				}
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			});
		const authStore = useAuthStore();
		authStore.token = "token";
		authStore.isAuthenticated = true;

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: buttonStub,
					PEmpty: true,
				},
			},
		});

		await flushPromises();
		await wrapper.get('[data-testid="discovery-search-input"]').setValue("AI");
		await new Promise((resolve) => setTimeout(resolve, 300));
		await flushPromises();

		const results = wrapper.findAll(
			'[data-testid="discovery-search-dropdown"] .discovery-search-result',
		);
		expect(results).toHaveLength(2);
		expect(results[0].text()).toContain("AI 来源");
		expect(results[1].text()).toContain("AI 文章");
		expect(
			wrapper.find('[data-test="open-discovery-add-subscription"]').exists(),
		).toBe(false);
		expect(
			fetchSpy.mock.calls.some(([input]) => {
				const url = String(input);
				return url.includes("/feed/explore/sources?") && url.includes("q=AI");
			}),
		).toBe(true);
		expect(
			fetchSpy.mock.calls.some(([input]) => {
				const url = String(input);
				return url.includes("/feed/explore?") && url.includes("q=AI");
			}),
		).toBe(true);
	});

	it("closes the discovery dropdown after the search input blurs", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: [] }), { status: 200 }),
		);
		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: buttonStub,
					PEmpty: true,
				},
			},
		});

		const input = wrapper.get('[data-testid="discovery-search-input"]');
		await input.trigger("focus");
		expect(wrapper.find('[data-testid="discovery-search-dropdown"]').exists()).toBe(true);
		await input.trigger("blur");
		await new Promise((resolve) => setTimeout(resolve, 180));
		expect(wrapper.find('[data-testid="discovery-search-dropdown"]').exists()).toBe(false);
	});

	it("uses the shared segmented control size for category filters", () => {
		expect(source).not.toContain(
			".category-segmented-control :deep(.p-segmented-control-item)",
		);
	});

	it("applies advanced filters from the compact filter panel", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/feed/recommend/themes")) {
					return new Response(JSON.stringify({ data: [] }), { status: 200 });
				}
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: buttonStub,
					PEmpty: true,
				},
			},
		});

		await flushPromises();
		await applyFilter(wrapper, "filter-category", "新闻");

		expect(fetchSpy).toHaveBeenLastCalledWith(
			expect.stringContaining("category=news"),
			publicRequestOptions,
		);
		expect(wrapper.text()).toContain("新闻");
	});

	it("subscribes the source directly from a popular article card", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/themes")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/articles")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "popular-article",
								title: "热门文章",
								target_path: "/feed/item/popular-article",
								source_id: "source-popular",
								source_title: "热门来源",
								source_type: "external_rss",
								source_path: "/feed?source_id=source-popular",
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		});

		const authStore = useAuthStore();
		authStore.token = "token";
		authStore.isAuthenticated = true;
		const feedStore = useFeedStore();
		const batchSubscribeSpy = vi
			.spyOn(feedStore, "batchSubscribeSources")
			.mockResolvedValue({ created: 1, reusedIds: [], missingIds: [] });

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: buttonStub,
					PEmpty: true,
				},
			},
		});

		await flushPromises();
		const subscribeButton = wrapper.get(
			'[data-test="article-source-subscribe"]',
		);
		expect(subscribeButton.text()).toContain("订阅");
		await subscribeButton.trigger("click");
		await flushPromises();

		expect(batchSubscribeSpy).toHaveBeenCalledWith(["source-popular"]);
		expect(
			wrapper.get('[data-test="article-source-subscribe"]').text(),
		).toContain("已订阅");
	});

	it("restores the external scope, searches paginated sources, selects all visible sources and subscribes them", async () => {
		routeQuery.scope = "external";
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/feed/explore/sources")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									id: "source-1",
									title: "Open Source Weekly",
									rss_url: "https://example.com/open.xml",
									category: "blog",
									subscribed: false,
									recent_items: [],
								},
								{
									id: "source-2",
									title: "Open Data",
									rss_url: "https://example.com/data.xml",
									category: "blog",
									subscribed: false,
									recent_items: [],
								},
							],
							meta: { page: 1, page_size: 20, total: 21 },
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/recommend/themes"))
					return new Response(JSON.stringify({ data: [] }), { status: 200 });
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			});
		const authStore = useAuthStore();
		authStore.token = "token";
		authStore.isAuthenticated = true;
		const feedStore = useFeedStore();
		const batchSubscribeSpy = vi
			.spyOn(feedStore, "batchSubscribeSources")
			.mockResolvedValue({ created: 2, reusedIds: [], missingIds: [] });

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: {
						props: ["label"],
						template:
							'<button class="p-button" @click="$emit(\'click\')">{{ label }}</button>',
					},
					PEmpty: true,
				},
			},
		});
		await flushPromises();

		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/explore/sources?page=1&limit=20"),
			authenticatedSourceRequestOptions,
		);
		expect(routerReplace).toHaveBeenCalledWith(
			expect.objectContaining({
				query: expect.objectContaining({ scope: "external" }),
			}),
		);

		await wrapper.get('[data-test="external-source-search"]').setValue("open");
		await flushPromises();
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/explore/sources?page=1&limit=20"),
			authenticatedSourceRequestOptions,
		);
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("q=open"),
			authenticatedSourceRequestOptions,
		);

		await wrapper
			.get('[data-test="external-source-select-all"]')
			.setValue(true);
		await wrapper
			.findAll(".p-button")
			.find((button) => button.text() === "订阅选中来源")!
			.trigger("click");
		await flushPromises();
		expect(batchSubscribeSpy).toHaveBeenCalledWith(["source-1", "source-2"]);

		await wrapper
			.findAll(".feed-page-control")
			.find((button) => button.text().includes("下一页"))!
			.trigger("click");
		await flushPromises();
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/explore/sources?page=2&limit=20"),
			authenticatedSourceRequestOptions,
		);
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("q=open"),
			authenticatedSourceRequestOptions,
		);
	});

	it("shows subscribe action for unsubscribed recommended channels and marks them subscribed after click", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/themes")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/articles")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/channels")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "chan-1",
								title: "Channel 1",
								summary: "Summary Channel 1",
								target_path: "/feed/channel/1",
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ error: "unexpected" }), {
				status: 404,
			});
		});

		const authStore = useAuthStore();
		authStore.token = "token";
		authStore.isAuthenticated = true;
		const feedStore = useFeedStore();
		vi.spyOn(feedStore, "isSubscribedToChannel").mockResolvedValue(false);
		const subscribeSpy = vi
			.spyOn(feedStore, "subscribeToChannel")
			.mockResolvedValue(true);

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: {
						props: ["title"],
						template: '<div class="p-empty">{{ title }}</div>',
					},
				},
			},
		});

		await flushPromises();

		await applyFilterValue(wrapper, "target", "channels");

		const subscribeButton = wrapper.find('[data-test="feed-source-subscribe"]');
		expect(subscribeButton.exists()).toBe(true);
		expect(subscribeButton.text()).toContain("订阅");

		await subscribeButton.trigger("click");
		await flushPromises();

		expect(subscribeSpy).toHaveBeenCalledWith("chan-1");
		expect(
			wrapper.find('[data-test="feed-source-subscribe"]').text(),
		).toContain("已订阅");
	});

	it("does not trigger a second subscribe for already subscribed recommended channels", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/themes")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/articles")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/channels")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "chan-1",
								title: "Channel 1",
								summary: "Summary Channel 1",
								target_path: "/feed/channel/1",
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ error: "unexpected" }), {
				status: 404,
			});
		});

		const authStore = useAuthStore();
		authStore.token = "token";
		authStore.isAuthenticated = true;
		const feedStore = useFeedStore();
		vi.spyOn(feedStore, "isSubscribedToChannel").mockResolvedValue(true);
		const subscribeSpy = vi
			.spyOn(feedStore, "subscribeToChannel")
			.mockResolvedValue(true);

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: {
						props: ["title"],
						template: '<div class="p-empty">{{ title }}</div>',
					},
				},
			},
		});

		await flushPromises();

		await applyFilterValue(wrapper, "target", "channels");

		const subscribeButton = wrapper.find('[data-test="feed-source-subscribe"]');
		expect(subscribeButton.exists()).toBe(true);
		expect(subscribeButton.text()).toContain("已订阅");
		expect(subscribeButton.attributes("disabled")).toBeDefined();

		await subscribeButton.trigger("click");
		await flushPromises();

		expect(subscribeSpy).not.toHaveBeenCalled();
	});

	it("mounts and defaults to hot mode and fetches recommendations", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/feed/recommend/themes")) {
					return new Response(
						JSON.stringify({
							data: [{ id: "ai", label: "AI", description: "AI 主题" }],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/recommend/articles")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									id: "art-1",
									title: "Article 1",
									summary: "Summary 1",
									target_path: "/feed/item/1",
								},
							],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/recommend/channels")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									id: "chan-1",
									title: "Channel 1",
									summary: "Summary Channel 1",
									description: "关注模型、工具、应用与研究动态",
									update_frequency_label: "每周多次",
									bookmark_count: 1200,
									read_count: 8400,
									recent_items: [
										{ id: "preview-1", title: "Recent item 1" },
										{ id: "preview-2", title: "Recent item 2" },
									],
									target_path: "/feed/channel/1",
								},
							],
						}),
						{ status: 200 },
					);
				}
				return new Response(JSON.stringify({ error: "unexpected" }), {
					status: 404,
				});
			});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: {
						props: ["label"],
						template:
							'<button class="p-button" @click="$emit(\'click\')">{{ label }}</button>',
					},
					PEmpty: {
						props: ["title"],
						template: '<div class="p-empty">{{ title }}</div>',
					},
				},
			},
		});

		await flushPromises();

		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/recommend/themes?category=all"),
			publicRequestOptions,
		);
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/recommend/articles?mode=hot"),
			publicRequestOptions,
		);
		expect(fetchSpy).not.toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/recommend/channels?mode=hot"),
			publicRequestOptions,
		);

		expect(wrapper.text()).toContain("Article 1");
		expect(wrapper.text()).not.toContain("Channel 1");

		await applyFilterValue(wrapper, "target", "channels");

		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/recommend/channels?mode=hot"),
			publicRequestOptions,
		);
		expect(wrapper.text()).toContain("Channel 1");
	});

	it("shows error state when fetching fails", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(null, { status: 500 }),
		);

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: true,
					PButton: true,
					PEmpty: true,
				},
			},
		});

		await flushPromises();
		expect(wrapper.text()).toContain("推荐内容加载失败");
	});

	it("renders a compact discovery toolbar with a single filter entry", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/themes")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/articles")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/channels")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			return new Response(JSON.stringify({ error: "unexpected" }), {
				status: 404,
			});
		});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: true,
				},
			},
		});

		await flushPromises();

		const compactWrap = wrapper.find('[data-test="feed-filter-wrap"]');
		expect(compactWrap.exists()).toBe(true);
		expect(
			compactWrap.find('[data-test="open-recommendation-filters"]').exists(),
		).toBe(true);
		expect(compactWrap.findAll('[data-test="feed-filter-group"]')).toHaveLength(
			0,
		);
	});

	it("restores route query and requests themes and recommendations with category and theme", async () => {
		routeQuery.mode = "featured";
		routeQuery.target = "channels";
		routeQuery.category = "blog";
		routeQuery.theme = "ai";

		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/feed/recommend/themes")) {
					return new Response(
						JSON.stringify({
							data: [{ id: "ai", label: "AI", description: "AI 主题" }],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/recommend/channels")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									id: "chan-ai-1",
									title: "AI Channel",
									summary: "AI Channel Summary",
									content_type: "blog",
									target_path: "/feed/channel/ai",
								},
							],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/recommend/articles")) {
					return new Response(JSON.stringify({ data: [] }), { status: 200 });
				}
				return new Response(JSON.stringify({ error: "unexpected" }), {
					status: 404,
				});
			});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: true,
				},
			},
		});

		await flushPromises();

		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/recommend/themes?category=blog"),
			publicRequestOptions,
		);
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/recommend/channels?mode=featured"),
			publicRequestOptions,
		);
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"/api/v1/feed/recommend/channels?mode=featured&page=1&page_size=20&category=blog&theme=ai",
			),
			publicRequestOptions,
		);
		expect(wrapper.text()).toContain("AI Channel");
	});

	it("resets theme to all and refreshes themes when category changes", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/feed/recommend/themes?category=all")) {
					return new Response(
						JSON.stringify({
							data: [{ id: "general", label: "综合", description: "综合主题" }],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/recommend/themes?category=blog")) {
					return new Response(
						JSON.stringify({
							data: [{ id: "ai", label: "AI", description: "AI 主题" }],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/recommend/articles")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									id: "art-1",
									title: "Article 1",
									content_type: "blog",
									target_path: "/feed/item/1",
								},
							],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/feed/recommend/channels")) {
					return new Response(JSON.stringify({ data: [] }), { status: 200 });
				}
				return new Response(JSON.stringify({ error: "unexpected" }), {
					status: 404,
				});
			});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: true,
				},
			},
		});

		await flushPromises();

		await applyFilterValue(wrapper, "theme", "ai");
		await applyFilterValue(wrapper, "category", "news");

		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/feed/recommend/themes?category=news"),
			publicRequestOptions,
		);
		expect(routerReplace).toHaveBeenLastCalledWith(
			expect.objectContaining({
				query: expect.objectContaining({ theme: "all", category: "news" }),
			}),
		);
	});

	it("changes mode and refetches on tab click", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				const mode = url.includes("mode=featured") ? "featured" : "hot";
				return new Response(
					JSON.stringify({
						data: [
							{
								id: `art-${mode}`,
								title: `Article ${mode}`,
								target_path: `/feed/item/${mode}`,
							},
						],
					}),
					{ status: 200 },
				);
			});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: true,
				},
			},
		});

		await flushPromises();
		expect(wrapper.text()).toContain("Article hot");

		await applyFilterValue(wrapper, "mode", "featured");

		expect(fetchSpy).toHaveBeenLastCalledWith(
			expect.stringContaining("/api/v1/feed/recommend/articles?mode=featured"),
			publicRequestOptions,
		);
		expect(wrapper.text()).toContain("Article featured");
	});

	it("navigates to subscriptions when clicking back button", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ data: [] }), { status: 200 }),
		);

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: true,
					PButton: {
						props: ["label"],
						template:
							'<button class="p-button" @click="$emit(\'click\')">{{ label }}</button>',
					},
					PEmpty: true,
				},
			},
		});

		await flushPromises();
		const backBtn = wrapper.find(".p-button");
		await backBtn.trigger("click");
		expect(routerPush).toHaveBeenCalledWith("/feed/subscriptions");
	});

	it("navigates to target path when clicking an item card", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/themes")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/articles")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "art-1",
								title: "Article One",
								target_path: "/feed/item/art-1",
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ data: [] }), { status: 200 });
		});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: true,
					PButton: true,
					PEmpty: true,
				},
			},
		});

		await flushPromises();
		const card = wrapper.find(".p-entry");
		await card.trigger("click");
		expect(routerPush).toHaveBeenCalledWith("/feed/item/art-1");
	});

	it("keeps article recommendations visible when the third-row type filter matches article content", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/articles")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "art-blog-1",
								title: "深入理解 SwiftUI 状态同步",
								summary: "这是一篇博客文章，讲状态和视图刷新。",
								target_path: "/posts/post/art-blog-1",
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url.includes("/feed/recommend/channels")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			return new Response(JSON.stringify({ error: "unexpected" }), {
				status: 404,
			});
		});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: {
						props: ["title"],
						template: '<div class="p-empty">{{ title }}</div>',
					},
				},
			},
		});

		await flushPromises();
		expect(wrapper.text()).toContain("深入理解 SwiftUI 状态同步");

		await applyFilterValue(wrapper, "category", "blog");

		expect(wrapper.text()).toContain("深入理解 SwiftUI 状态同步");
		expect(wrapper.text()).not.toContain("当前没有推荐文章");
	});

	it("shows a mixed overview that renders article and channel recommendations together", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/articles")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "art-mixed-1",
								title: "Article Mixed",
								summary: "Summary Mixed",
								target_path: "/feed/item/art-mixed-1",
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url.includes("/feed/recommend/channels")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "chan-mixed-1",
								title: "Channel Mixed",
								summary: "Channel Summary Mixed",
								target_path: "/feed/channel/chan-mixed-1",
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response(JSON.stringify({ error: "unexpected" }), {
				status: 404,
			});
		});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: {
						props: ["title"],
						template: '<div class="p-empty">{{ title }}</div>',
					},
				},
			},
		});

		await flushPromises();

		await applyFilterValue(wrapper, "target", "mixed");

		expect(wrapper.text()).toContain("Article Mixed");
		expect(wrapper.text()).toContain("Channel Mixed");
		expect(wrapper.text()).toContain("混合推荐");
	});

	it("does not classify plain articles as videos only because the title contains video keywords", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/themes")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			if (url.includes("/feed/recommend/articles")) {
				if (url.includes("category=video")) {
					return new Response(JSON.stringify({ data: [] }), { status: 200 });
				}
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "art-video-keyword-1",
								title: "Video encoding 深入笔记",
								summary: "这是一篇纯文章，不是视频条目。",
								content_type: "blog",
								target_path: "/posts/post/art-video-keyword-1",
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url.includes("/feed/recommend/channels")) {
				if (url.includes("category=video")) {
					return new Response(JSON.stringify({ data: [] }), { status: 200 });
				}
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			return new Response(JSON.stringify({ error: "unexpected" }), {
				status: 404,
			});
		});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: {
						props: ["title"],
						template: '<div class="p-empty">{{ title }}</div>',
					},
				},
			},
		});

		await flushPromises();
		expect(wrapper.text()).toContain("Video encoding 深入笔记");

		await applyFilterValue(wrapper, "category", "video");

		expect(wrapper.text()).not.toContain("Video encoding 深入笔记");
		expect(wrapper.text()).toContain("当前没有推荐文章");
	});

	it("requests paged recommendations and resets to page 1 when filters change", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				return new Response(
					JSON.stringify({
						data: [
							{
								id: url.includes("page=2") ? "art-page-2" : "art-page-1",
								title: url.includes("page=2")
									? "Article Page 2"
									: "Article Page 1",
								content_type: "blog",
								target_path: "/feed/item/example",
							},
						],
						meta: {
							page: url.includes("page=2") ? 2 : 1,
							page_size: 20,
							total: 40,
							has_more: !url.includes("page=2"),
						},
					}),
					{ status: 200 },
				);
			});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: {
						...segmentedControlStub,
					},
					PButton: true,
					PEmpty: true,
					PEntry: {
						props: ["title", "summary"],
						template:
							'<article class="p-entry">{{ title }} {{ summary }}</article>',
					},
					PBadge: true,
					PClip: true,
					FeedTimelineFooter: {
						props: ["page", "pageSize", "total", "loading"],
						template:
							'<button class="next-page" @click="$emit(\'change-page\', page + 1)">next</button>',
					},
				},
			},
		});

		await flushPromises();

		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"/api/v1/feed/recommend/articles?mode=hot&page=1&page_size=20",
			),
			publicRequestOptions,
		);
		expect(wrapper.text()).toContain("Article Page 1");

		await wrapper.find(".next-page").trigger("click");
		await flushPromises();

		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"/api/v1/feed/recommend/articles?mode=hot&page=2&page_size=20",
			),
			publicRequestOptions,
		);
		expect(wrapper.text()).toContain("Article Page 2");

		await applyFilterValue(wrapper, "mode", "featured");

		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"/api/v1/feed/recommend/articles?mode=featured&page=1&page_size=20",
			),
			publicRequestOptions,
		);
	});

	it("renders article recommendation cards without the channel two-column grid layout", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/feed/recommend/articles")) {
				return new Response(
					JSON.stringify({
						data: [
							{
								id: "art-layout-1",
								title: "Getty Images 宣布新计划",
								summary: "用于验证文章推荐卡片不再复用频道双列布局。",
								target_path: "/feed/item/art-layout-1",
							},
						],
					}),
					{ status: 200 },
				);
			}
			if (url.includes("/feed/recommend/channels")) {
				return new Response(JSON.stringify({ data: [] }), { status: 200 });
			}
			return new Response(JSON.stringify({ error: "unexpected" }), {
				status: 404,
			});
		});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: true,
					PButton: true,
					PEmpty: true,
				},
			},
		});

		await flushPromises();

		const entry = wrapper.find(".p-entry");
		expect(entry.exists()).toBe(true);
	});

	it("renders channel recommendation heat labels and avatar fallback", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/feed/recommend/themes")) {
					return new Response(JSON.stringify({ data: [] }), { status: 200 });
				}
				if (url.includes("/feed/recommend/articles")) {
					return new Response(JSON.stringify({ data: [] }), { status: 200 });
				}
				if (url.includes("/feed/recommend/channels")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									id: "chan-visual-1",
									title: "少数派",
									summary: "有图片的频道",
									description: "关注模型、工具、应用与研究动态",
									update_frequency_label: "每周多次",
									bookmark_count: 1200,
									read_count: 8400,
									recent_items: [
										{
											id: "recent-1",
											title: "OpenAI o3 之后，agent 设计空间怎么变了",
										},
										{ id: "recent-2", title: "Claude Code 工作流拆解" },
									],
									image_url: "https://example.com/channel-cover.jpg",
									target_path: "/feed/channel/chan-visual-1",
									score_label: "热度 94",
								},
								{
									id: "chan-visual-2",
									title: "Next Blog",
									summary: "没有图片时显示头像回退",
									description: "关注独立写作、产品观察与持续输出",
									update_frequency_label: "偶尔更新",
									bookmark_count: 540,
									read_count: 3200,
									recent_items: [
										{ id: "recent-3", title: "为什么越来越多团队重写检索层" },
									],
									target_path: "/feed/channel/chan-visual-2",
									score_label: "热度 81",
								},
							],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("/blog/posts")) {
					return new Response(
						JSON.stringify({
							data: [
								{
									id: "post-visual-1",
									title: "频道文章",
									content: "频道文章正文",
									created_at: "2026-06-20T08:30:00Z",
								},
							],
							meta: { total: 1 },
						}),
						{ status: 200 },
					);
				}
				return new Response(JSON.stringify({ error: "unexpected" }), {
					status: 404,
				});
			});

		const wrapper = mount(FeedRecommendedView, {
			global: {
				stubs: {
					PPageHeader: {
						template: '<header><slot /><slot name="action" /></header>',
					},
					PSegmentedControl: segmentedControlStub,
					PButton: true,
					PEmpty: true,
				},
			},
		});

		await flushPromises();

		await applyFilterValue(wrapper, "target", "channels");

		expect(wrapper.text()).toContain("热度 94");
		expect(wrapper.text()).toContain("热度 81");
		expect(wrapper.text()).toContain("收藏 1.2K");
		expect(wrapper.text()).toContain("阅读 8.4K");
		expect(wrapper.text()).toContain("每周多次");
		expect(wrapper.text()).toContain("OpenAI o3 之后，agent 设计空间怎么变了");

		const channelCards = wrapper.findAll('[data-test="channel-card"]');
		expect(channelCards).toHaveLength(2);

		expect(
			channelCards[0].find(".feed-source-card__avatar-image").attributes("src"),
		).toBe("https://example.com/channel-cover.jpg");
		expect(channelCards[1].get('[data-test="feed-source-avatar"]').text()).toBe(
			"N",
		);

		await channelCards[0].trigger("click");
		await flushPromises();
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/api/v1/blog/posts?channel_id=chan-visual-1"),
			expect.anything(),
		);
	});
});
