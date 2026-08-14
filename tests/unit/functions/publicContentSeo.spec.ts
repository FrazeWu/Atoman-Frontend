import { describe, expect, it, vi } from "vitest";

import {
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

	it("marks a matched but unavailable detail route as noindex", async () => {
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
});
