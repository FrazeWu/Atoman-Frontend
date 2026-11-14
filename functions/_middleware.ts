import { buildStaticPageHtml, isKnownPagePath } from "./_lib/pageSeo";
import { injectPublicSectionListing, loadPublicSectionListing } from "./_lib/sectionContentSeo";
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
		FRONTEND_RELEASE_ASSETS?: {
			get: (key: string) => Promise<ArchivedAsset | null>;
		};
	};
	next: () => Promise<Response>;
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

	const assetKey = archivedAssetKey(context.request);
	const response = await context.next();
	const contentType = response.headers.get("content-type") || "";
	if (assetKey && contentType.includes("text/html")) {
		const archivedAsset = await serveArchivedAsset(context, assetKey);
		if (archivedAsset) return archivedAsset;
	}
	if (!contentType.includes("text/html")) return response;

	try {
		const requestUrl = new URL(context.request.url);
		const html = await response.clone().text();
		const staticHtml = buildStaticPageHtml(
			html,
			requestUrl.pathname,
			requestUrl.hostname,
		);
		const lookup = await resolvePublicContentSeo(
			requestUrl.pathname,
			context.env?.VITE_API_URL,
			requestUrl.origin,
		);
		const missingSeoPage =
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
			const listing = await loadPublicSectionListing(
				requestUrl.pathname,
				context.env?.VITE_API_URL,
				requestUrl.origin,
			);
			transformedHtml = injectPublicSectionListing(transformedHtml, listing);
		}
		const headers = new Headers(response.headers);
		headers.delete("content-length");
		headers.delete("content-encoding");
		if (missingSeoPage) {
			headers.set("cache-control", "no-store");
			headers.set("x-robots-tag", "noindex, nofollow");
		}
		return new Response(transformedHtml, {
			status: missingSeoPage ? 404 : response.status,
			statusText: missingSeoPage ? "Not Found" : response.statusText,
			headers,
		});
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
