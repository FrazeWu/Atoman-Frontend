import { describe, expect, it, vi } from "vitest";
import worker, { isAllowedSeoRequest } from "../../../workers/seo-origin/index.js";

describe("Private SEO origin service", () => {
  it("allows only public SEO sources on the canonical API host", () => {
    expect(isAllowedSeoRequest(new URL("https://api.atoman.org/api/v1/blog/posts?page=2&page_size=20&view=summary"))).toBe(true);
    expect(isAllowedSeoRequest(new URL("https://api.atoman.org/api/v1/music/songs?page=5&page_size=100"))).toBe(true);
    expect(isAllowedSeoRequest(new URL("https://api.atoman.org/api/v1/blog/seo/sitemap"))).toBe(true);
    expect(isAllowedSeoRequest(new URL("https://api.atoman.org/api/v1/blog/seo/posts/01a1e858-0b7d-72ba-9bc0-3e0c712eff96"))).toBe(true);
    expect(isAllowedSeoRequest(new URL("https://api.atoman.org/api/v1/users/me"))).toBe(false);
    expect(isAllowedSeoRequest(new URL("https://api.atoman.org/api/v1/blog/posts?author_private=true"))).toBe(false);
    expect(isAllowedSeoRequest(new URL("https://evil.example/api/v1/blog/posts"))).toBe(false);
    expect(isAllowedSeoRequest(new URL("https://api.atoman.org/api/v1/blog/posts?page_size=10000"))).toBe(false);
    expect(isAllowedSeoRequest(new URL("https://api.atoman.org/api/v1/blog/posts?page=1&page=2"))).toBe(false);
  });

  it("only relays safe GET requests without forwarding auth headers", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "public" }] }), {
      headers: { "content-type": "application/json" },
    }));
    const env = { PRIVATE_ORIGIN: { fetch } };
    const request = new Request("https://api.atoman.org/api/v1/blog/posts?page=1", {
      headers: { Authorization: "Bearer PRIVATE", Cookie: "session=PRIVATE" },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [{ id: "public" }] });
    expect(fetch).toHaveBeenCalledWith(request.url, expect.objectContaining({
      headers: { Accept: "application/json", "User-Agent": "Atoman-SEO-Edge/1.0" },
    }));
    expect(await worker.fetch(new Request("https://evil.example/api/v1/blog/posts"), env)).toHaveProperty("status", 404);
    expect(await worker.fetch(new Request("https://api.atoman.org/api/v1/blog/posts", { method: "POST" }), env)).toHaveProperty("status", 405);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
