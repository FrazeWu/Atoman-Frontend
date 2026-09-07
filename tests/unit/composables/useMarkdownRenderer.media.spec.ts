import { describe, expect, it } from "vitest";
import { useMarkdownRenderer } from "../../../src/composables/useMarkdownRenderer";

const albumId = "22222222-2222-2222-2222-222222222222";
const videoId = "33333333-3333-3333-3333-333333333333";

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
		expect(html).toContain('preload="none"');
		expect(html).toContain('src="/media/demo.mp4"');
		expect(html).toContain('poster="/media/demo.jpg"');
		expect(html).toContain('data-atoman-embed="video"');
		expect(html).toContain('href="/videos/watch/' + videoId + '"');
		expect(html).not.toContain("autoplay");
	});
});
