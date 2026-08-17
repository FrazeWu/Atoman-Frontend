import { buildStaticPageHtml } from "./_lib/pageSeo";
import {
	buildMissingPublicContentHtml,
	buildPublicContentHtml,
	buildUnresolvedPublicContentHtml,
	resolvePublicContentSeo,
} from "./_lib/publicContentSeo";

type MiddlewareContext = {
	request: Request;
	env?: { VITE_API_URL?: string };
	next: () => Promise<Response>;
};

const legacyRouteRedirects: Record<string, string> = {
	"/podcast": "/podcasts",
	"/video": "/videos",
};

function redirectLegacyRoute(request: Request) {
	if (request.method !== "GET" && request.method !== "HEAD") return undefined;

	try {
		const requestUrl = new URL(request.url);
		const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";
		const destination = legacyRouteRedirects[pathname];
		if (!destination) return undefined;

		requestUrl.pathname = destination;
		return Response.redirect(requestUrl, 301);
	} catch {
		return undefined;
	}
}

export async function onRequest(context: MiddlewareContext) {
	const redirect = redirectLegacyRoute(context.request);
	if (redirect) return redirect;

	const response = await context.next();
	const contentType = response.headers.get("content-type") || "";
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
		const transformedHtml = lookup.content
			? buildPublicContentHtml(staticHtml, lookup.content)
			: lookup.retryable
				? buildUnresolvedPublicContentHtml(staticHtml)
				: lookup.matched
					? buildMissingPublicContentHtml(staticHtml)
					: staticHtml;
		const headers = new Headers(response.headers);
		headers.delete("content-length");
		return new Response(transformedHtml, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	} catch {
		return response;
	}
}
