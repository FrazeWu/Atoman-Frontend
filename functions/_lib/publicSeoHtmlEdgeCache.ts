// Cache only anonymous, verified-public SEO HTML in a data-center local Cache API.
// This is an opportunistic performance layer; all misses use the existing
// server-rendering path and its private Worker/R2/VPC failover.
// Public content can be updated or removed, so the TTL is deliberately short.
const publicSections = new Set([
  "/", "/feed", "/posts", "/posts/articles",
  "/books", "/books/lists", "/music", "/music/artists", "/music/albums",
  "/music/songs", "/forum", "/debate", "/podcasts", "/videos",
  "/about", "/timeline",
]);
const details = /^\/(?:music\/(?:artist|album|song)|books\/(?:work|edition)|posts\/post|forum\/topic)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const archivePaths = new Set(["/posts/articles", "/music/songs"]);
const cacheVersion = "atoman-public-seo-html-v3";
const edgeTtlSeconds = 75;

export type SeoHtmlCache = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
};

export function publicSeoHtmlKey(request: Request): Request | undefined {
  if (request.method !== "GET") return undefined;
  if (["cookie", "authorization", "range", "if-none-match", "if-modified-since"].some((h) => request.headers.has(h)))
    return undefined;
  if (request.headers.get("cache-control")?.includes("no-cache") || request.headers.get("pragma")?.includes("no-cache"))
    return undefined;
  const accept = request.headers.get("accept") || "";
  if (accept.includes("application/json") && !accept.includes("text/html")) return undefined;

  let url: URL;
  try { url = new URL(request.url); } catch { return undefined; }
  if (url.protocol !== "https:") return undefined;
  if (url.hostname !== "www.atoman.org" && !/^[a-z0-9-]+\.atoman-frontend\.pages\.dev$/i.test(url.hostname))
    return undefined;

  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!publicSections.has(path) && !details.test(path)) return undefined;
  const keys = [...url.searchParams.keys()];
  if (keys.length) {
    if (!archivePaths.has(path) || keys.length !== 1 || keys[0] !== "page") return undefined;
    const p = url.searchParams.get("page") || "";
    if (!/^[1-9][0-9]{0,3}$/.test(p) || Number(p) > 5000) return undefined;
  }
  // A synthetic namespaced key prevents collisions with public asset caching.
  const key = new URL("/__atoman_cache/" + cacheVersion + path, url.origin);
  if (keys.length) key.search = "?page=" + url.searchParams.get("page");
  return new Request(key.href, { method: "GET" });
}

export function canStorePublicSeoHtml(
  response: Response,
  isPreview: boolean,
  completePublicData: boolean,
): boolean {
  if (!completePublicData || response.status !== 200 ||
      !response.headers.get("content-type")?.toLowerCase().includes("text/html") ||
      response.headers.has("set-cookie")) return false;
  const cacheControl = response.headers.get("cache-control") || "";
  if (/\b(?:private|no-store|no-cache)\b/i.test(cacheControl)) return false;
  const vary = response.headers.get("vary") || "";
  if (vary === "*" || /\b(?:cookie|authorization)\b/i.test(vary)) return false;
  if (!isPreview && /\bnoindex\b/i.test(response.headers.get("x-robots-tag") || "")) return false;
  return true;
}

export async function cachedPublicSeoHtml(key: Request, store?: SeoHtmlCache): Promise<Response | undefined> {
  if (!store) return undefined;
  try {
    const matched = await store.match(key);
    if (!matched) return undefined;
    const headers = new Headers(matched.headers);
    // Don't add a second, long-lived browser cache on top of the short edge TTL.
    headers.set("cache-control", "public, max-age=0, must-revalidate");
    headers.set("x-atoman-seo-html-cache", "HIT");
    return new Response(matched.body, { status: 200, headers });
  } catch {
    return undefined;
  }
}

export function queuePublicSeoHtml(
  key: Request,
  response: Response,
  store?: SeoHtmlCache,
  waitUntil?: (promise: Promise<unknown>) => void,
) {
  if (!store || !waitUntil) return;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=" + edgeTtlSeconds);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");
  const copy = new Response(response.clone().body, { status: 200, headers });
  waitUntil(store.put(key, copy).catch(() => undefined));
}

export function runtimeSeoHtmlCache(): SeoHtmlCache | undefined {
  return (globalThis as unknown as { caches?: { default?: SeoHtmlCache } }).caches?.default;
}
