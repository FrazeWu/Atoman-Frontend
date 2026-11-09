import { buildSitemapXml, resolveApiBase, type SitemapItem } from "./_lib/blogSeo";

type SongsSitemapContext = {
  request: Request;
  env: { VITE_API_URL?: string };
};

const canonicalOrigin = "https://www.atoman.org";
const pageSize = 100;
const maxPages = 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublicSong = {
  id?: unknown;
  updated_at?: unknown;
  lifecycle_status?: unknown;
};

function responseXml(xml: string, cacheControl: string) {
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=UTF-8",
      "cache-control": cacheControl,
    },
  });
}

function unavailable() {
  // Do not return an empty 200 sitemap when the source temporarily fails.
  return new Response("Songs sitemap temporarily unavailable", {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=UTF-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequest(context: SongsSitemapContext) {
  const url = new URL(context.request.url);
  const rawPage = url.searchParams.get("page");
  if (rawPage !== null && !/^[1-9][0-9]{0,3}$/.test(rawPage)) {
    return new Response("Invalid songs sitemap page", { status: 400 });
  }
  const page = rawPage === null ? null : Number(rawPage);
  if (page !== null && page > maxPages) {
    return new Response("Songs sitemap page out of range", { status: 404 });
  }

  const defaultApi = url.origin.includes("atoman.org") ? "https://api.atoman.org/api" : undefined;
  const apiBase = resolveApiBase(context.env.VITE_API_URL || defaultApi, url.origin);
  const sourcePageSize = page === null ? 1 : pageSize;
  const sourcePage = page ?? 1;

  try {
    const response = await fetch(
      `${apiBase}/music/songs?page=${sourcePage}&page_size=${sourcePageSize}`,
      {
        headers: { Accept: "application/json" },
        signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(5000) : undefined,
      },
    );
    if (!response.ok) return unavailable();
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null || !("data" in payload) || !("meta" in payload)) {
      return unavailable();
    }
    const result = payload as { data: unknown; meta: unknown };
    if (!Array.isArray(result.data) || typeof result.meta !== "object" || result.meta === null) {
      return unavailable();
    }
    const meta = result.meta as { total?: unknown };
    if (typeof meta.total !== "number" || !Number.isInteger(meta.total) || meta.total < 0 ||
        meta.total > maxPages * pageSize) {
      return unavailable();
    }
    const pageCount = Math.ceil(meta.total / pageSize);
    if (page === null) {
      const entries = Array.from({ length: pageCount }, (_, i) =>
        `  <sitemap>
    <loc>${canonicalOrigin}/sitemap-songs.xml?page=${i + 1}</loc>
  </sitemap>`
      ).join("\n");
      return responseXml(
        `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`,
        "public, max-age=300, s-maxage=900",
      );
    }

    if (page > pageCount || !result.data.length) {
      return new Response("Songs sitemap page not found", { status: 404 });
    }
    const entries = new Map<string, SitemapItem>();
    for (const item of result.data as PublicSong[]) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !uuidPattern.test(item.id)) continue;
      if (typeof item.lifecycle_status === "string" && item.lifecycle_status !== "active") continue;
      const path = `/music/song/${item.id}`;
      entries.set(path, {
        path,
        last_modified: typeof item.updated_at === "string" && !Number.isNaN(Date.parse(item.updated_at))
          ? item.updated_at
          : undefined,
      });
    }
    if (entries.size === 0) return unavailable();
    return responseXml(
      buildSitemapXml([...entries.values()], canonicalOrigin),
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
  } catch (error) {
    console.warn("Songs sitemap source failed:", error);
    return unavailable();
  }
}
