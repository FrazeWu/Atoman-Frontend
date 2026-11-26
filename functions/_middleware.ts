import { buildStaticPageHtml, isKnownPagePath } from "./_lib/pageSeo";
import { createSeoApiFetcher, type SeoOriginBinding } from "./_lib/seoOriginFetcher";
import { cachedPublicSeoHtml, canStorePublicSeoHtml, publicSeoHtmlKeyForShell,
  queuePublicSeoHtml, runtimeSeoHtmlCache } from "./_lib/publicSeoHtmlEdgeCache";
import { injectPublicSectionListing, loadPublicSectionListingResult } from "./_lib/sectionContentSeo";
import {
	buildAggregatedContentHtml,
	buildMissingPublicContentHtml,
	buildPublicContentHtml,
	buildUnresolvedPublicContentHtml,
	isAggregatedFeedItemPath,
	resolvePublicContentSeo,
} from "./_lib/publicContentSeo";

type ArchivedAsset = {
	body: ReadableStream;
	httpEtag: string;
	httpMetadata?: { contentType?: string };
};

type MiddlewareContext = {
	request: Request;
	env?: {
		VITE_API_URL?: string;
		SEO_ORIGIN?: SeoOriginBinding;
		FRONTEND_RELEASE_ASSETS?: {
			get: (key: string) => Promise<ArchivedAsset | null>;
		};
	};
	next: () => Promise<Response>;
	waitUntil?: (promise: Promise<unknown>) => void;
};

// Match the Vue Router's legacy URL redirects at the HTTP layer. Crawlers must
// see the permanent redirect without executing the SPA JavaScript bundle.
const legacyRouteRedirects: Record<string, string> = {
	"/podcast": "/podcasts",
	"/video": "/videos",
	"/blog": "/posts",
	"/notes": "/posts/notes",
	"/bookmarks": "/posts/bookmarks",
	"/modules": "/",
	"/books/tags": "/books/lists",
};

function legacyRedirectDestination(pathname: string) {
	const direct = legacyRouteRedirects[pathname];
	if (direct) return direct;
	if (pathname.startsWith("/blog/")) return `/posts/${pathname.slice(6)}`;

	const post = pathname.match(/^\/post\/([^/]+)$/);
	if (post) return `/posts/post/${post[1]}`;
	const channel = pathname.match(/^\/channels\/([^/]+)(?:\/(?:posts|about))?$/);
	if (channel) return `/posts/channel/${channel[1]}`;
	const collection = pathname.match(/^\/collection\/([^/]+)$/);
	if (collection) return `/posts/collection/${collection[1]}`;
	const watch = pathname.match(/^\/watch\/([^/]+)$/);
	if (watch) return `/videos/watch/${watch[1]}`;
	return undefined;
}

function redirectLegacyRoute(request: Request) {
	if (request.method !== "GET" && request.method !== "HEAD") return undefined;

	try {
		const requestUrl = new URL(request.url);
		const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";
		const destination = legacyRedirectDestination(pathname);
		if (!destination) return undefined;

		requestUrl.pathname = destination;
		return Response.redirect(requestUrl, 301);
	} catch {
		return undefined;
	}
}

function archivedAssetKey(request: Request) {
	if (request.method !== "GET" && request.method !== "HEAD") return undefined;

	try {
		const pathname = new URL(request.url).pathname;
		return pathname.startsWith("/assets/") ? pathname.slice(1) : undefined;
	} catch {
		return undefined;
	}
}

function ensureNoTransform(headers: Headers) {
	const cacheControl = headers.get("cache-control") || "";
	if (
		!cacheControl
			.split(",")
			.some((directive) => directive.trim().toLowerCase() === "no-transform")
	) {
		headers.set(
			"cache-control",
			cacheControl ? `${cacheControl}, no-transform` : "no-transform",
		);
	}
}

async function serveArchivedAsset(context: MiddlewareContext, key: string) {
	if (!context.env?.FRONTEND_RELEASE_ASSETS) return undefined;

	try {
		const asset = await context.env.FRONTEND_RELEASE_ASSETS.get(key);
		if (!asset) return undefined;

		const headers = new Headers({
			"cache-control": "public, max-age=31536000, immutable",
			etag: asset.httpEtag,
			"content-type": asset.httpMetadata?.contentType || "application/octet-stream",
		});
		return new Response(context.request.method === "HEAD" ? null : asset.body, {
			headers,
		});
	} catch {
		return undefined;
	}
}

