import { afterEach, describe, expect, it, vi } from "vitest";
import { injectPublicSectionListing, loadPublicSectionListing } from "../../../functions/_lib/sectionContentSeo";
import { onRequest as pageMiddleware } from "../../../functions/_middleware";

function json(items: unknown, status = 200) {
  return new Response(JSON.stringify({ data: items }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const shell = '<!doctype html><html><head><title>Atoman</title></head><body><div id="app"><!-- seo-prerender-start --><div class="portal-prerender"><h1>首页</h1></div><!-- seo-prerender-end --></div></body></html>';

afterEach(() => vi.unstubAllGlobals());

describe("public section SEO link previews", () => {
  it("links only active public content, escaping text and preserving canonical routes", async () => {
    const fetcher = vi.fn(async () => json([
      { id: "work-1", title: '<三体> & beyond', lifecycle_status: "active" },
      { id: "work-2", title: "退役图书", lifecycle_status: "archived" },
      { id: "invalid!", title: "无效标识", lifecycle_status: "active" },
    ])) as unknown as typeof fetch;
    const listing = await loadPublicSectionListing("/books", undefined, "https://www.atoman.org", fetcher);
    expect(listing).toContain('href="/books/work/work-1"');
    expect(listing).toContain('&lt;三体&gt; &amp; beyond');
    expect(listing).not.toContain("退役图书");
    expect(listing).not.toContain("无效标识");
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.atoman.org/api/v1/books/works",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
  });

  it("renders multiple music groups and escapes descriptions safely", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("/albums")
      ? json([{ id: "album-1", title: "公开专辑", description: '<b>专辑介绍</b> & 作品', lifecycle_status: "active", status: "open" }])
      : json([{ id: "artist-1", name: "艺人", lifecycle_status: "active", entry_status: "open" }])) as unknown as typeof fetch;
    const listing = await loadPublicSectionListing("/music", undefined, "https://www.atoman.org", fetcher);
    expect(listing).toContain('href="/music/album/album-1"');
    expect(listing).toContain('href="/music/artist/artist-1"');
    expect(listing).toContain("专辑介绍 &amp; 作品");
    expect(listing).not.toContain("<b>");
    expect(listing).toContain("音乐专辑");
    expect(listing).toContain("音乐人");
  });

  it.each([
    ["/music/albums", "albums", "/music/album/", "title"],
    ["/music/artists", "artists", "/music/artist/", "name"],
  ])("exposes up to 12 public detail links on %s", async (page, apiName, prefix, labelField) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({data: Array.from({length: 14}, (_, i) => ({
      id: `record-${i}`, [labelField]: `公开内容 ${i}`, lifecycle_status: i === 2 ? "retired" : "active", status: "open",
    }))}), {headers:{"content-type":"application/json"}})) as unknown as typeof fetch;
    const listing = await loadPublicSectionListing(page, undefined, "https://www.atoman.org", fetcher);
    expect(listing).toContain(`${prefix}record-0`);
    expect(listing).not.toContain(`${prefix}record-2`);
    expect(listing).toContain(`${prefix}record-12`);
    expect(listing).not.toContain(`${prefix}record-13`);
    expect((listing.match(/<li>/g) || []).length).toBe(12);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/music/${apiName}?page=1&page_size=12`),expect.any(Object));
  });

  it("accepts raw video arrays and excludes non-public videos", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([
      { id: "video-1", title: "公开视频", visibility: "public", status: "published" },
      { id: "video-2", title: "私密视频", visibility: "private", status: "published" },
      { id: "video-3", title: "草稿视频", visibility: "public", status: "draft" },
    ]), { headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const listing = await loadPublicSectionListing("/videos", undefined, "https://www.atoman.org", fetcher);
    expect(listing).toContain('href="/videos/watch/video-1"');
    expect(listing).not.toContain("私密视频");
    expect(listing).not.toContain("草稿视频");
  });

  it("fails open for unavailable APIs and does not rewrite non-section pages", async () => {
    const failing = vi.fn(async () => { throw new Error("503"); }) as unknown as typeof fetch;
    const listing = await loadPublicSectionListing("/videos", undefined, "https://www.atoman.org", failing);
    expect(listing).toBe("");
    expect(injectPublicSectionListing(shell, '<section>dummy</section>')).toBe(shell);
    expect(await loadPublicSectionListing("/login", undefined, "https://www.atoman.org", failing)).toBe("");
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it("adds real article links to the server-rendered section in middleware", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([
      { id: "post-1", title: "新文章", status: "published", visibility: "public", summary: "文章摘要" },
      { id: "post-2", title: "私密文章", status: "published", visibility: "private" },
      { id: "post-3", title: "未发布文章", status: "draft", visibility: "public" },
    ])));
    const response = await pageMiddleware({
      request: new Request("https://www.atoman.org/posts"),
      next: async () => new Response(shell, { headers: { "content-type": "text/html" } }),
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('<h1>博客</h1>');
    expect(html).toContain('href="/posts/post/post-1"');
    expect(html).toContain("文章摘要");
    expect(html).not.toContain("私密文章");
    expect(html).not.toContain("未发布文章");
    expect(html).toContain('rel="canonical" href="https://www.atoman.org/posts"');
    expect(html).not.toContain('name="robots" content="noindex');
  });

  it("leaves noindex and 404 behavior alone", async () => {
    const mock = vi.fn(async () => json([]));
    vi.stubGlobal("fetch", mock);
    for (const [path, status] of [["/search", 200], ["/not-a-route", 404]] as const) {
      const r = await pageMiddleware({
        request: new Request("https://www.atoman.org" + path),
        next: async () => new Response(shell, { headers: { "content-type": "text/html" } }),
      });
      expect(r.status).toBe(status);
      expect(await r.text()).toContain('content="noindex, nofollow"');
    }
    expect(mock).not.toHaveBeenCalled();
  });
  it("paginates public article archives with crawlable links and self-canonical HTML", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: "post-page-2", title: "旧文章", status: "published", visibility: "public" }],
      meta: { page: 2, page_size: 20, total: 55, has_more: true },
    }), { headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const listing = await loadPublicSectionListing(
      "/posts/articles", undefined, "https://www.atoman.org", fetcher,
      new URLSearchParams("page=2"),
    );
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/blog/posts?page=2&page_size=20&view=summary"),
      expect.any(Object),
    );
    expect(listing).toContain('href="/posts/post/post-page-2"');
    expect(listing).toContain('rel="prev" href="/posts/articles"');
    expect(listing).toContain('rel="next" href="/posts/articles?page=3"');

    vi.stubGlobal("fetch", fetcher);
    const response = await pageMiddleware({
      request: new Request("https://www.atoman.org/posts/articles?page=2"),
      next: async () => new Response(shell, { headers: { "content-type": "text/html" } }),
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('rel="canonical" href="https://www.atoman.org/posts/articles?page=2"');
    expect(html).toContain('href="/posts/post/post-page-2"');
    expect(html).not.toContain('name="robots" content="noindex');
  });

  it("paginates the real song archive and refuses filter or invalid page combinations", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: "song-page-3", title: "未曾发现的歌", lifecycle_status: "active" }],
      meta: { page: 3, page_size: 20, total: 41, has_more: false },
    }), { headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    const listing = await loadPublicSectionListing(
      "/music/songs", undefined, "https://www.atoman.org", fetcher,
      new URLSearchParams("page=3"),
    );
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/music/songs?page=3&page_size=20&view=summary"),
      expect.any(Object),
    );
    expect(listing).toContain('href="/music/song/song-page-3"');
    expect(listing).toContain('rel="prev" href="/music/songs?page=2"');
    expect(listing).not.toContain('rel="next"');
    expect(await loadPublicSectionListing(
      "/music/songs", undefined, "https://www.atoman.org", fetcher,
      new URLSearchParams("q=private&page=3"),
    )).toBe("");
    expect(await loadPublicSectionListing(
      "/music/songs", undefined, "https://www.atoman.org", fetcher,
      new URLSearchParams("page=-1"),
    )).toBe("");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });


  it("returns a real noindex 404 for successful empty archive pages beyond the last page", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: [],
      meta: { page: 2, page_size: 20, total: 14, has_more: false },
    }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);
    for (const path of ["/posts/articles?page=2", "/music/songs?page=500"]) {
      const response = await pageMiddleware({
        request: new Request("https://www.atoman.org" + path),
        env: { VITE_API_URL: "https://api.atoman.org/api" },
        next: async () => new Response(shell, { headers: { "content-type": "text/html" } }),
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = await response.text();
      expect(body).toContain("noindex");
      expect(body).not.toContain('rel="canonical"');
      expect(body).not.toContain('data-seo-public-listing="true"');
    }
  });

  it("does not treat an unavailable listing API as a missing archive page", async () => {
    const fetcher = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await pageMiddleware({
      request: new Request("https://www.atoman.org/posts/articles?page=2"),
      env: { VITE_API_URL: "https://api.atoman.org/api" },
      next: async () => new Response(shell, { headers: { "content-type": "text/html" } }),
    });
    expect(response.status).toBe(200);
  });
});
