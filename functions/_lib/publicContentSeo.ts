import { selectPublicMusicSeoArtwork } from "../../src/utils/musicArtwork";
import { publicVideoCollections } from "../../src/utils/publicVideoCollections";
import {
	injectSeoFallbackHtml,
	resolveApiBase,
	type SitemapItem,
} from "./blogSeo";
import { canShowSongEditorialNote, getSongEditorialNote, type SongEditorialNote } from "../../src/content/musicEditorialNotes";

export type PublicContentSeo = {
	path: string;
	title: string;
	description: string;
	imageUrl?: string;
	lastModified?: string;
	structuredData: Record<string, unknown>;
	relatedLinks?: Array<{ href: string; label: string }>;
	// Body copy can be longer than the search-snippet meta description.
	bodyText?: string;
	metadataFacts?: Array<{ name: string; value: string }>;
	/** Visible to visitors in the song drawer as well as in server HTML. */
	editorialNote?: SongEditorialNote;
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

function normalizedPlainText(value: unknown): string {
	return text(value)
		.replace(/<[^>]*>/g, " ")
		.replace(/[#*_`>~[\]()]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function plainText(value: unknown, fallback: string): string {
	const normalized = normalizedPlainText(value);
	if (!normalized || /^(?:暂无|暂无内容|暂无资料|暂无信息|暂无介绍|暂无数据|暂略|略|待完善|未填写|待补充|无|n\/a|none|null|not available|--?)$/i.test(normalized)) return fallback;
	return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function fullBodyText(value: unknown, fallback: string): string {
	const normalized = normalizedPlainText(value);
	// The full authored summary is useful to crawlers; do not truncate it to
	// the 160-character meta-snippet limit. Bound very large content separately.
	return normalized && !/^(?:暂无|暂无内容|暂无资料|暂无信息|暂无介绍|暂无数据|暂略|略|待完善|未填写|待补充|无|n\/a|none|null|not available|--?)$/i.test(normalized) ? normalized.slice(0, 4000) : fallback;
}

function safeReleaseDate(value: unknown, precision: unknown): { raw?: string; label?: string; published?: string } {
	const raw = date(value);
	if (!raw || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return {};
	const year = Number(raw.slice(0, 4));
	const month = Number(raw.slice(5, 7));
	const day = Number(raw.slice(8, 10));
	const parsed = new Date(Date.UTC(year, month - 1, day));
	if (year < 1000 || year > new Date().getUTCFullYear() + 1 ||
		parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return {};
	const detail = text(precision);
	const label = detail === "year" || detail === "unknown" ? `${year} 年`
		: detail === "month" ? `${year} 年 ${month} 月`
		: `${year} 年 ${month} 月 ${day} 日`;
	const published = detail === "year" ? raw.slice(0, 4)
		: detail === "month" ? raw.slice(0, 7)
		: detail === "unknown" ? undefined
		: raw.slice(0, 10);
	return { raw, label, published };
}

function date(value: unknown): string | undefined {
	const candidate = text(value);
	return candidate && !candidate.startsWith("0001-01-01")
		? candidate
		: undefined;
}

type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

function parseJsonValue(value: unknown): JsonValue {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	)
		return value;
	if (Array.isArray(value)) return value.map(parseJsonValue);
	if (typeof value === "object") {
		const object: { [key: string]: JsonValue } = {};
		for (const [key, entry] of Object.entries(value))
			object[key] = parseJsonValue(entry);
		return object;
	}
	throw new Error("Expected a JSON value");
}

function unwrap(payload: JsonValue): JsonValue {
	const envelope = record(payload);
	return envelope && "data" in envelope ? (envelope.data as JsonValue) : payload;
}

async function getJson(url: string, fetcher: Fetcher): Promise<JsonValue> {
	const response = await fetcher(url, {
		headers: {
			Accept: "application/json",
			"User-Agent": "Atoman-Edge-SSR/1.0 (+https://www.atoman.org)",
		},
		signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(7000) : undefined,
	});
	// A genuine catalogue miss is a JSON API response. An HTML/proxy error
	// must not cause an otherwise public page to be de-indexed.
	if (response.status === 404 || response.status === 400) {
		if (!/\b(?:application\/json|application\/[\w.+-]+\+json)\b/i.test(response.headers.get("content-type") || "")) {
			throw new Error("Non-JSON public SEO error");
		}
		await response.json();
		return null;
	}
	if (!response.ok)
		throw new Error(`Public SEO source returned ${response.status}`);
	return unwrap(parseJsonValue(await response.json()));
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function musicEntityUrl(kind: "artist" | "album" | "song", id: unknown): string | undefined {
	const value = text(id);
	return uuidPattern.test(value) ? `${canonicalOrigin}/music/${kind}/${value.toLowerCase()}` : undefined;
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
	relatedLinks?: PublicContentSeo["relatedLinks"],
	bodyText?: string,
	metadataFacts?: PublicContentSeo["metadataFacts"],
	editorialNote?: PublicContentSeo["editorialNote"],
): PublicContentSeo {
	return { path, title, description, imageUrl, lastModified, structuredData, relatedLinks, bodyText, metadataFacts, editorialNote };
}

function bookCoverUrl(value: unknown, apiBase: string): string | undefined {
	const source = text(value);
	if (!source) return undefined;
	try {
		const result = new URL(source, new URL(apiBase).origin);
		return result.protocol === "https:" || result.protocol === "http:"
			? result.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

async function loadBookWork(apiBase: string, id: string, fetcher: Fetcher) {
	const work = record(
		await getJson(`${apiBase}/books/works/${encodeURIComponent(id)}`, fetcher),
	);
	if (!work || !text(work.id) || !text(work.title) ||
		(text(work.lifecycle_status) && text(work.lifecycle_status) !== "active"))
		return undefined;
	const title = text(work.title);
	const authors = names(work.authors);
	const editions = array(work.editions).map(record).filter(Boolean);
	const publicEditions = editions.filter((edition) =>
		!text(edition?.lifecycle_status) || text(edition?.lifecycle_status) === "active",
	);
	const factualFallback = "在 Atoman 查看《" + title + "》的作品资料" +
		(authors.length ? "，作者 " + authors.join("、") : "") +
		(publicEditions.length ? "，当前关联 " + publicEditions.length + " 个公开出版版本" : "") +
		"。可以进入具体版本查看已收录的出版社、版本说明、ISBN 等书目信息，并浏览相关公开书单。";
	const description = plainText(work.description || work.subtitle, factualFallback);
	const image = bookCoverUrl(work.cover_url || editions[0]?.cover_url, apiBase);
	return content(
		`/books/work/${encodeURIComponent(text(work.id))}`,
		`《${title}》${authors.length ? ` - ${authors.join("、")}` : ""} | 图书 | Atoman`,
		description,
		{
			"@type": "Book",
			name: title,
			description,
			author: authors.map((name) => ({ "@type": "Person", name })),
			image,
			workExample: editions.filter((edition) => uuidPattern.test(text(edition?.id))).map((edition) => ({
				"@type": "Book",
				name: text(edition?.title) || title,
				isbn: text(edition?.isbn13) || text(edition?.isbn10) || undefined,
				url: `${canonicalOrigin}/books/edition/${text(edition?.id).toLowerCase()}`,
			})),
		},
		image,
		date(work.updated_at),
		editions.flatMap((edition) => {
			const eid = text(edition?.id);
			return uuidPattern.test(eid)
				? [{ href: `${canonicalOrigin}/books/edition/${eid.toLowerCase()}`, label: text(edition?.edition_statement) || text(edition?.title) || `${title} · 出版版本` }]
				: [];
		}).slice(0, 50),
	);
}

async function loadBookEdition(apiBase: string, id: string, fetcher: Fetcher) {
	const metadata = record(
		await getJson(`${apiBase}/books/wiki/edition/${encodeURIComponent(id)}`, fetcher),
	);
	const fields = record(metadata?.fields);
	const workId = text(fields?.work_id);
	if (!workId) return undefined;
	const work = record(
		await getJson(`${apiBase}/books/works/${encodeURIComponent(workId)}`, fetcher),
	);
	if (!work || !text(work.id) || !text(work.title) ||
		(text(work.lifecycle_status) && text(work.lifecycle_status) !== "active"))
		return undefined;
	const editionId = text(metadata?.entity_id) || id;
	const edition = array(work.editions).map(record).find((item) => text(item?.id) === editionId);
	if (!edition) return undefined;
	const title = text(edition.title) || text(work.title);
	const authors = names(work.authors);
	const publisher = text(edition.publisher) || text(record(edition.publisher_info)?.name);
	const isbn = text(edition.isbn13) || text(edition.isbn10);
	const editionFacts = ["《" + title + "》", authors.length ? "作者 " + authors.join("、") : "",
		publisher ? "出版社 " + publisher : "",
		text(edition.edition_statement) ? "版本 " + text(edition.edition_statement) : "",
		isbn ? "ISBN " + isbn : ""].filter(Boolean).join("；");
	const description = editionFacts +
		"。在 Atoman 查看该出版版本的书目资料，并通过所属作品了解已公开收录的其他版本及相关内容。";
	const image = bookCoverUrl(edition.cover_url, apiBase);
	return content(
		`/books/edition/${encodeURIComponent(editionId)}`,
		`《${title}》${text(edition.edition_statement) ? `（${text(edition.edition_statement)}）` : ""} | 图书版本 | Atoman`,
		description,
		{
			"@type": "Book",
			name: title,
			description,
			author: authors.map((name) => ({ "@type": "Person", name })),
			bookEdition: text(edition.edition_statement) || undefined,
			bookFormat: text(edition.binding) || undefined,
			isbn: isbn || undefined,
			inLanguage: text(edition.language) || undefined,
			numberOfPages: typeof edition.page_count === "number" ? edition.page_count : undefined,
			publisher: publisher ? { "@type": "Organization", name: publisher } : undefined,
			datePublished: date(edition.published_date),
			image,
		},
		image,
		date(fields?.updated_at),
		uuidPattern.test(workId)
			? [{ href: `${canonicalOrigin}/books/work/${workId.toLowerCase()}`, label: `所属作品：${text(work.title)}` }]
			: [],
	);
}

async function loadBookList(apiBase: string, id: string, fetcher: Fetcher) {
	const booklist = record(
		await getJson(`${apiBase}/books/booklists/${encodeURIComponent(id)}`, fetcher),
	);
	if (!booklist || !text(booklist.id) || !text(booklist.title) || booklist.visibility !== "public")
		return undefined;
	const title = text(booklist.title);
	const description = plainText(booklist.description, `在 Atoman 浏览公开书单《${title}》及其推荐作品。`);
	const works = array(booklist.items).map(record).filter((item) => item?.available === true && !!text(item?.canonical_work_id));
	return content(
		`/books/lists/${encodeURIComponent(text(booklist.id))}`,
		`${title} | 公开书单 | Atoman`,
		description,
		{
			"@type": "CollectionPage",
			name: title,
			description,
			mainEntity: {
				"@type": "ItemList",
				itemListElement: works.map((item, index) => ({
					"@type": "ListItem",
					position: index + 1,
					name: text(item?.title),
					url: `${canonicalOrigin}/books/work/${encodeURIComponent(text(item?.canonical_work_id))}`,
				})),
			},
		},
		undefined,
		date(booklist.updated_at || booklist.published_at),
		works.flatMap((entry) => {
			const workId = text(entry?.canonical_work_id);
			return uuidPattern.test(workId)
				? [{ href: `${canonicalOrigin}/books/work/${workId.toLowerCase()}`, label: text(entry?.title) || `图书作品 ${workId}` }]
				: [];
		}).slice(0, 50),
	);
}

async function loadArtist(apiBase: string, id: string, fetcher: Fetcher) {
	const artist = record(
		await getJson(`${apiBase}/music/artists/${encodeURIComponent(id)}`, fetcher),
	);
	if (!artist || !text(artist.id) || !text(artist.name)) return undefined;
	const name = text(artist.display_name) || text(artist.name);
	const seenAlbumIds = new Set<string>();
	const publicAlbums = array(artist.albums).map(record).filter(Boolean).filter((album) =>
		(!text(album?.lifecycle_status) || text(album?.lifecycle_status) === "active") &&
		(!text(album?.status) || text(album?.status) === "open") &&
		(!text(album?.entry_status) || text(album?.entry_status) === "open"),
	);
	const albumLinks = publicAlbums.flatMap((album) => {
		const href = musicEntityUrl("album", album?.id);
		const label = text(album?.title);
		if (!href || !label || seenAlbumIds.has(href)) return [];
		seenAlbumIds.add(href);
		return [{ href, label }];
	});
	const relatedLinks = albumLinks.slice(0, 60);
	const albumExamples = albumLinks.slice(0, 3).map((album) => "《" + album.label + "》").join("、");
	const factualFallback = albumLinks.length
		? "在 Atoman 查看 " + name + " 的音乐人档案与作品关联。当前公开收录 " + albumLinks.length +
		  " 张专辑" + (albumExamples ? "，包括 " + albumExamples : "") +
		  "；可以进入专辑页面浏览已收录的曲目与作品资料。"
		: "在 Atoman 查看 " + name + " 的音乐人档案。当前没有可公开展示的关联专辑，可以通过音乐人和歌曲目录继续浏览其他已收录作品。";
	const authoredBio = plainText(artist.bio, "");
	const description = authoredBio
		? plainText(`${name}｜音乐人档案：${authoredBio}`, factualFallback)
		: plainText("", factualFallback);
	return content(
		`/music/artist/${encodeURIComponent(id)}`,
		`${name} | 音乐档案 | Atoman`,
		description,
		{
			"@type": artist.artist_form === "person" ? "Person" : "MusicGroup",
			name,
			description,
			image: selectPublicMusicSeoArtwork(artist.image_url),
		},
		selectPublicMusicSeoArtwork(artist.image_url),
		date(artist.updated_at),
		relatedLinks,
		fullBodyText(artist.bio, factualFallback),
		albumLinks.length ? [{ name: "已收录公开专辑", value: String(albumLinks.length) }] : [],
	);
}

async function loadAlbum(apiBase: string, id: string, fetcher: Fetcher) {
	const album = record(
		await getJson(`${apiBase}/music/albums/${encodeURIComponent(id)}`, fetcher),
	);
	if (!album || !text(album.id) || !text(album.title)) return undefined;
	const title = text(album.title);
	const artists = names(album.artists);
	const released = safeReleaseDate(album.release_date, album.release_date_precision);
	const tracks = array(album.songs).map(record).filter(Boolean).filter((track) =>
		(!text(track?.lifecycle_status) || text(track?.lifecycle_status) === "active") &&
		(!text(track?.status) || text(track?.status) === "open"),
	);
	const relatedLinks = tracks
		.map((track) => ({ href: musicEntityUrl("song", track?.id), label: text(track?.title) }))
		.filter((link): link is { href: string; label: string } => Boolean(link.href && link.label))
		.slice(0, 60);
	const factualFallback = [
		`在 Atoman 查看专辑《${title}》的资料`,
		artists.length ? `音乐人：${artists.join("、")}` : "",
		released.label ? `发行时间：${released.label}` : "",
		tracks.length ? `已收录 ${tracks.length} 首曲目` : "",
	].filter(Boolean).join("；") + "。";
	const authoredDescription = plainText(album.description, "");
	const albumIdentity = `专辑《${title}》${artists.length ? `（${artists.join("、")}）` : ""}`;
	const shortDescriptionFacts = [
		released.label ? `发行时间：${released.label}` : "",
		tracks.length ? `已收录 ${tracks.length} 首曲目` : "",
	].filter(Boolean).join("；");
	const description = authoredDescription
		? plainText(`${albumIdentity}：${authoredDescription}${authoredDescription.length < 30 && shortDescriptionFacts ? ` ${shortDescriptionFacts}。` : ""}`, factualFallback)
		: plainText("", factualFallback);
	const facts = [
		released.label ? { name: "发行时间", value: released.label } : undefined,
		tracks.length ? { name: "已收录曲目", value: `${tracks.length} 首` } : undefined,
	].filter((item): item is { name: string; value: string } => Boolean(item));
	return content(
		`/music/album/${encodeURIComponent(id)}`,
		`《${title}》${artists.length ? ` - ${artists.join("、")}` : ""} | 专辑 | Atoman`,
		description,
		{
			"@type": "MusicAlbum",
			name: title,
			description,
			image: selectPublicMusicSeoArtwork(album.cover_url),
			byArtist: array(album.artists).map(record).filter(Boolean).map((artist) => ({
				"@type": "MusicGroup",
				name: text(artist?.name),
				url: musicEntityUrl("artist", artist?.id),
			})).filter((artist) => artist.name),
			datePublished: released.published,
			numTracks: tracks.length || undefined,
		},
		selectPublicMusicSeoArtwork(album.cover_url),
		date(album.updated_at),
		relatedLinks,
		fullBodyText(album.description, factualFallback),
		facts,
	);
}

async function loadSong(apiBase: string, id: string, fetcher: Fetcher) {
	const detail = record(
		await getJson(`${apiBase}/music/songs/${encodeURIComponent(id)}`, fetcher),
	);
	const song = record(detail?.song);
	if (!song || !text(song.id) || !text(song.title) ||
		(text(song.lifecycle_status) && text(song.lifecycle_status) !== "active")) return undefined;
	const title = text(song.title);
	const artists = names(detail?.artists);
	const album = record(song.album);
	const durationSeconds = typeof song.duration_sec === "number" && Number.isFinite(song.duration_sec) && song.duration_sec > 0
		? Math.round(song.duration_sec) : undefined;
	const durationLabel = durationSeconds === undefined ? "" : `${Math.floor(durationSeconds / 60)} 分 ${String(durationSeconds % 60).padStart(2, "0")} 秒`;
	// Use only plausible dates, respecting day/month/year source precision.
	const released = safeReleaseDate(song.release_date, song.release_date_precision);
	const albumName = text(album?.title);
	const trackNumber = typeof song.track_number === "number" && Number.isInteger(song.track_number) && song.track_number > 0 && song.track_number < 1000
		? song.track_number : undefined;
	const discNumber = typeof song.disc_number === "number" && Number.isInteger(song.disc_number) && song.disc_number > 0 && song.disc_number < 100
		? song.disc_number : undefined;
	const trackPosition = trackNumber === undefined ? "" : discNumber && discNumber > 1
		? `第 ${discNumber} 碟，第 ${trackNumber} 首` : `第 ${trackNumber} 首`;
	const facts = [
		released.label ? { name: "发行时间", value: released.label } : undefined,
		trackPosition ? { name: "曲目序号", value: trackPosition } : undefined,
	].filter((item): item is { name: string; value: string } => Boolean(item));
	const factualFallback = [
		`在 Atoman 查看歌曲《${title}》的作品资料`,
		artists.length ? `音乐人：${artists.join("、")}` : "",
		albumName ? `收录于《${albumName}》` : "",
		released.label ? `发行时间：${released.label}` : "",
		trackPosition ? `曲目序号：${trackPosition}` : "",
		durationLabel ? `时长 ${durationLabel}` : "",
	].filter(Boolean).join("；") + "。";
	const editorialNote = canShowSongEditorialNote({
		description: text(song.description),
		lifecycle_status: text(song.lifecycle_status),
		status: text(song.status),
		entry_status: text(song.entry_status),
	}) ? getSongEditorialNote(id, title, text(album?.id) || text(song.album_id)) : undefined;
	const description = plainText(song.description, editorialNote?.text || factualFallback);
	const relatedLinks = ([
		{ record: record(detail?.previous), prefix: "上一首" },
		{ record: record(detail?.next), prefix: "下一首" },
	] as const).flatMap(({ record: adjacent, prefix }) => {
		const href = musicEntityUrl("song", adjacent?.id);
		const label = text(adjacent?.title);
		return href && label && adjacent?.lifecycle_status !== "merged" && adjacent?.lifecycle_status !== "retired"
			? [{ href, label: `${prefix}：${label}` }] : [];
	});
	return content(
		`/music/song/${encodeURIComponent(id)}`,
		[
			`《${title}》${artists.length ? ` - ${artists.join("、")}` : ""}`,
			"歌曲",
			albumName && albumName !== title ? `《${albumName}》` : "",
			albumName ? trackPosition : "",
			"Atoman",
		].filter(Boolean).join(" | "),
		description,
		{
			"@type": "MusicRecording",
			name: title,
			description,
			image: selectPublicMusicSeoArtwork(song.cover_url, album?.cover_url),
			byArtist: array(detail?.artists).map(record).filter(Boolean).map((artist) => ({
				"@type": "MusicGroup",
				name: text(artist?.name),
				url: musicEntityUrl("artist", artist?.id),
			})).filter((artist) => artist.name),
			duration: durationSeconds !== undefined ? `PT${durationSeconds}S` : undefined,
			datePublished: released.published,
			inAlbum: albumName
				? { "@type": "MusicAlbum", name: albumName, url: musicEntityUrl("album", album?.id) }
				: undefined,
		},
		selectPublicMusicSeoArtwork(song.cover_url, album?.cover_url),
		date(song.updated_at),
		relatedLinks,
		fullBodyText(song.description, factualFallback),
		facts,
		editorialNote,
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
		await getJson(`${apiBase}/debate/topics/${encodeURIComponent(id)}`, fetcher),
	);
	if (!debate || !text(debate.id) || !text(debate.title)) return undefined;
	const title = text(debate.title);
	const authored = fullBodyText(debate.description, "") || fullBodyText(debate.content, "");
	const created = safeReleaseDate(debate.created_at, "day").label;
	const stats = record(debate.stats);
	const counts = [["论点", stats?.claim_count], ["证据", stats?.active_evidence_count], ["反驳", stats?.rebuttal_count]]
		.flatMap(([label, value]) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? [`${label} ${value} 条`] : []);
	const factual = [`Atoman 公开辩题“${title}”`, created ? `创建于 ${created}` : "",
		counts.length ? `当前公开讨论：${counts.join("、")}` : "",
		!authored ? "尚未提供辩题背景说明" : ""].filter(Boolean).join("；") + "。";
	const body = [authored, factual].filter(Boolean).join(" ");
	const description = plainText(authored.length >= 30 ? authored : body, factual);
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
		undefined,
		body,
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
	const seconds = typeof value === "number" ? Math.max(0, Math.floor(value)) : 0;
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
	const channel = record(video.channel);
	const collections = publicVideoCollections([video]);
	const published = safeReleaseDate(video.created_at, "day").label;
	const seconds = typeof video.duration_sec === "number" && Number.isFinite(video.duration_sec) && video.duration_sec > 0
		? Math.floor(video.duration_sec) : 0;
	const facts = [text(channel?.name) ? { name: "发布频道", value: text(channel?.name) } : undefined,
		published ? { name: "发布时间", value: published } : undefined]
		.filter((fact): fact is {name: string; value: string} => Boolean(fact));
	const factual = [`Atoman 公开视频《${title}》`, ...facts.map(fact => `${fact.name}：${fact.value}`),
		seconds ? `时长 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : "",
		collections.length ? `所属公开合集：${collections.map(entry => `《${entry.name}》`).join("、")}` : ""]
		.filter(Boolean).join("；") + "。";
	const authored = fullBodyText(video.description, "");
	const body = [authored, factual].filter(Boolean).join(" ");
	const description = plainText(authored.length >= 30 ? authored : body, factual);
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
		collections.map((collection) => ({
			href: canonicalOrigin + "/videos/collections/" + encodeURIComponent(collection.id),
			label: collection.name,
		})),
		body,
		facts,
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
	const collection = publicVideoCollections(videos).find((entry) => entry.id === id);
	if (!collection) return undefined;
	const name = text(collection.name);
	// A collection is a catalogue, not the primary watch page for its
	// members. Describe the actual public links without inventing video
	// thumbnails or upload dates required by Google's VideoObject feature.
	const members = videos
		.filter((video) => uuidPattern.test(text(video.id)) && text(video.title) &&
			publicVideoCollections([video]).some((entry) => entry.id === id))
		.slice(0, 100)
		.map((video) => ({
			href: canonicalOrigin + "/videos/watch/" + encodeURIComponent(text(video.id)),
			label: text(video.title),
		}));
	const uniqueMembers = [...new Map(members.map(member => [member.href, member])).values()];
	const examples = uniqueMembers.slice(0, 3).map(member => `《${member.label}》`).join("、");
	const factual = [`Atoman 公开视频合集“${name}”`, uniqueMembers.length ? `当前展示 ${uniqueMembers.length} 个公开视频` : "",
		examples ? `包括 ${examples}` : ""].filter(Boolean).join("；") + "。";
	const authored = fullBodyText(collection.description, "");
	const body = [authored, factual].filter(Boolean).join(" ");
	const description = plainText(authored.length >= 30 ? authored : body, factual);
	return content(
		`/videos/collections/${encodeURIComponent(id)}`,
		`${name} | 视频合集 | Atoman`,
		description,
		{
			"@type": "CollectionPage",
			name,
			description,
			mainEntity: {
				"@type": "ItemList",
				numberOfItems: uniqueMembers.length,
				itemListElement: uniqueMembers.map(({ href, label }, index) => ({
					"@type": "ListItem",
					position: index + 1,
					name: label,
					url: href,
				})),
			},
		},
		text(collection.cover_url) || text(videos[0].thumbnail_url) || undefined,
		date(collection.updated_at),
		uniqueMembers,
		body,
	);
}

export function isAggregatedFeedItemPath(pathname: string) {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
	return /^\/feed\/item\/[^/]+$/.test(path);
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
		[/^\/books\/work\/([^/]+)$/, (id) => loadBookWork(apiBase, id, fetcher)],
		[/^\/books\/edition\/([^/]+)$/, (id) => loadBookEdition(apiBase, id, fetcher)],
		[/^\/books\/lists\/(?!new$)([^/]+)$/, (id) => loadBookList(apiBase, id, fetcher)],
		[/^\/music\/artist\/(?!new$)([^/]+)$/, (id) => loadArtist(apiBase, id, fetcher)],
		[/^\/music\/album\/([^/]+)$/, (id) => loadAlbum(apiBase, id, fetcher)],
		[/^\/music\/song\/([^/]+)$/, (id) => loadSong(apiBase, id, fetcher)],
		[/^\/forum\/topic\/([^/]+)$/, (id) => loadForumTopic(apiBase, id, fetcher)],
		[/^\/debate\/(?!(?:rules|search|me)$)([^/]+)$/, (id) => loadDebate(apiBase, id, fetcher)],
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

function directVideoSource(value: unknown) {
	const url = text(value);
	if (!url) return undefined;
	try {
		const pathname = new URL(url).pathname;
		return /\.(?:mp4|m4v|webm|ogg|m3u8)$/i.test(pathname) ? url : undefined;
	} catch {
		return undefined;
	}
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
	const structuredTitle =
		text(item.structuredData.name) ||
		text(item.structuredData.headline) ||
		item.title;
	type FactValue = { label: string; href?: string };
	const facts: Array<{ name: string; values: FactValue[] }> = [];
	const entity = item.structuredData;
	const safeLink = (value: unknown) => {
		const candidate = text(value);
		try {
			const url = new URL(candidate);
			return url.origin === canonicalOrigin && /^\/(?:music\/(?:artist|album|song)|books\/(?:work|edition)|videos\/(?:watch|collections))\/[a-f0-9-]{36}$/i.test(url.pathname)
				? url.pathname : undefined;
		} catch { return undefined; }
	};
	const authorNames = array(entity.author).map((author) => text(record(author)?.name)).filter(Boolean);
	if (authorNames.length) facts.push({ name: "作者", values: authorNames.map((label) => ({ label })) });
	const performers = array(entity.byArtist).map(record).filter(Boolean).map((artist) => ({
		label: text(artist?.name), href: safeLink(artist?.url),
	})).filter((artist) => artist.label);
	if (performers.length) facts.push({ name: "音乐人", values: performers });
	if (text(entity.isbn)) facts.push({ name: "ISBN", values: [{ label: text(entity.isbn) }] });
	if (text(record(entity.publisher)?.name)) facts.push({ name: "出版社", values: [{ label: text(record(entity.publisher)?.name) }] });
	const album = record(entity.inAlbum);
	if (text(album?.name)) facts.push({ name: "所属专辑", values: [{ label: text(album?.name), href: safeLink(album?.url) }] });
	if (typeof entity.numberOfPages === "number" && entity.numberOfPages > 0)
		facts.push({ name: "页数", values: [{ label: String(entity.numberOfPages) }] });
	if (typeof entity.duration === "string" && /^PT[0-9]+S$/.test(entity.duration)) {
		const seconds = Number(entity.duration.slice(2, -1));
		facts.push({ name: "时长", values: [{ label: `${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, "0")} 秒` }] });
	}
	for (const fact of item.metadataFacts || []) {
		if (text(fact.name) && text(fact.value)) facts.push({ name: text(fact.name), values: [{ label: text(fact.value) }] });
	}
	const factsHtml = facts.length
		? `<section aria-label="作品资料"><h2>作品资料</h2><dl>${facts.map(({ name, values }) =>
			`<dt>${escapeHtml(name)}</dt><dd>${values.map(({ label, href }) => href
				? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : escapeHtml(label)).join("、")}</dd>`
		).join("")}</dl></section>`
		: "";
	const relatedLinks = (item.relatedLinks || [])
		.map((link) => ({ href: safeLink(link.href), label: text(link.label) }))
		.filter((link): link is { href: string; label: string } => Boolean(link.href && link.label));
	const relatedHeading = item.path.startsWith("/music/artist/") ? "公开专辑"
		: item.path.startsWith("/books/work/") ? "出版版本"
		: item.path.startsWith("/books/edition/") ? "所属作品"
		: item.path.startsWith("/books/lists/") ? "书单作品"
		: item.path.startsWith("/videos/collections/") ? "合集视频"
		: item.path.startsWith("/videos/watch/") ? "所属合集"
		: entity["@type"] === "MusicAlbum" ? "专辑曲目" : "相邻曲目";
	const relatedHtml = relatedLinks.length
		? `<nav aria-label="相关作品"><h2>${relatedHeading}</h2><ul>${relatedLinks.map((link) =>
			`<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul></nav>`
		: "";
	const fallbackHtml = injectSeoFallbackHtml(cleanDefaultMetadata(html), {
		kind: "content",
		title: structuredTitle,
		description: item.bodyText || item.description,
		canonical,
		// A default share image is not a genuine music cover.
		imageUrl: item.path.startsWith("/music/") ? item.imageUrl : image,
		mediaUrl:
			item.structuredData["@type"] === "VideoObject"
				? directVideoSource(item.structuredData.contentUrl)
				: undefined,
	});
	const sourcesHtml = item.editorialNote?.sources.flatMap((source) => {
		try {
			const url = new URL(source.href);
			if (url.protocol !== "https:" ||
				!["music.apple.com", "pitchfork.com"].includes(url.hostname)) return [];
			return [`<a href="${escapeHtml(url.href)}" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`];
		} catch { return []; }
	}).join("、") || "";
	const editorialHtml = item.editorialNote
		? `<section data-seo-editorial="song"><h2>编辑补充资料</h2><p>${escapeHtml(item.editorialNote.text)}</p>${sourcesHtml ? `<p>参考来源：${sourcesHtml}</p>` : ""}</section>`
		: "";
	const htmlSupplement = factsHtml + editorialHtml + relatedHtml;
	const detailedHtml = htmlSupplement
		? fallbackHtml.replace(
			/(<main data-seo-fallback="content"><h1>[\s\S]*?<\/h1><p>[\s\S]*?<\/p>)/,
			(marker) => `${marker}${htmlSupplement}`,
		)
		: fallbackHtml;
	return detailedHtml.replace(
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

export function buildAggregatedContentHtml(html: string) {
	const cleanHtml = buildUnresolvedPublicContentHtml(html);
	if (/name=["']robots["']/i.test(cleanHtml)) return cleanHtml;
	return cleanHtml.replace(
		/<\/head>/i,
		'    <meta name="robots" content="noindex, follow">\n  </head>',
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

type ListPage = {
	items: Record<string, unknown>[];
	hasMore: boolean;
	complete: boolean;
	total?: number;
};

type SitemapSourceResult = {
	items: Record<string, unknown>[];
	complete: boolean;
};

function list(payload: JsonValue): Record<string, unknown>[] {
	return array(unwrap(payload))
		.map(record)
		.filter((value): value is Record<string, unknown> => Boolean(value));
}

function listPage(payload: JsonValue): ListPage {
	const envelope = record(payload);
	const meta = record(envelope?.meta);
	const raw = unwrap(payload);
	const items = list(payload);
	return {
		items,
		hasMore: meta?.has_more === true,
		complete: Array.isArray(raw) && raw.length === items.length &&
			(meta?.has_more === undefined || typeof meta.has_more === "boolean"),
		total: typeof meta?.total === "number" && Number.isSafeInteger(meta.total) && meta.total >= 0
			? meta.total : undefined,
	};
}

function pagePath(path: string, page: number) {
	const url = new URL(path, "https://seo.atoman.invalid");
	url.searchParams.set("page", String(page));
	return `${url.pathname}${url.search}`;
}

async function fetchListPage(
	apiBase: string,
	path: string,
	fetcher: Fetcher,
): Promise<ListPage> {
	const response = await fetcher(`${apiBase}${path}`, {
		headers: {
			Accept: "application/json",
			"User-Agent": "Atoman-Edge-SSR/1.0 (+https://www.atoman.org)",
		},
		signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(7000) : undefined,
	});
	if (!response.ok)
		throw new Error(`Public sitemap source unavailable: ${path}`);
	return listPage(parseJsonValue(await response.json()));
}

async function fetchList(apiBase: string, path: string, fetcher: Fetcher) {
	const pathUrl = new URL(path, "https://seo.atoman.invalid");
	const firstPage = await fetchListPage(apiBase, path, fetcher);
	const items = [...firstPage.items];
	let complete = firstPage.complete;
	const total = firstPage.total;
	const isComplete = () => complete && (total === undefined || items.length === total);
	if (!firstPage.hasMore) return { items, complete: isComplete() };
	if (!pathUrl.searchParams.has("page")) return { items, complete: false };

	let page = Number(pathUrl.searchParams.get("page")) || 1;
	for (let requestCount = 0; requestCount < 100; requestCount += 1) {
		page += 1;
		const nextPage = await fetchListPage(apiBase, pagePath(path, page), fetcher);
		items.push(...nextPage.items);
		complete = complete && nextPage.complete &&
			(total === undefined || nextPage.total === undefined || nextPage.total === total);
		if (!nextPage.hasMore) return { items, complete: isComplete() };
	}
	// Preserve discovered URLs, but never cache a pagination-truncated map.
	return { items, complete: false };
}

async function fetchBookCollection(apiBase: string, path: string, fetcher: Fetcher) {
	const limit = 50;
	const items: Record<string, unknown>[] = [];
	let complete = true;
	for (let page = 0; page < 100; page += 1) {
		const response = await fetcher(`${apiBase}${path}?limit=${limit}&offset=${page * limit}`, {
			headers: {
				Accept: "application/json",
				"User-Agent": "Atoman-Edge-SSR/1.0 (+https://www.atoman.org)",
			},
			signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(7000) : undefined,
		});
		if (!response.ok) throw new Error(`Book sitemap source unavailable: ${path}`);
		const payload = record(unwrap(parseJsonValue(await response.json())));
		if (!payload || !Array.isArray(payload.items)) throw new Error("Malformed book sitemap source");
		const pageItems = array(payload.items).map(record).filter((item): item is Record<string, unknown> => Boolean(item));
		items.push(...pageItems);
		complete = complete && pageItems.length === payload.items.length;
		const total = typeof payload.total === "number" && Number.isFinite(payload.total) && payload.total >= 0
			? payload.total : undefined;
		if (total !== undefined && items.length >= total) return { items, complete: complete && items.length === total };
		if (pageItems.length < limit) return { items, complete: complete && total === undefined };
	}
	return { items, complete: false };
}

export async function collectPublicSitemapResult(
	apiBase: string,
	fetcher: Fetcher = fetch,
): Promise<{ items: SitemapItem[]; complete: boolean }> {
	const sources = await Promise.allSettled([
		fetchList(apiBase, "/music/artists?page=1&page_size=1000", fetcher),
		fetchList(apiBase, "/music/albums?page=1&page_size=1000", fetcher),
		fetchList(apiBase, "/forum/topics?page=1&page_size=1000", fetcher),
		fetchList(apiBase, "/debate/topics?page=1&page_size=1000", fetcher),
		fetchList(apiBase, "/podcast/episodes", fetcher),
		fetchList(apiBase, "/videos?sort=latest&page=1&page_size=1000", fetcher),
		fetchBookCollection(apiBase, "/books/works", fetcher),
		fetchBookCollection(apiBase, "/books/booklists", fetcher),
	]);
	const fulfilled = (index: number) =>
		sources[index].status === "fulfilled"
			? (sources[index] as PromiseFulfilledResult<SitemapSourceResult>).value.items
			: [];
	const artists = fulfilled(0);
	const albums = fulfilled(1);
	const topics = fulfilled(2);
	const debates = fulfilled(3);
	const episodes = fulfilled(4);
	const videos = fulfilled(5);
	const works = fulfilled(6);
	const booklists = fulfilled(7);
	const items: SitemapItem[] = [];

	works.forEach((work) => {
		if (text(work.id) && text(work.title) && work.lifecycle_status === "active") {
			items.push({ path: `/books/work/${encodeURIComponent(text(work.id))}`, last_modified: date(work.updated_at) });
			array(work.editions).map(record).filter(Boolean).forEach((edition) => {
				if (text(edition?.id)) items.push({
					path: `/books/edition/${encodeURIComponent(text(edition?.id))}`,
					last_modified: date(edition?.updated_at),
				});
			});
		}
	});
	booklists.forEach((booklist) => {
		if (booklist.visibility === "public" && text(booklist.id) && text(booklist.title))
			items.push({ path: `/books/lists/${encodeURIComponent(text(booklist.id))}`, last_modified: date(booklist.updated_at || booklist.published_at) });
	});

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
	return { items, complete: sources.every((source) => source.status === "fulfilled" && source.value.complete) };
}

export async function collectPublicSitemapItems(
	apiBase: string,
	fetcher: Fetcher = fetch,
): Promise<SitemapItem[]> {
	return (await collectPublicSitemapResult(apiBase, fetcher)).items;
}