export async function onRequest(context: MiddlewareContext) {
	const redirect = redirectLegacyRoute(context.request);
	if (redirect) return redirect;

	// Read this deployment's actual shell before consulting the HTML cache.
	const assetKey = archivedAssetKey(context.request);
	const response = await context.next();
	const contentType = response.headers.get("content-type") || "";
	if (assetKey && (response.status === 404 || (response.status === 200 && contentType.includes("text/html")))) {
		const archivedAsset = await serveArchivedAsset(context, assetKey);
		if (archivedAsset) return archivedAsset;
		// Missing assets are not SPA documents. Never cache a fallback HTML
		// body for a hashed JS/CSS filename or an asset restored later.
		return new Response(context.request.method === "HEAD" ? null : "Asset not found", {
			status: 404,
			headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
		});
	}
	if (!contentType.includes("text/html")) return response;

	try {
		const requestUrl = new URL(context.request.url);
		const html = await response.clone().text();
		const isPreview = requestUrl.hostname.endsWith(".pages.dev");
		const htmlCacheKey = canStorePublicSeoHtml(response, isPreview, true)
			? await publicSeoHtmlKeyForShell(context.request, html)
			: undefined;
		const htmlCache = htmlCacheKey ? runtimeSeoHtmlCache() : undefined;
		if (htmlCacheKey) {
			const cached = await cachedPublicSeoHtml(htmlCacheKey, htmlCache);
			if (cached) return cached;
		}
		const seoFetcher = createSeoApiFetcher(context.env?.SEO_ORIGIN);
		const staticHtml = buildStaticPageHtml(
			html,
			requestUrl.pathname,
			requestUrl.hostname,
			requestUrl.searchParams,
		);
		const lookup = await resolvePublicContentSeo(
			requestUrl.pathname,
			context.env?.VITE_API_URL,
			requestUrl.origin,
			seoFetcher,
		);
        // A successful public song lookup can resolve a merged historical ID.
        // Redirect only validated song-to-song UUID paths on the same origin.
        const songPath = /^\/music\/song\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
        const requestedSong = requestUrl.pathname.match(songPath);
        const canonicalSong = lookup.content?.path.match(songPath);
        if (response.status === 200 && !lookup.retryable && requestedSong && canonicalSong &&
            requestedSong[1].toLowerCase() !== canonicalSong[1].toLowerCase() &&
            (context.request.method === "GET" || context.request.method === "HEAD")) {
            const destination = new URL(requestUrl.href);
            destination.pathname = "/music/song/" + canonicalSong[1].toLowerCase();
            return new Response(null, { status: 301, headers: { location: destination.href, "cache-control": "no-store" } });
        }
		// A failed SEO lookup is not a successful, indexable detail page.
		// Keep the client application shell, but tell crawlers to retry rather
		// than returning duplicate generic HTML with status 200.
		const retryableSeoPage = lookup.matched && Boolean(lookup.retryable);
		let completePublicData = !lookup.retryable && (!lookup.matched || Boolean(lookup.content));
		let missingSeoPage =
			(lookup.matched && !lookup.content && !lookup.retryable) ||
			(!lookup.matched && !isKnownPagePath(requestUrl.pathname));
		let transformedHtml = isAggregatedFeedItemPath(requestUrl.pathname)
			? buildAggregatedContentHtml(staticHtml)
			: lookup.content
				? buildPublicContentHtml(staticHtml, lookup.content)
				: lookup.retryable
					? buildUnresolvedPublicContentHtml(staticHtml)
				: missingSeoPage
					? buildMissingPublicContentHtml(staticHtml)
					: staticHtml;
		if (!missingSeoPage && !lookup.matched) {
			const listing = await loadPublicSectionListingResult(
				requestUrl.pathname,
				context.env?.VITE_API_URL,
				requestUrl.origin,
				seoFetcher,
				requestUrl.searchParams,
			);
			if (!listing.html && new Set([
				"/posts", "/posts/articles", "/books", "/books/lists", "/music",
				"/music/albums", "/music/artists", "/music/songs",
				"/forum", "/debate", "/podcasts", "/videos",
			]).has(requestUrl.pathname)) {
				completePublicData = false;
			}
			if (listing.outOfRange) {
				missingSeoPage = true;
				transformedHtml = buildMissingPublicContentHtml(staticHtml);
			} else {
				transformedHtml = injectPublicSectionListing(transformedHtml, listing.html, listing.itemLists);
			}
		}
		const headers = new Headers(response.headers);
		headers.delete("content-length");
		headers.delete("content-encoding");
		// Static shell validators do not describe the transformed public page.
		headers.delete("etag");
		headers.delete("last-modified");
		if (missingSeoPage) {
			headers.set("cache-control", "no-store");
			headers.set("x-robots-tag", "noindex, nofollow");
		} else if (retryableSeoPage) {
			headers.set("cache-control", "no-store");
			headers.set("retry-after", "60");
		}
		const finished = new Response(transformedHtml, {
			status: missingSeoPage ? 404 : retryableSeoPage ? 503 : response.status,
			statusText: missingSeoPage ? "Not Found" : retryableSeoPage ? "Service Unavailable" : response.statusText,
			headers,
		});
		if (htmlCacheKey && canStorePublicSeoHtml(
			finished,
			requestUrl.hostname.endsWith(".pages.dev"),
			completePublicData && !missingSeoPage,
		)) {
			queuePublicSeoHtml(htmlCacheKey, finished, htmlCache, context.waitUntil ? (promise) => context.waitUntil!(promise) : undefined);
		}
		return finished;
	} catch {
		const headers = new Headers(response.headers);
		ensureNoTransform(headers);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}
