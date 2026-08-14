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

export async function onRequest(context: MiddlewareContext) {
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
