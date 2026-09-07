import { describe, expect, it } from "vitest";
import { useMarkdownRenderer } from "../../../src/composables/useMarkdownRenderer";

const albumId = "22222222-2222-2222-2222-222222222222";
const videoId = "33333333-3333-3333-3333-333333333333";
const songId = "55555555-5555-5555-5555-555555555555";

describe("useMarkdownRenderer media embeds", () => {

	it("renders music as a horizontal linked card", () => {
		const { renderMarkdown } = useMarkdownRenderer();
		const html = renderMarkdown(`:::music{id="${albumId}"}\n:::`, {
			musicEmbeds: {
				[albumId]: {
					id: albumId,
					title: "夜航星",
					kind: "album",
					imageUrl: "https://cdn.example.test/cover.jpg",
					meta: "Atoman · 2026 · 8 首",
					href: `/music/album/${albumId}`,
				},
			},
		});

		expect(html).toContain("atoman-post-embed--music");
		expect(html).toContain("atoman-post-embed--music-album");
		expect(html).toContain('data-atoman-embed="music"');
		expect(html).toContain('href="/music/album/' + albumId + '"');
		expect(html).toContain('src="https://cdn.example.test/cover.jpg"');
		expect(html).toContain("夜航星");
	});

	it("renders a playable single-song card without nesting the player in its link", () => {
		const { renderMarkdown } = useMarkdownRenderer();
		const html = renderMarkdown(`:::music{id="${songId}"}\n:::`, {
			musicEmbeds: {
				[songId]: {
					id: songId,
					title: "夜航星",
					kind: "song",
					audioSrc: "https://cdn.example.test/song.mp3",
					href: `/music/song/${songId}`,
				},
			},
		});

		const document = new DOMParser().parseFromString(html, "text/html");
		const audio = document.querySelector("audio");
		expect(audio).not.toBeNull();
		expect(audio?.getAttribute("controls")).toBe("");
		expect(audio?.getAttribute("preload")).toBe("metadata");
		expect(audio?.getAttribute("src")).toBe("https://cdn.example.test/song.mp3");
		expect(audio?.closest("a")).toBeNull();
		expect(document.querySelector('a[data-atoman-embed="music"]')?.getAttribute("href")).toBe(`/music/song/${songId}`);
	});

	it("renders video with a non-autoplay player and a detail link", () => {
		const { renderMarkdown } = useMarkdownRenderer();
		const html = renderMarkdown(`:::video{id="${videoId}"}\n:::`, {
			videoEmbeds: {
				[videoId]: {
					id: videoId,
					title: "演示视频",
					kind: "video",
					videoSrc: "/media/demo.mp4",
					posterUrl: "/media/demo.jpg",
					href: `/videos/watch/${videoId}`,
				},
			},
		});

		expect(html).toContain("atoman-post-embed--video");
		expect(html).toContain("<video");
		expect(html).toContain('controls=""');
		expect(html).toContain('preload="metadata"');
		expect(html).toContain('src="/media/demo.mp4"');
		expect(html).toContain('poster="/media/demo.jpg"');
		expect(html).toContain('data-atoman-embed="video"');
		expect(html).toContain('href="/videos/watch/' + videoId + '"');
		expect(html).not.toContain("autoplay");
	});

	it("keeps the video element after markdown sanitization", () => {
		const { renderMarkdown } = useMarkdownRenderer();
		const html = renderMarkdown(`:::video{id="${videoId}"}\n:::`, {
			videoEmbeds: {
				[videoId]: {
					id: videoId,
					title: "可播放视频",
					kind: "video",
					videoSrc: "/media/demo.mp4",
					href: `/videos/watch/${videoId}`,
				},
			},
		});

		const document = new DOMParser().parseFromString(html, "text/html");
		expect(document.querySelector("video")).not.toBeNull();
		expect(document.querySelector("video")?.getAttribute("src")).toBe("/media/demo.mp4");
	});
});
