import { ref } from "vue";
import type { Song } from "@/types";
import {
	cacheMediaForOffline,
	isMediaCached,
	isMediaCachedSync,
	removeCachedMedia,
} from "@/utils/mediaOfflineCache";

export interface PlayerOfflineOptions {
	getCurrentSong: () => Song | null;
	getPlayGeneration: () => number;
	releaseCachedAudioObjectUrl: () => void;
}

export function createPlayerOfflineState(options: PlayerOfflineOptions) {
	const isCurrentAudioCached = ref(false);
	const isAudioCaching = ref(false);
	const audioCacheError = ref("");

	function syncCachedStatus(audioUrl: string | undefined) {
		isCurrentAudioCached.value = audioUrl ? isMediaCachedSync(audioUrl) : false;
		return isCurrentAudioCached.value;
	}

	async function checkAudioCache(
		song: Song | null = options.getCurrentSong(),
		generation?: number,
	): Promise<boolean> {
		if (!song || !song.audio_url) {
			isCurrentAudioCached.value = false;
			return false;
		}
		const url = song.audio_url;
		const cached = await isMediaCached(url);
		if (generation !== undefined && generation !== options.getPlayGeneration()) return cached;
		isCurrentAudioCached.value = cached;
		return cached;
	}

	async function cacheCurrentAudio(): Promise<boolean> {
		const song = options.getCurrentSong();
		if (!song || !song.audio_url || isAudioCaching.value) return false;
		isAudioCaching.value = true;
		audioCacheError.value = "";
		try {
			const success = await cacheMediaForOffline(song.audio_url);
			if (success) {
				isCurrentAudioCached.value = true;
				return true;
			} else {
				audioCacheError.value = "当前音源无法保存离线副本";
				return false;
			}
		} catch (error) {
			audioCacheError.value =
				error instanceof Error ? error.message : "离线保存失败";
			return false;
		} finally {
			isAudioCaching.value = false;
		}
	}

	async function removeCurrentAudio(): Promise<boolean> {
		const song = options.getCurrentSong();
		if (!song || !song.audio_url) return false;
		await removeCachedMedia(song.audio_url);
		isCurrentAudioCached.value = false;
		options.releaseCachedAudioObjectUrl();
		return true;
	}

	function resetForSession() {
		isCurrentAudioCached.value = false;
		isAudioCaching.value = false;
		audioCacheError.value = "";
	}

	function checkCurrentSongAudioCached(generation?: number) {
		return checkAudioCache(options.getCurrentSong(), generation);
	}

	return {
		isCurrentAudioCached,
		isAudioCaching,
		audioCacheError,
		syncCachedStatus,
		checkAudioCache,
		checkCurrentSongAudioCached,
		cacheCurrentAudio,
		removeCurrentAudio,
		resetForSession,
	};
}
