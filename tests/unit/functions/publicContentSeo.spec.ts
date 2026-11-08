import { describe, expect, it, vi } from "vitest";

import {
	buildAggregatedContentHtml,
	buildMissingPublicContentHtml,
	buildPublicContentHtml,
	buildUnresolvedPublicContentHtml,
	collectPublicSitemapItems,
	resolvePublicContentSeo,
} from "../../../functions/_lib/publicContentSeo";
import { onRequest as pageMiddleware } from "../../../functions/_middleware";

const shell =
	'<!doctype html><html><head><title>Atoman</title><meta data-default-meta name="description" content="old"><link data-default-meta rel="canonical" href="https://www.atoman.org/"></head><body></body></html>';

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("public content SEO", () => {
	it("builds canonical metadata and structured data for a public music artist", async () => {
		const fetcher = vi.fn(async () =>
			json({
				data: {
					id: "artist-1",
					name: "Artist",
					display_name: "艺术家",
					bio: "<p>艺术家介绍</p>",
					image_url: "https://assets.atoman.org/artist.webp",
					artist_form: "person",
					updated_at: "2026-08-14T08:00:00Z",
				},
			}),
		) as unknown as typeof fetch;

		const lookup = await resolvePublicContentSeo(
			"/music/artist/artist-1",
			"https://api.atoman.org/api",
			"https://www.atoman.org",
			fetcher,
		);

		expect(lookup.matched).toBe(true);
		expect(lookup.content?.path).toBe("/music/artist/artist-1");
		expect(fetcher).toHaveBeenCalledWith(
			"https://api.atoman.org/api/v1/music/artists/artist-1",
			expect.any(Object),
		);
		const html = buildPublicContentHtml(shell, lookup.content!);
		expect(html).toContain(
			'<title data-page-meta="content">艺术家 | 音乐档案 | Atoman</title>',
		);
		expect(html).toContain(
			'rel="canonical" href="https://www.atoman.org/music/artist/artist-1"',
		);
		expect(html).toContain('"@type":"Person"');
		expect(html).not.toContain('content="old"');
	});

	it("renders crawlable video content in the HTML body", () => {
		const html = buildPublicContentHtml(
			'<!doctype html><html><head><title>Atoman</title></head><body><div id="app"><!-- seo-prerender-start --><div class="portal-prerender">首页</div><!-- seo-prerender-end --></div></body></html>',
			{
				path: "/videos/watch/video-1",
				title: "视频标题 | 视频 | Atoman",
				description: "视频简介",
				imageUrl: "https://assets.atoman.org/video-cover.jpg",
				structuredData: {
					"@type": "VideoObject",
					name: "视频标题",
					contentUrl: "https://assets.atoman.org/video.mp4",
				},
			},
		);

		expect(html).toContain('<main data-seo-fallback="content">');
		expect(html).toContain("<h1>视频标题</h1>");
		expect(html).toContain('src="https://assets.atoman.org/video.mp4"');
		expect(html).toContain('poster="https://assets.atoman.org/video-cover.jpg"');
		expect(html).not.toContain("portal-prerender");
	});

	it("marks aggregated feed item pages as noindex without a homepage canonical", () => {
		const html = buildAggregatedContentHtml(shell);

		expect(html).toContain('<meta name="robots" content="noindex, follow">');
		expect(html).not.toContain('rel="canonical"');
		expect(html).not.toContain("noindex, nofollow");
	});

	it("returns a 404 for a matched but unavailable detail route", async () => {
		const fetcher = vi.fn(async () =>
			json({ error: "not found" }, 404),
		) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo(
			"/videos/watch/private-video",
			undefined,
			"https://www.atoman.org",
			fetcher,
		);

		expect(lookup).toEqual({ matched: true, content: undefined });
		const html = buildMissingPublicContentHtml(shell);
		expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
		expect(html).not.toContain('rel="canonical"');

		vi.stubGlobal("fetch", vi.fn(async () => json({ error: "not found" }, 404)));
		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/videos/watch/private-video"),
			next: async () =>
				new Response(shell, { headers: { "content-type": "text/html" } }),
		});
		expect(response.status).toBe(404);
		expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("does not noindex a valid route when its SEO source fails temporarily", async () => {
		const fetcher = vi.fn(async () =>
			json({ error: "unavailable" }, 503),
		) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo(
			"/videos/watch/video-1",
			undefined,
			"https://www.atoman.org",
			fetcher,
		);

		expect(lookup).toEqual({ matched: true, retryable: true });
		const html = buildUnresolvedPublicContentHtml(shell);
		expect(html).not.toContain('name="robots"');
		expect(html).not.toContain('rel="canonical"');
	});

	it("marks feed item pages as aggregate content through the Pages middleware", async () => {
		const response = await pageMiddleware({
			request: new Request(
				"https://www.atoman.org/feed/item/019f75a2-5466-7e1e-b0fd-1954e03116e4",
			),
			next: async () =>
				new Response(shell, { headers: { "content-type": "text/html" } }),
		});
		const html = await response.text();

		expect(html).toContain('<meta name="robots" content="noindex, follow">');
		expect(html).not.toContain('rel="canonical"');
	});

	it("removes stale content encoding after rewriting HTML", async () => {
		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/feed/item/item-1"),
			next: async () =>
				new Response(shell, {
					headers: {
						"content-type": "text/html",
						"content-encoding": "gzip",
					},
				}),
		});

		expect(response.headers.get("content-encoding")).toBeNull();
	});

	it("injects detail metadata through the Pages middleware", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				json({
					data: {
						id: "debate-1",
						title: "是否应该继续探索太空？",
						description: "讨论探索太空的价值。",
						status: "active",
						created_at: "2026-08-01T08:00:00Z",
						updated_at: "2026-08-02T08:00:00Z",
					},
				}),
			),
		);

		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/debate/debate-1"),
			env: { VITE_API_URL: "https://api.atoman.org/api" },
			next: async () =>
				new Response(shell, { headers: { "content-type": "text/html" } }),
		});
		const html = await response.text();

		expect(html).toContain("是否应该继续探索太空？ | 辩题 | Atoman");
		expect(html).toContain("https://www.atoman.org/debate/debate-1");
		expect(html).toContain(
			'property="og:image" content="https://www.atoman.org/atoman-share.png"',
		);
		expect(html).toContain('"@type":"Article"');
	});

	it("collects public detail URLs while tolerating one failed module source", async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/music/artists")) {
				return json({
					data: [{ id: "artist-1", updated_at: "2026-08-01T00:00:00Z" }],
				});
			}
			if (url.includes("/music/albums")) {
				return json({
					data: [
						{
							id: "album-1",
							updated_at: "2026-08-02T00:00:00Z",
							songs: [{ id: "song-1" }],
						},
					],
				});
			}
			if (url.includes("/forum/topics")) throw new Error("forum unavailable");
			if (url.includes("/debate/topics")) {
				return json({
					data: [{ id: "debate-1", updated_at: "2026-08-03T00:00:00Z" }],
				});
			}
			if (url.includes("/podcast/episodes")) return json([]);
			if (url.includes("/videos")) {
				return json([
					{
						id: "video-1",
						visibility: "public",
						status: "published",
						updated_at: "2026-08-04T00:00:00Z",
					},
					{
						id: "video-2",
						visibility: "private",
						status: "published",
						collection: { id: "private-collection" },
					},
				]);
			}
			return json([], 404);
		}) as unknown as typeof fetch;

		const items = await collectPublicSitemapItems(
			"https://api.atoman.org/api/v1",
			fetcher,
		);
		expect(items.map((item) => item.path)).toEqual([
			"/music/artist/artist-1",
			"/music/album/album-1",
			"/music/song/song-1",
			"/debate/debate-1",
			"/videos/watch/video-1",
		]);
	});

	it("collects every page from a paginated public source", async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/music/artists")) {
				const page = new URL(url).searchParams.get("page");
				return json({
					data: [{ id: `artist-${page}` }],
					meta: { page: Number(page), page_size: 1, total: 2, has_more: page === "1" },
				});
			}
			return json([]);
		}) as unknown as typeof fetch;

		const items = await collectPublicSitemapItems(
			"https://api.atoman.org/api/v1",
			fetcher,
		);

		expect(items.map((item) => item.path)).toContain("/music/artist/artist-1");
		expect(items.map((item) => item.path)).toContain("/music/artist/artist-2");
		expect(fetcher).toHaveBeenCalledWith(
			"https://api.atoman.org/api/v1/music/artists?page=2&page_size=1000",
			expect.any(Object),
		);
	});


	it("builds crawlable book work and edition metadata from public catalog APIs", async () => {
		const work = {
			id: "work-1", title: "三体", lifecycle_status: "active",
			authors: [{ name: "刘慈欣" }],
			editions: [{ id: "edition-1", title: "三体", isbn13: "9787536692930", publisher: "重庆出版社", cover_url: "/api/v1/books/editions/edition-1/cover" }],
		};
		const fetcher = vi.fn(async (input: RequestInfo | URL) =>
			String(input).includes("/books/wiki/edition/")
				? json({ data: { entity_id: "edition-1", fields: { work_id: "work-1", updated_at: "2026-11-04T08:00:00Z" } } })
				: json({ data: work }),
		) as unknown as typeof fetch;
		const workLookup = await resolvePublicContentSeo("/books/work/work-1", undefined, "https://www.atoman.org", fetcher);
		expect(workLookup.matched).toBe(true);
		expect(workLookup.content?.title).toContain("三体");
		const workHtml = buildPublicContentHtml(shell, workLookup.content!);
		expect(workHtml).toContain('rel="canonical" href="https://www.atoman.org/books/work/work-1"');
		expect(workHtml).toContain('<main data-seo-fallback="content">');
		expect(workHtml).toContain('"@type":"Book"');
		expect(workHtml).toContain("刘慈欣");
		expect(workHtml).toContain("https://api.atoman.org/api/v1/books/editions/edition-1/cover");
		const editionLookup = await resolvePublicContentSeo("/books/edition/edition-1", undefined, "https://www.atoman.org", fetcher);
		expect(editionLookup.matched).toBe(true);
		const editionHtml = buildPublicContentHtml(shell, editionLookup.content!);
		expect(editionHtml).toContain('rel="canonical" href="https://www.atoman.org/books/edition/edition-1"');
		expect(editionHtml).toContain("9787536692930");
		expect(editionHtml).toContain("重庆出版社");
		expect(fetcher).toHaveBeenCalledWith(
			"https://api.atoman.org/api/v1/books/wiki/edition/edition-1", expect.any(Object),
		);
	});

	it("indexes only public booklists and skips invalid private book routes", async () => {
		const fetcher = vi.fn(async () => json({ data: { id: "list-1", title: "科幻推荐", description: "科幻阅读书单", visibility: "public", items: [{ title: "三体", available: true, canonical_work_id: "work-1" }] } })) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo("/books/lists/list-1", undefined, "https://www.atoman.org", fetcher);
		expect(lookup.matched).toBe(true);
		const html = buildPublicContentHtml(shell, lookup.content!);
		expect(html).toContain("科幻推荐");
		expect(html).toContain('"@type":"ItemList"');
		expect(html).toContain("https://www.atoman.org/books/work/work-1");
		expect((await resolvePublicContentSeo("/books/lists/new", undefined, "https://www.atoman.org", fetcher)).matched).toBe(false);
		const hidden = await resolvePublicContentSeo("/books/lists/private-1", undefined, "https://www.atoman.org", vi.fn(async () => json({ data: { id: "private-1", title: "私密书单", visibility: "private" } })) as unknown as typeof fetch);
		expect(hidden).toEqual({ matched: true, content: undefined });
	});

	it("adds active book works, editions and public booklists to sitemap only", async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/books/works?")) return json({ data: { items: [
				{ id: "work-1", title: "三体", lifecycle_status: "active", editions: [{ id: "edition-1" }] },
				{ id: "work-deleted", title: "隐藏作品", lifecycle_status: "removed" },
			], total: 2 } });
			if (url.includes("/books/booklists?")) return json({ data: { items: [
				{ id: "list-1", title: "科幻推荐", visibility: "public" },
				{ id: "list-private", title: "私人书单", visibility: "private" },
			], total: 2 } });
			return json({ data: [] });
		}) as unknown as typeof fetch;
		const items = await collectPublicSitemapItems("https://api.atoman.org/api/v1", fetcher);
		expect(items.map(({ path }) => path)).toEqual([
			"/books/work/work-1", "/books/edition/edition-1", "/books/lists/list-1",
		]);
		expect(fetcher).toHaveBeenCalledWith("https://api.atoman.org/api/v1/books/works?limit=50&offset=0", expect.any(Object));
	});

});
