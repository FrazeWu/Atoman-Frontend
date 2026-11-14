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
});
