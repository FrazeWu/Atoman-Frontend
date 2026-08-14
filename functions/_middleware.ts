import { buildStaticPageHtml } from "./_lib/pageSeo";

type MiddlewareContext = {
	request: Request;
	next: () => Promise<Response>;
};

export async function onRequest(context: MiddlewareContext) {
	const response = await context.next();
	const contentType = response.headers.get("content-type") || "";
	if (!contentType.includes("text/html")) return response;

	try {
		const requestUrl = new URL(context.request.url);
		const html = await response.clone().text();
		const headers = new Headers(response.headers);
		headers.delete("content-length");
		return new Response(
			buildStaticPageHtml(html, requestUrl.pathname, requestUrl.hostname),
			{
				status: response.status,
				statusText: response.statusText,
				headers,
			},
		);
	} catch {
		return response;
	}
}
