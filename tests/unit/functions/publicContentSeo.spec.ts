import { describe, expect, it, vi } from "vitest";

import {
	buildAggregatedContentHtml,
	buildMissingPublicContentHtml,
	buildPublicContentHtml,
	buildUnresolvedPublicContentHtml,
	collectPublicSitemapItems,
	resolvePublicContentSeo,
} from "../../../functions/_lib/publicContentSeo";
import { onRequest as pageMiddleware } from "../../../functions/_middleware";

const shell =
	'<!doctype html><html><head><title>Atoman</title><meta data-default-meta name="description" content="old"><link data-default-meta rel="canonical" href="https://www.atoman.org/"></head><body></body></html>';

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("public content SEO", () => {
	it("does not publish unavailable Discogs covers as song or album artwork", async () => {
		const id = "01a10b46-acd6-7096-acc3-2918aa322eef";
		const blocked = "https://i.discogs.com/restricted.jpeg";
		const owned = "https://assets.atoman.org/music/verified-cover.jpg";
		for (const path of ["/music/song/" + id, "/music/album/" + id, "/music/artist/" + id]) {
			const makeFetcher = (direct: string, albumCover: string) => vi.fn(async () => json({ data:
				path.includes("/song/") ? {
					song: { id, title: "Verified song", lifecycle_status: "active", cover_url: direct,
						album: { id, title: "Album", cover_url: albumCover } },
				} : { id, title: "Verified album", name: "Verified artist",
					cover_url: direct, image_url: direct, lifecycle_status: "active" },
			})) as unknown as typeof fetch;
			const lookup = await resolvePublicContentSeo(path, undefined, "https://www.atoman.org", makeFetcher(blocked, blocked));
			expect(lookup.content).toBeDefined();
			expect(lookup.content?.imageUrl).toBeUndefined();
			expect(lookup.content?.structuredData.image).toBeUndefined();
			const html = buildPublicContentHtml(shell, lookup.content!);
			expect(html).not.toContain("i.discogs.com");
			expect(html).not.toContain("<img ");
			expect(html).toContain('property="og:image" content="https://www.atoman.org/atoman-share.png"');
			const recovered = await resolvePublicContentSeo(path, undefined, "https://www.atoman.org",
				makeFetcher(path.includes("/song/") ? blocked : owned, owned));
			expect(recovered.content?.imageUrl).toBe(owned);
			expect(recovered.content?.structuredData.image).toBe(owned);
			expect(buildPublicContentHtml(shell, recovered.content!)).toContain('<img src="' + owned + '"');
		}
	});

	it("replaces placeholder artist biographies with verified public album facts", async () => {
		const artistId = "01a06793-193c-796e-8b97-b1ee8de3a825";
		const albumId = "01a07774-5cb4-7c6f-b5df-841db6db86a2";
		const fetcher = vi.fn(async () => json({ data: {
			id: artistId, name: "九维", bio: "<p>暂无</p>",
			albums: [{ id: albumId, title: "公开作品", lifecycle_status: "active", status: "open" }],
		} })) as unknown as typeof fetch;
		const found = await resolvePublicContentSeo("/music/artist/" + artistId,
			"https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		expect(found.content?.description).toContain("公开作品");
		expect(found.content?.description).not.toBe("暂无");
		expect(found.content?.bodyText).toContain("公开作品");
		expect(found.content?.description.length).toBeGreaterThan(65);
	});

	it("builds canonical metadata and structured data for a public music artist", async () => {
		const fetcher = vi.fn(async () =>
			json({
				data: {
					id: "artist-1",
					name: "Artist",
					display_name: "艺术家",
					bio: "<p>艺术家介绍</p>",
					image_url: "https://assets.atoman.org/artist.webp",
					artist_form: "person",
					updated_at: "2026-08-14T08:00:00Z",
				},
			}),
		) as unknown as typeof fetch;

		const lookup = await resolvePublicContentSeo(
			"/music/artist/artist-1",
			"https://api.atoman.org/api",
			"https://www.atoman.org",
			fetcher,
		);

		expect(lookup.matched).toBe(true);
		expect(lookup.content?.path).toBe("/music/artist/artist-1");
		expect(fetcher).toHaveBeenCalledWith(
			"https://api.atoman.org/api/v1/music/artists/artist-1",
			expect.any(Object),
		);
		const html = buildPublicContentHtml(shell, lookup.content!);
		expect(html).toContain(
			'<title data-page-meta="content">艺术家 | 音乐档案 | Atoman</title>',
		);
		expect(html).toContain(
			'rel="canonical" href="https://www.atoman.org/music/artist/artist-1"',
		);
		expect(html).toContain('"@type":"Person"');
		expect(html).not.toContain('content="old"');
	});

	it("links a public artist to their active albums without exposing archived or duplicate editions", async () => {
		const artistId = "019fa2ca-a4ab-72fd-8d3d-5f1a06694598";
		const publicAlbumId = "01a10a79-3c3c-7c40-a3be-dbe76b21c2ac";
		const privateAlbumId = "01a06b7f-0350-7e5e-85fc-4b523587fcb9";
		const fetcher = vi.fn(async () => json({ data: {
			id: artistId, name: "示例音乐人", artist_form: "person", lifecycle_status: "active",
			albums: [
				{ id: publicAlbumId, title: "公开 & 专辑", lifecycle_status: "active", status: "open", entry_status: "open" },
				{ id: publicAlbumId, title: "重复条目", lifecycle_status: "active", status: "open" },
				{ id: privateAlbumId, title: "已删除专辑", lifecycle_status: "retired", status: "closed" },
				{ id: "not-an-id", title: "无效 URL", lifecycle_status: "active" },
			],
		} })) as unknown as typeof fetch;
		const found = await resolvePublicContentSeo(`/music/artist/${artistId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const page = '<!doctype html><html><head><title>Atoman</title></head><body><div id="app"><!-- seo-prerender-start --><p>首页预览</p><!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(page, found.content!);
		expect(html).toContain('<h2>公开专辑</h2>');
		expect(html).toContain(`href="/music/album/${publicAlbumId}">公开 &amp; 专辑</a>`);
		expect(html.match(new RegExp(`href="/music/album/${publicAlbumId}"`, "g"))).toHaveLength(1);
		expect(html).not.toContain("已删除专辑");
		expect(html).not.toContain("无效 URL");
		expect(html).not.toContain("首页预览");
	});

	it("renders actual book edition links on the public work page", async () => {
		const workId = "01a1a665-e4f0-71d9-bd3e-4d19f50b9d09";
		const editionId = "01a1a665-ec80-7a99-9222-960174288f0a";
		const fetcher = vi.fn(async () => json({ data: {
			id: workId, title: "三体", lifecycle_status: "active", authors: [{name: "刘慈欣"}],
			editions: [{ id: editionId, title: "三体", edition_statement: "第一版", isbn13: "9787536692930" },
				{ id: "not-a-real-id", title: "无效版本" }],
		} })) as unknown as typeof fetch;
		const found = await resolvePublicContentSeo(`/books/work/${workId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const shell = '<html><head></head><body><div id="app"><!-- seo-prerender-start --><p>通用首屏</p><!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(shell, found.content!);
		expect(html).toContain('<h2>出版版本</h2>');
		expect(html).toContain(`href="/books/edition/${editionId}">第一版</a>`);
		expect(html).not.toContain("无效版本");
		expect(html).not.toContain("通用首屏");
	});

	it("links published book edition back to its public work", async () => {
		const workId = "01a1a665-e4f0-71d9-bd3e-4d19f50b9d09";
		const editionId = "01a1a665-ec80-7a99-9222-960174288f0a";
		const fetcher = vi.fn(async (url: string) =>
			url.includes("/books/wiki/edition/")
				? json({ data: { entity_id: editionId, fields: { work_id: workId } } })
				: json({ data: { id: workId, title: "三体", lifecycle_status: "active", authors: [{name: "刘慈欣"}],
						editions: [{ id: editionId, title: "三体", edition_statement: "第一版", isbn13: "9787536692930" }] } }),
		) as unknown as typeof fetch;
		const found = await resolvePublicContentSeo(`/books/edition/${editionId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const shell = '<html><head></head><body><div id="app"><!-- seo-prerender-start --><p>通用首屏</p><!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(shell, found.content!);
		expect(html).toContain('<h2>所属作品</h2>');
		expect(html).toContain(`href="/books/work/${workId}">所属作品：三体</a>`);
		expect(html).not.toContain("通用首屏");
	});

	it("renders crawlable video content in the HTML body", () => {
		const html = buildPublicContentHtml(
			'<!doctype html><html><head><title>Atoman</title></head><body><div id="app"><!-- seo-prerender-start --><div class="portal-prerender">首页</div><!-- seo-prerender-end --></div></body></html>',
			{
				path: "/videos/watch/video-1",
				title: "视频标题 | 视频 | Atoman",
				description: "视频简介",
				imageUrl: "https://assets.atoman.org/video-cover.jpg",
				structuredData: {
					"@type": "VideoObject",
					name: "视频标题",
					contentUrl: "https://assets.atoman.org/video.mp4",
				},
			},
		);

		expect(html).toContain('<main data-seo-fallback="content">');
		expect(html).toContain("<h1>视频标题</h1>");
		expect(html).toContain('src="https://assets.atoman.org/video.mp4"');
		expect(html).toContain('poster="https://assets.atoman.org/video-cover.jpg"');
		expect(html).not.toContain("portal-prerender");
	});

	it("distinguishes same-name albums, recordings, and track versions using actual metadata", async () => {
		const common = { title: "Intro", lifecycle_status: "active" };
		const artists = [{ name: "示例音乐人" }];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const path = new URL(String(input)).pathname;
			if (path.includes("/albums/")) return json({ data: { ...common, id: "album-1", artists } });
			const id = path.split("/").pop();
			const secondAlbum = id === "song-3";
			return json({ data: { song: { ...common, id, album: { title: secondAlbum ? "其他专辑" : "Intro" },
				track_number: id === "song-2" ? 18 : 1, disc_number: id === "song-2" ? 2 : 1 }, artists } });
		}) as unknown as typeof fetch;
		const paths = ["/music/album/album-1", "/music/song/song-1", "/music/song/song-2", "/music/song/song-3"];
		const results = await Promise.all(paths.map(path => resolvePublicContentSeo(path, undefined, "https://www.atoman.org", fetcher)));
		const titles = results.map(result => result.content?.title);
		expect(new Set(titles).size).toBe(4);
		expect(titles[0]).toContain("| 专辑 | Atoman");
		expect(titles[1]).toContain("| 歌曲 |");
		expect(titles[2]).toContain("第 2 碟，第 18 首");
		expect(titles[3]).toContain("《其他专辑》");
		for (const [index, result] of results.entries()) {
			expect(result.content?.path).toBe(paths[index]);
			expect(result.content?.structuredData.name).toBe("Intro");
			expect(buildPublicContentHtml(shell, result.content!)).toContain(`https://www.atoman.org${paths[index]}`);
		}
	});

	it("distinguishes reused artist and album descriptions while preserving authored copy", async () => {
		const description = "真实的作品资料。";
		const fetcher = vi.fn(async (input: RequestInfo | URL) => String(input).includes("/artists/")
			? json({ data: { id: "artist-1", name: "示例音乐人", bio: description } })
			: json({ data: { id: "album-1", title: "示例专辑", description, artists: [{ name: "示例音乐人" }],
				release_date: "2020-01-01", release_date_precision: "day", songs: [{ id: "song-1", title: "歌曲" }] } })) as unknown as typeof fetch;
		const artist = await resolvePublicContentSeo("/music/artist/artist-1", undefined, "https://www.atoman.org", fetcher);
		const album = await resolvePublicContentSeo("/music/album/album-1", undefined, "https://www.atoman.org", fetcher);
		expect(artist.content?.description).not.toBe(album.content?.description);
		expect(artist.content?.description).toContain("示例音乐人｜音乐人档案");
		expect(album.content?.description).toContain("专辑《示例专辑》");
		expect(album.content?.description).toContain("已收录 1 首曲目");
		expect(artist.content?.bodyText).toBe(description);
		expect(album.content?.bodyText).toBe(description);
	});

	it("adds verified recording facts but rejects impossible release years", async () => {
		const fetcher = vi.fn(async () => json({ data: {
			song: { id: "song-1", title: "样本歌曲", lifecycle_status: "active", duration_sec: 206, release_date: "2202-01-01T00:00:00Z" },
			artists: [{ name: "示例音乐人" }],
		} })) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo("/music/song/song-1", "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		expect(lookup.content?.structuredData.duration).toBe("PT206S");
		expect(lookup.content?.structuredData.datePublished).toBeUndefined();
		const html = buildPublicContentHtml(shell, lookup.content!);
		expect(html).toContain("作品资料");
		expect(html).toContain("示例音乐人");
		expect(html).toContain("3 分 26 秒");
		expect(html).not.toContain("2202");
	});

	it("links only verified music artist, album and neighboring song entities in crawlable HTML", async () => {
		const artist = "01a17b88-ee59-77c5-9ebf-049390c71f52";
		const album = "01a17b88-ee76-77c9-afff-031387805123";
		const song = "01a17b89-60cd-741e-beba-f14d5c6ca236";
		const previous = "01a17b89-581d-7415-9118-54a93cb85c5e";
		const fetcher = vi.fn(async () => json({ data: {
			song: { id: song, title: "示例歌曲", lifecycle_status: "active", duration_sec: 201,
				album: { id: album, title: "公开专辑" } },
			artists: [{ id: artist, name: "示例歌手" }],
			previous: { id: previous, title: "上一首作品", lifecycle_status: "active" },
		} })) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo(`/music/song/${song}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const page = '<!doctype html><html><head><title>Atoman</title></head><body><div id="app"><!-- seo-prerender-start --><p>首页预览</p><!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(page, lookup.content!);
		expect(html).toContain(`href="/music/artist/${artist}">示例歌手</a>`);
		expect(html).toContain(`href="/music/album/${album}">公开专辑</a>`);
		expect(html).toContain(`href="/music/song/${previous}">上一首：上一首作品</a>`);
		expect(html).toContain('"@type":"MusicRecording"');
		expect(html).toContain(`"url":"https://www.atoman.org/music/artist/${artist}"`);
		expect(html).toContain(`"url":"https://www.atoman.org/music/album/${album}"`);
		expect(html).not.toContain("首页预览");
	});

	it("renders a publicly visible album track list without exposing archived songs", async () => {
		const album = "01a17b88-ee76-77c9-afff-031387805123";
		const artist = "01a17b88-ee59-77c5-9ebf-049390c71f52";
		const firstTrack = "01a17b89-60cd-741e-beba-f14d5c6ca236";
		const archivedTrack = "01a17b89-581d-7415-9118-54a93cb85c5e";
		const fetcher = vi.fn(async () => json({ data: {
			id: album, title: "商业与玩法", lifecycle_status: "active", status: "open",
			artists: [{ id: artist, name: "示例音乐人" }],
			songs: [
				{ id: firstTrack, title: "公开歌曲", lifecycle_status: "active", status: "open" },
				{ id: archivedTrack, title: "归档歌曲", lifecycle_status: "retired", status: "closed" },
			],
		} })) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo(`/music/album/${album}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const page = '<!doctype html><html><head><title>Atoman</title></head><body><div id="app"><!-- seo-prerender-start --><p>首页预览</p><!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(page, lookup.content!);
		expect(html).toContain('<h2>专辑曲目</h2>');
		expect(html).toContain(`href="/music/song/${firstTrack}">公开歌曲</a>`);
		expect(html).toContain(`href="/music/artist/${artist}">示例音乐人</a>`);
		expect(html).not.toContain("归档歌曲");
		expect(html).not.toContain(`href="/music/song/${archivedTrack}"`);
	});

	it("does not invent links to soft-deleted albums and escapes catalog labels", async () => {
		const song = "01a07774-5d12-7269-8ba1-873530a3654d";
		const deletedAlbum = "01a06b7f-0350-7e5e-85fc-4b523587fcb9";
		const artist = "01a000c7-7bc4-7d80-a32d-bc9ee315d2d7";
		const fetcher = vi.fn(async () => json({ data: {
			song: { id: song, title: "Kendrick <unsafe> & friends", album_id: deletedAlbum,
				lifecycle_status: "active", duration_sec: 257 },
			artists: [{ id: artist, name: "Kendrick & Friends" }],
		} })) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo(`/music/song/${song}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		expect(lookup.content?.structuredData.inAlbum).toBeUndefined();
		expect(lookup.content?.description).toContain("Kendrick & Friends");
		const page = '<!doctype html><html><head><title>Atoman</title></head><body><div id="app"><!-- seo-prerender-start --><p>首页预览</p><!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(page, lookup.content!);
		expect(html).toContain(`href="/music/artist/${artist}"`);
		expect(html).not.toContain(`href="/music/album/${deletedAlbum}"`);
		expect(html).not.toContain("<unsafe>");
		expect(html).toContain("Kendrick &amp; Friends");
	});

	it("keeps full authored album and artist copy in crawlable HTML while capping the meta snippet", async () => {
		const albumId = "01a17b88-ee76-77c9-afff-031387805123";
		const artistId = "019fa2ca-a4ab-72fd-8d3d-5f1a06694598";
		const fullAlbumText = "公开专辑介绍：" + "录音背景与发行信息。".repeat(28) + "独特的结尾介绍 & 收录情况。";
		const fullArtistText = "音乐人简介：" + "公开经历与创作资料。".repeat(24) + "长期创作与专辑整理。";
		const fetcher = vi.fn(async (url: string) => url.includes("/albums/")
			? json({ data: { id: albumId, title: "资料专辑", description: `<p>${fullAlbumText}</p>`,
				release_date: "2026-09-26T00:00:00Z", release_date_precision: "day",
				artists: [{ name: "音乐人", id: artistId }], songs: [
					{ id: "01a17b89-60cd-741e-beba-f14d5c6ca236", title: "公开曲目", lifecycle_status: "active" },
				] } })
			: json({ data: { id: artistId, name: "音乐人", bio: fullArtistText,
				albums: [{ id: albumId, title: "资料专辑", lifecycle_status: "active", entry_status: "open" }] } })) as unknown as typeof fetch;
		const page = '<html><head></head><body><div id="app"><!-- seo-prerender-start -->旧内容<!-- seo-prerender-end --></div></body></html>';
		const album = await resolvePublicContentSeo(`/music/album/${albumId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const albumHtml = buildPublicContentHtml(page, album.content!);
		expect(album.content?.description.length).toBeLessThanOrEqual(160);
		expect(albumHtml).toContain("独特的结尾介绍 &amp; 收录情况");
		expect(albumHtml).toContain("<dt>发行时间</dt><dd>2026 年 9 月 26 日</dd>");
		expect(albumHtml).toContain("<dt>已收录曲目</dt><dd>1 首</dd>");
		expect(albumHtml).toContain('"numTracks":1');
		const artist = await resolvePublicContentSeo(`/music/artist/${artistId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const artistHtml = buildPublicContentHtml(page, artist.content!);
		expect(artist.content?.description.length).toBeLessThanOrEqual(160);
		expect(artistHtml).toContain("长期创作与专辑整理。");
		expect(artistHtml).toContain("<dt>已收录公开专辑</dt><dd>1</dd>");
	});

	it("renders source-linked editorial notes for public songs without authored descriptions", async () => {
		const songId = "01a07774-5cc3-7d3a-af30-6611899f00fc";
		const fetcher = vi.fn(async () => json({ data: {
			song: { id: songId, title: "DNA.", description: "", status: "open", lifecycle_status: "active",
				track_number: 2, album: { title: "DAMN.", id: "01a06b7f-0330-7f31-a440-b666a9722289" } },
			artists: [{ name: "Kendrick Lamar" }],
		} })) as unknown as typeof fetch;
		const resolved = await resolvePublicContentSeo(`/music/song/${songId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const page = '<html><head></head><body><div id="app"><!-- seo-prerender-start --><p>首页内容</p><!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(page, resolved.content!);
		expect(html).toContain('data-seo-editorial="song"');
		expect(html).toContain("<h2>编辑补充资料</h2>");
		expect(html).toContain("Matt Schaeffer");
		expect(html).toContain('href="https://pitchfork.com/news/72695-kendrick-lamars-new-album-damn-the-full-credits/"');
		expect(html).toContain('href="https://music.apple.com/us/song/1440881357"');
		expect(html).toContain("参考来源：");
		expect(html).not.toContain("首页内容");
		expect(resolved.content?.description).toContain("Mike WiLL Made-It");
		expect(resolved.content?.description.length).toBeLessThanOrEqual(160);
	});

	it("does not show stale editorial notes after a song is renamed or assigned to another album", async () => {
		const songId = "01a07774-5cc3-7d3a-af30-6611899f00fc";
		for (const [title, albumId] of [
			["Renamed Song", "01a06b7f-0330-7f31-a440-b666a9722289"],
			["DNA.", "01a17b88-ee76-77c9-afff-031387805123"],
		] as const) {
			const fetcher = vi.fn(async () => json({ data: {
				song: { id: songId, title, album_id: albumId, status: "open", lifecycle_status: "active" },
				artists: [{name:"Kendrick Lamar"}],
			} })) as unknown as typeof fetch;
			const resolved = await resolvePublicContentSeo(`/music/song/${songId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
			const html = buildPublicContentHtml('<html><head></head><body></body></html>', resolved.content!);
			expect(html).not.toContain('data-seo-editorial="song"');
		}
	});

	it("never overrides a wiki-authored song description with a curated note", async () => {
		const songId = "01a07774-5cc3-7d3a-af30-6611899f00fc";
		const fetcher = vi.fn(async () => json({ data: {
			song: { id: songId, title: "DNA.", description: "编辑者填写的歌曲介绍。", status: "open", lifecycle_status: "active" },
			artists: [{ name: "Kendrick Lamar" }],
		} })) as unknown as typeof fetch;
		const resolved = await resolvePublicContentSeo(`/music/song/${songId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const page = '<html><head></head><body><div id="app"><!-- seo-prerender-start --><p>首页内容</p><!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(page, resolved.content!);
		expect(resolved.content?.description).toBe("编辑者填写的歌曲介绍。");
		expect(html).not.toContain('data-seo-editorial="song"');
	});

	it("does not attach supplemental copy to a closed or unrelated song", async () => {
		for (const [songId, status] of [
			["01a07774-5cc3-7d3a-af30-6611899f00fc", "closed"],
			["01a17b89-60cd-741e-beba-f14d5c6ca236", "open"],
		] as const) {
			const fetcher = vi.fn(async () => json({ data: {
				song: { id: songId, title: "Song", description: "", status, lifecycle_status: "active" },
				artists: [{ name: "Artist" }],
			} })) as unknown as typeof fetch;
			const resolved = await resolvePublicContentSeo(`/music/song/${songId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
			const html = buildPublicContentHtml('<html><head></head><body></body></html>', resolved.content!);
			expect(html).not.toContain('data-seo-editorial="song"');
		}
	});

	it("renders only recorded song facts, not assumed duration or invented release dates", async () => {
		const songId = "01a17b89-60cd-741e-beba-f14d5c6ca236";
		const albumId = "01a17b88-ee76-77c9-afff-031387805123";
		const song = { id: songId, title: "公开歌曲", description: "", album: {id:albumId,title:"资料专辑"},
			release_date: "2026-09-26T00:00:00Z", release_date_precision: "day", track_number: 13, disc_number: 2, duration_sec: 0 };
		const fetcher = vi.fn(async () => json({ data: {song, artists: [{name:"音乐人"}] } })) as unknown as typeof fetch;
		const found = await resolvePublicContentSeo(`/music/song/${songId}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
		const page = '<html><head></head><body><div id="app"><!-- seo-prerender-start -->旧内容<!-- seo-prerender-end --></div></body></html>';
		const html = buildPublicContentHtml(page, found.content!);
		expect(html).toContain("<dt>曲目序号</dt><dd>第 2 碟，第 13 首</dd>");
		expect(html).toContain("<dt>发行时间</dt><dd>2026 年 9 月 26 日</dd>");
		expect(html).toContain("收录于《资料专辑》");
		expect(html).not.toContain("<dt>时长</dt>");
		expect(html).not.toContain("PT0S");
	});

	it("rejects invalid and impossible calendar dates in both album and song facts", async () => {
		const album = "01a17b88-ee76-77c9-afff-031387805123";
		const get = async (dateValue: string, precision: string) => {
			const fetcher = vi.fn(async () => json({ data: { id: album, title: "专辑", release_date: dateValue, release_date_precision: precision } })) as unknown as typeof fetch;
			const found = await resolvePublicContentSeo(`/music/album/${album}`, "https://api.atoman.org/api", "https://www.atoman.org", fetcher);
			return found.content!;
		};
		for (const dateValue of ["2202-01-01T00:00:00Z", "2026-02-29T00:00:00Z", "0001-01-01T00:00:00Z"]) {
			const result = await get(dateValue, "day");
			expect(result.structuredData.datePublished).toBeUndefined();
			expect(result.metadataFacts).toEqual([]);
		}
		const monthOnly = await get("2026-09-01T00:00:00Z", "month");
		expect(monthOnly.metadataFacts).toEqual([{name:"发行时间",value:"2026 年 9 月"}]);
		expect(monthOnly.structuredData.datePublished).toBe("2026-09");
		const yearOnly = await get("2026-09-01T00:00:00Z", "year");
		expect(yearOnly.structuredData.datePublished).toBe("2026");
		const unknownPrecision = await get("2026-09-01T00:00:00Z", "unknown");
		expect(unknownPrecision.structuredData.datePublished).toBeUndefined();
	});

	it("links video members to their public collections and collections back to their members", async () => {
		const id = "01a02565-0cc8-7ba7-93e0-c4b698b30974";
		const other = { id: "other-collection", name: "另一个合集" };
		const collection = { id, name: "公开合集" };
		const video = { id: "01a02565-0cc9-7ba7-93e0-c4b698b30974", title: "视频作品", visibility: "public", status: "published",
			collection: other, collections: [collection, { id: "private-collection", name: "私密", visibility: "private" }] };
		const fetcher = vi.fn(async (url: string) =>
			url.includes("collection_id=") ? json({ data: [video] }) : json({ data: video })) as unknown as typeof fetch;
		const detail = await resolvePublicContentSeo("/videos/watch/01a02565-0cc9-7ba7-93e0-c4b698b30974", undefined, "https://www.atoman.org", fetcher);
		const detailHtml = buildPublicContentHtml(shell, detail.content!);
		expect(detailHtml).toContain('href="/videos/collections/' + id + '"');
		expect(detailHtml).toContain("所属合集");
		expect(detailHtml).not.toContain("private-collection");
		const collectionPage = await resolvePublicContentSeo("/videos/collections/" + id, undefined, "https://www.atoman.org", fetcher);
		expect(collectionPage.content?.title).toContain("公开合集");
		expect(collectionPage.content?.title).not.toContain("另一个合集");
		const collectionHtml = buildPublicContentHtml(shell, collectionPage.content!);
		expect(collectionHtml).toContain('href="/videos/watch/01a02565-0cc9-7ba7-93e0-c4b698b30974"');
		expect(collectionHtml).toContain("合集视频");
		expect(collectionPage.content?.structuredData).toMatchObject({
			"@type": "CollectionPage",
			mainEntity: { "@type": "ItemList", numberOfItems: 1, itemListElement: [
				{ "@type": "ListItem", position: 1, name: "视频作品", url: "https://www.atoman.org/videos/watch/01a02565-0cc9-7ba7-93e0-c4b698b30974" },
			] },
		});
		expect(collectionHtml).not.toContain('"@type":"VideoObject"');
		expect(collectionPage.content?.structuredData).not.toHaveProperty("hasPart");
	});

	it("marks aggregated feed item pages as noindex without a homepage canonical", () => {
		const html = buildAggregatedContentHtml(shell);

		expect(html).toContain('<meta name="robots" content="noindex, follow">');
		expect(html).not.toContain('rel="canonical"');
		expect(html).not.toContain("noindex, nofollow");
	});

	it("does not interpret existing app routes as dynamic content IDs", async () => {
		const fetcher = vi.fn(async () => json({ error: "not found" }, 404)) as unknown as typeof fetch;
		for (const path of ["/debate/search", "/debate/me", "/debate/rules", "/music/artist/new"]) {
			const result = await resolvePublicContentSeo(path, undefined, "https://www.atoman.org", fetcher);
			expect(result).toEqual({ matched: false });
		}
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("returns a 404 for a matched but unavailable detail route", async () => {
		const fetcher = vi.fn(async () =>
			json({ error: "not found" }, 404),
		) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo(
			"/videos/watch/private-video",
			undefined,
			"https://www.atoman.org",
			fetcher,
		);

		expect(lookup).toEqual({ matched: true, content: undefined });
		const html = buildMissingPublicContentHtml(shell);
		expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
		expect(html).not.toContain('rel="canonical"');

		vi.stubGlobal("fetch", vi.fn(async () => json({ error: "not found" }, 404)));
		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/videos/watch/private-video"),
			next: async () =>
				new Response(shell, { headers: { "content-type": "text/html" } }),
		});
		expect(response.status).toBe(404);
		expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("treats HTML or malformed JSON errors from the origin as retryable rather than missing content", async () => {
		const request = new Request("https://www.atoman.org/music/song/01a01fed-ab42-7698-a02a-7ac4f3257f62");
		for (const failure of [
			() => new Response("<html>Temporary proxy error</html>", { status: 404, headers: { "content-type": "text/html" } }),
			() => new Response("<html>Temporary proxy error</html>", { status: 404, headers: { "content-type": "application/json" } }),
			() => new Response("Proxy bad request", { status: 400, headers: { "content-type": "text/plain" } }),
		]) {
			const response = await pageMiddleware({
				request,
				env: { SEO_ORIGIN: { fetch: async () => failure() } },
				next: async () => new Response(shell, { headers: { "content-type": "text/html" } }),
			});
			expect(response.status).toBe(503);
			expect(response.headers.get("retry-after")).toBe("60");
			expect(response.headers.get("x-robots-tag")).toBeNull();
		}
	});

	it("does not noindex a valid route when its SEO source fails temporarily", async () => {
		const fetcher = vi.fn(async () =>
			json({ error: "unavailable" }, 503),
		) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo(
			"/videos/watch/video-1",
			undefined,
			"https://www.atoman.org",
			fetcher,
		);

		expect(lookup).toEqual({ matched: true, retryable: true });
		const html = buildUnresolvedPublicContentHtml(shell);
		expect(html).not.toContain('name="robots"');
		expect(html).not.toContain('rel="canonical"');
	});

	it("returns retryable 503 for a failed public detail lookup, never a generic indexable 200", async () => {
		const ids = [
			"01a10b46-ceed-7373-8614-31aeae023292",
			"01a10b46-c677-7ba4-a5c2-c31806588ab5",
			"01a10b43-3418-7339-89de-c18c288943a9",
		];
		for (const id of ids) {
			const request = new Request("https://www.atoman.org/music/song/" + id);
			const next = async () => new Response(shell, {
				headers: { "content-type": "text/html", "cache-control": "public, max-age=60" },
			});
			for (const fail of [
				async () => json({ error: "temporarily unavailable" }, 503),
				async () => { throw new Error("upstream timeout"); },
			]) {
				const response = await pageMiddleware({
					request,
					env: { SEO_ORIGIN: { fetch: fail } },
					next,
				});
				expect(response.status).toBe(503);
				expect(response.headers.get("cache-control")).toBe("no-store");
				expect(response.headers.get("retry-after")).toBe("60");
				expect(response.headers.get("x-robots-tag")).toBeNull();
				expect(await response.text()).not.toContain('rel="canonical"');
			}
			const recovered = await pageMiddleware({
				request,
				env: { SEO_ORIGIN: { fetch: async () => json({ data: {
					song: { id, title: "Recovered song", lifecycle_status: "active" },
					artists: [{ name: "Artist" }],
				} }) } },
				next,
			});
			expect(recovered.status).toBe(200);
			expect(recovered.headers.get("retry-after")).toBeNull();
			expect(await recovered.text()).toContain('rel="canonical" href="https://www.atoman.org/music/song/' + id + '"');
		}
	});

	it("marks feed item pages as aggregate content through the Pages middleware", async () => {
		const response = await pageMiddleware({
			request: new Request(
				"https://www.atoman.org/feed/item/019f75a2-5466-7e1e-b0fd-1954e03116e4",
			),
			next: async () =>
				new Response(shell, { headers: { "content-type": "text/html" } }),
		});
		const html = await response.text();

		expect(html).toContain('<meta name="robots" content="noindex, follow">');
		expect(html).not.toContain('rel="canonical"');
	});

	it("removes stale content encoding after rewriting HTML", async () => {
		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/feed/item/item-1"),
			next: async () =>
				new Response(shell, {
					headers: {
						"content-type": "text/html",
						"content-encoding": "gzip",
					},
				}),
		});

		expect(response.headers.get("content-encoding")).toBeNull();
	});

	it("injects detail metadata through the Pages middleware", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				json({
					data: {
						id: "debate-1",
						title: "是否应该继续探索太空？",
						description: "讨论探索太空的价值。",
						status: "active",
						created_at: "2026-08-01T08:00:00Z",
						updated_at: "2026-08-02T08:00:00Z",
					},
				}),
			),
		);

		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/debate/debate-1"),
			env: { VITE_API_URL: "https://api.atoman.org/api" },
			next: async () =>
				new Response(shell, { headers: { "content-type": "text/html" } }),
		});
		const html = await response.text();

		expect(html).toContain("是否应该继续探索太空？ | 辩题 | Atoman");
		expect(html).toContain("https://www.atoman.org/debate/debate-1");
		expect(html).toContain(
			'property="og:image" content="https://www.atoman.org/atoman-share.png"',
		);
		expect(html).toContain('"@type":"Article"');
	});

	it("collects public detail URLs while tolerating one failed module source", async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/music/artists")) {
				return json({
					data: [{ id: "artist-1", updated_at: "2026-08-01T00:00:00Z" }],
				});
			}
			if (url.includes("/music/albums")) {
				return json({
					data: [
						{
							id: "album-1",
							updated_at: "2026-08-02T00:00:00Z",
							songs: [{ id: "song-1" }],
						},
					],
				});
			}
			if (url.includes("/forum/topics")) throw new Error("forum unavailable");
			if (url.includes("/debate/topics")) {
				return json({
					data: [{ id: "debate-1", updated_at: "2026-08-03T00:00:00Z" }],
				});
			}
			if (url.includes("/podcast/episodes")) return json([]);
			if (url.includes("/videos")) {
				return json([
					{
						id: "video-1",
						visibility: "public",
						status: "published",
						updated_at: "2026-08-04T00:00:00Z",
					},
					{
						id: "video-2",
						visibility: "private",
						status: "published",
						collection: { id: "private-collection" },
					},
				]);
			}
			return json([], 404);
		}) as unknown as typeof fetch;

		const items = await collectPublicSitemapItems(
			"https://api.atoman.org/api/v1",
			fetcher,
		);
		expect(items.map((item) => item.path)).toEqual([
			"/music/artist/artist-1",
			"/music/album/album-1",
			"/music/song/song-1",
			"/debate/debate-1",
			"/videos/watch/video-1",
		]);
	});

	it("collects every page from a paginated public source", async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/music/artists")) {
				const page = new URL(url).searchParams.get("page");
				return json({
					data: [{ id: `artist-${page}` }],
					meta: { page: Number(page), page_size: 1, total: 2, has_more: page === "1" },
				});
			}
			return json([]);
		}) as unknown as typeof fetch;

		const items = await collectPublicSitemapItems(
			"https://api.atoman.org/api/v1",
			fetcher,
		);

		expect(items.map((item) => item.path)).toContain("/music/artist/artist-1");
		expect(items.map((item) => item.path)).toContain("/music/artist/artist-2");
		expect(fetcher).toHaveBeenCalledWith(
			"https://api.atoman.org/api/v1/music/artists?page=2&page_size=1000",
			expect.any(Object),
		);
	});


	it("builds crawlable book work and edition metadata from public catalog APIs", async () => {
		const work = {
			id: "work-1", title: "三体", lifecycle_status: "active",
			authors: [{ name: "刘慈欣" }],
			editions: [{ id: "edition-1", title: "三体", isbn13: "9787536692930", publisher: "重庆出版社", cover_url: "/api/v1/books/editions/edition-1/cover" }],
		};
		const fetcher = vi.fn(async (input: RequestInfo | URL) =>
			String(input).includes("/books/wiki/edition/")
				? json({ data: { entity_id: "edition-1", fields: { work_id: "work-1", updated_at: "2026-11-04T08:00:00Z" } } })
				: json({ data: work }),
		) as unknown as typeof fetch;
		const workLookup = await resolvePublicContentSeo("/books/work/work-1", undefined, "https://www.atoman.org", fetcher);
		expect(workLookup.matched).toBe(true);
		expect(workLookup.content?.title).toContain("三体");
		const workHtml = buildPublicContentHtml(shell, workLookup.content!);
		expect(workHtml).toContain('rel="canonical" href="https://www.atoman.org/books/work/work-1"');
		expect(workHtml).toContain('<main data-seo-fallback="content">');
		expect(workHtml).toContain('"@type":"Book"');
		expect(workHtml).toContain("刘慈欣");
		expect(workHtml).toContain("https://api.atoman.org/api/v1/books/editions/edition-1/cover");
		const editionLookup = await resolvePublicContentSeo("/books/edition/edition-1", undefined, "https://www.atoman.org", fetcher);
		expect(editionLookup.matched).toBe(true);
		const editionHtml = buildPublicContentHtml(shell, editionLookup.content!);
		expect(editionHtml).toContain('rel="canonical" href="https://www.atoman.org/books/edition/edition-1"');
		expect(editionHtml).toContain("9787536692930");
		expect(editionHtml).toContain("重庆出版社");
		expect(fetcher).toHaveBeenCalledWith(
			"https://api.atoman.org/api/v1/books/wiki/edition/edition-1", expect.any(Object),
		);
	});

	it("indexes only public booklists and skips invalid private book routes", async () => {
		const fetcher = vi.fn(async () => json({ data: { id: "list-1", title: "科幻推荐", description: "科幻阅读书单", visibility: "public", items: [{ title: "三体", available: true, canonical_work_id: "work-1" }] } })) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo("/books/lists/list-1", undefined, "https://www.atoman.org", fetcher);
		expect(lookup.matched).toBe(true);
		const html = buildPublicContentHtml(shell, lookup.content!);
		expect(html).toContain("科幻推荐");
		expect(html).toContain('"@type":"ItemList"');
		expect(html).toContain("https://www.atoman.org/books/work/work-1");
		expect((await resolvePublicContentSeo("/books/lists/new", undefined, "https://www.atoman.org", fetcher)).matched).toBe(false);
		const hidden = await resolvePublicContentSeo("/books/lists/private-1", undefined, "https://www.atoman.org", vi.fn(async () => json({ data: { id: "private-1", title: "私密书单", visibility: "private" } })) as unknown as typeof fetch);
		expect(hidden).toEqual({ matched: true, content: undefined });
	});

	it("adds active book works, editions and public booklists to sitemap only", async () => {
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/books/works?")) return json({ data: { items: [
				{ id: "work-1", title: "三体", lifecycle_status: "active", editions: [{ id: "edition-1" }] },
				{ id: "work-deleted", title: "隐藏作品", lifecycle_status: "removed" },
			], total: 2 } });
			if (url.includes("/books/booklists?")) return json({ data: { items: [
				{ id: "list-1", title: "科幻推荐", visibility: "public" },
				{ id: "list-private", title: "私人书单", visibility: "private" },
			], total: 2 } });
			return json({ data: [] });
		}) as unknown as typeof fetch;
		const items = await collectPublicSitemapItems("https://api.atoman.org/api/v1", fetcher);
		expect(items.map(({ path }) => path)).toEqual([
			"/books/work/work-1", "/books/edition/edition-1", "/books/lists/list-1",
		]);
		expect(fetcher).toHaveBeenCalledWith("https://api.atoman.org/api/v1/books/works?limit=50&offset=0", expect.any(Object));
	});


	it("returns noindex 404 for malformed detail identifiers rejected by the API", async () => {
		const fetcher = vi.fn(async () => json({ error: { code: "validation.invalid_request" } }, 400)) as unknown as typeof fetch;
		const lookup = await resolvePublicContentSeo("/books/work/invalid-id", undefined, "https://www.atoman.org", fetcher);
		expect(lookup).toEqual({ matched: true, content: undefined });
		vi.stubGlobal("fetch", fetcher);
		const response = await pageMiddleware({
			request: new Request("https://www.atoman.org/books/work/invalid-id"),
			next: async () => new Response(shell, { headers: { "content-type": "text/html" } }),
		});
		expect(response.status).toBe(404);
		expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
		expect(await response.text()).toContain('<meta name="robots" content="noindex, nofollow">');
	});

});
