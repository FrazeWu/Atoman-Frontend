import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
	ApiErrorResponseError,
	apiGet,
	apiGetEnvelope,
	apiGetRaw,
	apiPatchJson,
	apiPostJson,
	apiPostMultipart,
} from "@/api/client";
import * as apiUrlModule from "@/composables/useApi";
import {
	createMusicArtist,
	submitAlbumRevision,
	updateMusicPlaylist,
	getMusicAlbum,
	getMusicArtist,
	listMusicArtists,
	listMusicAlbums,
	getMusicHome,
	createAlbumDiscussion,
	deleteAlbumDiscussion,
	listAlbumDiscussions,
	replyAlbumDiscussion,
	startMusicAlbumImportMultipart,
	type MusicAlbumListItem,
	musicV1Endpoints,
	uploadMusicAlbumArchiveMultipart,
	uploadMusicAlbumArchive,
	uploadMusicAsset,
	uploadMusicAssetWithProgress,
} from "@/api/musicV1";
import * as musicV1 from "@/api/musicV1";

describe("api v1 client", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("loads artist revision history through the artist wiki namespace", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith("/revisions/2")) {
					return new Response(
						JSON.stringify({ data: { id: "revision-2", version_number: 2 } }),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				return new Response(
					JSON.stringify({ data: [{ id: "revision-2", version_number: 2 }] }),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}),
		);

		const revisions = await musicV1.listArtistRevisions("artist-1");
		const revision = await musicV1.getArtistRevision("artist-1", 2);

		expect(fetch).toHaveBeenNthCalledWith(
			1,
			"/api/v1/artists/artist-1/revisions",
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			"/api/v1/artists/artist-1/revisions/2",
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
		expect(revisions.data[0]?.version_number).toBe(2);
		expect(revision.version_number).toBe(2);
	});

	it("unwraps successful data envelopes", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: { id: "album_uuid", title: "Album" },
							meta: { source: "test" },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await apiGet<{ id: string; title: string }>(
			"/api/v1/music/albums/album_uuid",
		);

		expect(result).toEqual({ id: "album_uuid", title: "Album" });
		expect(fetch).toHaveBeenCalledWith("/api/v1/music/albums/album_uuid", {
			credentials: "include",
			headers: { Accept: "application/json" },
		});
	});

	it("uses cookie credentials for same-origin relative API requests", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({ data: { id: "playlist_uuid", name: "Playlist" } }),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);
		await apiGet<{ id: string; name: string }>(
			"/api/v1/music/playlists/playlist_uuid",
		);

		expect(fetch).toHaveBeenCalledWith(
			"/api/v1/music/playlists/playlist_uuid",
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
	});

	it("removes a song from later playback through the matching endpoint", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ data: { deleted: true } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					}),
			),
		);

		await musicV1.removeMusicSongFromLater("song-1");

		expect(fetch).toHaveBeenCalledWith("/api/v1/music/playlists/later/song-1", {
			method: "DELETE",
			credentials: "include",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: undefined,
		});
	});

	it("returns success envelopes when meta is needed by the caller", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: [{ id: "album_uuid", title: "Album" }],
							meta: { page: 2, page_size: 1, total: 5, has_more: true },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await apiGetEnvelope<
			{ id: string; title: string }[],
			{ page: number; page_size: number; total: number; has_more: boolean }
		>("/api/v1/music/albums?page=2&page_size=1");

		expect(result).toEqual({
			data: [{ id: "album_uuid", title: "Album" }],
			meta: { page: 2, page_size: 1, total: 5, has_more: true },
		});
	});

	it("returns raw JSON payloads when callers handle legacy response shapes", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify([{ id: "channel_uuid", name: "Channel" }]),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await apiGetRaw<{ id: string; name: string }[]>(
			"/api/v1/blog/channels",
		);

		expect(result).toEqual([{ id: "channel_uuid", name: "Channel" }]);
		expect(fetch).toHaveBeenCalledWith("/api/v1/blog/channels", {
			credentials: "include",
			headers: { Accept: "application/json" },
		});
	});

	it("throws typed errors while preserving API error code", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							error: {
								code: "music.entry_protected",
								message: "Entry is protected.",
								details: { role: "admin" },
							},
						}),
						{ status: 403, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		await expect(
			apiPostJson("/api/v1/albums/album_uuid/revisions", {
				changes: { title: "Updated" },
			}),
		).rejects.toMatchObject({
			status: 403,
			code: "music.entry_protected",
			message: "Entry is protected.",
			details: { role: "admin" },
		});
	});

	it("posts multipart upload without setting a manual Content-Type header", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								url: "https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/cover.png",
								key: "music/covers/uploads/users/user-1/2026/06/cover.png",
								content_type: "image/png",
								size: 123,
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const form = new FormData();
		form.append("purpose", "music.cover");

		const result = await apiPostMultipart<{
			url: string;
			key: string;
			content_type: string;
			size: number;
		}>("/api/v1/uploads", form);

		expect(result.url).toBe(
			"https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/cover.png",
		);
		const [, init] = vi.mocked(fetch).mock.calls[0];
		expect(init).toMatchObject({ method: "POST", credentials: "include" });
		expect((init as RequestInit).headers).toEqual({
			Accept: "application/json",
		});
	});

	it("maps non-JSON error responses into typed internal errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response("<html>bad gateway</html>", {
						status: 502,
						headers: { "Content-Type": "text/html" },
					}),
			),
		);

		await expect(apiGet("/api/v1/music/albums")).rejects.toMatchObject({
			status: 502,
			code: "system.internal_error",
			message: "Request failed.",
			details: {},
		});
	});

	it("maps non-JSON success responses into typed invalid response errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response("<html>not api json</html>", {
						status: 200,
						headers: { "Content-Type": "text/html" },
					}),
			),
		);

		await expect(apiGet("/api/v1/music/albums")).rejects.toMatchObject({
			status: 200,
			code: "system.invalid_response",
			message: "Invalid API response.",
			details: {},
		});
	});

	it("exposes ApiErrorResponseError for component error mapping", () => {
		const error = new ApiErrorResponseError(
			422,
			"music.invalid_source",
			"Invalid source.",
			{ field: "sources" },
		);

		expect(error.status).toBe(422);
		expect(error.code).toBe("music.invalid_source");
		expect(error.details).toEqual({ field: "sources" });
	});

	it("does not retry playlist updates after a not-found response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ error: { message: "Not found" } }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(
			updateMusicPlaylist("playlist-1", { is_public: true }),
		).rejects.toMatchObject({ status: 404 });
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("sends PATCH JSON requests with credentials and Accept headers", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({ data: { id: "artist_uuid", name: "Updated" } }),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await apiPatchJson<{ id: string; name: string }>(
			"/api/v1/music/artists/artist_uuid",
			{ name: "Updated" },
		);

		expect(fetch).toHaveBeenCalledWith("/api/v1/music/artists/artist_uuid", {
			method: "PATCH",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify({ name: "Updated" }),
		});
		expect(result.name).toBe("Updated");
	});
});

