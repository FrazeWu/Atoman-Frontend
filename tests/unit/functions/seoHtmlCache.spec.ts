import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cachedPublicSeoHtml, canStorePublicSeoHtml,
  publicSeoHtmlKey, publicSeoHtmlKeyForShell, queuePublicSeoHtml,
} from "../../../functions/_lib/publicSeoHtmlEdgeCache";
import { onRequest as pageMiddleware } from "../../../functions/_middleware";

const releaseA = "a".repeat(64);
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
      expect(publicSeoHtmlKey(new Request(url), releaseA), url).toBeDefined();
    }
    expect(publicSeoHtmlKey(new Request(detail), releaseA)?.url).toContain("__atoman_cache/");
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
    ]) expect(publicSeoHtmlKey(new Request(url), releaseA), url).toBeUndefined();
  });

  it("rejects cookie/authenticated or conditional requests before reading cache", () => {
    for (const h of ["cookie", "authorization", "range", "if-none-match",
      "if-modified-since", "cache-control", "pragma"]) {
      const value = h === "cache-control" || h === "pragma" ? "no-cache" : "x";
      expect(publicSeoHtmlKey(new Request(detail, { headers: { [h]: value } }), releaseA), h).toBeUndefined();
    }
    expect(publicSeoHtmlKey(new Request(detail, {
      headers: { accept: "application/json" },
    }), releaseA)).toBeUndefined();
    expect(publicSeoHtmlKey(new Request(detail, { method: "POST" }), releaseA)).toBeUndefined();
  });

  it("uses different keys for different deployed shells at the same public URL", async () => {
    const request = new Request(detail);
    const a = await publicSeoHtmlKeyForShell(request, '<script src="/assets/index-aaaaaaaa.js"></script>');
    const b = await publicSeoHtmlKeyForShell(request, '<script src="/assets/index-bbbbbbbb.js"></script>');
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a?.url).not.toBe(b?.url);
    expect((await publicSeoHtmlKeyForShell(request, '<script src="/assets/index-aaaaaaaa.js"></script>'))?.url).toBe(a?.url);
    expect(publicSeoHtmlKey(request, "untrusted-release-id")).toBeUndefined();
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
    const key = publicSeoHtmlKey(new Request(detail), releaseA)!;
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

  it("never serves a previous deployment shell after a release switch", async () => {
    const cache = fakeCache();
    const previous = (globalThis as any).caches;
    (globalThis as any).caches = { default: cache };
    try {
      let entry = "index-aaaaaaaa.js";
      const next = vi.fn(async () => new Response(
        '<html><head><title>Atoman</title><script src="/assets/' + entry + '"></script></head><body><div id="app"></div></body></html>',
        { headers: { "content-type": "text/html", "cache-control": "public, max-age=0" } },
      ));
      const jobs: Promise<unknown>[] = [];
      const ctx = { request: new Request("https://www.atoman.org/about"), next, waitUntil: (p: Promise<unknown>) => { jobs.push(p); } };
      expect(await (await pageMiddleware(ctx)).text()).toContain("index-aaaaaaaa.js");
      await Promise.all(jobs);
      expect((await pageMiddleware(ctx)).headers.get("x-atoman-seo-html-cache")).toBe("HIT");
      entry = "index-bbbbbbbb.js";
      const newPage = await pageMiddleware(ctx);
      expect(newPage.headers.get("x-atoman-seo-html-cache")).toBeNull();
      const html = await newPage.text();
      expect(html).toContain("index-bbbbbbbb.js");
      expect(html).not.toContain("index-aaaaaaaa.js");
      await Promise.all(jobs);
      expect(cache.entries.size).toBe(2);
      expect((await pageMiddleware(ctx)).headers.get("x-atoman-seo-html-cache")).toBe("HIT");
    } finally {
      (globalThis as any).caches = previous;
    }
  });

  it("serves archived assets even on a plain 404 and never caches a missing script as HTML", async () => {
    const request = new Request("https://www.atoman.org/assets/index-aaaaaaaa.js");
    const get = vi.fn(async () => ({
      body: new Response("export {};").body!,
      httpEtag: '"archive"',
      httpMetadata: { contentType: "application/javascript" },
    }));
    const archived = await pageMiddleware({ request, env: { FRONTEND_RELEASE_ASSETS: { get } },
      next: async () => new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } }) });
    expect(archived.status).toBe(200);
    expect(await archived.text()).toBe("export {};");
    expect(get).toHaveBeenCalledWith("assets/index-aaaaaaaa.js");
    for (const status of [200, 404]) {
      const missing = await pageMiddleware({ request, next: async () => new Response("<html>SPA</html>", {
        status, headers: { "content-type": "text/html", "cache-control": "public, max-age=31536000" },
      }) });
      expect(missing.status).toBe(404);
      expect(missing.headers.get("cache-control")).toBe("no-store");
      expect(missing.headers.get("content-type")).toContain("text/plain");
    }
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
      expect(next).toHaveBeenCalledTimes(2);
    } finally {
      (globalThis as any).caches = previous;
    }
  });
});
