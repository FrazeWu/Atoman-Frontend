import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cachedPublicSeoHtml, canStorePublicSeoHtml,
  publicSeoHtmlKey, queuePublicSeoHtml,
} from "../../../functions/_lib/publicSeoHtmlEdgeCache";
import { onRequest as pageMiddleware } from "../../../functions/_middleware";

const detail = "https://www.atoman.org/music/artist/01a06fbd-cbee-7a51-a378-b2732a9137a9";

function fakeCache() {
  const entries = new Map<string, Response>();
  return {
    entries,
    match: vi.fn(async (key: Request) => entries.get(key.url)?.clone()),
    put: vi.fn(async (key: Request, response: Response) => { entries.set(key.url, response.clone()); }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("short-lived anonymous public HTML edge cache", () => {
  it("only allows canonical anonymous public pages and recognized pagination", () => {
    for (const url of [detail, "https://www.atoman.org/posts/articles?page=2",
      "https://www.atoman.org/", "https://www.atoman.org/books"]) {
      expect(publicSeoHtmlKey(new Request(url)), url).toBeDefined();
    }
    expect(publicSeoHtmlKey(new Request(detail))?.url).toContain("__atoman_cache/");
    for (const url of [
      "https://api.atoman.org/music/songs",
      "https://atoman.org/books",
      "https://www.atoman.org/music/history",
      "https://www.atoman.org/mail",
      "https://www.atoman.org/posts/articles?page=0",
      "https://www.atoman.org/posts/articles?page=9999",
      "https://www.atoman.org/posts/articles?page=2&sort=latest",
      "https://www.atoman.org/music/song/invalid",
      "https://www.atoman.org/posts/post/bad",
      "http://www.atoman.org/music",
    ]) expect(publicSeoHtmlKey(new Request(url)), url).toBeUndefined();
  });

  it("rejects cookie/authenticated or conditional requests before reading cache", () => {
    for (const h of ["cookie", "authorization", "range", "if-none-match",
      "if-modified-since", "cache-control", "pragma"]) {
      const value = h === "cache-control" || h === "pragma" ? "no-cache" : "x";
      expect(publicSeoHtmlKey(new Request(detail, { headers: { [h]: value } })), h).toBeUndefined();
    }
    expect(publicSeoHtmlKey(new Request(detail, {
      headers: { accept: "application/json" },
    }))).toBeUndefined();
    expect(publicSeoHtmlKey(new Request(detail, { method: "POST" }))).toBeUndefined();
  });

  it("never caches missing, private, incomplete, set-cookie, or 5xx pages", () => {
    const html = (status: number, headers: Record<string, string> = {}) =>
      new Response("<html>public</html>", {
        status, headers: { "content-type": "text/html", ...headers },
      });
    expect(canStorePublicSeoHtml(html(200), false, true)).toBe(true);
    expect(canStorePublicSeoHtml(html(404), false, true)).toBe(false);
    expect(canStorePublicSeoHtml(html(503), false, true)).toBe(false);
    expect(canStorePublicSeoHtml(html(200), false, false)).toBe(false);
    expect(canStorePublicSeoHtml(html(200, { "set-cookie": "session=123" }), false, true)).toBe(false);
    expect(canStorePublicSeoHtml(html(200, { "cache-control": "no-store" }), false, true)).toBe(false);
    expect(canStorePublicSeoHtml(html(200, { vary: "Cookie" }), false, true)).toBe(false);
    expect(canStorePublicSeoHtml(html(200, { "x-robots-tag": "noindex" }), false, true)).toBe(false);
    expect(canStorePublicSeoHtml(html(200, { "x-robots-tag": "noindex" }), true, true)).toBe(true);
    expect(canStorePublicSeoHtml(new Response("{}", {
      headers: { "content-type": "application/json" },
    }), false, true)).toBe(false);
  });

  it("stores with a bounded TTL without altering the visitor's original headers", async () => {
    const cache = fakeCache();
    const key = publicSeoHtmlKey(new Request(detail))!;
    const response = new Response("Public music profile", {
      headers: { "content-type": "text/html", "cache-control": "public, max-age=0", etag: "irrelevant" },
    });
    const work: Promise<unknown>[] = [];
    queuePublicSeoHtml(key, response, cache, (p) => { work.push(p); });
    await Promise.all(work);
    expect(cache.put).toHaveBeenCalledTimes(1);
    expect(cache.entries.get(key.url)?.headers.get("cache-control")).toBe("public, max-age=75");
    expect(cache.entries.get(key.url)?.headers.has("etag")).toBe(false);
    const hit = (await cachedPublicSeoHtml(key, cache))!;
    expect(hit.headers.get("x-atoman-seo-html-cache")).toBe("HIT");
    expect(hit.headers.get("cache-control")).toContain("max-age=0");
    expect(await hit.text()).toBe("Public music profile");
    expect(response.headers.get("cache-control")).toBe("public, max-age=0");
  });

  it("respects noindex preview and skips generation on subsequent hits", async () => {
    const cache = fakeCache();
    const previous = (globalThis as any).caches;
    (globalThis as any).caches = { default: cache };
    try {
      const next = vi.fn(async () => new Response(
        '<!doctype html><html><head><title>Atoman</title></head><body><div id="app"></div></body></html>',
        { headers: { "content-type": "text/html", "x-robots-tag": "noindex",
          "cache-control": "public, max-age=0" } },
      ));
      const wait: Promise<unknown>[] = [];
      const request = new Request("https://preview.atoman-frontend.pages.dev/about");
      const context = { request, next, waitUntil: (p: Promise<unknown>) => { wait.push(p); } };
      const first = await pageMiddleware(context);
      expect(first.status).toBe(200);
      await Promise.all(wait);
      expect(cache.put).toHaveBeenCalledTimes(1);
      const second = await pageMiddleware(context);
      expect(second.status).toBe(200);
      expect(second.headers.get("x-robots-tag")).toBe("noindex");
      expect(second.headers.get("x-atoman-seo-html-cache")).toBe("HIT");
      expect(next).toHaveBeenCalledTimes(1);
    } finally {
      (globalThis as any).caches = previous;
    }
  });
});
