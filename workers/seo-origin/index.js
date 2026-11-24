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

// A private Standard-class R2 bucket provides failover and prevents every
// crawler request from going through the home-cluster Tunnel.
const cachePrefix = "seo-public-json/v1/";
const freshForMs = 20 * 60 * 1000;
const staleForMs = 72 * 60 * 60 * 1000;
const maxCacheBytes = 4 * 1024 * 1024;
const responseHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, max-age=0",
  "x-content-type-options": "nosniff",
};

function cacheKey(url) {
  const copy = new URL(url.href);
  copy.searchParams.sort();
  return cachePrefix + encodeURIComponent(copy.pathname + copy.search);
}

async function getCached(env, key) {
  if (!env.SEO_CACHE || typeof env.SEO_CACHE.get !== "function") return null;
  try {
    const object = await env.SEO_CACHE.get(key);
    if (!object) return null;
    const stored = Number(object.customMetadata?.cachedAt);
    const age = Date.now() - stored;
    if (!Number.isFinite(stored) || stored <= 0 || age < -60000 || age > staleForMs) return null;
    return { object, age };
  } catch {
    // A broken cache should not affect the live API.
    return null;
  }
}

function fromCache(cached, method) {
  return new Response(method === "HEAD" ? null : cached.object.body, {
    status: 200,
    headers: responseHeaders,
  });
}

async function requestPublicJson(url, method, env, forceRefresh = false) {
  if (!isAllowedSeoRequest(url)) return new Response("Not found", { status: 404 });
  if (method !== "GET" && method !== "HEAD") return new Response("Method not allowed", { status: 405 });

  const key = cacheKey(url);
  const cached = await getCached(env, key);
  if (!forceRefresh && cached && cached.age <= freshForMs) return fromCache(cached, method);

  try {
    if (!env.PRIVATE_ORIGIN || typeof env.PRIVATE_ORIGIN.fetch !== "function") {
      throw new Error("No configured private origin");
    }
    // Always GET from the origin even for a HEAD request so it can warm R2.
    const upstream = await env.PRIVATE_ORIGIN.fetch(url.href, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "Atoman-SEO-Edge/1.0" },
      signal: AbortSignal.timeout(8500),
    });
    if (upstream.status >= 500) throw new Error("Upstream unavailable");
    if (upstream.status !== 200) {
      // 403/404/410 are authoritative: never resurrect removed/private content.
      return new Response(method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }
    if (!(upstream.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      throw new Error("Upstream returned non-JSON");
    }
    const body = await upstream.arrayBuffer();
    if (env.SEO_CACHE && body.byteLength > 0 && body.byteLength <= maxCacheBytes) {
      try {
        await env.SEO_CACHE.put(key, body, {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
          customMetadata: { cachedAt: String(Date.now()) },
        });
      } catch {
        // A failed cache write must not turn a successful read into a 503.
      }
    }
    return new Response(method === "HEAD" ? null : body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch {
    if (cached) return fromCache(cached, method);
    return new Response("SEO origin temporarily unavailable", {
      status: 503,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  }
}

// Warm only documented anonymous public read endpoints; no user-specific data.
const warmPaths = [
  "/api/v1/blog/seo/sitemap",
  "/api/v1/blog/posts?page=1&page_size=8",
  "/api/v1/blog/posts?page=1&page_size=20&view=summary",
  "/api/v1/music/songs?page=1&page_size=1",
  "/api/v1/music/songs?page=1&page_size=20&view=summary",
  "/api/v1/music/songs?page=2&page_size=20&view=summary",
  "/api/v1/music/artists?page=1&page_size=8",
  "/api/v1/music/artists?page=1&page_size=12",
  "/api/v1/music/artists?page=1&page_size=1000",
  "/api/v1/music/albums?page=1&page_size=8",
  "/api/v1/music/albums?page=1&page_size=12",
  "/api/v1/music/albums?page=1&page_size=1000",
  "/api/v1/forum/topics?page=1&page_size=8",
  "/api/v1/forum/topics?page=1&page_size=1000",
  "/api/v1/debate/topics?page=1&page_size=8",
  "/api/v1/debate/topics?page=1&page_size=1000",
  "/api/v1/podcast/episodes",
  "/api/v1/videos?sort=latest&page=1&page_size=8",
  "/api/v1/videos?sort=latest&page=1&page_size=1000",
  "/api/v1/books/works?limit=100&offset=0",
  "/api/v1/books/booklists?limit=100&offset=0",
  ...Array.from({ length: 11 }, (_, i) => "/api/v1/music/songs?page=" + (i + 1) + "&page_size=100"),
];

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
    return requestPublicJson(url, request.method, env);
  },
  async scheduled(_event, env) {
    // Sequential groups protect the VPS from a burst of parallel API reads.
    for (let index = 0; index < warmPaths.length; index += 4) {
      const batch = warmPaths.slice(index, index + 4);
      await Promise.allSettled(batch.map(async (path) => {
        const url = new URL("https://api.atoman.org" + path);
        if (isAllowedSeoRequest(url)) await requestPublicJson(url, "GET", env, true);
      }));
    }
  },
};
