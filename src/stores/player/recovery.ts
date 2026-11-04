import type { Song } from "@/types";
import { playbackItemKey } from "@/utils/playerState";
import { isMusicSong } from "./progress";

export interface CreatePlayerAudioRecoveryOptions {
	getCurrentSong: () => Song | null;
	getActiveList: () => Song[];
	getPlayGeneration: () => number;
	getAudio: () => HTMLAudioElement | null;
	setPlaybackError: (err: string) => void;
	setAudioRecoveryNotice: (notice: string) => void;
	reloadCurrentAudio: (forceReload: boolean) => void;
	startSong: (song: Song, startAt?: number, persistPrevious?: boolean, fromRecovery?: boolean) => void;
}

export function createPlayerAudioRecovery(options: CreatePlayerAudioRecoveryOptions) {
	let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
	const recoveryRetried = new Set<string>();
	const recoveryFailed = new Set<string>();

	const clearRecoveryTimer = () => {
		if (recoveryTimer !== null) clearTimeout(recoveryTimer);
		recoveryTimer = null;
	};

	const resetAudioRecovery = () => {
		clearRecoveryTimer();
		recoveryRetried.clear();
		recoveryFailed.clear();
		options.setAudioRecoveryNotice("");
	};

	const hasRecoveryTimer = () => recoveryTimer !== null;

	const recoverFromMediaError = (player: HTMLAudioElement): boolean => {
		const failed = options.getCurrentSong();
		const list = options.getActiveList();
		if (!failed || !isMusicSong(failed) || list.length < 2) return false;
		if (recoveryTimer !== null) return true;

		const failedKey = playbackItemKey(failed);
		const generation = options.getPlayGeneration();
		const schedule = (callback: () => void, delay: number) => {
			recoveryTimer = setTimeout(() => {
				recoveryTimer = null;
				if (
					generation !== options.getPlayGeneration() ||
					options.getAudio() !== player ||
					!options.getCurrentSong() ||
					playbackItemKey(options.getCurrentSong()!) !== failedKey
				)
					return;
				callback();
			}, delay);
		};

		if (!recoveryRetried.has(failedKey)) {
			recoveryRetried.add(failedKey);
			options.setPlaybackError("");
			options.setAudioRecoveryNotice("音源加载失败，正在自动重试一次…");
			schedule(() => options.reloadCurrentAudio(true), 450);
			return true;
		}

		recoveryFailed.add(failedKey);
		const index = list.findIndex((item) => playbackItemKey(item) === failedKey);
		const next = Array.from({ length: list.length - 1 }, (_, step) =>
			list[(Math.max(0, index) + step + 1) % list.length],
		).find(
			(item) =>
				item && isMusicSong(item) && !recoveryFailed.has(playbackItemKey(item)),
		);

		if (!next) {
			options.setAudioRecoveryNotice("");
			options.setPlaybackError("队列音源均无法播放，请检查网络后手动重试");
			return true;
		}
		options.setPlaybackError("");
		options.setAudioRecoveryNotice("已跳过无法加载的歌曲：" + failed.title);
		schedule(() => options.startSong(next, undefined, false, true), 180);
		return true;
	};

	return {
		recoverFromMediaError,
		resetAudioRecovery,
		hasRecoveryTimer,
		clearRecoveryTimer,
	};
}
