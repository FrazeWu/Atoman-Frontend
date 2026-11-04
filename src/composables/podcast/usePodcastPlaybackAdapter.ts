import { getActivePinia } from "pinia";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
	createContentConsumptionTracker,
	useContentLifecycle,
} from "@/composables/useContentLifecycle";
import {
	readPodcastProgress,
	writePodcastProgress,
	type PodcastProgressRecord,
} from "@/composables/usePodcastProgress";
import { isPlayableFeedPodcast } from "@/utils/feedPodcast";
import { resolveUploadedMediaURL } from "@/utils/mediaUrl";
import type { FeedItem, PodcastEpisode, TimelineItem } from "@/types";
import type { Song } from "@/entities/music";

export type { PodcastProgressRecord };

export interface PodcastTrackerOptions {
	episodeId: string;
	getCurrentTime?: () => number;
	getDuration?: () => number;
	onEvent?: (event: "open" | "engaged" | "complete") => void;
	onProgress?: (progress: number) => void;
}

export interface PodcastTrackerInstance {
	open: () => void;
	update: (rawProgress: number) => void;
}

export function episodeCover(
	episode: PodcastEpisode | (Record<string, any> & { id: string | number }),
): string {
	const ep = episode as any;
	return (
		ep.cover_url ||
		ep.episode_cover_url ||
		ep.post?.cover_url ||
		ep.post?.collections?.[0]?.cover_url ||
		ep.collections?.[0]?.cover_url ||
		ep.channel?.cover_url ||
		""
	);
}

export function createPodcastSong(
	feedItem: FeedItem | TimelineItem["feed_item"] | null | undefined,
): Song | null {
	if (!feedItem || !isPlayableFeedPodcast(feedItem)) return null;

	const rawId = String(feedItem.id);
	return {
		id: /^\d+$/.test(rawId) ? Number(rawId) : rawId,
		source_type: "feed_podcast",
		source_id: rawId,
		title: feedItem.title || "未知播客",
		artist: feedItem.author || feedItem.feed_source?.title || "Podcast",
		album: feedItem.feed_source?.title || "Podcast",
		album_id: -1,
		year: new Date(feedItem.published_at || "").getFullYear() || 0,
		release_date: feedItem.published_at || "",
		lyrics: feedItem.summary || "",
		audio_url: feedItem.enclosure_url || "",
		media_kind: "feed_item",
		cover_url: feedItem.image_url || feedItem.feed_source?.cover_url || "",
		status: "approved" as const,
	};
}

export function createPodcastEpisodeSong(
	episode: PodcastEpisode | (Record<string, any> & { id: string | number }),
	apiURL = "",
): Song {
	const ep = episode as any;
	const rawId = String(ep.id);
	const title = ep.title || ep.post?.title || "未命名单集";
	const artist = ep.podcast_title || ep.channel?.name || "播客";
	const album =
		ep.podcast_title ||
		ep.post?.collections?.[0]?.name ||
		ep.collections?.[0]?.name ||
		ep.channel?.name ||
		"播客";
	const albumId =
		ep.podcast_id ||
		ep.post?.collections?.[0]?.id ||
		ep.collections?.[0]?.id ||
		ep.channel_id ||
		-1;
	const releaseDate = ep.published_at || ep.created_at || "";
	const year = new Date(releaseDate).getFullYear() || 0;
	const duration =
		typeof ep.duration_seconds === "number"
			? ep.duration_seconds
			: typeof ep.duration_sec === "number"
				? ep.duration_sec
				: undefined;
	const lyrics = ep.summary || ep.post?.content || "";
	const rawAudio = ep.audio_url || "";
	const audioUrl = apiURL ? resolveUploadedMediaURL(rawAudio, apiURL) : rawAudio;
	const rawCover = episodeCover(episode);
	const coverUrl = apiURL ? resolveUploadedMediaURL(rawCover, apiURL) : rawCover;

	return {
		id: `podcast:${rawId}`,
		source_type: "podcast_episode",
		source_id: rawId,
		title,
		artist,
		album,
		album_id: albumId,
		year,
		release_date: releaseDate,
		duration,
		lyrics,
		audio_url: audioUrl,
		cover_url: coverUrl,
		track_number: ep.episode_number,
		status: "approved" as const,
	};
}

export function savePodcastProgress(
	currentSong: Song | null,
	currentTime: number,
	duration: number,
	completed?: boolean,
): void {
	if (currentSong?.source_type !== "podcast_episode" || !currentSong.source_id) return;
	const posSec = Math.max(0, Math.floor(currentTime));
	const durSec = Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 0;
	const isCompleted = completed ?? (durSec > 0 && posSec >= durSec * 0.95);

	writePodcastProgress({
		episode_id: String(currentSong.source_id),
		position_sec: posSec,
		duration_sec: durSec,
		completed: isCompleted,
		last_played_at: new Date().toISOString(),
	});
}

export { readPodcastProgress };

export function usePodcastPlaybackAdapter() {
	let apiURL = "";
	try {
		const api = useApi();
		apiURL = api.url;
	} catch {
		// api composable fallback
	}

	const createEpisodeSong = (
		episode: PodcastEpisode | (Record<string, any> & { id: string | number }),
	): Song => createPodcastEpisodeSong(episode, apiURL);

	const createEpisodeConsumptionTracker = (
		options: PodcastTrackerOptions,
	): PodcastTrackerInstance => {
		const getCurrentTime = options.getCurrentTime ?? (() => 0);
		const getDuration = options.getDuration ?? (() => 0);

		const pinia = typeof getActivePinia === "function" ? getActivePinia() : undefined;
		const lifecycle = pinia ? useContentLifecycle() : null;
		const authStore = pinia ? useAuthStore(pinia) : null;

		return createContentConsumptionTracker({
			onEvent: (event) => {
				const curTime = getCurrentTime();
				const dur = getDuration();
				if (lifecycle) {
					void lifecycle
						.recordEvent({
							module: "podcast",
							content_id: options.episodeId,
							event,
							position_sec: Math.floor(curTime),
							duration_sec: Math.floor(dur),
							progress: dur > 0 ? curTime / dur : 0,
						})
						.catch(() => undefined);
				}
				options.onEvent?.(event);
			},
			onProgress: (progress) => {
				if (authStore?.token && lifecycle) {
					const curTime = getCurrentTime();
					const dur = getDuration();
					void lifecycle
						.saveProgress({
							module: "podcast",
							content_id: options.episodeId,
							position_sec: Math.floor(curTime),
							duration_sec: Math.floor(dur),
							progress,
							completed: progress >= 0.95,
						})
						.catch(() => undefined);
				}
				options.onProgress?.(progress);
			},
		});
	};

	return {
		createPodcastSong,
		createPodcastEpisodeSong: createEpisodeSong,
		savePodcastProgress,
		readPodcastProgress,
		createEpisodeConsumptionTracker,
	};
}
