import { resolveApiBase } from "./blogSeo";
import { publicArchivePageNumbers } from "../../src/utils/publicArchivePages";
import { publicVideoCollections } from "../../src/utils/publicVideoCollections";

type PublicItem = Record<string, unknown>;
type PublicFetcher = typeof fetch;
type SeoGroupResult = { html: string; outOfRange: boolean };
const emptyGroup: SeoGroupResult = { html: "", outOfRange: false };

type PublicListSource = {
  heading: string;
  endpoint: string;
  routePrefix: string;
  labelField: "title" | "name";
  maxItems?: number;
  paginated?: boolean;
};

const sources: Record<string, PublicListSource[]> = {
  "/posts": [{ heading: "公开文章", endpoint: "/blog/posts?page=1&page_size=8", routePrefix: "/posts/post/", labelField: "title" }],
  "/posts/articles": [{ heading: "公开博文", endpoint: "/blog/posts?page=1&page_size=20&view=summary", routePrefix: "/posts/post/", labelField: "title", maxItems: 20, paginated: true }],
  "/books": [{ heading: "公开图书作品", endpoint: "/books/works", routePrefix: "/books/work/", labelField: "title" }],
  "/books/lists": [{ heading: "公开书单", endpoint: "/books/booklists", routePrefix: "/books/lists/", labelField: "title" }],
  "/music": [
    { heading: "音乐专辑", endpoint: "/music/albums?page=1&page_size=8", routePrefix: "/music/album/", labelField: "title" },
    { heading: "音乐人", endpoint: "/music/artists?page=1&page_size=8", routePrefix: "/music/artist/", labelField: "name" },
  ],
  "/music/albums": [
    { heading: "公开音乐专辑", endpoint: "/music/albums?page=1&page_size=12", routePrefix: "/music/album/", labelField: "title", maxItems: 12 },
  ],
  "/music/artists": [
    { heading: "公开音乐人", endpoint: "/music/artists?page=1&page_size=12", routePrefix: "/music/artist/", labelField: "name", maxItems: 12 },
  ],
  "/music/songs": [
    { heading: "公开歌曲", endpoint: "/music/songs?page=1&page_size=20&view=summary", routePrefix: "/music/song/", labelField: "title", maxItems: 20, paginated: true },
  ],
  "/forum": [{ heading: "公开讨论", endpoint: "/forum/topics?page=1&page_size=8", routePrefix: "/forum/topic/", labelField: "title" }],
  "/debate": [{ heading: "公开辩题", endpoint: "/debate/topics?page=1&page_size=8", routePrefix: "/debate/", labelField: "title" }],
  "/podcasts": [{ heading: "播客单集", endpoint: "/podcast/episodes", routePrefix: "/podcasts/episode/", labelField: "title" }],
  "/videos": [{ heading: "公开视频", endpoint: "/videos?sort=latest&page=1&page_size=8", routePrefix: "/videos/watch/", labelField: "title" }],
};

