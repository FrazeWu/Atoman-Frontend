import { afterEach, describe, expect, it, vi } from "vitest";
import { createSeoApiFetcher } from "../../../functions/_lib/seoOriginFetcher";
import { onRequest as articleHandler } from "../../../functions/posts/post/[id]";

afterEach(() => vi.unstubAllGlobals());

describe("Pages SEO service binding", () => {
  it("uses a private service for canonical API GETs and strips user headers", async () => {
    const binding = { fetch: vi.fn(async () => new Response(JSON.stringify({ data: [] }))) };
    const publicFetch = vi.fn(async () => new Response("fallback"));
    vi.stubGlobal("fetch", publicFetch);
    const fetcher = createSeoApiFetcher(binding);
    const response = await fetcher("https://api.atoman.org/api/v1/blog/posts?page=1", {
      headers: { Authorization: "Bearer hidden", Cookie: "private" },
    });
    expect(response.status).toBe(200);
    expect(binding.fetch).toHaveBeenCalledWith(
      "https://api.atoman.org/api/v1/blog/posts?page=1",
      expect.objectContaining({ method: "GET", headers: { Accept: "application/json" } }),
    );
    expect(publicFetch).not.toHaveBeenCalled();
    await fetcher("https://elsewhere.example/test");
    expect(publicFetch).toHaveBeenCalledTimes(1);
  });

  it("renders blog metadata when the public API would be challenged", async () => {
    const binding = { fetch: vi.fn(async () => new Response(JSON.stringify({
      data: { id: "post-1", title: "Public", description: "Article summary", image_url: "",
        author_name: "Author", published_at: null, updated_at: "2026-11-24T00:00:00Z",
        path: "/posts/post/post-1" },
    }))) };
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Blocked", { status: 403 })));
    const response = await articleHandler({
      request: new Request("https://www.atoman.org/posts/post/post-1"),
      env: { SEO_ORIGIN: binding },
      params: { id: "post-1" },
      next: async () => new Response("<html><head></head><body><div id=\"app\"></div></body></html>", {
        headers: { "content-type": "text/html" },
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-atoman-seo")).toBe("hit");
    expect(await response.text()).toContain("Article summary");
    expect(binding.fetch).toHaveBeenCalledWith(
      "https://api.atoman.org/api/v1/blog/seo/posts/post-1",
      expect.any(Object),
    );
  });
});
