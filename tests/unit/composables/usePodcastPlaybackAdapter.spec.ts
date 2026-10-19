import { describe, expect, it, beforeEach, vi } from "vitest";
import {
	usePodcastPlaybackAdapter,
	createPodcastSong,
	createPodcastEpisodeSong,
	episodeCover,
	savePodcastProgress,
	readPodcastProgress,
} from "@/composables/usePodcastPlaybackAdapter";
import type { PodcastEpisode, FeedItem } from "@/types";
import type { Song } from "@/entities/music";

describe("usePodcastPlaybackAdapter", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("converts a podcast episode into a playable Song format", () => {
		const adapter = usePodcastPlaybackAdapter();
		const episode: PodcastEpisode = {
			id: 101 as any,
			title: "Episode 101",
			podcast_id: 1,
			podcast_title: "Tech Weekly",
			audio_url: "https://example.com/ep101.mp3",
			duration_seconds: 3600,
			cover_url: "https://example.com/cover.jpg",
			published_at: "2026-10-19T00:00:00Z",
		} as any;

		const song = adapter.createPodcastEpisodeSong(episode);
		expect(song.id).toBe("podcast:101");
		expect(song.source_type).toBe("podcast_episode");
		expect(song.source_id).toBe("101");
		expect(song.title).toBe("Episode 101");
		expect(song.artist).toBe("Tech Weekly");
		expect(song.duration).toBe(3600);
	});

	it("reads and saves podcast progress to localStorage", () => {
		const adapter = usePodcastPlaybackAdapter();
		const song = adapter.createPodcastEpisodeSong({
			id: 202,
			title: "Episode 202",
			audio_url: "https://example.com/ep202.mp3",
		} as any);

		adapter.savePodcastProgress(song, 120, 300);
		const saved = adapter.readPodcastProgress("202");
		expect(saved?.position_sec).toBe(120);
		expect(saved?.completed).toBe(false);
	});

	it("marks completed when progress reaches or exceeds 95% of duration", () => {
		const adapter = usePodcastPlaybackAdapter();
		const song = adapter.createPodcastEpisodeSong({
			id: 303,
			title: "Episode 303",
			audio_url: "https://example.com/ep303.mp3",
		} as any);

		adapter.savePodcastProgress(song, 290, 300);
		const saved = adapter.readPodcastProgress("303");
		expect(saved?.position_sec).toBe(290);
		expect(saved?.completed).toBe(true);
	});

	it("ignores saving progress for non-podcast songs or empty source IDs", () => {
		const adapter = usePodcastPlaybackAdapter();
		const musicSong = {
			id: "music-1",
			title: "Music Song",
			source_type: "music",
			source_id: "music-1",
		} as unknown as Song;

		adapter.savePodcastProgress(musicSong, 100, 200);
		expect(adapter.readPodcastProgress("music-1")).toBeNull();

		adapter.savePodcastProgress(null, 100, 200);
		expect(adapter.readPodcastProgress("")).toBeNull();
	});

	it("converts a playable feed item to Song format and respects numeric / UUID ids", () => {
		const adapter = usePodcastPlaybackAdapter();

		const numericFeedItem: Partial<FeedItem> = {
			id: "404",
			title: "Feed Episode",
			author: "Feed Author",
			enclosure_url: "https://example.com/feed.mp3",
			enclosure_type: "audio/mpeg",
			published_at: "2026-01-01T00:00:00Z",
		};
		const song = adapter.createPodcastSong(numericFeedItem as FeedItem);
		expect(song).not.toBeNull();
		expect(song?.id).toBe(404);
		expect(song?.source_type).toBe("feed_podcast");
		expect(song?.source_id).toBe("404");
		expect(song?.title).toBe("Feed Episode");
		expect(song?.media_kind).toBe("feed_item");

		const uuidFeedItem: Partial<FeedItem> = {
			id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			title: "UUID Episode",
			enclosure_url: "https://example.com/feed2.mp3",
			enclosure_type: "audio/mp3",
		};
		const uuidSong = adapter.createPodcastSong(uuidFeedItem as FeedItem);
		expect(uuidSong?.id).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
		expect(uuidSong?.source_id).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
	});

	it("returns null for non-audio or invalid feed items", () => {
		const adapter = usePodcastPlaybackAdapter();

		const imageAttachment: Partial<FeedItem> = {
			id: "img-1",
			enclosure_url: "https://example.com/image.png",
			enclosure_type: "image/png",
		};
		expect(adapter.createPodcastSong(imageAttachment as FeedItem)).toBeNull();
		expect(adapter.createPodcastSong(null)).toBeNull();
	});

	it("resolves episodeCover with proper fallback priority", () => {
		expect(
			episodeCover({
				id: "1",
				cover_url: "https://example.com/direct.jpg",
				episode_cover_url: "https://example.com/ep.jpg",
			} as any),
		).toBe("https://example.com/direct.jpg");

		expect(
			episodeCover({
				id: "2",
				episode_cover_url: "https://example.com/ep.jpg",
				post: { cover_url: "https://example.com/post.jpg" } as any,
			} as any),
		).toBe("https://example.com/ep.jpg");

		expect(
			episodeCover({
				id: "3",
				post: {
					cover_url: "",
					collections: [{ cover_url: "https://example.com/post-col.jpg" }],
				} as any,
			} as any),
		).toBe("https://example.com/post-col.jpg");

		expect(
			episodeCover({
				id: "4",
				collections: [{ cover_url: "https://example.com/col.jpg" }],
			} as any),
		).toBe("https://example.com/col.jpg");

		expect(
			episodeCover({
				id: "5",
				channel: { cover_url: "https://example.com/channel.jpg" } as any,
			} as any),
		).toBe("https://example.com/channel.jpg");
	});

	it("creates an episode consumption tracker that dispatches events", () => {
		const adapter = usePodcastPlaybackAdapter();
		const onEvent = vi.fn();
		const onProgress = vi.fn();

		const tracker = adapter.createEpisodeConsumptionTracker({
			episodeId: "ep-999",
			getCurrentTime: () => 150,
			getDuration: () => 300,
			onEvent,
			onProgress,
		});

		tracker.open();
		expect(onEvent).toHaveBeenCalledWith("open");

		tracker.update(0.2);
		expect(onEvent).toHaveBeenCalledWith("engaged");
		expect(onProgress).toHaveBeenCalledWith(0.2);

		tracker.update(0.96);
		expect(onEvent).toHaveBeenCalledWith("complete");
		expect(onProgress).toHaveBeenCalledWith(0.96);
	});
});
