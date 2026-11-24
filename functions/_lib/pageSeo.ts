import { isCanonicalSitemapPath } from "./blogSeo";
import { getPublicArchivePage } from "./sectionContentSeo";

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
			"Atoman 汇集可订阅的 RSS 内容与独立文章，并整理图书、音乐人、专辑、歌曲、播客和视频。通过公开目录发现感兴趣的作品，也可以参与论坛与辩论，围绕内容和证据继续讨论。",
	},
	"/feed": {
		title: "订阅流 | Atoman",
		description: "Atoman 订阅流将 RSS 信息源与文章更新集中呈现，方便按主题发现值得阅读的内容、打开原文并追踪后续发布。你还可以从公开目录进入博客、播客、视频及音乐内容。",
	},
	"/posts": {
		title: "博客 | Atoman",
		description: "在 Atoman 浏览公开文章与专题，阅读内容摘要、进入独立文章页面，并从相关目录发现更多公开的作者内容。也可以继续探索 RSS 订阅流、论坛讨论与不同主题的观点。",
	},
	"/posts/articles": {
		title: "博文目录 | Atoman",
		description: "Atoman 的公开文章目录按页面展示已发布的博文，提供文章标题、摘要与可直接访问的详情链接。通过分页浏览历史文章，也可以返回博客首页或进入其他公开栏目继续发现内容。",
	},
	"/books": {
		title: "图书馆 | Atoman",
		description: "Atoman 图书馆整理公开作品与具体出版版本，展示作者、出版社、ISBN 等可获得的书目资料，并将同一作品的不同版本关联起来。你可以浏览作品详情、公开书单及相关讨论。",
	},
	"/books/lists": {
		title: "公开书单 | Atoman",
		description: "在 Atoman 查看社区公开书单与作品条目，按书单主题发现阅读线索、进入相关图书作品页并查看出版版本资料。书单连接图书目录，方便在不同作品之间继续探索。",
	},
	"/music": {
		title: "音乐档案 | Atoman",
		description: "Atoman 音乐档案将音乐人、专辑与歌曲信息关联整理，方便从艺人档案进入已收录专辑，再查看曲目和作品介绍。你也可以独立浏览公开音乐目录，并与播客、文章等内容相互发现。",
	},
	"/music/albums": {
		title: "音乐专辑列表 | Atoman",
		description: "Atoman 音乐专辑目录汇集公开收录的唱片与作品资料，可以按目录浏览专辑标题、进入专辑详情查看发行信息和关联音乐人。相关曲目页面与音乐人档案相互链接，便于追踪作品脉络。",
	},
	"/music/artists": {
		title: "音乐人目录 | Atoman",
		description: "Atoman 音乐人目录集中呈现已公开收录的歌手、组合与音乐人档案。选择音乐人可以查看已有简介和关联专辑，再沿着专辑进入歌曲详情，探索不同艺人与作品之间的联系。",
	},
	"/music/songs": {
		title: "歌曲目录 | Atoman",
		description: "Atoman 歌曲目录按页面整理已公开收录的曲目，提供歌曲标题与可直接访问的详情链接。打开歌曲页面可以查看关联音乐人、专辑和已有的作品资料，并沿着分页继续发现其他音乐。",
	},
	"/forum": {
		title: "论坛 | Atoman",
		description: "Atoman 论坛围绕公开主题组织交流，你可以浏览已经发布的讨论及其内容，从主题进入具体对话，也可以继续阅读相关博文和辩论。不同观点和资料可以在社区中相互补充与讨论。",
	},
	"/debate": {
		title: "辩论 | Atoman",
		description: "Atoman 辩论栏目围绕具体辩题整理不同立场、论点和证据，帮助读者沿着问题理解讨论中的分歧。你可以进入公开辩题查看相关内容，也能从论坛和文章目录继续阅读背景资料。",
	},
	"/timeline": {
		title: "人物时间线 | Atoman",
		description: "Atoman 人物时间线按时间脉络呈现公开记录的相关人物与事件，便于沿着时间顺序阅读条目并理解前后关系。你可以结合站内图书、文章和讨论中的内容，继续查阅相关公开资料。",
	},
	"/podcasts": {
		title: "播客 | Atoman",
		description: "Atoman 播客栏目汇集公开节目与单集，方便从播客目录进入节目页面，再阅读或收听具体单集内容。结合 RSS 订阅流和站内文章，可以在不同形式的音频与文字内容之间继续探索。",
	},
	"/videos": {
		title: "视频 | Atoman",
		description: "Atoman 视频栏目汇集公开发布的影像内容，通过视频目录可以进入具体视频页面，查看已有标题、简介和关联信息。你也可以结合文章、音乐与讨论栏目，探索相同主题的其他资料。",
	},
	"/about": {
		title: "关于 Atoman | 平台与社区介绍",
		description: "了解 Atoman 的定位与主要栏目：通过 RSS 订阅流发现公开文章，浏览图书、音乐、播客与视频资料，并在论坛和辩论中交流观点。这里介绍平台提供的公开内容类型与参与方式。",
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
  "/posts": ["/posts/articles", "/feed", "/forum", "/debate"],
  "/posts/articles": ["/posts", "/feed", "/forum"],
  "/books": ["/books/lists", "/posts", "/forum"],
  "/books/lists": ["/books", "/posts"],
  "/music": ["/music/albums", "/music/artists", "/music/songs", "/podcasts", "/videos", "/posts"],
  "/music/albums": ["/music", "/music/artists", "/music/songs"],
  "/music/artists": ["/music", "/music/albums", "/music/songs"],
  "/music/songs": ["/music", "/music/albums", "/music/artists"],
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
	"/papers",
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
    dynamic: [
      /^\/posts\/notes\/[^/]+$/,
      /^\/posts\/channel\/[^/]+$/,
      /^\/posts\/collection\/[^/]+$/,
    ],
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
	searchParams: URLSearchParams = new URLSearchParams(),
) {
	const path = normalizePath(pathname);
	const meta = pageMeta[path];
	const archivePage = getPublicArchivePage(path, searchParams);
	const pageSuffix = archivePage && archivePage > 1 ? "?page=" + String(archivePage) : "";
	const pageTitle = meta && pageSuffix ? meta.title.replace(" | Atoman", " · 第 " + archivePage + " 页 | Atoman") : meta?.title;
	const noIndex =
		hostname.endsWith(".pages.dev") ||
		noIndexPrefixes.some(
			(prefix) => path === prefix || path.startsWith(`${prefix}/`),
		) || privateRoutePatterns.some((pattern) => pattern.test(path));
	if (!meta && !noIndex && isCanonicalSitemapPath(path)) return html;

	const tags: string[] = [];
	if (meta) {
		const canonical = `${canonicalOrigin}${path === "/" ? "/" : path}${pageSuffix}`;
		tags.push(
			`<title data-default-meta>${escapeHtml(pageTitle || meta.title)}</title>`,
			`<meta data-default-meta name="description" content="${escapeHtml(meta.description)}">`,
			`<link data-default-meta rel="canonical" href="${escapeHtml(canonical)}">`,
			'<meta data-default-meta property="og:type" content="website">',
			`<meta data-default-meta property="og:title" content="${escapeHtml(pageTitle || meta.title)}">`,
			`<meta data-default-meta property="og:description" content="${escapeHtml(meta.description)}">`,
			`<meta data-default-meta property="og:url" content="${escapeHtml(canonical)}">`,
			`<meta data-default-meta property="og:image" content="${defaultImage}">`,
			'<meta data-default-meta name="twitter:card" content="summary_large_image">',
			`<meta data-default-meta name="twitter:title" content="${escapeHtml(pageTitle || meta.title)}">`,
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
