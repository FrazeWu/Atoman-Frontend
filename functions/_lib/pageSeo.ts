import { isCanonicalSitemapPath } from "./blogSeo";

type StaticPageMeta = {
	title: string;
	description: string;
};

const canonicalOrigin = "https://www.atoman.org";
const defaultImage = `${canonicalOrigin}/atoman-share.png`;

const pageMeta: Record<string, StaticPageMeta> = {
	"/": {
		title: "Atoman | 订阅与内容｜求真与开放",
		description:
			"聚合值得订阅的博客、播客、音乐与讨论，在开放交流中接近事实。",
	},
	"/feed": {
		title: "订阅流 | Atoman",
		description: "聚合你感兴趣的 RSS 订阅源与内容更新。",
	},
	"/posts": {
		title: "博客 | Atoman",
		description: "发现并阅读 Atoman 上的独立文章与专题内容。",
	},
	"/books": {
		title: "图书馆 | Atoman",
		description: "探索作品、出版版本与书单，参与开放的图书资料维护和讨论。",
	},
	"/books/lists": {
		title: "公开书单 | Atoman",
		description: "发现社区公开书单和阅读推荐。",
	},
	"/music": {
		title: "音乐档案 | Atoman",
		description: "浏览和整理专辑、歌曲与艺人资料。",
	},
	"/forum": {
		title: "论坛 | Atoman",
		description: "参与主题讨论，发布观点并与社区交流。",
	},
	"/debate": {
		title: "辩论 | Atoman",
		description: "围绕具体辩题查看论点、证据与讨论。",
	},
	"/timeline": {
		title: "人物时间线 | Atoman",
		description: "按时间与地点查看人物和事件脉络。",
	},
	"/podcasts": {
		title: "播客 | Atoman",
		description: "发现播客节目、单集与相关讨论。",
	},
	"/videos": {
		title: "视频 | Atoman",
		description: "发现视频内容并参与相关讨论。",
	},
	"/about": {
		title: "关于 Atoman",
		description: "了解 Atoman 的定位、内容与社区。",
	},
	"/terms": {
		title: "服务条款 | Atoman",
		description: "Atoman 服务条款。",
	},
	"/privacy": {
		title: "隐私政策 | Atoman",
		description: "Atoman 隐私政策。",
	},
};

// These are real, public destinations. Keep the initial HTML specific to the
// requested section instead of shipping the home page's placeholder to crawlers.
const publicSectionLinks: Record<string, string[]> = {
  "/": ["/feed", "/posts", "/books", "/music", "/forum", "/podcasts", "/videos"],
  "/feed": ["/posts", "/podcasts", "/videos", "/music"],
  "/posts": ["/feed", "/forum", "/debate"],
  "/books": ["/books/lists", "/posts", "/forum"],
  "/books/lists": ["/books", "/posts"],
  "/music": ["/podcasts", "/videos", "/posts"],
  "/forum": ["/debate", "/posts"],
  "/debate": ["/forum", "/posts"],
  "/timeline": ["/posts", "/books"],
  "/podcasts": ["/feed", "/posts", "/music"],
  "/videos": ["/posts", "/music"],
  "/about": ["/feed", "/books", "/music", "/forum"],
  "/terms": ["/about", "/privacy"],
  "/privacy": ["/about", "/terms"],
};

