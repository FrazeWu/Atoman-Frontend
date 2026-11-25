import { runtimeSeoHtmlCache, type SeoHtmlCache } from "./publicSeoHtmlEdgeCache";

// Use a short public and Cache API TTL to avoid repeatedly assembling XML
// without retaining an obsolete public catalogue for a long period.
export const sitemapCacheControl = "public, max-age=60, s-maxage=120";
const cacheNamespace = "atoman-public-sitemap-v1";
const ttlSeconds = 120;

export function publicSitemapCacheKey(request: Request): Request | undefined {
  if (request.method !== "GET" || ["cookie", "authorization", "range", "if-none-match",
    "if-modified-since", "if-match", "if-unmodified-since"].some((header) => request.headers.has(header))) return undefined;
  if (/\b(?:no-cache|no-store|max-age\s*=\s*0)\b/i.test(request.headers.get("cache-control") || "") ||
      /\bno-cache\b/i.test(request.headers.get("pragma") || "")) return undefined;

  const url = new URL(request.url);
  if (url.origin !== "https://www.atoman.org" || url.pathname !== "/sitemap.xml" || url.search) return undefined;
  return new Request(url.origin + "/__atoman_cache/" + cacheNamespace + "/sitemap.xml");
}

export function runtimeSitemapCache(): SeoHtmlCache | undefined {
  return runtimeSeoHtmlCache();
}

export async function readPublicSitemapCache(key: Request, cache: SeoHtmlCache): Promise<Response | undefined> {
  try {
    const response = await cache.match(key);
    if (!response || response.status !== 200 ||
        response.headers.get("x-atoman-sitemap-status") !== "complete" ||
        !(response.headers.get("content-type") || "").includes("application/xml") ||
        response.headers.has("set-cookie")) return undefined;
    const headers = new Headers(response.headers);
    headers.set("cache-control", sitemapCacheControl);
    headers.set("x-atoman-sitemap-cache", "HIT");
    return new Response(response.body, { status: 200, headers });
  } catch { return undefined; }
}

export function queuePublicSitemapCache(key: Request, response: Response, cache: SeoHtmlCache,
  waitUntil: (job: Promise<unknown>) => void) {
  if (response.status !== 200 || response.headers.get("x-atoman-sitemap-status") !== "complete" ||
      !(response.headers.get("content-type") || "").includes("application/xml") ||
      response.headers.has("set-cookie") || /\b(?:no-store|private|no-cache)\b/i.test(response.headers.get("cache-control") || "")) return;
  try {
    const headers = new Headers(response.headers);
    headers.set("cache-control", "public, max-age=" + ttlSeconds);
    const cached = new Response(response.clone().body, { status: 200, headers });
    waitUntil(cache.put(key, cached).catch(() => undefined));
  } catch { /* Optional cache must not break the public sitemap. */ }
}
