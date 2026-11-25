import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest as sitemapHandler } from "../../../functions/sitemap.xml";
import { publicSitemapCacheKey } from "../../../functions/_lib/publicSitemapEdgeCache";

const sitemapUrl = "https://www.atoman.org/sitemap.xml";
const json = (data: unknown, meta?: unknown) => new Response(JSON.stringify({ data, ...(meta ? { meta } : {}) }));
const pathOf = (input: RequestInfo | URL) => new URL(String(input)).pathname;
function completeFixture(input: RequestInfo | URL) {
  const path = pathOf(input);
  if (path.endsWith("/blog/seo/sitemap")) return json([{ path: "/posts/post/article-1" }]);
  if (path.endsWith("/books/works") || path.endsWith("/books/booklists")) return json({ items: [], total: 0 });
  if (path.endsWith("/music/artists")) return json([{ id: "artist-1" }], { total: 1, has_more: false });
  return json([]);
}
function setupCache() {
  const entries = new Map<string, Response>();
  const cache = {
    entries,
    match: vi.fn(async (key: Request) => entries.get(key.url)?.clone()),
    put: vi.fn(async (key: Request, response: Response) => { entries.set(key.url, response.clone()); }),
  };
  const jobs: Promise<unknown>[] = [];
  vi.stubGlobal("caches", { default: cache });
  return { cache, jobs, context: { request: new Request(sitemapUrl), env: {}, waitUntil: (job: Promise<unknown>) => jobs.push(job) } };
}
afterEach(() => vi.unstubAllGlobals());

describe("short-lived complete public sitemap cache", () => {
  it("bypasses noncanonical, authenticated, conditional and explicit refresh requests", () => {
    expect(publicSitemapCacheKey(new Request(sitemapUrl))?.url).toContain("/__atoman_cache/");
    for (const url of ["https://atoman.org/sitemap.xml", sitemapUrl + "?x=1", "https://www.atoman.org/sitemap-songs.xml", "http://www.atoman.org/sitemap.xml"])
      expect(publicSitemapCacheKey(new Request(url))).toBeUndefined();
    for (const [name, value] of [["cookie", "a=1"], ["authorization", "Bearer example"], ["range", "bytes=0-1"], ["if-none-match", "x"], ["if-modified-since", "x"], ["cache-control", "max-age=0"], ["cache-control", "no-store"], ["pragma", "no-cache"]])
      expect(publicSitemapCacheKey(new Request(sitemapUrl, { headers: { [name]: value } })), name).toBeUndefined();
    expect(publicSitemapCacheKey(new Request(sitemapUrl, { method: "HEAD" }))).toBeUndefined();
  });

  it("avoids all nine upstream reads on the next anonymous request and preserves XML", async () => {
    const { cache, jobs, context } = setupCache();
    const fetcher = vi.fn(async (input: RequestInfo | URL) => completeFixture(input));
    vi.stubGlobal("fetch", fetcher);
    const first = await sitemapHandler(context);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-atoman-sitemap-status")).toBe("complete");
    const xml = await first.text();
    expect(xml).toContain("/music/artist/artist-1");
    expect(xml).toContain("/posts/post/article-1");
    await Promise.all(jobs);
    expect(fetcher).toHaveBeenCalledTimes(9);
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect([...cache.entries.values()][0].headers.get("cache-control")).toBe("public, max-age=120");
    const second = await sitemapHandler(context);
    expect(second.headers.get("x-atoman-sitemap-cache")).toBe("HIT");
    expect(await second.text()).toBe(xml);
    expect(fetcher).toHaveBeenCalledTimes(9);
    const bypass = await sitemapHandler({ ...context, request: new Request(sitemapUrl, { headers: { "cache-control": "no-cache" } }) });
    expect(bypass.headers.get("x-atoman-sitemap-cache")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(18);
  });

  it.each(["upstream", "malformed", "truncated", "missing-page", "book-total"])("never stores an incomplete %s catalogue", async (failure) => {
    const { cache, jobs, context } = setupCache();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = pathOf(input);
      if (failure === "book-total" && path.endsWith("/books/works")) return json({ items: [], total: 7 });
      if (failure === "missing-page" && path.endsWith("/podcast/episodes")) return json([{ id: "episode-1" }], { has_more: true, total: 3 });
      if (path.endsWith("/music/artists")) {
        if (failure === "upstream") return new Response("unavailable", { status: 503 });
        if (failure === "malformed") return json({ unexpected: [] });
        if (failure === "truncated") return json([{ id: "artist-1" }], { total: 2, has_more: false });
      }
      return completeFixture(input);
    }));
    const response = await sitemapHandler(context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-atoman-sitemap-status")).toBe("partial");
    expect(await response.text()).toContain("/posts/post/article-1");
    await Promise.all(jobs);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("never stores static fallback after blog source failure", async () => {
    const { cache, jobs, context } = setupCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    const response = await sitemapHandler(context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-atoman-sitemap-status")).toBe("partial");
    await Promise.all(jobs);
    expect(cache.put).not.toHaveBeenCalled();
  });
});
