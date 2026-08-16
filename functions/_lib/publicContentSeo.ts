import { resolveApiBase, type SitemapItem } from "./blogSeo";

export type PublicContentSeo = {
	path: string;
	title: string;
	description: string;
	imageUrl?: string;
	lastModified?: string;
	structuredData: Record<string, unknown>;
};

export type PublicContentLookup = {
	matched: boolean;
	content?: PublicContentSeo;
	retryable?: boolean;
};

type Fetcher = typeof fetch;

const canonicalOrigin = "https://www.atoman.org";
const defaultImage = `${canonicalOrigin}/atoman-share.png`;

const escapeHtml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

function record(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function array(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function plainText(value: unknown, fallback: string): string {
	const normalized = text(value)
		.replace(/<[^>]*>/g, " ")
		.replace(/[#*_`>~[\]()]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!normalized) return fallback;
	return normalized.length > 160
		? `${normalized.slice(0, 157)}...`
		: normalized;
}

function date(value: unknown): string | undefined {
	const candidate = text(value);
	return candidate && !candidate.startsWith("0001-01-01")
		? candidate
		: undefined;
}

function unwrap(payload: unknown): unknown {
	const envelope = record(payload);
	return envelope && "data" in envelope ? envelope.data : payload;
}

async function getJson(url: string, fetcher: Fetcher): Promise<unknown> {
	const response = await fetcher(url, {
		headers: { Accept: "application/json" },
	});
	if ([401, 403, 404].includes(response.status)) return null;
	if (!response.ok)
		throw new Error(`Public SEO source returned ${response.status}`);
	return unwrap(await response.json());
}

function names(values: unknown): string[] {
	return array(values)
		.map((value) => text(record(value)?.name))
		.filter(Boolean);
}

function content(
	path: string,
	title: string,
	description: string,
	structuredData: Record<string, unknown>,
	imageUrl?: string,
	lastModified?: string,
): PublicContentSeo {
	return { path, title, description, imageUrl, lastModified, structuredData };
}

async function loadArtist(apiBase: string, id: string, fetcher: Fetcher) {
	const artist = record(
		await getJson(
			`${apiBase}/music/artists/${encodeURIComponent(id)}`,
			fetcher,
		),
	);
	if (!artist || !text(artist.id) || !text(artist.name)) return undefined;
	const name = text(artist.display_name) || text(artist.name);
	const description = plainText(
		artist.bio,
		`在 Atoman 查看 ${name} 的音乐资料、专辑与作品。`,
	);
	return content(
		`/music/artist/${encodeURIComponent(id)}`,
		`${name} | 音乐档案 | Atoman`,
		description,
		{
			"@type": artist.artist_form === "person" ? "Person" : "MusicGroup",
			name,
			description,
			image: text(artist.image_url) || undefined,
		},
		text(artist.image_url) || undefined,
		date(artist.updated_at),
	);
}

async function loadAlbum(apiBase: string, id: string, fetcher: Fetcher) {
	const album = record(
		await getJson(`${apiBase}/music/albums/${encodeURIComponent(id)}`, fetcher),
	);
	if (!album || !text(album.id) || !text(album.title)) return undefined;
	const title = text(album.title);
	const artists = names(album.artists);
	const description = plainText(
		album.description,
		`在 Atoman 查看专辑《${title}》的曲目与资料。`,
	);
	return content(
		`/music/album/${encodeURIComponent(id)}`,
		`《${title}》${artists.length ? ` - ${artists.join("、")}` : ""} | Atoman`,
		description,
		{
			"@type": "MusicAlbum",
			name: title,
			description,
			image: text(album.cover_url) || undefined,
			byArtist: artists.map((name) => ({ "@type": "MusicGroup", name })),
			datePublished: date(album.release_date),
		},
		text(album.cover_url) || undefined,
		date(album.updated_at),
	);
}

async function loadSong(apiBase: string, id: string, fetcher: Fetcher) {
	const detail = record(
		await getJson(`${apiBase}/music/songs/${encodeURIComponent(id)}`, fetcher),
	);
	const song = record(detail?.song);
	if (!song || !text(song.id) || !text(song.title)) return undefined;
	const title = text(song.title);
	const artists = names(detail?.artists);
	const album = record(song.album);
	const description = `在 Atoman 收听${artists.length ? ` ${artists.join("、")} 的` : ""}歌曲《${title}》，查看所属专辑与歌词。`;
	return content(
		`/music/song/${encodeURIComponent(id)}`,
		`《${title}》${artists.length ? ` - ${artists.join("、")}` : ""} | Atoman`,
		description,
		{
			"@type": "MusicRecording",
			name: title,
			description,
			image: text(song.cover_url) || text(album?.cover_url) || undefined,
			byArtist: artists.map((name) => ({ "@type": "MusicGroup", name })),
			inAlbum: text(album?.title)
				? { "@type": "MusicAlbum", name: text(album?.title) }
				: undefined,
		},
		text(song.cover_url) || text(album?.cover_url) || undefined,
		date(song.updated_at),
	);
}

async function loadForumTopic(apiBase: string, id: string, fetcher: Fetcher) {
	const topic = record(
		await getJson(`${apiBase}/forum/topics/${encodeURIComponent(id)}`, fetcher),
	);
	if (!topic || !text(topic.id) || !text(topic.title)) return undefined;
	const title = text(topic.title);
	const description = plainText(
		topic.content,
		`在 Atoman 论坛参与“${title}”的讨论。`,
	);
	const author = record(topic.user);
	return content(
		`/forum/topic/${encodeURIComponent(id)}`,
		`${title} | 论坛 | Atoman`,
		description,
		{
			"@type": "DiscussionForumPosting",
			headline: title,
			text: description,
			author:
				text(author?.display_name) || text(author?.username)
					? {
							"@type": "Person",
							name: text(author?.display_name) || text(author?.username),
						}
					: undefined,
			datePublished: date(topic.created_at),
			dateModified: date(topic.updated_at),
		},
		undefined,
		date(topic.updated_at),
	);
}

async function loadDebate(apiBase: string, id: string, fetcher: Fetcher) {
	const debate = record(
		await getJson(
			`${apiBase}/debate/topics/${encodeURIComponent(id)}`,
			fetcher,
		),
	);
	if (!debate || !text(debate.id) || !text(debate.title)) return undefined;
	const title = text(debate.title);
	const description = plainText(
		debate.description || debate.content,
		`查看辩题“${title}”的观点、论证与讨论。`,
	);
	const author = record(debate.user);
	return content(
		`/debate/${encodeURIComponent(id)}`,
		`${title} | 辩题 | Atoman`,
		description,
		{
			"@type": "Article",
			headline: title,
			description,
			author:
				text(author?.display_name) || text(author?.username)
					? {
							"@type": "Person",
							name: text(author?.display_name) || text(author?.username),
						}
					: undefined,
			datePublished: date(debate.created_at),
			dateModified: date(debate.updated_at),
		},
		undefined,
		date(debate.updated_at),
	);
}

function podcastEpisodeContent(episode: Record<string, unknown>, id: string) {
	const post = record(episode.post);
	const channel = record(episode.channel);
	const title = text(post?.title);
	if (!text(episode.id) || !title) return undefined;
	const description = plainText(
		post?.description || post?.excerpt || post?.content,
		`收听播客单集《${title}》。`,
	);
	const image =
		text(episode.episode_cover_url) ||
		text(post?.cover_url) ||
		text(channel?.cover_url);
	return content(
		`/podcasts/episode/${encodeURIComponent(id)}`,
		`${title} | 播客 | Atoman`,
		description,
		{
			"@type": "PodcastEpisode",
			name: title,
			description,
			image: image || undefined,
			duration: duration(episode.duration_sec),
			datePublished: date(post?.published_at || episode.created_at),
			partOfSeries: text(channel?.name)
				? { "@type": "PodcastSeries", name: text(channel?.name) }
				: undefined,
		},
		image || undefined,
		date(episode.updated_at || post?.updated_at),
	);
}

async function loadPodcastEpisode(
	apiBase: string,
	id: string,
	fetcher: Fetcher,
) {
	const episode = record(
		await getJson(
			`${apiBase}/podcast/episodes/${encodeURIComponent(id)}`,
			fetcher,
		),
	);
	return episode ? podcastEpisodeContent(episode, id) : undefined;
}

async function loadPodcastShow(
	apiBase: string,
	slug: string,
	fetcher: Fetcher,
) {
	const data = record(
		await getJson(
			`${apiBase}/podcast/channels/${encodeURIComponent(slug)}/episodes`,
			fetcher,
		),
	);
	const channel = record(data?.channel);
	if (!channel || !text(channel.slug) || !text(channel.name)) return undefined;
	const name = text(channel.name);
	const description = plainText(
		channel.description,
		`收听 ${name} 的播客节目与最新单集。`,
	);
	return content(
		`/podcasts/show/${encodeURIComponent(slug)}`,
		`${name} | 播客节目 | Atoman`,
		description,
		{
			"@type": "PodcastSeries",
			name,
			description,
			image: text(channel.cover_url) || undefined,
		},
		text(channel.cover_url) || undefined,
		date(channel.updated_at),
	);
}

function duration(value: unknown): string | undefined {
	const seconds =
		typeof value === "number" ? Math.max(0, Math.floor(value)) : 0;
	return seconds ? `PT${seconds}S` : undefined;
}

async function loadVideo(apiBase: string, id: string, fetcher: Fetcher) {
	const video = record(
		await getJson(`${apiBase}/videos/${encodeURIComponent(id)}`, fetcher),
	);
	if (
		!video ||
		!text(video.id) ||
		!text(video.title) ||
		video.visibility !== "public" ||
		video.status !== "published"
	)
		return undefined;
	const title = text(video.title);
	const description = plainText(
		video.description,
		`在 Atoman 观看视频《${title}》。`,
	);
	const channel = record(video.channel);
	return content(
		`/videos/watch/${encodeURIComponent(id)}`,
		`${title} | 视频 | Atoman`,
		description,
		{
			"@type": "VideoObject",
			name: title,
			description,
			thumbnailUrl: text(video.thumbnail_url) || undefined,
			uploadDate: date(video.created_at),
			duration: duration(video.duration_sec),
			contentUrl: text(video.video_url) || undefined,
			creator: text(channel?.name)
				? { "@type": "Organization", name: text(channel?.name) }
				: undefined,
		},
		text(video.thumbnail_url) || undefined,
		date(video.updated_at),
	);
}

async function loadVideoCollection(
	apiBase: string,
	id: string,
	fetcher: Fetcher,
) {
	const videos = array(
		await getJson(
			`${apiBase}/videos?collection_id=${encodeURIComponent(id)}`,
			fetcher,
		),
	)
		.map(record)
		.filter(
			(video): video is Record<string, unknown> =>
				Boolean(video) &&
				video?.visibility === "public" &&
				video?.status === "published",
		);
	if (!videos.length) return undefined;
	const collection =
		record(videos[0].collection) ||
		array(videos[0].collections).map(record).find(Boolean);
	if (!collection || !text(collection.id) || !text(collection.name))
		return undefined;
	const name = text(collection.name);
	const description = plainText(
		collection.description,
		`浏览视频合集“${name}”。`,
	);
	return content(
		`/videos/collections/${encodeURIComponent(id)}`,
		`${name} | 视频合集 | Atoman`,
		description,
		{
			"@type": "CollectionPage",
			name,
			description,
			hasPart: videos.map((video) => ({
				"@type": "VideoObject",
				name: text(video.title),
				url: `${canonicalOrigin}/videos/watch/${encodeURIComponent(text(video.id))}`,
			})),
		},
		text(collection.cover_url) || text(videos[0].thumbnail_url) || undefined,
		date(collection.updated_at),
	);
}

export async function resolvePublicContentSeo(
	pathname: string,
	configuredApiUrl: string | undefined,
	requestOrigin: string,
	fetcher: Fetcher = fetch,
): Promise<PublicContentLookup> {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
	const apiBase = resolveApiBase(configuredApiUrl, requestOrigin);
	const routes: Array<
		[RegExp, (value: string) => Promise<PublicContentSeo | undefined>]
	> = [
		[/^\/music\/artist\/([^/]+)$/, (id) => loadArtist(apiBase, id, fetcher)],
		[/^\/music\/album\/([^/]+)$/, (id) => loadAlbum(apiBase, id, fetcher)],
		[/^\/music\/song\/([^/]+)$/, (id) => loadSong(apiBase, id, fetcher)],
		[/^\/forum\/topic\/([^/]+)$/, (id) => loadForumTopic(apiBase, id, fetcher)],
		[/^\/debate\/(?!rules$)([^/]+)$/, (id) => loadDebate(apiBase, id, fetcher)],
		[
			/^\/podcasts\/show\/([^/]+)$/,
			(slug) => loadPodcastShow(apiBase, slug, fetcher),
		],
		[
			/^\/podcasts\/episode\/([^/]+)$/,
			(id) => loadPodcastEpisode(apiBase, id, fetcher),
		],
		[/^\/videos\/watch\/([^/]+)$/, (id) => loadVideo(apiBase, id, fetcher)],
		[
			/^\/videos\/collections\/([^/]+)$/,
			(id) => loadVideoCollection(apiBase, id, fetcher),
		],
	];
	for (const [pattern, loader] of routes) {
		const match = path.match(pattern);
		if (!match) continue;
		try {
			return {
				matched: true,
				content: await loader(decodeURIComponent(match[1])),
			};
		} catch {
			return { matched: true, retryable: true };
		}
	}
	return { matched: false };
}

function metaTag(attribute: "name" | "property", key: string, value: string) {
	return `<meta data-page-meta="content" ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}">`;
}

function cleanDefaultMetadata(html: string) {
	return html
		.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "")
		.replace(
			/\s*<(?:meta|link|script)[^>]*(?:data-default-meta|data-page-meta="content")[^>]*>(?:[\s\S]*?<\/script>)?/gi,
			"",
		);
}

export function buildPublicContentHtml(html: string, item: PublicContentSeo) {
	const canonical = `${canonicalOrigin}${item.path}`;
	const image = item.imageUrl || defaultImage;
	const jsonLd = JSON.stringify({
		"@context": "https://schema.org",
		...item.structuredData,
		url: canonical,
	})
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026");
	const tags = [
		`<title data-page-meta="content">${escapeHtml(item.title)}</title>`,
		metaTag("name", "description", item.description),
		`<link data-page-meta="content" rel="canonical" href="${escapeHtml(canonical)}">`,
		metaTag("property", "og:type", "article"),
		metaTag("property", "og:title", item.title),
		metaTag("property", "og:description", item.description),
		metaTag("property", "og:url", canonical),
		metaTag("property", "og:image", image),
		metaTag("name", "twitter:card", "summary_large_image"),
		metaTag("name", "twitter:title", item.title),
		metaTag("name", "twitter:description", item.description),
		metaTag("name", "twitter:image", image),
		`<script data-page-meta="content" type="application/ld+json">${jsonLd}</script>`,
	].join("\n    ");
	return cleanDefaultMetadata(html).replace(
		/<\/head>/i,
		`    ${tags}\n  </head>`,
	);
}

export function buildUnresolvedPublicContentHtml(html: string) {
	return html.replace(
		/\s*<link(?=[^>]*data-default-meta)(?=[^>]*rel=["']canonical["'])[^>]*>/gi,
		"",
	);
}

export function buildMissingPublicContentHtml(html: string) {
	const cleanHtml = buildUnresolvedPublicContentHtml(html);
	if (/name=["']robots["']/i.test(cleanHtml)) return cleanHtml;
	return cleanHtml.replace(
		/<\/head>/i,
		'    <meta name="robots" content="noindex, nofollow">\n  </head>',
	);
}

function list(payload: unknown): Record<string, unknown>[] {
	return array(unwrap(payload))
		.map(record)
		.filter((value): value is Record<string, unknown> => Boolean(value));
}

async function fetchList(apiBase: string, path: string, fetcher: Fetcher) {
	const response = await fetcher(`${apiBase}${path}`, {
		headers: { Accept: "application/json" },
	});
	if (!response.ok)
		throw new Error(`Public sitemap source unavailable: ${path}`);
	return list(await response.json());
}

export async function collectPublicSitemapItems(
	apiBase: string,
	fetcher: Fetcher = fetch,
): Promise<SitemapItem[]> {
	const sources = await Promise.allSettled([
		fetchList(apiBase, "/music/artists?page=1&page_size=1000", fetcher),
		fetchList(apiBase, "/music/albums?page=1&page_size=1000", fetcher),
		fetchList(apiBase, "/forum/topics?page=1&page_size=1000", fetcher),
		fetchList(apiBase, "/debate/topics?page=1&page_size=1000", fetcher),
		fetchList(apiBase, "/podcast/episodes", fetcher),
		fetchList(apiBase, "/videos?sort=latest", fetcher),
	]);
	const fulfilled = (index: number) =>
		sources[index].status === "fulfilled"
			? (sources[index] as PromiseFulfilledResult<Record<string, unknown>[]>)
					.value
			: [];
	const artists = fulfilled(0);
	const albums = fulfilled(1);
	const topics = fulfilled(2);
	const debates = fulfilled(3);
	const episodes = fulfilled(4);
	const videos = fulfilled(5);
	const items: SitemapItem[] = [];

	artists.forEach((artist) => {
		if (text(artist.id))
			items.push({
				path: `/music/artist/${encodeURIComponent(text(artist.id))}`,
				last_modified: date(artist.updated_at),
			});
	});
	albums.forEach((album) => {
		if (text(album.id))
			items.push({
				path: `/music/album/${encodeURIComponent(text(album.id))}`,
				last_modified: date(album.updated_at),
			});
		array(album.songs)
			.map(record)
			.filter(Boolean)
			.forEach((song) => {
				if (text(song?.id))
					items.push({
						path: `/music/song/${encodeURIComponent(text(song?.id))}`,
						last_modified: date(song?.updated_at) || date(album.updated_at),
					});
			});
	});
	topics.forEach((topic) => {
		if (text(topic.id))
			items.push({
				path: `/forum/topic/${encodeURIComponent(text(topic.id))}`,
				last_modified: date(topic.updated_at),
			});
	});
	debates.forEach((debate) => {
		if (text(debate.id))
			items.push({
				path: `/debate/${encodeURIComponent(text(debate.id))}`,
				last_modified: date(debate.updated_at),
			});
	});
	episodes.forEach((episode) => {
		if (text(episode.id))
			items.push({
				path: `/podcasts/episode/${encodeURIComponent(text(episode.id))}`,
				last_modified: date(episode.updated_at),
			});
		const channel = record(episode.channel);
		if (text(channel?.slug))
			items.push({
				path: `/podcasts/show/${encodeURIComponent(text(channel?.slug))}`,
				last_modified: date(channel?.updated_at),
			});
	});
	videos.forEach((video) => {
		if (
			text(video.id) &&
			video.visibility === "public" &&
			video.status === "published"
		) {
			items.push({
				path: `/videos/watch/${encodeURIComponent(text(video.id))}`,
				last_modified: date(video.updated_at),
			});
			const collections = [
				record(video.collection),
				...array(video.collections).map(record),
			].filter(Boolean);
			collections.forEach((collection) => {
				if (text(collection?.id))
					items.push({
						path: `/videos/collections/${encodeURIComponent(text(collection?.id))}`,
						last_modified: date(collection?.updated_at),
					});
			});
		}
	});
	return items;
}
