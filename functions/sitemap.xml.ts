import { createSeoApiFetcher, type SeoOriginBinding } from "./_lib/seoOriginFetcher";
import {
	buildSitemapXml,
	isCanonicalSitemapPath,
	resolveApiBase,
	type SitemapItem,
} from "./_lib/blogSeo";
import { collectPublicSitemapResult } from "./_lib/publicContentSeo";
import { publicSitemapCacheKey, queuePublicSitemapCache, readPublicSitemapCache,
	runtimeSitemapCache, sitemapCacheControl } from "./_lib/publicSitemapEdgeCache";

type SitemapContext = {
	request: Request;
	env: { VITE_API_URL?: string; SEO_ORIGIN?: SeoOriginBinding };
	waitUntil?: (job: Promise<unknown>) => void;
};

const canonicalOrigin = "https://www.atoman.org";
const staticPages: SitemapItem[] = [
	{ path: "/" },
	{ path: "/feed" },
	{ path: "/posts" },
	{ path: "/posts/articles" },
	{ path: "/books" },
	{ path: "/books/lists" },
	{ path: "/music" },
	{ path: "/music/albums" },
	{ path: "/music/artists" },
	{ path: "/music/songs" },
	{ path: "/forum" },
	{ path: "/debate" },
	{ path: "/timeline" },
	{ path: "/podcasts" },
	{ path: "/videos" },
	{ path: "/about" },
	{ path: "/terms" },
	{ path: "/privacy" },
];

function isSitemapItems(value: unknown): value is SitemapItem[] {
	return (
		Array.isArray(value) &&
		value.every(
			(item) =>
				Boolean(item) &&
				typeof item === "object" &&
				typeof (item as SitemapItem).path === "string" &&
				((item as SitemapItem).last_modified === undefined ||
					(item as SitemapItem).last_modified === null ||
					typeof (item as SitemapItem).last_modified === "string"),
		)
	);
}

function isAllowedSitemapPath(path: string) {
	return staticPages.some((item) => item.path === path) || isCanonicalSitemapPath(path);
}

function fallbackSitemap() {
	return new Response(
		buildSitemapXml(staticPages, canonicalOrigin),
		{
			status: 200,
			headers: {
				"content-type": "application/xml; charset=UTF-8",
				"cache-control": "no-store",
				"x-atoman-sitemap-status": "partial",
			},
		},
	);
}

export async function onRequest(context: SitemapContext) {
	try {
		const requestUrl = new URL(context.request.url);
		const key = publicSitemapCacheKey(context.request);
		const cache = key ? runtimeSitemapCache() : undefined;
		if (key && cache) {
			const hit = await readPublicSitemapCache(key, cache);
			if (hit) return hit;
		}
		const defaultApi = requestUrl.origin.includes("atoman.org")
			? "https://api.atoman.org/api"
			: undefined;
		const apiBase = resolveApiBase(context.env.VITE_API_URL || defaultApi, requestUrl.origin);
		const seoFetcher = createSeoApiFetcher(context.env.SEO_ORIGIN);
		const response = await seoFetcher(`${apiBase}/blog/seo/sitemap`, {
			headers: {
				Accept: "application/json",
				"User-Agent": "Atoman-Edge-SSR/1.0 (+https://www.atoman.org)",
			},
			signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(7000) : undefined,
		});
		if (!response.ok) throw new Error("SEO sitemap unavailable");
		const payload = (await response.json()) as { data?: unknown };
		if (!isSitemapItems(payload.data)) return fallbackSitemap();
		const itemsByPath = new Map(staticPages.map((item) => [item.path, item]));
		payload.data
			.filter((item) => isAllowedSitemapPath(item.path))
			.forEach((item) => itemsByPath.set(item.path, item));
		let complete = false;
		try {
			const publicItems = await collectPublicSitemapResult(apiBase, seoFetcher);
			complete = publicItems.complete;
			publicItems.items.filter((item) => isAllowedSitemapPath(item.path)).forEach((item) => {
				const existing = itemsByPath.get(item.path);
				if (!existing?.last_modified || item.last_modified)
					itemsByPath.set(item.path, item);
			});
		} catch (publicError) {
			console.warn("Public sitemap items partial failure:", publicError);
		}
		const sitemap = new Response(
			buildSitemapXml([...itemsByPath.values()], canonicalOrigin),
			{
				headers: {
					"cache-control": complete ? sitemapCacheControl : "no-store",
					"content-type": "application/xml; charset=UTF-8",
					"x-atoman-sitemap-status": complete ? "complete" : "partial",
				},
			},
		);
		if (complete && key && cache && context.waitUntil) {
			queuePublicSitemapCache(key, sitemap, cache, (job) => context.waitUntil!(job));
		}
		return sitemap;
	} catch (error) {
		console.error("Sitemap generation error, falling back to static pages:", error);
		return fallbackSitemap();
	}
}
