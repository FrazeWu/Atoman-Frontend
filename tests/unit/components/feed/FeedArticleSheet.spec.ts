import { mount, type MountingOptions, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, routerKey } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Isolated TypeScript diagnostics do not load the Vue SFC module resolver.
import FeedArticleSheet from "@/components/feed/FeedArticleSheet.vue";
import { useAuthStore } from "../../../../src/stores/auth";
import { useFeedStore } from "../../../../src/stores/feed";

const mountedWrappers = new Set<VueWrapper>();
let consoleWarn: ReturnType<typeof vi.spyOn>;
let consoleError: ReturnType<typeof vi.spyOn>;

const mountSheet = (
	options: MountingOptions<any>,
	configureAuth?: (store: ReturnType<typeof useAuthStore>) => void,
) => {
	const pinia = createPinia();
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: { template: "<div />" } }],
	});
	setActivePinia(pinia);
	configureAuth?.(useAuthStore());

	const wrapper = mount(FeedArticleSheet, {
		...options,
		global: {
			...options.global,
			plugins: [pinia],
			provide: {
				...(options.global?.provide || {}),
				[routerKey as symbol]: router,
			},
		},
	});
	mountedWrappers.add(wrapper);
	return wrapper;
};

describe("FeedArticleSheet", () => {
	beforeEach(() => {
		consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	it("tries the source cover after the article image fails", async () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-cover-fallback-1",
						feed_source_id: "source-cover-fallback-1",
						guid: "guid-cover-fallback-1",
						title: "头图回退文章",
						link: "https://example.com/article",
						image_url: "https://cdn.example.com/missing-cover.jpg",
						feed_source: {
							id: "source-cover-fallback-1",
							title: "示例来源",
							cover_url: "https://cdn.example.com/source-cover.jpg",
						},
						summary: "摘要",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		const image = wrapper.get(".article-cover img");
		expect(image.attributes("src")).toBe(
			"https://cdn.example.com/missing-cover.jpg",
		);
		await image.trigger("error");
		await wrapper.vm.$nextTick();

		expect(wrapper.get(".article-cover img").attributes("src")).toBe(
			"https://cdn.example.com/source-cover.jpg",
		);
		expect(wrapper.find(".article-cover--fallback").exists()).toBe(false);
	});

	afterEach(() => {
		for (const wrapper of mountedWrappers) wrapper.unmount();
		mountedWrappers.clear();
		expect(consoleWarn).not.toHaveBeenCalled();
		expect(consoleError).not.toHaveBeenCalled();
		vi.restoreAllMocks();
	});

	it("renders rating controls for blog posts opened from the feed sheet", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					data: { rating_score: 8, rating_count: 2, viewer_rating: 8 },
				}),
				{ status: 200 },
			),
		);
		const wrapper = mountSheet(
			{
				props: {
					show: true,
					article: {
						type: "post",
						published_at: "2026-06-20T00:00:00Z",
						is_read: false,
						post: {
							id: "post-sheet-rating-1",
							title: "可评分文章",
							content: "正文",
							created_at: "2026-06-20T00:00:00Z",
							updated_at: "2026-06-20T00:00:00Z",
							status: "published",
							visibility: "public",
							pinned: false,
							user_id: "user-1",
							rating_score: 7,
							rating_count: 1,
						},
					},
				},
				global: {
					stubs: {
						PSheet: { template: "<section><slot /></section>" },
					},
				},
			},
			(authStore) => {
				authStore.isAuthenticated = true;
				authStore.token = "token";
			},
		);

		await wrapper.vm.$nextTick();
		expect(wrapper.find('button[aria-label="1 分，0.5 星"]').exists()).toBe(true);
		await wrapper.get('button[aria-label="8 分，4.0 星"]').trigger("click");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/blog/posts/post-sheet-rating-1/rating"),
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("rates and clears an external RSS article", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			if (String(input).includes("/rating") && init?.method === "DELETE") {
				return new Response(JSON.stringify({ data: { rating_score: 0, rating_count: 0 } }), { status: 200 });
			}
			if (String(input).includes("/rating")) {
				return new Response(JSON.stringify({ data: { rating_score: 9, rating_count: 1, viewer_rating: 9 } }), { status: 200 });
			}
			return new Response(JSON.stringify({ data: [], meta: { total: 0 } }), { status: 200 });
		});
		const article = {
			type: "feed_item",
			published_at: "2026-06-20T00:00:00Z",
			is_read: false,
			feed_item: {
				id: "feed-item-rating-1",
				feed_source_id: "source-rating-1",
				guid: "guid-rating-1",
				title: "可评分 RSS 文章",
				link: "https://example.com/rated-article",
				summary: "<p>正文</p>",
				rating_score: 8,
				rating_count: 2,
				viewer_rating: 8,
				published_at: "2026-06-20T00:00:00Z",
				fetched_at: "2026-06-20T00:00:00Z",
			},
		} as any;
		const wrapper = mountSheet(
			{
				props: { show: true, article },
				global: {
					stubs: { PSheet: { template: "<section><slot /></section>" } },
				},
			},
			(authStore) => {
				authStore.isAuthenticated = true;
				authStore.token = "token";
			},
		);

		expect(wrapper.find('button[aria-label="9 分，4.5 星"]').exists()).toBe(true);
		await wrapper.get('button[aria-label="9 分，4.5 星"]').trigger("click");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/feed/items/feed-item-rating-1/rating"),
			expect.objectContaining({ method: "PUT" }),
		);
		await vi.waitFor(() => expect(article.feed_item.viewer_rating).toBe(9));

		await wrapper.get('button[aria-label="清除评分"]').trigger("click");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/feed/items/feed-item-rating-1/rating"),
			expect.objectContaining({ method: "DELETE" }),
		);
		await vi.waitFor(() => expect(article.feed_item.viewer_rating).toBeUndefined());
	});

	it("sanitizes external feed HTML before rendering it", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-17T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-1",
						feed_source_id: "source-1",
						guid: "guid-1",
						title: "外部文章",
						link: "https://example.com/article",
						summary:
							'<p>正文</p><img src="x" onerror="alert(1)"><script>alert(1)</script>',
						published_at: "2026-06-17T00:00:00Z",
						fetched_at: "2026-06-17T00:00:00Z",
					},
				},
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		const html = wrapper.html();
		expect(html).toContain("正文");
		expect(html).not.toContain("<script");
		expect(html).not.toContain("onerror");
		expect(wrapper.get('[data-test="feed-article-validity-notice"]').text()).toContain(
			"最近更新时间：",
		);
		expect(wrapper.get('[data-test="feed-article-validity-notice"]').text()).toContain(
			"请注意信息有效性",
		);
	});

	it("opens the article source and exposes a primary subscribe action", async () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				showSourceSubscribe: true,
				source: {
					type: "external_rss",
					id: "source-article-1",
					title: "示例订阅源",
					rssUrl: "https://example.com/feed.xml",
					subscribed: false,
				},
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-source-1",
						feed_source_id: "source-article-1",
						guid: "guid-source-1",
						title: "来源文章",
						link: "https://example.com/article",
						summary: "<p>摘要</p>",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				},
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		await wrapper
			.get('[data-test="feed-article-source-trigger"]')
			.trigger("click");
		await wrapper
			.get('[data-test="feed-article-subscribe-source"]')
			.trigger("click");

		expect(
			wrapper.get('[data-test="feed-article-source-trigger"]').text(),
		).toContain("示例订阅源");
		expect(
			wrapper.get('[data-test="feed-article-subscribe-source"]').classes(),
		).toContain("p-button--primary");
		expect(wrapper.emitted("open-source")).toEqual([[]]);
		expect(wrapper.emitted("subscribe-source")).toEqual([[]]);
	});

	it("renders full-text provenance plus synchronized feed saves and related reading", async () => {
		const wrapper = mountSheet(
			{
				props: {
					show: true,
					showSourceSubscribe: true,
					source: {
						type: "external_rss",
						id: "source-reader-footer-1",
						title: "深读周刊",
						subscribed: false,
					},
					reader: {
						default_variant: "full_text",
						rss: { html: "<p>RSS 正文</p>" },
						full_text: {
							status: "success",
							html: "<p>完整正文</p>",
							word_count: 1280,
						},
					},
					article: {
						type: "feed_item",
						published_at: "2026-06-20T00:00:00Z",
						is_read: false,
						feed_item: {
							id: "feed-item-reader-footer-1",
							feed_source_id: "source-reader-footer-1",
							guid: "guid-reader-footer-1",
							title: "正文结尾功能文章",
							link: "https://example.com/reader-footer",
							summary: "<p>摘要</p>",
							rating_score: 9,
							rating_count: 6,
							published_at: "2026-06-20T00:00:00Z",
							fetched_at: "2026-06-20T00:00:00Z",
						},
					},
					relatedArticles: [
						{
							type: "feed_item",
							published_at: "2026-06-19T00:00:00Z",
							is_read: false,
							feed_item: {
								id: "feed-item-reader-related-1",
								feed_source_id: "source-reader-footer-1",
								guid: "guid-reader-related-1",
								title: "同源推荐文章",
								link: "https://example.com/related",
								summary: "<p>相关正文</p>",
								published_at: "2026-06-19T00:00:00Z",
								fetched_at: "2026-06-19T00:00:00Z",
							},
						},
						{
							type: "feed_item",
							published_at: "2026-06-18T00:00:00Z",
							is_read: false,
							feed_item: {
								id: "feed-item-other-source-1",
								feed_source_id: "other-source",
								guid: "guid-other-source-1",
								title: "其他来源文章",
								link: "https://example.com/other",
								summary: "<p>其他正文</p>",
								published_at: "2026-06-18T00:00:00Z",
								fetched_at: "2026-06-18T00:00:00Z",
							},
						},
					],
				},
				global: {
					stubs: {
						PSheet: { template: "<section><slot /></section>" },
						PBadge: true,
					},
				},
			},
			(authStore) => {
				authStore.isAuthenticated = true;
				authStore.token = "token";
			},
		);
		const feedStore = useFeedStore();
		const toggleStar = vi.spyOn(feedStore, "toggleStar").mockResolvedValue(true);

		expect(wrapper.get('[data-test="feed-article-validity-notice"]').text()).toContain(
			"最近更新时间：",
		);
		expect(wrapper.get('[data-test="feed-article-validity-notice"]').text()).toContain(
			"请注意信息有效性",
		);
		expect(wrapper.get('[data-test="feed-article-rating"]').text()).toContain("9.0 / 10");
		expect(wrapper.get('[data-test="feed-article-related-reading"]').text()).toContain("同源推荐文章");
		expect(wrapper.text()).not.toContain("其他来源文章");
		expect(wrapper.get('[data-test="feed-article-quick-star"]').attributes("aria-pressed")).toBe("false");
		expect(wrapper.get('[data-test="feed-article-footer-star"]').attributes("aria-pressed")).toBe("false");

		await wrapper.get('[data-test="feed-article-quick-star"]').trigger("click");
		expect(toggleStar).toHaveBeenCalledWith("feed-item-reader-footer-1");
	});

	it("marks external feed content as width constrained prose", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-29T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-wide-content-1",
						feed_source_id: "source-wide-content-1",
						guid: "guid-wide-content-1",
						title: "包含超长内容的外部文章",
						link: "https://example.com/article",
						summary:
							"<p>https://example.com/very-long-unbroken-url-that-should-not-expand-the-page-width</p>",
						published_at: "2026-06-29T00:00:00Z",
						fetched_at: "2026-06-29T00:00:00Z",
					},
				},
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		expect(wrapper.get(".article-body").classes()).toContain(
			"article-body--external-feed",
		);
	});

	it("renders a play button for podcast feed items and emits play-podcast when clicked", async () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-podcast-1",
						feed_source_id: "source-1",
						guid: "guid-podcast-1",
						title: "播客节目",
						link: "https://example.com/episode",
						enclosure_url: "https://cdn.example.com/audio.mp3",
						enclosure_type: "audio/mpeg",
						summary: "<p>节目摘要</p>",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				},
				isPodcastPlaying: false,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		const playButton = wrapper.get('[data-test="feed-article-play"]');
		expect(playButton.text()).toContain("播放播客");

		await playButton.trigger("click");

		expect(wrapper.emitted("play-podcast")?.[0]?.[0]).toMatchObject({
			id: "feed-item-podcast-1",
		});
	});

	it("does not render a play button for non-audio feed items", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-2",
						feed_source_id: "source-2",
						guid: "guid-2",
						title: "普通文章",
						link: "https://example.com/article",
						enclosure_url: "https://cdn.example.com/cover.jpg",
						enclosure_type: "image/jpeg",
						summary: "<p>摘要</p>",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				},
				isPodcastPlaying: false,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		expect(wrapper.find('[data-test="feed-article-play"]').exists()).toBe(false);
	});

	it("shows the playing label when the current podcast is already playing", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-playing-1",
						feed_source_id: "source-3",
						guid: "guid-3",
						title: "正在播放的播客",
						link: "https://example.com/playing",
						enclosure_url: "https://cdn.example.com/playing.mp3",
						enclosure_type: "audio/mpeg",
						summary: "<p>摘要</p>",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				},
				isPodcastPlaying: true,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		expect(wrapper.get('[data-test="feed-article-play"]').text()).toContain(
			"播放中",
		);
	});

	it("shows richer external article reading metadata for readability", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				reader: {
					default_variant: "full_text",
					rss: { html: "<p>RSS 正文</p>" },
					full_text: {
						status: "success",
						html: "<p>抓取正文</p>",
						word_count: 1280,
					},
				},
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-meta-1",
						feed_source_id: "source-meta-1",
						guid: "guid-meta-1",
						title: "带有完整状态信息的外部文章",
						link: "https://example.com/meta",
						summary: "<p>这是一段摘要内容。</p>",
						author: "外部作者",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T08:30:00Z",
						full_text_status: "success",
						content_source: "full_text",
						full_text_word_count: 1280,
						feed_source: {
							id: "source-meta-1",
							source_type: "external_rss",
							title: "Longform Weekly",
							created_at: "2026-06-01T00:00:00Z",
						},
					},
				} as any,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		expect(wrapper.text()).toContain("Longform Weekly");
		expect(wrapper.text()).toContain("信息有效性");
		expect(wrapper.text()).toContain("约 1,280 字，4 分钟阅读");
		expect(wrapper.get(".article-source-link").attributes("aria-label")).toBe("在源站查看");
	});

	it("does not render previous and next navigation controls", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				hasPrevious: true,
				hasNext: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-nav-2",
						feed_source_id: "source-nav",
						guid: "guid-nav-2",
						title: "第二篇文章",
						link: "https://example.com/nav-2",
						summary: "<p>摘要</p>",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		expect(wrapper.find('[data-test="feed-article-prev"]').exists()).toBe(false);
		expect(wrapper.find('[data-test="feed-article-next"]').exists()).toBe(false);
	});

	it("opens comments in a nested sheet and supports keyboard article navigation", async () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				hasPrevious: true,
				hasNext: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-comments-1",
						feed_source_id: "source-comments-1",
						guid: "guid-comments-1",
						title: "评论文章",
						link: "https://example.com/comments",
						summary: "<p>正文</p>",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: {
					PSheet: {
						props: ["show"],
						template:
							'<section v-if="show" data-test="feed-reader-sheet"><slot /></section>',
					},
					PBadge: true,
					PDiscussionFAB: {
						template:
							'<button data-test="open-comments" @click="$emit(\'click\')">评论</button>',
					},
					CommentSection: { template: "<div>评论区</div>" },
				},
			},
		});

		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
		expect(wrapper.emitted("previous")).toEqual([[]]);
		expect(wrapper.emitted("next")).toEqual([[]]);

		const commentsTrigger = wrapper.get('[data-test="open-comments"]');
		expect(
			commentsTrigger.element.closest('[data-test="feed-reader-sheet"]'),
		).not.toBeNull();
		await commentsTrigger.trigger("click");
		expect(wrapper.text()).toContain("评论区");

		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
		expect(wrapper.emitted("previous")).toEqual([[]]);
		expect(wrapper.emitted("next")).toEqual([[]]);

		await wrapper.setProps({ article: null });
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
		expect(wrapper.emitted("previous")).toEqual([[]]);
	});

	it("explains whether the reader is showing full text or only a summary", async () => {
		const fullTextWrapper = mountSheet({
			props: {
				show: true,
				reader: {
					default_variant: "full_text",
					rss: { html: "<p>RSS 正文</p>" },
					full_text: { status: "success", html: "<p>全文</p>", word_count: 2 },
				},
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-status-1",
						feed_source_id: "source-status-1",
						guid: "guid-status-1",
						title: "全文文章",
						link: "https://example.com/full",
						summary: "<p>摘要</p>",
						feed_content_html: "<p>RSS 正文</p>",
						full_text_html: "<p>全文</p>",
						full_text_status: "success",
						content_source: "full_text",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		const summaryWrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-status-2",
						feed_source_id: "source-status-2",
						guid: "guid-status-2",
						title: "摘要文章",
						link: "https://example.com/summary",
						summary: "<p>仅摘要</p>",
						full_text_status: "failed",
						full_text_error: "fetch timeout",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		expect(fullTextWrapper.text()).toContain("信息有效性");
		expect(fullTextWrapper.html()).toContain("全文");
		expect(
			fullTextWrapper
				.get('[data-test="feed-content-mode-full-text"]')
				.attributes("aria-checked"),
		).toBe("true");
		await fullTextWrapper
			.get('[data-test="feed-content-mode-rss"]')
			.trigger("click");
		expect(fullTextWrapper.text()).toContain("RSS 正文");
		expect(fullTextWrapper.html()).toContain("RSS 正文");
		expect(
			fullTextWrapper
				.get('[data-test="feed-content-mode-rss"]')
				.attributes("aria-checked"),
		).toBe("true");
		expect(summaryWrapper.text()).toContain("RSS 摘要");
		expect(
			summaryWrapper.find('[data-test="feed-content-mode-rss"]').exists(),
		).toBe(false);
		expect(summaryWrapper.text()).not.toContain("fetch timeout");
	});

	it("falls back to content_html before summary when full-text status is available but html is missing", () => {
		const wrapper = mountSheet({
			props: {
				show: true,
				article: {
					type: "feed_item",
					published_at: "2026-06-20T00:00:00Z",
					is_read: false,
					feed_item: {
						id: "feed-item-fallback-1",
						feed_source_id: "source-fallback-1",
						guid: "guid-fallback-1",
						title: "正文回退文章",
						link: "https://example.com/fallback",
						summary: "<p>只应作为最后回退的摘要</p>",
						content_html: "<p>这是清洗后的正文 HTML</p>",
						full_text_status: "success",
						content_source: "full_text",
						published_at: "2026-06-20T00:00:00Z",
						fetched_at: "2026-06-20T00:00:00Z",
					},
				} as any,
			},
			global: {
				stubs: {
					PSheet: { template: "<section><slot /></section>" },
					PBadge: true,
				},
			},
		});

		expect(wrapper.html()).toContain("这是清洗后的正文 HTML");
		expect(wrapper.html()).not.toContain("只应作为最后回退的摘要");
	});
});
