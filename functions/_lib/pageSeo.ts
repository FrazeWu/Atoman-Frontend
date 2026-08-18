type StaticPageMeta = {
	title: string;
	description: string;
};

const canonicalOrigin = "https://www.atoman.org";
const defaultImage = `${canonicalOrigin}/atoman-share.png`;

const pageMeta: Record<string, StaticPageMeta> = {
	"/": {
		title: "订阅与内容｜求真与开放",
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
};

const noIndexPrefixes = [
	"/login",
	"/register",
	"/forgot-password",
	"/auth",
	"/studio",
	"/settings",
];

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
		);

	if (!meta && !noIndex) return html;

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
			'<meta data-default-meta name="twitter:card" content="summary">',
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
				/\s*<link(?=[^>]*data-default-meta)(?=[^>]*rel=["']canonical["'])[^>]*>/gi,
				"",
			);
	return cleanHtml.replace(
		/<\/head>/i,
		`    ${tags.join("\n    ")}\n  </head>`,
	);
}
