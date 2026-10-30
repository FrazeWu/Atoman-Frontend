import {
	buildSitemapXml,
	isCanonicalSitemapPath,
	resolveApiBase,
	type SitemapItem,
} from "./_lib/blogSeo";
import { collectPublicSitemapItems } from "./_lib/publicContentSeo";

type SitemapContext = {
	request: Request;
	env: { VITE_API_URL?: string };
};

const canonicalOrigin = "https://www.atoman.org";
const staticPages: SitemapItem[] = [
	{ path: "/" },
	{ path: "/feed" },
	{ path: "/posts" },
	{ path: "/music" },
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
				"cache-control": "public, max-age=60, s-maxage=300",
			},
		},
	);
}

export async function onRequest(context: SitemapContext) {
	try {
		const requestUrl = new URL(context.request.url);
		const defaultApi = requestUrl.origin.includes("atoman.org")
			? "https://api.atoman.org/api"
			: undefined;
		const apiBase = resolveApiBase(context.env.VITE_API_URL || defaultApi, requestUrl.origin);
		const response = await fetch(`${apiBase}/blog/seo/sitemap`, {
			headers: { Accept: "application/json" },
			signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(4000) : undefined,
		});
		if (!response.ok) throw new Error("SEO sitemap unavailable");
		const payload = (await response.json()) as { data?: unknown };
		if (!isSitemapItems(payload.data)) return fallbackSitemap();
		const itemsByPath = new Map(staticPages.map((item) => [item.path, item]));
		payload.data
			.filter((item) => isAllowedSitemapPath(item.path))
			.forEach((item) => itemsByPath.set(item.path, item));
		try {
			const publicItems = await collectPublicSitemapItems(apiBase);
			publicItems.forEach((item) => {
				const existing = itemsByPath.get(item.path);
				if (!existing?.last_modified || item.last_modified)
					itemsByPath.set(item.path, item);
			});
		} catch (publicError) {
			console.warn("Public sitemap items partial failure:", publicError);
		}
		return new Response(
			buildSitemapXml([...itemsByPath.values()], canonicalOrigin),
			{
				headers: {
					"cache-control": "public, max-age=300, s-maxage=3600",
					"content-type": "application/xml; charset=UTF-8",
				},
			},
		);
	} catch (error) {
		console.error("Sitemap generation error, falling back to static pages:", error);
		return fallbackSitemap();
	}
}
