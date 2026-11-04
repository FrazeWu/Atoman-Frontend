import { computed, ref, watch } from "vue";
import type { PodcastEpisode, RepeatMode, Song, TimelineItem } from "@/types";
import { shufflePlaybackItems } from "@/utils/playerQueue";
import { playbackItemKey } from "@/utils/playerState";
import { isPlayableFeedPodcast } from "@/utils/feedPodcast";

export type PlaybackMode = "loop" | "single" | "random";

export interface PlayerQueueOptions {
	getCurrentSong: () => Song | null;
	getFallbackSongs?: () => Song[];
	onQueueOrShuffleChanged?: () => void;
	createPodcastSong?: (feedItem: any) => Song | null;
	createPodcastEpisodeSong?: (episode: PodcastEpisode) => Song;
}

export function createPlayerQueue(options: PlayerQueueOptions) {
	const queue = ref<Song[]>([]);
	const shuffledQueue = ref<Song[]>([]);
	const currentAlbum = ref<Song[] | null>(null);
	const isShuffled = ref(false);
	const repeatMode = ref<RepeatMode>("all");
	const playbackMode = ref<PlaybackMode>("loop");

	const recomputeShuffledQueue = () => {
		if (!isShuffled.value) {
			shuffledQueue.value = [];
			return;
		}
		const fallback = options.getFallbackSongs ? options.getFallbackSongs() : [];
		const list = queue.value.length > 0 ? queue.value : fallback;
		if (list.length === 0) return;

		const newList = shufflePlaybackItems(list);
		const current = options.getCurrentSong();
		if (current) {
			const currentKey = playbackItemKey(current);
			const idx = newList.findIndex((s) => playbackItemKey(s) === currentKey);
			if (idx > -1) {
				newList.splice(idx, 1);
				newList.unshift(current);
			}
		}
		shuffledQueue.value = newList;
	};

	const activeQueue = computed(() =>
		isShuffled.value && shuffledQueue.value.length > 0
			? shuffledQueue.value
			: queue.value,
	);

	const getActiveList = () => {
		const fallback = options.getFallbackSongs ? options.getFallbackSongs() : [];
		return activeQueue.value.length > 0 ? activeQueue.value : fallback;
	};

	watch(isShuffled, () => {
		recomputeShuffledQueue();
		options.onQueueOrShuffleChanged?.();
	});

	// Lyrics/waveform hydration replaces queue objects without changing their
	// identity or order; it must not reshuffle the remaining playback sequence.
	watch(
		() => queue.value.map(playbackItemKey).join("|"),
		() => {
			if (isShuffled.value) recomputeShuffledQueue();
			options.onQueueOrShuffleChanged?.();
		},
	);

	// Sync isShuffled and repeatMode based on playbackMode
	watch(
		playbackMode,
		(mode) => {
			switch (mode) {
				case "loop":
					isShuffled.value = false;
					repeatMode.value = "all";
					break;
				case "single":
					isShuffled.value = false;
					repeatMode.value = "one";
					break;
				case "random":
					isShuffled.value = true;
					repeatMode.value = "all";
					break;
			}
		},
		{ immediate: true },
	);

	const toggleShuffle = () => {
		isShuffled.value = !isShuffled.value;
	};

	const toggleRepeat = () => {
		const modes: RepeatMode[] = ["none", "all", "one"];
		const nextMode = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length];
		repeatMode.value = nextMode;
	};

	const cyclePlaybackMode = () => {
		const modes: PlaybackMode[] = ["loop", "single", "random"];
		const currentIndex = modes.indexOf(playbackMode.value);
		playbackMode.value = modes[(currentIndex + 1) % modes.length];
	};

	const setQueueFromCurrentItems = (items: TimelineItem[]) => {
		if (!options.createPodcastSong) return;
		const podcastSongs: Song[] = items
			.filter(
				(item) =>
					(item.type === "feed_item" || item.type === "project_update") &&
					isPlayableFeedPodcast(item.feed_item),
			)
			.map((item) => options.createPodcastSong!(item.feed_item))
			.filter((song): song is Song => Boolean(song));
		queue.value = podcastSongs;
	};

	const setQueueFromPodcastEpisodes = (episodes: PodcastEpisode[]) => {
		if (!options.createPodcastEpisodeSong) return;
		queue.value = episodes.map(options.createPodcastEpisodeSong);
	};

	const resetForSession = () => {
		queue.value = [];
		shuffledQueue.value = [];
		currentAlbum.value = null;
	};

	return {
		queue,
		shuffledQueue,
		currentAlbum,
		isShuffled,
		repeatMode,
		playbackMode,
		activeQueue,
		getActiveList,
		recomputeShuffledQueue,
		toggleShuffle,
		toggleRepeat,
		cyclePlaybackMode,
		setQueueFromCurrentItems,
		setQueueFromPodcastEpisodes,
		resetForSession,
	};
}
