import { flushPromises } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBlogMediaEmbeds } from "../../../src/composables/useBlogMediaEmbeds";

const albumId = "22222222-2222-2222-2222-222222222222";
const videoId = "44444444-4444-4444-4444-444444444444";
const songAudioUrl = "https://cdn.example.com/audio/song.mp3";

const response = (data: unknown, status = 200) =>
	new Response(JSON.stringify({ data }), { status });

describe("useBlogMediaEmbeds", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("falls back from an album reference to a song reference", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith(`/music/albums/${albumId}`)) return response({}, 404);
			if (url.endsWith(`/music/songs/${albumId}`)) {
				return response({
					song: {
						id: albumId,
						title: "单曲引用",
						artists: [{ id: "artist-1", name: "作者" }],
						cover_url: "/cover.jpg",
						duration_sec: 125,
						audio_url: songAudioUrl,
					},
					playable: true,
				});
			}
			return response({}, 404);
		});
		vi.stubGlobal("fetch", fetchMock);

		const embeds = useBlogMediaEmbeds();
		await embeds.load(`:::music{id="${albumId}"}\n:::`);

		expect(embeds.musicEmbeds.value[albumId]).toMatchObject({
			kind: "song",
			title: "单曲引用",
			href: `/music/song/${albumId}`,
			audioSrc: songAudioUrl,
		});
		expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
			expect.arrayContaining([
				`/api/v1/music/albums/${albumId}`,
				`/api/v1/music/songs/${albumId}`,
			]),
		);
	});

	it("normalizes production audio URLs for browser playback", async () => {
		const songId = "66666666-6666-6666-6666-666666666666";
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith(`/music/albums/${songId}`)) return response({}, 404);
			if (url.endsWith(`/music/songs/${songId}`)) {
				return response({
					song: {
						id: songId,
						title: "云端单曲",
						audio_url: "https://assets.atoman.org/music/audio/cloud-song.mp3",
					},
					playable: true,
				});
			}
			return response({}, 404);
		});
		vi.stubGlobal("fetch", fetchMock);

		const embeds = useBlogMediaEmbeds();
		await embeds.load(`:::music{id="${songId}"}\n:::`);

		expect(embeds.musicEmbeds.value[songId]?.audioSrc).toBe(
			"https://assets.atoman.org/music/audio/cloud-song.mp3?cors=1",
		);
	});

	it("loads a playable video and ignores a late response after a new load", async () => {
		const firstVideo = new Promise<Response>((resolve) => {
			setTimeout(() => resolve(response({
				id: videoId,
				title: "旧视频",
				description: "旧内容",
				storage_type: "local",
				video_url: "/old.mp4",
				thumbnail_url: "/old.jpg",
				duration_sec: 10,
			})), 20);
		});
		vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.endsWith(`/videos/${videoId}`)) return firstVideo;
			return response({}, 404);
		}));

		const embeds = useBlogMediaEmbeds();
		const firstLoad = embeds.load(`:::video{id="${videoId}"}\n:::`);
		await embeds.load("没有媒体");
		await firstLoad;
		await flushPromises();

		expect(embeds.videoEmbeds.value).toEqual({});
	});
});