function buildSectionFallback(path: string, meta: StaticPageMeta) {
  const links = (publicSectionLinks[path] || [])
    .filter((destination) => pageMeta[destination])
    .map((destination) =>
      `<li><a href="${escapeHtml(destination)}">${escapeHtml(pageMeta[destination].title.split(" | ")[0])}</a></li>`,
    ).join("");
  const fallback = [
    '<main class="seo-static-fallback" data-seo-fallback="section">',
    `<h1>${escapeHtml(meta.title.split(" | ")[0])}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    links ? `<nav aria-label="探索 Atoman 其他公开栏目"><h2>探索更多公开内容</h2><ul>${links}</ul></nav>` : "",
    "</main>",
  ].join("");
  return fallback;
}

function replaceSectionFallback(html: string, path: string, meta: StaticPageMeta) {
  // A visible, crawlable loading shell is replaced automatically when Vue mounts.
  // The home page keeps its existing designed prerender loading screen.
  if (path === "/") return html;
  const marker = /<!--\s*seo-prerender-start\s*-->[\s\S]*?<!--\s*seo-prerender-end\s*-->/i;
  const result = marker.test(html)
    ? html.replace(marker, buildSectionFallback(path, meta))
    : html.replace(/<div id=["']app["']>/i, (match) => `${match}${buildSectionFallback(path, meta)}`);
  return result.replace(/<\/head>/i, `    <style data-seo-section-fallback>
      .seo-static-fallback { display: block; min-height: 30vh; max-width: 900px; margin: 0 auto; padding: 48px 24px; color: #171717; font: 16px/1.65 system-ui, sans-serif; }
      .seo-static-fallback h1 { font-size: 30px; line-height: 1.3; margin: 0 0 18px; }
      .seo-static-fallback h2 { font-size: 20px; margin: 30px 0 12px; }
      .seo-static-fallback ul { padding-left: 1.4em; }
      .seo-static-fallback a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
    </style>\n  </head>`);
}

const noIndexPrefixes = [
	"/login",
	"/register",
	"/forgot-password",
	"/auth",
	"/search",
	"/modules",
	"/studio",
	"/site/setting",
	"/inbox",
	"/messages",
	"/mail",
	"/me",
	"/dev",
	"/__disabled__",
	"/__not_found__",
	"/feed/sources",
	"/feed/search",
	"/feed/subscriptions",
	"/feed/stats",
	"/feed/starred",
	"/feed/reading-list",
	"/debate/search",
	"/debate/me",
	"/music/artist/new",
	"/books/search",
	"/books/new",
	"/books/library",
	"/books/shelf",
	"/books/notes",
	"/books/read",
	"/books/public-read",
	"/books/annotations",
	"/books/lists/new",
	// Authenticated areas and in-site search results must not enter Google.
	"/posts/subscriptions",
	"/posts/bookmarks",
	"/music/starred",
	"/music/library",
	"/music/playlists",
	"/music/bookmarks",
	"/music/history",
	"/music/me",
	"/music/archived",
	"/music/imports",
	"/forum/me",
	"/forum/new",
	"/forum/search",
	"/timeline/me",
	"/timeline/search",
	"/podcasts/subscriptions",
	"/podcasts/favorites",
	"/podcasts/me",
	"/videos/search",
	"/videos/subscriptions",
	"/videos/favorites",
];

const privateRoutePatterns = [
	/^\/books\/work\/[^/]+\/(?:notes|collections)(?:\/|$)/,
	/^\/books\/lists\/[^/]+\/edit(?:\/|$)/,
	/^\/posts\/notes\/[^/]+\/edit(?:\/|$)/,
	/^\/music\/album\/[^/]+\/edit(?:\/|$)/,
	/^\/forum\/topic\/[^/]+\/edit(?:\/|$)/,
	/^\/users\/[^/]+\/settings(?:\/|$)/,
];

const publicRoutePrefixes = [
	"/feed",
	"/posts",
	"/music",
	"/books",
	"/forum",
	"/debate",
	"/timeline",
	"/podcasts",
	"/videos",
	"/users",
	"/channels",
	"/channel",
	"/collection",
	"/post",
	"/notes",
	"/bookmarks",
	"/about",
	"/terms",
	"/privacy",
];

// Only registered routes are valid under these sections. Accepting every
// subpath as 200 made invented URLs look like soft-404 pages to search engines.
const guardedRoutes: Record<string, { exact: string[]; dynamic: RegExp[] }> = {
  "/feed": {
    // /feed/following was a legacy SPA path; it is no longer registered.
    // Keeping an invented child as HTTP 200 made Google index a soft 404.
    exact: ["/feed/explore"],
    dynamic: [/^\/feed\/item\/[^/]+$/],
  },
  "/posts": {
    exact: ["/posts/articles", "/posts/notes"],
    dynamic: [/^\/posts\/notes\/[^/]+$/],
  },
  "/books": {
    exact: ["/books/shared-notes"],
    dynamic: [/^\/books\/note-shares\/[^/]+$/],
  },
  "/music": {
    exact: ["/music/discover", "/music/albums", "/music/songs", "/music/tags", "/music/artists", "/music/more"],
    dynamic: [/^\/music\/tags\/[^/]+$/, /^\/music\/playlist\/[^/]+$/],
  },
  "/about": { exact: [], dynamic: [] },
  "/terms": { exact: [], dynamic: [] },
  "/privacy": { exact: [], dynamic: [] },
};

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function normalizePath(pathname: string) {
	if (pathname === "/") return pathname;
	return pathname.replace(/\/+$/, "");
}

export function isKnownPagePath(pathname: string) {
	const path = normalizePath(pathname);
	if (pageMeta[path] || isCanonicalSitemapPath(path)) return true;
	if (
		noIndexPrefixes.some(
			(prefix) => path === prefix || path.startsWith(`${prefix}/`),
		) || privateRoutePatterns.some((pattern) => pattern.test(path))
	)
		return true;
	for (const [section, routes] of Object.entries(guardedRoutes)) {
		if (path.startsWith(`${section}/`)) {
			return routes.exact.includes(path) || routes.dynamic.some((pattern) => pattern.test(path));
		}
	}
	return publicRoutePrefixes.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`),
	);
}