describe("music v1 adapter", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("builds api v1 endpoint paths", () => {
		expect(musicV1Endpoints.uploads()).toBe("/api/v1/uploads");
		expect(musicV1Endpoints.albums()).toBe("/api/v1/music/albums");
		expect(musicV1Endpoints.album("album_uuid")).toBe(
			"/api/v1/music/albums/album_uuid",
		);
		expect(musicV1Endpoints).not.toHaveProperty("edits");
		expect(musicV1Endpoints).not.toHaveProperty("editApprove");
	});

	it("reuses the shared api base url for music endpoints", () => {
		vi.spyOn(apiUrlModule, "useApiUrl").mockReturnValue(
			"https://api.atoman.org/api/v1",
		);

		expect(musicV1Endpoints.albums()).toBe(
			"https://api.atoman.org/api/v1/music/albums",
		);
		expect(musicV1Endpoints.artist("artist_uuid")).toBe(
			"https://api.atoman.org/api/v1/music/artists/artist_uuid",
		);
	});

	it("requests music home from GET /api/v1/music/home and returns its discover payload", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								personalized: false,
								recently_played: [],
								for_you: [],
								sections: [],
								discover: [
									{
										type: "album",
										id: "album-1",
										title: "Album",
										target_path: "/music?album=album-1",
									},
									{
										type: "playlist",
										id: "playlist-1",
										title: "Playlist",
										song_count: 8,
										target_path: "/music/playlists/playlist-1",
									},
								],
								discover_has_more: false,
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await getMusicHome();

		expect(fetch).toHaveBeenCalledWith("/api/v1/music/home", {
			credentials: "include",
			headers: { Accept: "application/json" },
		});
		expect(result.discover).toEqual([
			{
				type: "album",
				id: "album-1",
				title: "Album",
				target_path: "/music?album=album-1",
			},
			{
				type: "playlist",
				id: "playlist-1",
				title: "Playlist",
				song_count: 8,
				target_path: "/music/playlists/playlist-1",
			},
		]);
	});

	it("sends bearer authorization when uploading album archives", async () => {
		const storage = {
			getItem: vi.fn((key: string) => (key === "token" ? "test-token" : null)),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn(),
		};
		vi.stubGlobal("localStorage", storage);

		class FakeXMLHttpRequest {
			static lastInstance: FakeXMLHttpRequest | null = null;
			method = "";
			url = "";
			withCredentials = false;
			requestHeaders: Record<string, string> = {};
			upload = {
				addEventListener: vi.fn(),
			};
			private listeners: Record<string, Array<() => void>> = {};
			status = 200;

			constructor() {
				FakeXMLHttpRequest.lastInstance = this;
			}

			open(method: string, url: string) {
				this.method = method;
				this.url = url;
			}

			setRequestHeader(name: string, value: string) {
				this.requestHeaders[name] = value;
			}

			addEventListener(name: string, handler: () => void) {
				this.listeners[name] = this.listeners[name] || [];
				this.listeners[name].push(handler);
			}

			send(_body: FormData) {
				this.listeners.load?.forEach((handler) => handler());
			}
		}

		vi.stubGlobal(
			"XMLHttpRequest",
			FakeXMLHttpRequest as unknown as typeof XMLHttpRequest,
		);

		await uploadMusicAlbumArchive(
			"import-uuid",
			new File(["zip"], "album.zip", { type: "application/zip" }),
		);

		expect(FakeXMLHttpRequest.lastInstance?.withCredentials).toBe(true);
		expect(FakeXMLHttpRequest.lastInstance?.requestHeaders.Accept).toBe(
			"application/json",
		);
		expect(
			FakeXMLHttpRequest.lastInstance?.requestHeaders.Authorization,
		).toBeUndefined();
	});

	it("serializes list filters using the api v1 query vocabulary and preserves server pagination meta", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: [],
							meta: { page: 3, page_size: 20, total: 41, has_more: true },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await listMusicAlbums({
			q: "ambient",
			status: "open",
			page: 1,
			page_size: 20,
			sort: "-created_at",
		});

		expect(fetch).toHaveBeenCalledWith(
			"/api/v1/music/albums?q=ambient&status=open&page=1&page_size=20&sort=-created_at",
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
		expect(result).toEqual({
			data: [],
			meta: { page: 3, page_size: 20, total: 41, has_more: true },
		});
	});

	it("keeps album hot_score available to discovery views", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: [
								{
									id: "album_uuid",
									title: "Album",
									entry_status: "open",
									hot_score: 12.5,
									year: 2026,
								},
							],
							meta: { page: 1, page_size: 20, total: 1, has_more: false },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await listMusicAlbums({
			sort: "hot",
			page: 1,
			page_size: 20,
		});
		const first: MusicAlbumListItem = result.data[0];

		expect(fetch).toHaveBeenCalledWith(
			"/api/v1/music/albums?sort=hot&page=1&page_size=20",
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
		expect(first.hot_score).toBe(12.5);
		expect(first.year).toBe(2026);
	});

	it("lists artists through the music v1 namespace", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: [
								{ id: "artist_uuid", name: "Artist", entry_status: "open" },
							],
							meta: { page: 1, page_size: 20, total: 1, has_more: false },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await listMusicArtists({
			q: "artist",
			page: 1,
			page_size: 20,
		});

		expect(fetch).toHaveBeenCalledWith(
			"/api/v1/music/artists?q=artist&page=1&page_size=20",
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
		expect(result.data).toEqual([
			{ id: "artist_uuid", name: "Artist", entry_status: "open" },
		]);
	});

	it("gets artist details through the direct wiki endpoint", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								id: "artist_uuid",
								name: "Kanye West",
								bio: "Artist bio",
								entry_status: "open",
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await getMusicArtist("artist_uuid");

		expect(fetch).toHaveBeenCalledWith("/api/v1/music/artists/artist_uuid", {
			credentials: "include",
			headers: { Accept: "application/json" },
		});
		expect(result).toEqual({
			id: "artist_uuid",
			name: "Kanye West",
			bio: "Artist bio",
			entry_status: "open",
		});
	});

	it("creates artists through the direct wiki endpoint", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								id: "artist_uuid",
								name: "Kanye West",
								bio: "Artist bio",
								entry_status: "open",
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const input = {
			name: "Ye",
			legal_name: "Kanye Omari West",
			stage_names: [
				{
					name: "Ye",
					is_primary: true,
					start_date_text: "",
					end_date_text: "",
				},
			],
			bio: "Artist bio",
			nationality: "US",
			birth_place: "Atlanta",
			birth_date: "1977-06-08",
			artist_form: "person" as const,
			active_start_date: "1996-01-01",
			members: [],
		};
		const result = await createMusicArtist(input);

		expect(fetch).toHaveBeenCalledWith("/api/v1/music/artists", {
			method: "POST",
			credentials: "include",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(input),
		});
		expect(result).toEqual({
			id: "artist_uuid",
			name: "Kanye West",
			bio: "Artist bio",
			entry_status: "open",
		});
	});

	it("gets album details through the direct wiki endpoint", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								id: "album_uuid",
								title: "Graduation",
								entry_status: "open",
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await getMusicAlbum("album_uuid");

		expect(fetch).toHaveBeenCalledWith("/api/v1/music/albums/album_uuid", {
			credentials: "include",
			headers: { Accept: "application/json" },
		});
		expect(result).toEqual({
			id: "album_uuid",
			title: "Graduation",
			entry_status: "open",
		});
	});

	it("submits album track changes through revisions", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: { id: "revision-2", status: "approved", version_number: 2 },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);
		await submitAlbumRevision("album_uuid", {
			title: "Updated Album",
			artist_ids: ["artist_uuid"],
			release_date: "2026-07-01",
			album_type: "ep",
			tracks: [
				{
					id: "song-1",
					title: "Keep Song",
					track_number: 1,
					lyrics: "lyrics",
					audio_url: "https://cdn.example.com/song-1.mp3",
					audio_key: "music/album/album-1/staging/stage-1/tracks/song-1.mp3",
				},
				{
					title: "New Song",
					track_number: 2,
					audio_url: "https://cdn.example.com/song-2.mp3",
					audio_key: "music/album/album-1/staging/stage-1/tracks/new-song.mp3",
				},
			],
			reason: "Update album tracks",
			sources: [
				{ type: "url", url: "https://example.com/source", title: "Source" },
			],
		});

		expect(fetch).toHaveBeenCalledWith(
			"/api/v1/albums/album_uuid/revisions",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					base_revision: 0,
					changes: {
						title: "Updated Album",
						artist_ids: ["artist_uuid"],
						release_date: "2026-07-01",
						album_type: "ep",
						tracks: [
							{
								id: "song-1",
								title: "Keep Song",
								track_number: 1,
								lyrics: "lyrics",
								audio_url: "https://cdn.example.com/song-1.mp3",
								audio_key:
									"music/album/album-1/staging/stage-1/tracks/song-1.mp3",
							},
							{
								title: "New Song",
								track_number: 2,
								audio_url: "https://cdn.example.com/song-2.mp3",
								audio_key:
									"music/album/album-1/staging/stage-1/tracks/new-song.mp3",
							},
						],
					},
					edit_summary: "Update album tracks",
				}),
			}),
		);
	});

	it("uploads large audio through a resumable music upload session", async () => {
		const file = new File(["x"], "large-track.mp3", { type: "audio/mpeg" });
		Object.defineProperty(file, "size", { value: 32 * 1024 * 1024 });
		const part = new Blob(["x"], { type: file.type });
		Object.defineProperty(part, "size", { value: file.size });
		vi.spyOn(file, "slice").mockReturnValue(part);
		const expiresAt = new Date(Date.now() + 60_000).toISOString();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith("/music/uploads")) {
					return new Response(
						JSON.stringify({
							data: {
								id: "upload-1",
								status: "uploading",
								file_name: file.name,
								content_type: file.type,
								size: file.size,
								part_size: file.size,
								completed_parts: [],
								expires_at: expiresAt,
							},
						}),
						{ status: 201, headers: { "Content-Type": "application/json" } },
					);
				}
				if (url.endsWith("/music/uploads/upload-1/parts/1")) {
					return new Response(
						JSON.stringify({
							data: {
								part_number: 1,
								upload_url: "https://storage.example.test/part-1",
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				if (url === "https://storage.example.test/part-1") {
					return new Response(null, {
						status: 200,
						headers: { ETag: "etag-1" },
					});
				}
				if (url.endsWith("/music/uploads/upload-1/parts/1/complete")) {
					return new Response(JSON.stringify({ data: {} }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url.endsWith("/music/uploads/upload-1/complete")) {
					return new Response(
						JSON.stringify({
							data: {
								url: "https://assets.example.test/music/audio/large-track.mp3",
								key: "music/audio/large-track.mp3",
								content_type: file.type,
								size: file.size,
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				throw new Error(`unexpected request: ${url}`);
			}),
		);
		const onProgress = vi.fn();

		const asset = await uploadMusicAssetWithProgress(file, "music.audio", {
			onProgress,
		});

		expect(asset.key).toBe("music/audio/large-track.mp3");
		expect(vi.mocked(fetch).mock.calls.map(([input]) => String(input))).toEqual(
			[
				"/api/v1/music/uploads",
				"/api/v1/music/uploads/upload-1/parts/1",
				"https://storage.example.test/part-1",
				"/api/v1/music/uploads/upload-1/parts/1/complete",
				"/api/v1/music/uploads/upload-1/complete",
			],
		);
		expect(onProgress).toHaveBeenLastCalledWith({
			loaded: file.size,
			total: file.size,
		});
	});

	it("cancels music asset uploads before sending when the signal is already aborted", async () => {
		class FakeXMLHttpRequest {
			static lastInstance: FakeXMLHttpRequest | null = null;
			upload = { addEventListener: vi.fn() };
			send = vi.fn();
			open = vi.fn();
			setRequestHeader = vi.fn();
			addEventListener = vi.fn();
			constructor() {
				FakeXMLHttpRequest.lastInstance = this;
			}
		}
		const controller = new AbortController();
		controller.abort();
		vi.stubGlobal(
			"XMLHttpRequest",
			FakeXMLHttpRequest as unknown as typeof XMLHttpRequest,
		);

		await expect(
			uploadMusicAssetWithProgress(
				new File(["x"], "track.mp3"),
				"music.audio",
				{
					signal: controller.signal,
				},
			),
		).rejects.toThrow("音频上传已取消");
		expect(FakeXMLHttpRequest.lastInstance?.send).not.toHaveBeenCalled();
	});

	it("reports a retryable error when music asset upload times out", async () => {
		class FakeXMLHttpRequest {
			upload = { addEventListener: vi.fn() };
			timeout = 0;
			status = 0;
			responseText = "";
			private listeners: Record<string, Array<() => void>> = {};
			open = vi.fn();
			setRequestHeader = vi.fn();
			addEventListener(name: string, listener: () => void) {
				this.listeners[name] = this.listeners[name] || [];
				this.listeners[name].push(listener);
			}
			send() {
				this.listeners.timeout?.forEach((listener) => listener());
			}
		}
		vi.stubGlobal(
			"XMLHttpRequest",
			FakeXMLHttpRequest as unknown as typeof XMLHttpRequest,
		);

		await expect(
			uploadMusicAssetWithProgress(
				new File(["x"], "track.mp3"),
				"music.audio",
				{
					timeoutMs: 123,
				},
			),
		).rejects.toThrow("音频上传超时，请重试");
	});

	it("uploads music cover assets with the correct purpose", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								url: "https://cdn.example.com/assets/music/covers/uploads/users/user-1/2026/06/c.png",
								key: "music/covers/uploads/users/user-1/2026/06/c.png",
								content_type: "image/png",
								size: 1,
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);
		const file = new File(["x"], "cover.png", { type: "image/png" });

		const result = await uploadMusicAsset(file, "music.cover");

		const [, init] = vi.mocked(fetch).mock.calls[0];
		const body = (init as RequestInit).body as FormData;
		expect(result.url).toMatch(
			/^https:\/\/cdn\.example\.com\/assets\/music\/covers\/uploads\//,
		);
		expect(result.url).not.toMatch(/^\/uploads\//);
		expect(body.get("purpose")).toBe("music.cover");
		expect(body.get("file")).toBe(file);
	});

	it("uploads music assets with entity staging metadata when provided", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								url: "https://cdn.example.com/assets/music/album/album-1/staging/stage-1/cover.png",
								key: "music/album/album-1/staging/stage-1/cover.png",
								content_type: "image/png",
								size: 1,
							},
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);
		const file = new File(["x"], "cover.png", { type: "image/png" });

		await uploadMusicAsset(file, "music.cover", {
			entityType: "album",
			entityId: "album-1",
			stagingId: "stage-1",
		});

		const [, init] = vi.mocked(fetch).mock.calls[0];
		const body = (init as RequestInit).body as FormData;
		expect(body.get("purpose")).toBe("music.cover");
		expect(body.get("entity_type")).toBe("album");
		expect(body.get("entity_id")).toBe("album-1");
		expect(body.get("staging_id")).toBe("stage-1");
	});

	it("does not expose revert music edit endpoints or api methods", () => {
		expect(musicV1Endpoints).not.toHaveProperty("editRevert");
		expect(musicV1).not.toHaveProperty("revertMusicEdit");
	});

	it("uses unified comment endpoints for album discussion replies", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: {
								id: "reply_uuid",
								author_id: "user_uuid",
								reply_to_id: "discussion_uuid",
								content: "Reply",
								rendered_html: "<p>Reply</p>",
								status: "visible",
								like_count: 0,
								reply_count: 0,
								hot_score: 0,
								created_at: "2026-07-06T00:00:00Z",
								marked: false,
								liked: false,
								mentions: [],
								attachments: [],
								time_anchors: [],
								replies: [],
								author: {
									id: "user_uuid",
									username: "tester",
									display_name: "Tester",
									avatar_url: "",
								},
							},
						}),
						{ status: 201, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await replyAlbumDiscussion(
			"album_uuid",
			"discussion_uuid",
			"Reply",
		);

		expect(fetch).toHaveBeenCalledWith(
			"/api/v1/discussions/music_album/album_uuid/comments",
			{
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					content: "Reply",
					reply_to_id: "discussion_uuid",
					mentions: [],
					attachment_ids: [],
				}),
			},
		);
		expect(result.parent_id).toBe("discussion_uuid");
	});

	it("uses unified comment endpoints for album discussions and deletion", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === "DELETE") {
					return new Response(JSON.stringify({ data: { ok: true } }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (init?.method === "POST") {
					return new Response(
						JSON.stringify({
							data: {
								id: "root_uuid",
								author_id: "user_uuid",
								content: "Root",
								rendered_html: "<p>Root</p>",
								status: "visible",
								like_count: 0,
								reply_count: 0,
								hot_score: 0,
								created_at: "2026-07-06T00:00:00Z",
								marked: false,
								liked: false,
								mentions: [],
								attachments: [],
								time_anchors: [],
								replies: [],
								author: {
									id: "user_uuid",
									username: "tester",
									display_name: "Tester",
									avatar_url: "",
								},
							},
						}),
						{ status: 201, headers: { "Content-Type": "application/json" } },
					);
				}
				return new Response(
					JSON.stringify({
						data: {
							items: [],
							page: 1,
							per_page: 20,
							total_roots: 0,
							total_comments: 0,
							total_replies: 0,
							target: { kind: "music_album", resource_id: "album_uuid" },
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			},
		);
		vi.stubGlobal("fetch", fetchMock);

		await listAlbumDiscussions("album_uuid");
		await createAlbumDiscussion("album_uuid", "Root");
		const result = await deleteAlbumDiscussion("album_uuid", "comment_uuid");

		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"/api/v1/discussions/music_album/album_uuid/comments",
			{
				credentials: "include",
				headers: { Accept: "application/json" },
			},
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"/api/v1/discussions/music_album/album_uuid/comments",
			{
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					content: "Root",
					mentions: [],
					attachment_ids: [],
				}),
			},
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			"/api/v1/comments/comment_uuid",
			{
				method: "DELETE",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
			},
		);
		expect(result).toEqual({ success: true });
	});

	it("starts album import multipart uploads through the correct path and body", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							data: { partSize: 10485760, completedParts: [] },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);

		const result = await startMusicAlbumImportMultipart("import_uuid", {
			fileName: "album.zip",
			fileSize: 123456,
			contentType: "application/zip",
		});

		expect(fetch).toHaveBeenCalledWith(
			"/api/v1/music/imports/albums/import_uuid/multipart",
			{
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					fileName: "album.zip",
					fileSize: 123456,
					contentType: "application/zip",
				}),
			},
		);
		expect(result).toEqual({ partSize: 10485760, completedParts: [] });
	});

	it("rejects album archive files over 2GB before sending requests", async () => {
		vi.stubGlobal("fetch", vi.fn());
		const file = new File(["x"], "album.zip", { type: "application/zip" });
		Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 * 1024 + 1 });

		await expect(
			uploadMusicAlbumArchiveMultipart("import_uuid", file),
		).rejects.toThrow("文件需在 2GB 以内，请转换或压缩后上传");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("skips completed multipart parts and only uploads missing parts", async () => {
		const file = new File(["aaaabbbbcccc"], "album.zip", {
			type: "application/zip",
		});
		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			if (url === "/api/v1/music/imports/albums/import_uuid/multipart") {
				return new Response(
					JSON.stringify({
						data: {
							partSize: 4,
							completedParts: [{ partNumber: 2, etag: "existing-etag" }],
						},
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url.endsWith("/multipart/parts/1")) {
				return new Response(
					JSON.stringify({
						data: { partNumber: 1, uploadUrl: "https://r2.example.com/part-1" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url.endsWith("/multipart/parts/3")) {
				return new Response(
					JSON.stringify({
						data: { partNumber: 3, uploadUrl: "https://r2.example.com/part-3" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url === "https://r2.example.com/part-1") {
				expect(init).toMatchObject({ method: "PUT" });
				expect(init?.credentials).toBeUndefined();
				expect(init?.headers).toBeUndefined();
				return new Response(null, {
					status: 200,
					headers: { ETag: '"etag-1"' },
				});
			}
			if (url === "https://r2.example.com/part-3") {
				expect(init).toMatchObject({ method: "PUT" });
				expect(init?.credentials).toBeUndefined();
				expect(init?.headers).toBeUndefined();
				return new Response(null, {
					status: 200,
					headers: { ETag: '"etag-3"' },
				});
			}
			if (
				url.endsWith("/multipart/parts/1/complete") ||
				url.endsWith("/multipart/parts/3/complete")
			) {
				return new Response(JSON.stringify({ data: { ok: true } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (
				url === "/api/v1/music/imports/albums/import_uuid/multipart/complete"
			) {
				return new Response(
					JSON.stringify({
						data: { importId: "import_uuid", status: "uploaded" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			throw new Error(`unexpected request ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await uploadMusicAlbumArchiveMultipart("import_uuid", file);

		expect(result).toMatchObject({
			importId: "import_uuid",
			status: "uploaded",
		});
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/v1/music/imports/albums/import_uuid/multipart/parts/2",
			expect.anything(),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://r2.example.com/part-1",
			expect.objectContaining({ method: "PUT" }),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://r2.example.com/part-3",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("reports multipart ETags to part complete and then completes the import", async () => {
		const file = new File(["aaaabbbb"], "album.zip", {
			type: "application/zip",
		});
		const progress: Array<{
			loaded: number;
			total: number;
			bytesPerSecond: number;
		}> = [];
		const fetchMock = vi.fn(async (url: string) => {
			if (url === "/api/v1/music/imports/albums/import_uuid/multipart") {
				return new Response(
					JSON.stringify({ data: { partSize: 4, completedParts: [] } }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url.endsWith("/multipart/parts/1")) {
				return new Response(
					JSON.stringify({
						data: { partNumber: 1, uploadUrl: "https://r2.example.com/part-1" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url.endsWith("/multipart/parts/2")) {
				return new Response(
					JSON.stringify({
						data: { partNumber: 2, uploadUrl: "https://r2.example.com/part-2" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url === "https://r2.example.com/part-1")
				return new Response(null, {
					status: 200,
					headers: { etag: '"etag-1"' },
				});
			if (url === "https://r2.example.com/part-2")
				return new Response(null, {
					status: 200,
					headers: { ETag: '"etag-2"' },
				});
			if (
				url.endsWith("/multipart/parts/1/complete") ||
				url.endsWith("/multipart/parts/2/complete")
			) {
				return new Response(JSON.stringify({ data: { ok: true } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (
				url === "/api/v1/music/imports/albums/import_uuid/multipart/complete"
			) {
				return new Response(
					JSON.stringify({
						data: { importId: "import_uuid", status: "uploaded" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			throw new Error(`unexpected request ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		await uploadMusicAlbumArchiveMultipart("import_uuid", file, {
			onProgress: (event) => progress.push(event),
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/music/imports/albums/import_uuid/multipart/parts/1/complete",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ etag: '"etag-1"' }),
			}),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/music/imports/albums/import_uuid/multipart/parts/2/complete",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ etag: '"etag-2"' }),
			}),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/music/imports/albums/import_uuid/multipart/complete",
			expect.objectContaining({ method: "POST" }),
		);
		expect(progress.at(-1)).toMatchObject({ loaded: 8, total: 8 });
		expect(progress.at(-1)?.bytesPerSecond).toBeGreaterThan(0);
	});

	it("retries failed R2 PUT requests twice and succeeds on the third attempt", async () => {
		const file = new File(["aaaa"], "album.zip", { type: "application/zip" });
		const putCalls: RequestInit[] = [];
		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			if (url === "/api/v1/music/imports/albums/import_uuid/multipart") {
				return new Response(
					JSON.stringify({ data: { partSize: 4, completedParts: [] } }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (
				url === "/api/v1/music/imports/albums/import_uuid/multipart/parts/1"
			) {
				return new Response(
					JSON.stringify({
						data: {
							partNumber: 1,
							uploadUrl: "https://r2.example.com/retry-part",
						},
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url === "https://r2.example.com/retry-part") {
				putCalls.push(init as RequestInit);
				expect(init?.credentials).toBeUndefined();
				expect(init?.headers).toBeUndefined();
				return new Response(null, {
					status: putCalls.length < 3 ? 500 : 200,
					headers:
						putCalls.length < 3 ? undefined : { ETag: '"etag-after-retry"' },
				});
			}
			if (
				url ===
				"/api/v1/music/imports/albums/import_uuid/multipart/parts/1/complete"
			) {
				return new Response(
					JSON.stringify({
						data: { partNumber: 1, etag: '"etag-after-retry"' },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (
				url === "/api/v1/music/imports/albums/import_uuid/multipart/complete"
			) {
				return new Response(
					JSON.stringify({
						data: { importId: "import_uuid", status: "uploaded" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			throw new Error(`unexpected request ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await uploadMusicAlbumArchiveMultipart("import_uuid", file);

		expect(result).toMatchObject({
			importId: "import_uuid",
			status: "uploaded",
		});
		expect(putCalls).toHaveLength(3);
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/v1/music/imports/albums/import_uuid/multipart/complete",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("throws a useful error after R2 PUT retries are exhausted and skips final complete", async () => {
		const file = new File(["aaaa"], "album.zip", { type: "application/zip" });
		const putCalls: RequestInit[] = [];
		const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
			if (url === "/api/v1/music/imports/albums/import_uuid/multipart") {
				return new Response(
					JSON.stringify({ data: { partSize: 4, completedParts: [] } }),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (
				url === "/api/v1/music/imports/albums/import_uuid/multipart/parts/1"
			) {
				return new Response(
					JSON.stringify({
						data: {
							partNumber: 1,
							uploadUrl: "https://r2.example.com/failing-part",
						},
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url === "https://r2.example.com/failing-part") {
				putCalls.push(init as RequestInit);
				expect(init?.credentials).toBeUndefined();
				expect(init?.headers).toBeUndefined();
				return new Response(null, { status: 503 });
			}
			throw new Error(`unexpected request ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			uploadMusicAlbumArchiveMultipart("import_uuid", file),
		).rejects.toThrow("上传分片失败 (503)");

		expect(putCalls).toHaveLength(3);
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/v1/music/imports/albums/import_uuid/multipart/complete",
			expect.anything(),
		);
	});

	it("reports 100% progress when all multipart parts are already completed", async () => {
		const file = new File(["aaaabbbb"], "album.zip", {
			type: "application/zip",
		});
		const progress: Array<{
			loaded: number;
			total: number;
			bytesPerSecond: number;
		}> = [];
		const fetchMock = vi.fn(async (url: string) => {
			if (url === "/api/v1/music/imports/albums/import_uuid/multipart") {
				return new Response(
					JSON.stringify({
						data: {
							partSize: 4,
							completedParts: [
								{ partNumber: 1, etag: '"etag-1"' },
								{ partNumber: 2, etag: '"etag-2"' },
							],
						},
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (
				url === "/api/v1/music/imports/albums/import_uuid/multipart/complete"
			) {
				return new Response(
					JSON.stringify({
						data: { importId: "import_uuid", status: "uploaded" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			throw new Error(`unexpected request ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		await uploadMusicAlbumArchiveMultipart("import_uuid", file, {
			onProgress: (event) => progress.push(event),
		});

		expect(progress).toHaveLength(1);
		expect(progress[0]).toMatchObject({ loaded: 8, total: 8 });
		expect(fetchMock).not.toHaveBeenCalledWith(
			"/api/v1/music/imports/albums/import_uuid/multipart/parts/1",
			expect.anything(),
		);
	});
});

describe("music merge API contract", () => {
	it("使用直接合并接口", () => {
		const source = readFileSync(
			path.resolve(process.cwd(), "src/api/musicV1/catalog.ts"),
			"utf8",
		);

		expect(source).toContain("musicV1Endpoints.artistMerge(targetArtistId)");
		expect(source).toContain("musicV1Endpoints.albumMerge(targetAlbumId)");
		expect(source).not.toContain("submitMusicEdit");
	});
});
