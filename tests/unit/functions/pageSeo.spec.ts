import { describe, expect, it, vi } from "vitest";

import { buildStaticPageHtml } from "../../../functions/_lib/pageSeo";
import { onRequest as pageMiddleware } from "../../../functions/_middleware";

const shell =
	'<!doctype html><html><head><title>Atoman</title><meta data-default-meta name="description" content="old"><link data-default-meta rel="canonical" href="https://www.atoman.org/"></head><body></body></html>';

describe("static page SEO", () => {
	it("renders independent metadata and a www canonical for public module pages", () => {
		const html = buildStaticPageHtml(shell, "/feed/", "www.atoman.org");

		expect(html).toContain("<title data-default-meta>订阅流 | Atoman</title>");
		expect(html).toContain(
			'rel="canonical" href="https://www.atoman.org/feed"',
		);
		expect(html).toContain(
			'property="og:url" content="https://www.atoman.org/feed"',
		);
		expect(html).toContain(
			'property="og:image" content="https://www.atoman.org/atoman-share.png"',
		);
		expect(html).toContain(
			'name="twitter:image" content="https://www.atoman.org/atoman-share.png"',
		);
		expect(html).not.toContain('content="old"');
		expect(html).not.toContain('name="robots"');
	});

	it("marks preview deployments and private application routes as noindex", () => {
		expect(
			buildStaticPageHtml(shell, "/", "preview.atoman-frontend.pages.dev"),
		).toContain('<meta name="robots" content="noindex, nofollow">');
		const privateHtml = buildStaticPageHtml(
			shell,
			"/studio/blog",
			"www.atoman.org",
		);
		expect(privateHtml).toContain(
			'<meta name="robots" content="noindex, nofollow">',
		);
		expect(privateHtml).toContain("<title>Atoman</title>");
		expect(privateHtml).toContain('content="old"');
		expect(privateHtml).not.toContain('rel="canonical"');
		expect(
			buildStaticPageHtml(shell, "/auth/oauth/callback", "www.atoman.org"),
		).toContain('<meta name="robots" content="noindex, nofollow">');
	});

	it("leaves dynamic public content for its route-specific SEO handler", () => {
		expect(
			buildStaticPageHtml(shell, "/posts/post/post-1", "www.atoman.org"),
		).toBe(shell);
	});

	it("redirects legacy singular public module URLs to their canonical routes", async () => {
		const next = vi.fn(async () => new Response(shell));
		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/podcast/?source=legacy"),
			next,
		});

		expect(response.status).toBe(301);
		expect(response.headers.get("location")).toBe(
			"https://www.atoman.org/podcasts?source=legacy",
		);
		expect(next).not.toHaveBeenCalled();
	});

	it("only redirects legacy routes for safe navigation methods", async () => {
		const next = vi.fn(async () => new Response(shell));
		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/video", { method: "POST" }),
			next,
		});

		expect(response.status).toBe(200);
		expect(next).toHaveBeenCalledOnce();
	});

	it("only transforms HTML responses in middleware", async () => {
		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/feed"),
			next: async () =>
				new Response(shell, {
					headers: { "content-type": "text/html; charset=UTF-8" },
				}),
		});
		expect(await response.text()).toContain(
			"<title data-default-meta>订阅流 | Atoman</title>",
		);

		const xmlResponse = new Response("<urlset/>", {
			headers: { "content-type": "application/xml" },
		});
		const untouched = await pageMiddleware({
			request: new Request("https://www.atoman.org/sitemap.xml"),
			next: async () => xmlResponse,
		});
		expect(untouched).toBe(xmlResponse);
	});
});
