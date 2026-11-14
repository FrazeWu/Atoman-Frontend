import { resolveApiBase } from "./blogSeo";

type PublicItem = Record<string, unknown>;
type PublicFetcher = typeof fetch;
type PublicListSource = {
  heading: string;
  endpoint: string;
  routePrefix: string;
  labelField: "title" | "name";
};

const sources: Record<string, PublicListSource[]> = {
  "/posts": [{ heading: "公开文章", endpoint: "/blog/posts?page=1&page_size=8", routePrefix: "/posts/post/", labelField: "title" }],
  "/books": [{ heading: "公开图书作品", endpoint: "/books/works", routePrefix: "/books/work/", labelField: "title" }],
  "/books/lists": [{ heading: "公开书单", endpoint: "/books/booklists", routePrefix: "/books/lists/", labelField: "title" }],
  "/music": [
    { heading: "音乐专辑", endpoint: "/music/albums?page=1&page_size=8", routePrefix: "/music/album/", labelField: "title" },
    { heading: "音乐人", endpoint: "/music/artists?page=1&page_size=8", routePrefix: "/music/artist/", labelField: "name" },
  ],
  "/forum": [{ heading: "公开讨论", endpoint: "/forum/topics?page=1&page_size=8", routePrefix: "/forum/topic/", labelField: "title" }],
  "/debate": [{ heading: "公开辩题", endpoint: "/debate/topics?page=1&page_size=8", routePrefix: "/debate/", labelField: "title" }],
  "/podcasts": [{ heading: "播客单集", endpoint: "/podcast/episodes", routePrefix: "/podcasts/episode/", labelField: "title" }],
  "/videos": [{ heading: "公开视频", endpoint: "/videos?sort=latest&page=1&page_size=8", routePrefix: "/videos/watch/", labelField: "title" }],
};

function cleanText(value: unknown, limit = 125, stripMarkup = true) {
  if (typeof value !== "string") return "";
  const normalized = stripMarkup ? value.replace(/<[^>]*>/g, " ") : value;
  return normalized.replace(/\s+/g, " ").trim().slice(0, limit);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function publicRecord(item: PublicItem) {
  for (const [field, allowed] of [
    ["visibility", ["public"]],
    ["status", ["active", "open", "published"]],
    ["lifecycle_status", ["active"]],
    ["entry_status", ["open"]],
  ] as const) {
    const value = item[field];
    if (typeof value === "string" && !allowed.some((valid) => valid === value)) return false;
  }
  return true;
}

function listItems(payload: unknown): PublicItem[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const data = (payload as { data?: unknown }).data;
  const items = Array.isArray(data)
    ? data
    : data && typeof data === "object" && !Array.isArray(data)
      ? (data as { items?: unknown }).items
      : undefined;
  return Array.isArray(items)
    ? items.filter((item): item is PublicItem => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

async function getGroup(apiBase: string, source: PublicListSource, fetcher: PublicFetcher) {
  try {
    const response = await fetcher(`${apiBase}${source.endpoint}`, {
      headers: { accept: "application/json" },
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(2500) : undefined,
    });
    if (!response.ok) return "";
    const items = listItems(await response.json());
    const valid = items.filter(publicRecord)
      .map((item) => {
        const id = typeof item.id === "string" ? item.id : "";
        const title = cleanText(item[source.labelField], 125, false);
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !title) return "";
        const url = `${source.routePrefix}${encodeURIComponent(id)}`;
        const summary = cleanText(item.summary || item.description, 170);
        return `<li><a href="${escapeHtml(url)}">${escapeHtml(title)}</a>${summary && summary !== title ? `<p>${escapeHtml(summary)}</p>` : ""}</li>`;
      })
      .filter(Boolean)
      .slice(0, 8);
    return valid.length
      ? `<section class="seo-public-listing-group"><h3>${escapeHtml(source.heading)}</h3><ul>${valid.join("")}</ul></section>`
      : "";
  } catch {
    // A temporary API failure should never hide the section or change indexing.
    return "";
  }
}

export async function loadPublicSectionListing(
  pathname: string,
  configuredApiUrl: string | undefined,
  origin: string,
  fetcher: PublicFetcher = fetch,
) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const config = sources[path];
  if (!config) return "";
  const base = resolveApiBase(configuredApiUrl, origin);
  const groups = await Promise.all(config.map((item) => getGroup(base, item, fetcher)));
  const content = groups.filter(Boolean).join("");
  return content ? `<section data-seo-public-listing="true" aria-label="当前公开内容"><h2>浏览公开内容</h2>${content}</section>` : "";
}

export function injectPublicSectionListing(html: string, listing: string) {
  if (!listing) return html;
  const start = html.indexOf('<main class="seo-static-fallback"');
  if (start === -1) return html;
  const end = html.indexOf("</main>", start);
  return end === -1 ? html : `${html.slice(0, end)}${listing}${html.slice(end)}`;
}
