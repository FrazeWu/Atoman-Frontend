import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../../workers/seo-origin/index.js";

const url = "https://api.atoman.org/api/v1/music/songs?page=1&page_size=20";
const now = Date.parse("2026-11-24T02:00:00.000Z");

function cacheStore() {
  const map = new Map<string, { bytes: Uint8Array; cachedAt: string }>();
  return {
    map,
    get: vi.fn(async (key: string) => {
      const item = map.get(key);
      return item
        ? { customMetadata: { cachedAt: item.cachedAt }, body: new Response(item.bytes).body }
        : null;
    }),
    put: vi.fn(async (key: string, value: ArrayBuffer, opts: { customMetadata: { cachedAt: string } }) => {
      map.set(key, { bytes: new Uint8Array(value.slice(0)), cachedAt: opts.customMetadata.cachedAt });
    }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Private SEO R2 resilience", () => {
  it("serves repeated public JSON from a private cache without another VPC request", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const SEO_CACHE = cacheStore();
    const PRIVATE_ORIGIN = { fetch: vi.fn(async () => new Response(JSON.stringify({ data: ["song"] }), {
      headers: { "content-type": "application/json" },
    })) };
    const env = { SEO_CACHE, PRIVATE_ORIGIN };
    expect((await worker.fetch(new Request(url), env)).status).toBe(200);
    const fromCache = await worker.fetch(new Request(url), env);
    expect(await fromCache.json()).toEqual({ data: ["song"] });
    expect(PRIVATE_ORIGIN.fetch).toHaveBeenCalledTimes(1);
    expect(SEO_CACHE.put).toHaveBeenCalledTimes(1);
    expect(SEO_CACHE.map.size).toBe(1);
  });

  it("serves a bounded stale copy on origin failure, then refuses expired data", async () => {
    let clock = now;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const SEO_CACHE = cacheStore();
    const PRIVATE_ORIGIN = { fetch: vi.fn(async () => new Response('{"data":[1]}', {
      headers: { "content-type": "application/json" },
    })) };
    const env = { SEO_CACHE, PRIVATE_ORIGIN };
    expect((await worker.fetch(new Request(url), env)).status).toBe(200);
    PRIVATE_ORIGIN.fetch.mockImplementation(async () => { throw new Error("home tunnel offline"); });
    clock += 30 * 60 * 1000;
    const stale = await worker.fetch(new Request(url), env);
    expect(stale.status).toBe(200);
    expect(await stale.json()).toEqual({ data: [1] });
    clock += 73 * 60 * 60 * 1000;
    const expired = await worker.fetch(new Request(url), env);
    expect(expired.status).toBe(503);
    expect(expired.headers.get("cache-control")).toBe("no-store");
  });

  it("never resurrects content removed at the authoritative origin", async () => {
    let clock = now;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const SEO_CACHE = cacheStore();
    const PRIVATE_ORIGIN = { fetch: vi.fn(async () => new Response('{"data":[1]}', {
      headers: { "content-type": "application/json" },
    })) };
    const env = { SEO_CACHE, PRIVATE_ORIGIN };
    await worker.fetch(new Request(url), env);
    clock += 21 * 60 * 1000;
    PRIVATE_ORIGIN.fetch.mockImplementation(async () => new Response('{"error":"Not found"}', {
      status: 404, headers: { "content-type": "application/json" },
    }));
    const response = await worker.fetch(new Request(url), env);
    expect(response.status).toBe(404);
    expect((await response.text()).includes("Not found")).toBe(true);
  });

  it("rejects non-JSON origin replies and never forwards a private API request", async () => {
    const SEO_CACHE = cacheStore();
    const PRIVATE_ORIGIN = { fetch: vi.fn(async () => new Response("<html>challenge</html>", {
      status: 200, headers: { "content-type": "text/html" },
    })) };
    const env = { SEO_CACHE, PRIVATE_ORIGIN };
    expect((await worker.fetch(new Request(url), env)).status).toBe(503);
    expect(SEO_CACHE.put).not.toHaveBeenCalled();
    expect((await worker.fetch(new Request("https://api.atoman.org/api/v1/users/me"), env)).status).toBe(404);
    expect(PRIVATE_ORIGIN.fetch).toHaveBeenCalledTimes(1);
  });
});
