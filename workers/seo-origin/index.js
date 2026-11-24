// Private Pages -> Worker service binding -> pinned Workers VPC origin.
// This script intentionally has no public route and never forwards cookies or credentials.
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const safeSlug = "[a-zA-Z0-9_-]{1,100}";
const fixedPaths = new Set([
  "/api/v1/blog/posts",
  "/api/v1/blog/seo/sitemap",
  "/api/v1/books/works",
  "/api/v1/books/booklists",
  "/api/v1/music/artists",
  "/api/v1/music/albums",
  "/api/v1/music/songs",
  "/api/v1/forum/topics",
  "/api/v1/debate/topics",
  "/api/v1/podcast/episodes",
  "/api/v1/videos",
]);
const dynamicPaths = [
  new RegExp("^/api/v1/blog/seo/posts/" + uuid + "$", "i"),
  new RegExp("^/api/v1/books/(works|booklists)/" + uuid + "$", "i"),
  new RegExp("^/api/v1/books/wiki/edition/" + uuid + "$", "i"),
  new RegExp("^/api/v1/music/(artists|albums|songs)/" + uuid + "$", "i"),
  new RegExp("^/api/v1/(forum|debate)/topics/" + uuid + "$", "i"),
  new RegExp("^/api/v1/podcast/episodes/" + uuid + "$", "i"),
  new RegExp("^/api/v1/podcast/channels/" + safeSlug + "/episodes$"),
  new RegExp("^/api/v1/videos/" + uuid + "$", "i"),
];

const queryKeys = new Set(["page", "page_size", "sort", "view", "limit", "offset", "collection_id"]);
export function isAllowedSeoRequest(url) {
  if (url.protocol !== "https:" || url.hostname !== "api.atoman.org" || url.port) return false;
  if (!fixedPaths.has(url.pathname) && !dynamicPaths.some((rule) => rule.test(url.pathname))) return false;
  if ([...url.searchParams.keys()].some((key) => !queryKeys.has(key))) return false;
  if ([...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1)) return false;
  for (const key of ["page", "page_size", "limit", "offset"]) {
    const val = url.searchParams.get(key);
    if (val !== null && (!/^[0-9]{1,7}$/.test(val) || Number(val) > 1000000)) return false;
  }
  if (url.searchParams.has("page_size") && Number(url.searchParams.get("page_size")) > 1000) return false;
  if (url.searchParams.has("view") && url.searchParams.get("view") !== "summary") return false;
  if (url.searchParams.has("sort") && !["latest", "recent", "hot", "release_date", "-release_date"].includes(url.searchParams.get("sort"))) return false;
  const cid = url.searchParams.get("collection_id");
  if (cid !== null && !new RegExp("^" + uuid + "$", "i").test(cid)) return false;
  return true;
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    if (!isAllowedSeoRequest(url)) {
      return new Response("Not found", { status: 404 });
    }
    if (!env.PRIVATE_ORIGIN || typeof env.PRIVATE_ORIGIN.fetch !== "function") {
      return new Response("Origin unavailable", { status: 503 });
    }
    try {
      const upstream = await env.PRIVATE_ORIGIN.fetch(url.href, {
        method: request.method,
        headers: { Accept: "application/json", "User-Agent": "Atoman-SEO-Edge/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      const contentType = upstream.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return new Response("Origin returned non-JSON", { status: 502 });
      }
      return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "private, max-age=0",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return new Response("Origin unavailable", { status: 503 });
    }
  },
};