export function buildStaticPageHtml(
	html: string,
	pathname: string,
	hostname: string,
) {
	const path = normalizePath(pathname);
	const meta = pageMeta[path];
	const noIndex =
		hostname.endsWith(".pages.dev") ||
		noIndexPrefixes.some(
			(prefix) => path === prefix || path.startsWith(`${prefix}/`),
		) || privateRoutePatterns.some((pattern) => pattern.test(path));
	if (!meta && !noIndex && isCanonicalSitemapPath(path)) return html;

	const tags: string[] = [];
	if (meta) {
		const canonical = `${canonicalOrigin}${path === "/" ? "/" : path}`;
		tags.push(
			`<title data-default-meta>${escapeHtml(meta.title)}</title>`,
			`<meta data-default-meta name="description" content="${escapeHtml(meta.description)}">`,
			`<link data-default-meta rel="canonical" href="${escapeHtml(canonical)}">`,
			'<meta data-default-meta property="og:type" content="website">',
			`<meta data-default-meta property="og:title" content="${escapeHtml(meta.title)}">`,
			`<meta data-default-meta property="og:description" content="${escapeHtml(meta.description)}">`,
			`<meta data-default-meta property="og:url" content="${escapeHtml(canonical)}">`,
			`<meta data-default-meta property="og:image" content="${defaultImage}">`,
			'<meta data-default-meta name="twitter:card" content="summary_large_image">',
			`<meta data-default-meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
			`<meta data-default-meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
			`<meta data-default-meta name="twitter:image" content="${defaultImage}">`,
		);
	}
	if (noIndex) tags.push('<meta name="robots" content="noindex, nofollow">');

	const cleanHtml = meta
		? html
				.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "")
				.replace(/\s*<(?:meta|link)[^>]*data-default-meta[^>]*>/gi, "")
		: html.replace(
				/\s*<(?:meta|link)(?=[^>]*data-default-meta)(?=[^>]*(?:rel=["']canonical["']|property=["']og:url["']))[^>]*>/gi,
				"",
			);
	if (!tags.length) return cleanHtml;
	const pageHtml = cleanHtml.replace(
		/<\/head>/i,
		`    ${tags.join("\n    ")}\n  </head>`,
	);
	return meta ? replaceSectionFallback(pageHtml, path, meta) : pageHtml;
}