// Only clean, public archive pages get an indexable pagination chain.
const publicArchives = new Set(["/posts/articles", "/music/songs"]);
export function getPublicArchivePage(pathname: string, query: URLSearchParams) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!publicArchives.has(path)) return null;
  if ([...query.keys()].some((key) => key !== "page")) return null;
  const raw = query.get("page");
  if (raw === null) return 1;
  if (!/^[1-9][0-9]{0,3}$/.test(raw)) return null;
  const page = Number(raw);
  return page <= 5000 ? page : null;
}

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
  if (!payload || typeof payload !== "object") return [];
  // Public APIs return either a bare array (/videos) or a data envelope.
  const data = Array.isArray(payload) ? payload : (payload as { data?: unknown }).data;
  const items = Array.isArray(data)
    ? data
    : data && typeof data === "object" && !Array.isArray(data)
      ? (data as { items?: unknown }).items
      : undefined;
  return Array.isArray(items)
    ? items.filter((item): item is PublicItem => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

async function getGroup(apiBase: string, source: PublicListSource, fetcher: PublicFetcher, page = 1, archivePath?: string) {
  try {
    const endpoint = source.paginated
      ? source.endpoint.replace("page=1", "page=" + String(page))
      : source.endpoint;
    const response = await fetcher(apiBase + endpoint, {
      headers: { accept: "application/json" },
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(7000) : undefined,
    });
    if (!response.ok) return emptyGroup;
    const payload: unknown = await response.json();
    const items = listItems(payload);
    const metadata = payload && typeof payload === "object" && "meta" in payload
      ? (payload as { meta?: { has_more?: boolean; total?: number } }).meta
      : undefined;
    const pageSize = source.maxItems ?? 8;
    // Only a successful API response with explicit pagination metadata proves
    // that an empty archive URL is out of range. Network failures do not.
    if (archivePath && page > 1 && items.length === 0 &&
        typeof metadata?.total === "number" && Number.isFinite(metadata.total) &&
        metadata.total >= 0 && page > Math.ceil(metadata.total / pageSize)) {
      return { html: "", outOfRange: true };
    }
    const valid = items.filter(publicRecord)
      .map((item) => {
        const id = typeof item.id === "string" ? item.id : "";
        const title = cleanText(item[source.labelField], 125, false);
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !title) return "";
        const url = source.routePrefix + encodeURIComponent(id);
        const summary = cleanText(item.summary || item.description, 170);
        return '<li><a href="' + escapeHtml(url) + '">' + escapeHtml(title) + '</a>'
          + (summary && summary !== title ? '<p>' + escapeHtml(summary) + '</p>' : '') + '</li>';
      })
      .filter(Boolean)
      .slice(0, source.maxItems ?? 8);
    if (!valid.length) return emptyGroup;
    const hasMore = metadata?.has_more === true || (
      metadata?.has_more === undefined
      && typeof metadata?.total === "number"
      && metadata.total > page * pageSize
    );
    const pageUrl = (n: number) => archivePath + (n > 1 ? "?page=" + String(n) : "");
    const numbers = archivePath === "/music/songs" && typeof metadata?.total === "number"
      ? publicArchivePageNumbers(page, metadata.total, pageSize) : [];
    const numberedPager = numbers.length
      ? '<details><summary>跳转页码</summary><ul>' + numbers.map((n) =>
        '<li>' + (n === page ? '<span aria-current="page">' + n + '</span>'
          : '<a href="' + escapeHtml(pageUrl(n)) + '" aria-label="第 ' + n + ' 页">' + n + '</a>') + '</li>'
        ).join("") + '</ul></details>' : "";
    const pager = archivePath
      ? '<nav aria-label="目录分页">'
        + (page > 1 ? '<a rel="prev" href="' + escapeHtml(pageUrl(page - 1)) + '">上一页</a>' : '')
        + (hasMore ? '<a rel="next" href="' + escapeHtml(pageUrl(page + 1)) + '">下一页</a>' : '')
        + numberedPager + '</nav>'
      : "";
    const collections = source.routePrefix === "/videos/watch/"
      ? publicVideoCollections(items.filter(publicRecord)).slice(0, 100) : [];
    const collectionLinks = collections.length
      ? '<section class="seo-public-listing-group"><h3>公开视频合集</h3><ul>' +
        collections.map((collection) => '<li><a href="/videos/collections/' +
          encodeURIComponent(collection.id) + '">' + escapeHtml(collection.name) + '</a></li>').join("") +
        '</ul></section>' : "";
    return { html: '<section class="seo-public-listing-group"><h3>' + escapeHtml(source.heading)
      + '</h3><ul>' + valid.join("") + '</ul>' + pager + '</section>' + collectionLinks, outOfRange: false };
  } catch {
    // A temporary API failure should never hide the section or change indexing.
    return emptyGroup;
  }
}

export async function loadPublicSectionListingResult(
  pathname: string,
  configuredApiUrl: string | undefined,
  origin: string,
  fetcher: PublicFetcher = fetch,
  searchParams: URLSearchParams = new URLSearchParams(),
) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const config = sources[path];
  if (!config) return emptyGroup;
  const archivePage = getPublicArchivePage(path, searchParams);
  if (publicArchives.has(path) && archivePage === null) return emptyGroup;
  const base = resolveApiBase(configuredApiUrl, origin);
  const groups = await Promise.all(config.map((item) =>
    getGroup(base, item, fetcher, archivePage ?? 1, item.paginated ? path : undefined)));
  const content = groups.map((group) => group.html).filter(Boolean).join("");
  return {
    html: content
      ? '<section data-seo-public-listing="true" aria-label="当前公开内容"><h2>浏览公开内容</h2>'
        + content + '</section>'
      : "",
    outOfRange: groups.some((group) => group.outOfRange),
  };
}

// Keep the HTML-only API for existing callers and tests.
export async function loadPublicSectionListing(
  pathname: string,
  configuredApiUrl: string | undefined,
  origin: string,
  fetcher: PublicFetcher = fetch,
  searchParams: URLSearchParams = new URLSearchParams(),
) {
  const result = await loadPublicSectionListingResult(pathname, configuredApiUrl, origin, fetcher, searchParams);
  return result.html;
}

export function injectPublicSectionListing(html: string, listing: string) {
  if (!listing) return html;
  const start = html.indexOf('<main class="seo-static-fallback"');
  if (start === -1) return html;
  const end = html.indexOf("</main>", start);
  return end === -1 ? html : `${html.slice(0, end)}${listing}${html.slice(end)}`;
}
