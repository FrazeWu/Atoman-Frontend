import { createPinia, getActivePinia, setActivePinia } from "pinia";
import { clearSessionStores } from "@/stores/sessionReset";
import { nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { usePlayerStore, computeActualVolume, fadeOutAudio } from "../../../src/stores/player";
import { useAuthStore } from "../../../src/stores/auth";
import { writePodcastProgress } from "../../../src/composables/usePodcastProgress";
import type { Song } from "../../../src/types";
import { startMobileMusicQueue } from "../../../apps/mobile/mobileMusicPlayback";

const mocks = vi.hoisted(() => ({
	getMusicSongDetail: vi.fn(),
	recordMusicSongPlay: vi.fn(),
	recordMusicRecommendationEvents: vi.fn(),
	getMusicPlaybackProgress: vi.fn(),
	getMusicPlaybackSession: vi.fn(),
	saveMusicPlaybackProgress: vi.fn(),
	saveMusicPlaybackSession: vi.fn(),
}));

vi.mock("@/api/musicV1", () => ({
	getMusicSongDetail: mocks.getMusicSongDetail,
	recordMusicSongPlay: mocks.recordMusicSongPlay,
	recordMusicRecommendationEvents: mocks.recordMusicRecommendationEvents,
	getMusicPlaybackProgress: mocks.getMusicPlaybackProgress,
	getMusicPlaybackSession: mocks.getMusicPlaybackSession,
	saveMusicPlaybackProgress: mocks.saveMusicPlaybackProgress,
	saveMusicPlaybackSession: mocks.saveMusicPlaybackSession,
}));

// Mock Audio
const audioInstances: MockAudio[] = [];
let audioPlayImplementation: () => Promise<void> = () => Promise.resolve();

class MockAudio {
	currentTime = 0;
	duration = 100;
	volume = 1;
	src = "";
	preload = "";
	paused = true;
	private readonly listeners = new Map<string, EventListener[]>();
	play = vi.fn(() => audioPlayImplementation());
	load = vi.fn();
	pause = vi.fn();
	removeAttribute = vi.fn((name: string) => {
		if (name === "src") this.src = "";
	});
	addEventListener = vi.fn((type: string, listener: EventListener) => {
		const listeners = this.listeners.get(type) ?? [];
		listeners.push(listener);
		this.listeners.set(type, listeners);
	});

	emit(type: string) {
		for (const listener of this.listeners.get(type) ?? []) {
			listener(new Event(type));
		}
	}

	constructor() {
		audioInstances.push(this);
	}
}

global.Audio = MockAudio as any;

function readPersistedPlaybackState(): Record<string, any> {
	const raw = localStorage.getItem("playbackState");
	if (!raw) return {};
	try {
		return JSON.parse(raw) as Record<string, any>;
	} catch {
		return {};
	}
}

describe("player store", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.restoreAllMocks();
		audioInstances.length = 0;
		audioPlayImplementation = () => Promise.resolve();
		mocks.getMusicSongDetail.mockReset();
		mocks.recordMusicSongPlay.mockReset();
		mocks.recordMusicSongPlay.mockResolvedValue({ recorded: true });
		mocks.recordMusicRecommendationEvents.mockReset();
		mocks.recordMusicRecommendationEvents.mockResolvedValue(undefined);
		mocks.getMusicPlaybackProgress.mockReset();
		mocks.getMusicPlaybackProgress.mockResolvedValue(null);
		mocks.getMusicPlaybackSession.mockReset();
		mocks.getMusicPlaybackSession.mockResolvedValue(null);
		mocks.saveMusicPlaybackProgress.mockReset();
		mocks.saveMusicPlaybackProgress.mockResolvedValue({});
		mocks.saveMusicPlaybackSession.mockReset();
		mocks.saveMusicPlaybackSession.mockResolvedValue({});
		useAuthStore().isAuthenticated = true;
		// localStorage.clear()
	});

	it("plays summary songs immediately and hydrates lyrics and waveform in the current song and queue", async () => {
		let resolveDetail!: (detail: unknown) => void;
		mocks.getMusicSongDetail.mockReturnValue(new Promise(resolve => { resolveDetail = resolve; }));
		const player = usePlayerStore();
		const song = { id: "summary-song", title: "Summary Song", audio_url: "summary.mp3", lyrics: "", summary_only: true } as Song & { summary_only: boolean };
		player.playSong(song);

		expect(audioInstances[0].src).toContain("summary.mp3");
		expect(audioInstances[0].play).toHaveBeenCalledOnce();
		expect(player.currentSong?.lyrics).toBe("");
		expect(mocks.getMusicSongDetail).toHaveBeenCalledWith("summary-song");

		resolveDetail({ song: { ...song, lyrics: "[00:01]完整歌词", waveform_peaks: [0.2, 0.8], summary_only: false }, artists: [], playable: true });
		await flushPromises();

		expect(player.currentSong?.lyrics).toBe("[00:01]完整歌词");
		expect(player.currentSong?.waveform_peaks).toEqual([0.2, 0.8]);
		expect(player.queue[0].lyrics).toBe("[00:01]完整歌词");
		expect(player.queue[0].waveform_peaks).toEqual([0.2, 0.8]);
		expect(audioInstances[0].play).toHaveBeenCalledOnce();
	});

	it("ignores summary song details from an old playback after quickly switching tracks", async () => {
		let resolveFirst!: (detail: unknown) => void;
		let resolveSecond!: (detail: unknown) => void;
		mocks.getMusicSongDetail
			.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }))
			.mockReturnValueOnce(new Promise(resolve => { resolveSecond = resolve; }));
		const player = usePlayerStore();
		const first = { id: "summary-first", title: "First", audio_url: "first.mp3", lyrics: "", summary_only: true } as Song & { summary_only: boolean };
		const second = { id: "summary-second", title: "Second", audio_url: "second.mp3", lyrics: "", summary_only: true } as Song & { summary_only: boolean };
		player.playAlbum([first, second]);
		player.playNext();
		expect(mocks.getMusicSongDetail).toHaveBeenCalledTimes(2);

		resolveSecond({ song: { ...second, lyrics: "第二首歌词", waveform_peaks: [0.7] }, artists: [], playable: true });
		await flushPromises();
		expect(player.currentSong?.id).toBe("summary-second");
		expect(player.currentSong?.lyrics).toBe("第二首歌词");

		resolveFirst({ song: { ...first, lyrics: "迟到的第一首歌词", waveform_peaks: [0.1] }, artists: [], playable: true });
		await flushPromises();
		expect(player.currentSong?.id).toBe("summary-second");
		expect(player.currentSong?.lyrics).toBe("第二首歌词");
		expect(player.currentSong?.waveform_peaks).toEqual([0.7]);
		expect(player.queue[1].lyrics).toBe("第二首歌词");
		expect(player.queue[0].lyrics).toBe("");
	});

	it("does not request song details when playing an already complete song", async () => {
		const player = usePlayerStore();
		player.playSong({ id: "complete-song", title: "Complete", audio_url: "complete.mp3", lyrics: "完整歌词", waveform_peaks: [0.2, 0.6], summary_only: false } as Song & { summary_only: boolean });
		await flushPromises();

		expect(player.currentSong?.lyrics).toBe("完整歌词");
		expect(mocks.getMusicSongDetail).not.toHaveBeenCalled();
	});

	it("records one play only after five seconds of active playback", async () => {
		vi.useFakeTimers();
		const player = usePlayerStore();
		const song = {
			id: "song-5s",
			title: "Five Seconds",
			audio_url: "five.mp3",
		} as any;

		player.playSong(song);
		await audioInstances[0].play.mock.results[0]?.value;
		await vi.advanceTimersByTimeAsync(4999);
		expect(mocks.recordMusicSongPlay).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(mocks.recordMusicSongPlay).toHaveBeenCalledTimes(1);
		expect(mocks.recordMusicSongPlay).toHaveBeenCalledWith("song-5s", undefined, expect.any(String));
		const firstEvent = mocks.recordMusicSongPlay.mock.calls[0][2];
		expect(firstEvent).toMatch(/^[0-9a-f-]{36}$/i);

		await vi.advanceTimersByTimeAsync(5000);
		expect(mocks.recordMusicSongPlay).toHaveBeenCalledTimes(1);
		player.playSong({ id: "next-song", title: "Next", audio_url: "next.mp3" } as Song);
		await vi.advanceTimersByTimeAsync(5000);
		expect(mocks.recordMusicSongPlay).toHaveBeenCalledTimes(2);
		expect(mocks.recordMusicSongPlay.mock.calls[1][2]).not.toBe(firstEvent);
		vi.useRealTimers();
	});

	it("attributes valid plays to their source playlist", async () => {
		vi.useFakeTimers();
		const player = usePlayerStore();
		player.playAlbum([
			{ id: "playlist-song", title: "Playlist Song", audio_url: "playlist.mp3", playlist_id: "playlist-1" } as Song,
		]);
		await audioInstances[0].play.mock.results[0]?.value;
		await vi.advanceTimersByTimeAsync(5000);

		expect(mocks.recordMusicSongPlay).toHaveBeenCalledWith("playlist-song", "playlist-1", expect.any(String));
		vi.useRealTimers();
	});

	it("records recommendation playback lifecycle for attributed songs", async () => {
		vi.useFakeTimers();
		const player = usePlayerStore();
		const song = {
			id: "recommended-song",
			title: "Recommended Song",
			audio_url: "recommended.mp3",
			recommendation_context: {
				request_id: "00000000-0000-0000-0000-000000000001",
				surface: "music_home",
				position: 2,
				reason: "结合你的音乐记录",
			},
		} as any;

		player.playSong(song);
		await audioInstances[0].play.mock.results[0]?.value;
		await vi.advanceTimersByTimeAsync(5000);
		expect(mocks.recordMusicRecommendationEvents).toHaveBeenCalledWith(
			expect.objectContaining({
				request_id: song.recommendation_context.request_id,
				events: [
					expect.objectContaining({
						event: "play_start",
						entity_id: "recommended-song",
					}),
				],
			}),
		);

		audioInstances[0].emit("ended");
		expect(mocks.recordMusicRecommendationEvents).toHaveBeenCalledWith(
			expect.objectContaining({
				events: [
					expect.objectContaining({
						event: "play_complete",
						entity_id: "recommended-song",
					}),
				],
			}),
		);

		player.playNext();
		expect(mocks.recordMusicRecommendationEvents).toHaveBeenCalledWith(
			expect.objectContaining({
				events: [
					expect.objectContaining({ event: "skip", entity_id: "recommended-song" }),
				],
			}),
		);
		vi.useRealTimers();
	});

	it("reports guest plays so the backend can count them without writing history", async () => {
		vi.useFakeTimers();
		useAuthStore().isAuthenticated = false;
		const player = usePlayerStore();
		const song = {
			id: "guest-song",
			title: "Guest Song",
			audio_url: "guest.mp3",
		} as any;

		player.playSong(song);
		await audioInstances[0].play.mock.results[0]?.value;
		await vi.advanceTimersByTimeAsync(5000);

		expect(mocks.recordMusicSongPlay).toHaveBeenCalledTimes(1);
		expect(mocks.recordMusicSongPlay).toHaveBeenCalledWith("guest-song", undefined, expect.any(String));
		vi.useRealTimers();
	});

	it("uses the CORS-enabled cache version for production R2 audio", async () => {
		const player = usePlayerStore();
		player.playSong({
			id: "r2-song",
			title: "R2 Song",
			audio_url: "https://assets.atoman.org/music/audio/r2-song.mp3",
		} as any);

		expect(player.currentSong?.audio_url).toBe(
			"https://assets.atoman.org/music/audio/r2-song.mp3?cors=1",
		);
		expect(audioInstances[0]?.src).toBe(
			"https://assets.atoman.org/music/audio/r2-song.mp3?cors=1",
		);
	});

	it("prefetches the first audio chunk for every queued song after the current song can play", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(new Uint8Array(512 * 1024), { status: 206 }),
			);
		vi.stubGlobal("fetch", fetchMock);
		const player = usePlayerStore();
		const firstSong = {
			id: "first",
			title: "First",
			audio_url: "first.mp3",
		} as any;
		const secondSong = {
			id: "second",
			title: "Second",
			audio_url: "second.mp3",
		} as any;
		const thirdSong = {
			id: "third",
			title: "Third",
			audio_url: "third.mp3",
		} as any;

		player.playAlbum([firstSong, secondSong, thirdSong]);
		expect(fetchMock).not.toHaveBeenCalled();

		audioInstances[0].emit("canplay");
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(fetchMock).toHaveBeenCalledWith(
			"second.mp3",
			expect.objectContaining({
				cache: "force-cache",
				headers: { Range: "bytes=0-524287" },
				signal: expect.any(AbortSignal),
			}),
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"third.mp3",
			expect.objectContaining({
				cache: "force-cache",
				headers: { Range: "bytes=0-524287" },
				signal: expect.any(AbortSignal),
			}),
		);

		audioInstances[0].emit("canplay");
		await Promise.resolve();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("keeps queued prefetch requests alive when switching within the queue", async () => {
		const pendingResponses: Array<(response: Response) => void> = [];
		const fetchMock = vi.fn(
			(_url: string, _options: RequestInit) =>
				new Promise<Response>((resolve) => {
					pendingResponses.push(resolve);
				}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const player = usePlayerStore();
		const firstSong = {
			id: "first",
			title: "First",
			audio_url: "first.mp3",
		} as any;
		const secondSong = {
			id: "second",
			title: "Second",
			audio_url: "second.mp3",
		} as any;
		const thirdSong = {
			id: "third",
			title: "Third",
			audio_url: "third.mp3",
		} as any;

		player.playAlbum([firstSong, secondSong, thirdSong]);
		audioInstances[0].emit("canplay");
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		const signals = fetchMock.mock.calls.map(
			([, options]) => (options as RequestInit).signal as AbortSignal,
		);

		player.playQueuedSong(secondSong);

		expect(signals.every((signal) => !signal.aborted)).toBe(true);
		pendingResponses.forEach((resolve) => {
			resolve(new Response(new Uint8Array(512 * 1024), { status: 206 }));
		});
	});

	it("records a restored song after five seconds of resumed playback", async () => {
		vi.useFakeTimers();
		localStorage.setItem(
			"playbackState",
			JSON.stringify({
				song: {
					id: "restored-song",
					title: "Restored",
					audio_url: "restored.mp3",
				},
				currentTime: 12,
			}),
		);
		const player = usePlayerStore();

		player.togglePlay();
		await audioInstances[0].play.mock.results[0]?.value;
		await vi.advanceTimersByTimeAsync(5000);

		expect(mocks.recordMusicSongPlay).toHaveBeenCalledWith("restored-song", undefined, expect.any(String));
		vi.useRealTimers();
	});

	it("does not restore persisted songs without an audio source", () => {
		localStorage.clear();
		localStorage.setItem(
			"playbackState",
			JSON.stringify({
				song: { id: "missing-source", title: "Missing source", audio_url: "" },
				queue: [{ id: "missing-source", title: "Missing source", audio_url: "" }],
			}),
		);

		const player = usePlayerStore();

		expect(player.currentSong).toBeNull();
		expect(player.queue).toEqual([]);
	});

	it("rejects playback when a song has no audio source", () => {
		const player = usePlayerStore();

		player.playSong({ id: "missing-source", title: "Missing source", audio_url: "" } as any);

		expect(player.currentSong).toBeNull();
		expect(player.isLoading).toBe(false);
		expect(player.playbackError).toBe("当前曲目没有可用音频源");
		expect(audioInstances).toHaveLength(0);
	});

	it("toggles lyrics", () => {
		const player = usePlayerStore();
		expect(player.showLyrics).toBe(false);
		player.toggleLyrics();
		expect(player.showLyrics).toBe(true);
		player.toggleLyrics();
		expect(player.showLyrics).toBe(false);
	});

	it("requests lyrics closure without bypassing the panel confirmation", () => {
		const player = usePlayerStore();
		player.showLyrics = true;

		player.requestLyricsClose();

		expect(player.showLyrics).toBe(true);
		expect(player.lyricsCloseRequest).toBe(1);
	});

	it("keeps lyrics and queue open independently", () => {
		const player = usePlayerStore();

		player.toggleLyrics();
		player.toggleQueue();

		expect(player.showLyrics).toBe(true);
		expect(player.showQueue).toBe(true);
	});

	it("persists the player pin preference independently from playback", async () => {
		const player = usePlayerStore();
		expect(player.isPinned).toBe(true);

		player.togglePinned();
		await nextTick();
		expect(localStorage.getItem("playerPinned")).toBe("false");

		setActivePinia(createPinia());
		const restoredPlayer = usePlayerStore();
		expect(restoredPlayer.isPinned).toBe(false);
	});

	it("skips forward and backward", () => {
		const player = usePlayerStore();

		// Setup a fake current song and audio to enable skip
		const mockSong = { id: 1, title: "Test", audio_url: "test.mp3" } as any;
		player.playSong(mockSong);

		player.duration = 100;
		player.seek(50);

		player.skip(5);
		expect(player.currentTime).toBe(55);

		player.skip(-10);
		expect(player.currentTime).toBe(45);

		// Test boundaries
		player.skip(100);
		expect(player.currentTime).toBe(100);

		player.skip(-200);
		expect(player.currentTime).toBe(0);
	});

	it("supports five-second skips before audio metadata is available", () => {
		const player = usePlayerStore();
		player.playSong({
			id: "metadata-pending",
			title: "Metadata Pending",
			audio_url: "metadata-pending.mp3",
		} as any);
		audioInstances[0].duration = 0;
		player.duration = 0;

		player.skip(5);

		expect(player.currentTime).toBe(5);
		expect(audioInstances[0].currentTime).toBe(5);
	});
	it("keeps next and previous on the selected single song after an old queue exists", () => {
		const player = usePlayerStore();
		const firstQueuedSong = {
			id: 1,
			title: "Queued 1",
			audio_url: "queued-1.mp3",
		} as any;
		const secondQueuedSong = {
			id: 2,
			title: "Queued 2",
			audio_url: "queued-2.mp3",
		} as any;
		const singleSong = {
			id: 3,
			title: "Single",
			audio_url: "single.mp3",
		} as any;

		player.playAlbum([firstQueuedSong, secondQueuedSong]);
		player.playSong(singleSong);

		expect(player.queue.map((song: Song) => song.id)).toEqual([3]);

		player.playNext();
		expect(player.currentSong?.id).toBe(3);

		player.playPrevious();
		expect(player.currentSong?.id).toBe(3);
	});

	it("automatically advances through a complete mobile queue after audio ends", () => {
    const player = usePlayerStore();
    const tracks = [
      { id: "missing", title: "Missing", audio_url: "" },
      ...Array.from({ length: 26 }, (_, index) => ({
        id: "mobile-" + (index + 1),
        title: "Track " + (index + 1),
        audio_url: "/audio/mobile-" + (index + 1) + ".mp3",
        audio_status: "ready",
      })),
      { id: "processing", title: "Processing", audio_url: "/processing.mp3", audio_status: "processing" },
    ] as Song[];

    expect(startMobileMusicQueue(player, tracks)).toBe(true);
    expect(player.currentSong?.id).toBe("mobile-1");
    expect(player.queue).toHaveLength(26);
    audioInstances[0].emit("ended");
    expect(player.currentSong?.id).toBe("mobile-2");
    player.playNext();
    expect(player.currentSong?.id).toBe("mobile-3");
    player.playPrevious();
    expect(player.currentSong?.id).toBe("mobile-2");
    expect(player.queue).toHaveLength(26);
  });

  it("advances to next song in an album queue with uuid ids", () => {
		const player = usePlayerStore();
		const firstSong = {
			id: "song-uuid-1",
			title: "UUID 1",
			audio_url: "uuid-1.wav",
		} as any;
		const secondSong = {
			id: "song-uuid-2",
			title: "UUID 2",
			audio_url: "uuid-2.wav",
		} as any;

		player.playAlbum([firstSong, secondSong]);
		player.playNext();

		expect(player.currentSong?.id).toBe("song-uuid-2");
	});

	it("does not overwrite a completed song when advancing automatically", () => {
		const player = usePlayerStore();
		const firstSong = {
			id: "ended-1",
			title: "Ended 1",
			audio_url: "ended-1.mp3",
		} as any;
		const secondSong = {
			id: "ended-2",
			title: "Ended 2",
			audio_url: "ended-2.mp3",
		} as any;

		player.playAlbum([firstSong, secondSong]);
		audioInstances[0].emit("ended");

		const firstSongProgress = mocks.saveMusicPlaybackProgress.mock.calls
			.filter(([payload]) => payload.song_id === "ended-1")
			.map(([payload]) => payload.completed);
		expect(firstSongProgress).toEqual([true]);
		expect(player.currentSong?.id).toBe("ended-2");
	});

	it("keeps music and podcast items with the same raw id distinct", () => {
		const player = usePlayerStore();
		const musicSong = {
			id: 101,
			source_type: "music",
			title: "Song",
			audio_url: "song.mp3",
		} as any;
		const podcastSong = {
			id: 101,
			source_type: "feed_podcast",
			source_id: "101",
			title: "Episode",
			audio_url: "episode.mp3",
		} as any;

		player.playSong(musicSong);
		player.addToQueue(podcastSong);

		expect(player.queue).toHaveLength(2);
		player.playQueuedSong(podcastSong);
		expect(player.currentSong?.title).toBe("Episode");

		player.removeFromQueue(musicSong);
		expect(player.queue.map((item: Song) => item.title)).toEqual(["Episode"]);
	});

	it("normalizes invalid album start indexes and missing queue positions", () => {
		const player = usePlayerStore();
		const firstSong = {
			id: "first",
			title: "First",
			audio_url: "first.mp3",
		} as any;
		const secondSong = {
			id: "second",
			title: "Second",
			audio_url: "second.mp3",
		} as any;

		player.playAlbum([firstSong, secondSong], 99);
		expect(player.currentSong?.id).toBe("first");

		player.currentSong = {
			id: "restored",
			title: "Restored",
			audio_url: "restored.mp3",
		} as any;
		player.playPrevious();
		expect(player.currentSong?.id).toBe("first");
	});

	it("plays a queued feed song without shrinking the current queue", () => {
		const player = usePlayerStore();
		const firstFeedItem = {
			id: "101",
			title: "Episode 1",
			author: "Host",
			published_at: "2025-01-01T00:00:00Z",
			summary: "First episode",
			enclosure_url: "episode-1.mp3",
			enclosure_type: "audio/mpeg",
		};
		const secondFeedItem = {
			id: "102",
			title: "Episode 2",
			author: "Host",
			published_at: "2025-01-02T00:00:00Z",
			summary: "Second episode",
			enclosure_url: "episode-2.mp3",
			enclosure_type: "audio/mpeg",
		};

		player.setQueueFromCurrentItems([
			{ type: "feed_item", feed_item: firstFeedItem },
			{ type: "feed_item", feed_item: secondFeedItem },
		] as any);
		const firstSong = player.createPodcastSong(firstFeedItem as any);
		expect(firstSong).not.toBeNull();
		expect(firstSong?.media_kind).toBe("feed_item");

		player.playQueuedSong(firstSong!);

		expect(player.currentSong?.id).toBe(101);
		expect(player.queue.map((song: Song) => song.id)).toEqual([101, 102]);

		player.playNext();
		expect(player.currentSong?.id).toBe(102);
	});

	it("rejects non-audio feed attachments from the podcast queue", () => {
		const player = usePlayerStore();
		const articleAttachment = {
			id: "image-attachment-1",
			title: "Article image",
			published_at: "2025-01-01T00:00:00Z",
			enclosure_url: "https://cdn.example.com/cover.jpg",
			enclosure_type: "image/jpeg",
		};

		player.setQueueFromCurrentItems([
			{ type: "feed_item", feed_item: articleAttachment },
		] as any);

		expect(player.createPodcastSong(articleAttachment as any)).toBeNull();
		expect(player.queue).toEqual([]);
	});

	it("preserves UUID feed item ids for podcast songs", () => {
		const player = usePlayerStore();
		const song = player.createPodcastSong({
			id: "019f5eb9-285b-7a06-ba5f-034975eab083",
			title: "UUID episode",
			enclosure_url: "episode.mp3",
			enclosure_type: "audio/mpeg",
		} as any);

		expect(song?.id).toBe("019f5eb9-285b-7a06-ba5f-034975eab083");
		expect(song?.source_id).toBe("019f5eb9-285b-7a06-ba5f-034975eab083");
	});

	it("keeps album queue when selecting another song from the same queue", () => {
		const player = usePlayerStore();
		const firstSong = {
			id: "song-uuid-1",
			title: "UUID 1",
			audio_url: "uuid-1.wav",
		} as any;
		const secondSong = {
			id: "song-uuid-2",
			title: "UUID 2",
			audio_url: "uuid-2.wav",
		} as any;
		const thirdSong = {
			id: "song-uuid-3",
			title: "UUID 3",
			audio_url: "uuid-3.wav",
		} as any;

		player.playAlbum([firstSong, secondSong, thirdSong]);
		player.playQueuedSong(secondSong);

		expect(player.queue.map((song: Song) => song.id)).toEqual([
			"song-uuid-1",
			"song-uuid-2",
			"song-uuid-3",
		]);

		player.playNext();
		expect(player.currentSong?.id).toBe("song-uuid-3");

		player.playPrevious();
		expect(player.currentSong?.id).toBe("song-uuid-2");
	});

	it("keeps current song title populated while moving through album queue", () => {
		const player = usePlayerStore();
		const firstSong = {
			id: "song-uuid-1",
			title: "UUID 1",
			audio_url: "uuid-1.wav",
		} as any;
		const secondSong = {
			id: "song-uuid-2",
			title: "UUID 2",
			audio_url: "uuid-2.wav",
		} as any;

		player.playAlbum([firstSong, secondSong]);
		expect(player.currentSong?.title).toBe("UUID 1");

		player.playNext();
		expect(player.currentSong?.title).toBe("UUID 2");

		player.playPrevious();
		expect(player.currentSong?.title).toBe("UUID 1");
	});

	it("does not randomly replay the current song when other queued songs exist", () => {
		const player = usePlayerStore();
		const firstSong = {
			id: "song-uuid-1",
			title: "UUID 1",
			audio_url: "uuid-1.wav",
		} as any;
		const secondSong = {
			id: "song-uuid-2",
			title: "UUID 2",
			audio_url: "uuid-2.wav",
		} as any;
		const thirdSong = {
			id: "song-uuid-3",
			title: "UUID 3",
			audio_url: "uuid-3.wav",
		} as any;

		player.playAlbum([firstSong, secondSong, thirdSong]);
		player.playbackMode = "random";

		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
		player.playNext();
		randomSpy.mockRestore();

		expect(player.currentSong?.id).not.toBe("song-uuid-1");
		expect(["song-uuid-2", "song-uuid-3"]).toContain(player.currentSong?.id);
	});

	it("persists playback without playing intent and restores paused", async () => {
		const player = usePlayerStore();
		const song = {
			id: 1,
			title: "Persisted",
			audio_url: "persisted.mp3",
		} as any;

		player.playSong(song);
		await nextTick();

		const savedState = readPersistedPlaybackState();
		expect(savedState).not.toHaveProperty("isPlaying");

		setActivePinia(createPinia());
		const restoredPlayer = usePlayerStore();

		expect(restoredPlayer.currentSong?.id).toBe(1);
		expect(restoredPlayer.isPlaying).toBe(false);
	});

	it("persists and restores the active queue", async () => {
		localStorage.clear();
		const player = usePlayerStore();
		const firstSong = {
			id: "song-1",
			title: "Song 1",
			audio_url: "song-1.mp3",
		} as any;
		const secondSong = {
			id: "song-2",
			title: "Song 2",
			audio_url: "song-2.mp3",
		} as any;

		player.playAlbum([firstSong, secondSong], 1);
		await nextTick();

		const savedState = readPersistedPlaybackState();
		expect(savedState.queue.map((song: any) => song.id)).toEqual([
			"song-1",
			"song-2",
		]);

		setActivePinia(createPinia());
		const restoredPlayer = usePlayerStore();

		expect(restoredPlayer.currentSong?.id).toBe("song-2");
		expect(restoredPlayer.queue.map((song: Song) => song.id)).toEqual([
			"song-1",
			"song-2",
		]);

		restoredPlayer.playPrevious();
		expect(restoredPlayer.currentSong?.id).toBe("song-1");
	});

	it("clears old playback state and restores the new account session", async () => {
		localStorage.clear();
		const auth = useAuthStore();
		const player = usePlayerStore();
		auth.user = {
			uuid: "user-a",
			username: "user-a",
			email: "a@example.com",
		} as any;
		await nextTick();

		player.playSong({
			id: "old-account-song",
			title: "Old Account Song",
			audio_url: "old-account.mp3",
		} as any);
		await nextTick();
		expect(player.currentSong?.id).toBe("old-account-song");
		expect(localStorage.getItem("playbackState")).not.toBeNull();

		const pinia = getActivePinia();
		if (!pinia) throw new Error("missing active pinia");
		clearSessionStores(pinia);
		expect(player.currentSong).toBeNull();
		expect(player.queue).toEqual([]);
		expect(audioInstances[0].pause).toHaveBeenCalled();
		expect(audioInstances[0].removeAttribute).toHaveBeenCalledWith("src");
		expect(localStorage.getItem("playbackState")).toBeNull();

		mocks.getMusicPlaybackSession.mockResolvedValueOnce({
			queue: [
				{
					id: "new-account-song",
					title: "New Account Song",
					audio_url: "new-account.mp3",
				},
			],
			current_song_id: "new-account-song",
			position_seconds: 8,
			playback_mode: "loop",
		});
		auth.user = {
			uuid: "user-b",
			username: "user-b",
			email: "b@example.com",
		} as any;
		await vi.waitFor(() =>
			expect(player.currentSong?.id).toBe("new-account-song"),
		);
	});
	it("ignores a stale play rejection after switching songs", async () => {
		let rejectFirst!: (reason?: unknown) => void;
		let resolveSecond!: () => void;
		let call = 0;
		audioPlayImplementation = () =>
			new Promise<void>((resolve, reject) => {
				call += 1;
				if (call === 1) rejectFirst = reject;
				else resolveSecond = resolve;
			});
		const player = usePlayerStore();

		player.playSong({
			id: "first",
			title: "First",
			audio_url: "first.mp3",
		} as any);
		player.playSong({
			id: "second",
			title: "Second",
			audio_url: "second.mp3",
		} as any);
		resolveSecond();
		await Promise.resolve();
		expect(player.currentSong?.id).toBe("second");
		expect(player.isPlaying).toBe(true);

		try {
			rejectFirst(new DOMException("aborted", "AbortError"));
		} catch (error) {
			throw new Error(
				`Rejecting the deferred play promise threw: ${String(error)}`,
			);
		}
		await Promise.resolve();
		expect(player.currentSong?.id).toBe("second");
		expect(player.isPlaying).toBe(true);
	});

	it("writes saved podcast progress to the audio element before playback", () => {
		writePodcastProgress({
			episode_id: "episode-1",
			position_sec: 37,
			duration_sec: 120,
			completed: false,
			last_played_at: "",
		});
		const player = usePlayerStore();

		player.playSong({
			id: "episode-1",
			source_id: "episode-1",
			source_type: "podcast_episode",
			title: "Episode",
			audio_url: "episode.mp3",
		} as any);

		expect(player.currentTime).toBe(37);
		expect(audioInstances[0].currentTime).toBe(37);
	});

	it("omits lyrics and waveform data from persisted queue items", async () => {
		const player = usePlayerStore();
		player.playSong({
			id: "compact",
			title: "Compact",
			audio_url: "compact.mp3",
			lyrics: "large lyrics",
			waveform_peaks: [1, 2, 3],
		} as any);
		await nextTick();

		const saved = readPersistedPlaybackState();
		expect(saved.song).not.toHaveProperty("lyrics");
		expect(saved.song).not.toHaveProperty("waveform_peaks");
		expect(saved.queue[0]).not.toHaveProperty("lyrics");
	});

	it("does not mark playSong as playing when audio play fails", async () => {
		const player = usePlayerStore();
		const song = { id: 1, title: "Rejected", audio_url: "rejected.mp3" } as any;

		player.playSong(song);
		audioInstances[0].play.mockRejectedValueOnce(new Error("play blocked"));
		player.playSong({
			id: 2,
			title: "Next rejected",
			audio_url: "next-rejected.mp3",
		} as any);
		await audioInstances[0].play.mock.results
			.at(-1)
			?.value.catch(() => undefined);

		expect(player.isPlaying).toBe(false);
	});

	it("exposes playback errors and retries the current audio", async () => {
		const player = usePlayerStore();
		player.playSong({
			id: "broken",
			title: "Broken",
			audio_url: "broken.mp3",
		} as any);
		audioInstances[0].emit("error");

		expect(player.isPlaying).toBe(false);
		expect(player.isLoading).toBe(false);
		expect(player.playbackError).toBe("音频加载失败，请重试");

		player.retryPlayback();

		expect(audioInstances[0].load).toHaveBeenCalledOnce();
		expect(player.playbackError).toBe("");
		expect(player.isLoading).toBe(true);
	});

	it("keeps togglePlay paused when audio play fails", async () => {
		const player = usePlayerStore();
		const song = {
			id: 1,
			title: "Toggle rejected",
			audio_url: "toggle-rejected.mp3",
		} as any;

		player.playSong(song);
		await audioInstances[0].play.mock.results[0]?.value;
		player.togglePlay();
		audioInstances[0].play.mockRejectedValueOnce(new Error("play blocked"));

		player.togglePlay();
		await audioInstances[0].play.mock.results
			.at(-1)
			?.value.catch(() => undefined);

		expect(player.isPlaying).toBe(false);
	});

	it("pauses immediately while an audio play request is still pending", async () => {
		let resolvePlay!: () => void;
		audioPlayImplementation = () =>
			new Promise<void>((resolve) => {
				resolvePlay = resolve;
			});
		const player = usePlayerStore();
		player.playSong({
			id: "pending-play",
			title: "Pending Play",
			audio_url: "pending-play.mp3",
		} as any);

		expect(player.isPlaying).toBe(false);
		player.togglePlay();

		expect(audioInstances[0].pause).toHaveBeenCalledOnce();
		expect(player.isPlaying).toBe(false);

		resolvePlay();
		await Promise.resolve();
		expect(player.isPlaying).toBe(false);
	});

	it("pauses an active audio element even before the playing state syncs", async () => {
		const player = usePlayerStore();
		player.playSong({
			id: "stale-playing-state",
			title: "Stale Playing State",
			audio_url: "stale-playing-state.mp3",
		} as any);
		await audioInstances[0].play.mock.results[0]?.value;

		player.isPlaying = false;
		audioInstances[0].paused = false;
		player.togglePlay();

		expect(audioInstances[0].pause).toHaveBeenCalledOnce();
		expect(audioInstances[0].play).toHaveBeenCalledOnce();
		expect(player.isPlaying).toBe(false);
	});

	it("ignores a delayed pause event after playback has resumed", async () => {
		const player = usePlayerStore();
		player.playSong({
			id: "resumed-after-pause-event",
			title: "Resumed Song",
			audio_url: "resumed-song.mp3",
		} as any);
		await audioInstances[0].play.mock.results[0]?.value;
		audioInstances[0].paused = false;
		audioInstances[0].emit("playing");

		// pause() may have queued this event before the newer play() completed.
		audioInstances[0].emit("pause");

		expect(player.isPlaying).toBe(true);
	});
	it("keeps repeat-one next paused when audio play fails", async () => {
		const player = usePlayerStore();
		const song = {
			id: 1,
			title: "Repeat rejected",
			audio_url: "repeat-rejected.mp3",
		} as any;

		player.playSong(song);
		await audioInstances[0].play.mock.results[0]?.value;
		player.repeatMode = "one";
		audioInstances[0].play.mockRejectedValueOnce(new Error("play blocked"));

		player.playNext();
		await audioInstances[0].play.mock.results
			.at(-1)
			?.value.catch(() => undefined);

		expect(player.isPlaying).toBe(false);
	});

	it("treats media session play and pause as idempotent actions", async () => {
		const handlers = new Map<string, () => void>();
		const mediaSession = {
			playbackState: "none",
			setActionHandler: vi.fn((action: string, handler: () => void) => {
				handlers.set(action, handler);
			}),
			setPositionState: vi.fn(),
		};
		Object.defineProperty(navigator, "mediaSession", {
			configurable: true,
			value: mediaSession,
		});

		const player = usePlayerStore();
		player.playSong({
			id: "media-song",
			title: "Media Song",
			audio_url: "media.mp3",
		} as any);
		await audioInstances[0].play.mock.results[0]?.value;

		handlers.get("pause")?.();
		handlers.get("pause")?.();
		expect(audioInstances[0].pause).toHaveBeenCalledTimes(1);

		handlers.get("play")?.();
		await audioInstances[0].play.mock.results.at(-1)?.value;
		handlers.get("play")?.();
		await audioInstances[0].play.mock.results.at(-1)?.value;
		expect(audioInstances[0].play).toHaveBeenCalledTimes(2);
		expect(player.isPlaying).toBe(true);

		Reflect.deleteProperty(navigator, "mediaSession");
	});

	it("computes actual volume using logarithmic perceptual mapping", () => {
		expect(computeActualVolume(0)).toBe(0);
		expect(computeActualVolume(1)).toBe(1);
		expect(computeActualVolume(0.5)).toBeCloseTo(0.25);
		expect(computeActualVolume(0.2)).toBeCloseTo(0.04);
		expect(computeActualVolume(-0.5)).toBe(0);
		expect(computeActualVolume(1.5)).toBe(1);
	});

	it("applies logarithmic volume to audio element when setVolume is called", () => {
		const player = usePlayerStore();
		player.playSong({ id: "vol-test", title: "Vol Test", audio_url: "vol.mp3" } as any);
		const audio = audioInstances[0];

		player.setVolume(0.6);
		expect(player.volume).toBe(0.6);
		expect(audio.volume).toBeCloseTo(0.36);

		player.setVolume(0);
		expect(player.volume).toBe(0);
		expect(audio.volume).toBe(0);
	});

	it("fades out audio smoothly down to zero", async () => {
		const mockAudio = {
			volume: 1,
			paused: false,
		} as unknown as HTMLAudioElement;

		await fadeOutAudio(mockAudio, 60);
		expect(mockAudio.volume).toBe(0);
	});

	it("retains logarithmic volume curve when switching songs or toggling play", () => {
		const player = usePlayerStore();
		player.setVolume(0.6);

		player.playSong({ id: "song-a", title: "Song A", audio_url: "a.mp3" } as any);
		const audio = audioInstances.at(-1)!;
		expect(audio.volume).toBeCloseTo(0.36);

		player.playSong({ id: "song-b", title: "Song B", audio_url: "b.mp3" } as any);
		expect(audio.volume).toBeCloseTo(0.36);
	});

	it("avoids resetting audio currentTime when seeking to negligible time difference", () => {
		const player = usePlayerStore();
		player.playSong({ id: "song-seek", title: "Song Seek", audio_url: "seek.mp3" } as any);
		const audio = audioInstances.at(-1)!;

		player.seek(30);
		expect(audio.currentTime).toBe(30);

		audio.currentTime = 30.02;
		player.seek(30.04);
		expect(audio.currentTime).toBe(30.02);
		expect(player.currentTime).toBe(30.04);

		player.seek(35);
		expect(audio.currentTime).toBe(35);
	});

	it("persists player volume to localStorage and respects saved setting", () => {
		const player = usePlayerStore();
		player.setVolume(0.45);
		expect(localStorage.getItem("playerVolume")).toBe("0.45");

		player.setVolume(0.8);
		expect(localStorage.getItem("playerVolume")).toBe("0.8");
	});

	it("supports setting playbackRate and applies to audio element", () => {
		const player = usePlayerStore();
		player.playSong({ id: "rate-song", title: "Rate Song", audio_url: "rate.mp3" } as any);
		const audio = audioInstances.at(-1)!;

		player.setPlaybackRate(1.5);
		expect(player.playbackRate).toBe(1.5);
		expect(audio.playbackRate).toBe(1.5);

		player.setPlaybackRate(0.75);
		expect(player.playbackRate).toBe(0.75);
		expect(audio.playbackRate).toBe(0.75);
	});

	it("restores player.playbackRate on audio element when loading new song", () => {
		const player = usePlayerStore();
		player.playSong({ id: "rate-1", title: "Rate 1", audio_url: "r1.mp3" } as any);
		const audio = audioInstances.at(-1)!;
		player.setPlaybackRate(1.75);
		expect(player.playbackRate).toBe(1.75);
		expect(audio.playbackRate).toBe(1.75);

		// Simulate browser reset of playbackRate to 1.0 on src change
		audio.playbackRate = 1.0;

		const song2 = { id: "rate-2", title: "Rate 2", audio_url: "r2.mp3" } as any;
		player.playSong(song2);

		expect(audio.src).toContain("r2.mp3");
		expect(audio.playbackRate).toBe(1.75);
	});

	it("maintains playedHistory when switching songs", () => {
		const player = usePlayerStore();
		const song1 = { id: "hist-1", title: "History 1", audio_url: "h1.mp3" } as any;
		const song2 = { id: "hist-2", title: "History 2", audio_url: "h2.mp3" } as any;
		const song3 = { id: "hist-3", title: "History 3", audio_url: "h3.mp3" } as any;

		player.playSong(song1);
		expect(player.playedHistory).toHaveLength(0);

		player.playSong(song2);
		expect(player.playedHistory).toHaveLength(1);
		expect(player.playedHistory[0].id).toBe("hist-1");

		player.playSong(song3);
		expect(player.playedHistory).toHaveLength(2);
		expect(player.playedHistory[0].id).toBe("hist-2");
		expect(player.playedHistory[1].id).toBe("hist-1");
	});

	it("does not duplicate history when currentSong is enriched or updated in-place", () => {
		const player = usePlayerStore();
		const song1 = { id: "dedupe-1", title: "Dedupe 1", audio_url: "d1.mp3" } as any;
		const song2 = { id: "dedupe-2", title: "Dedupe 2", audio_url: "d2.mp3" } as any;

		player.playSong(song1);
		expect(player.playedHistory).toHaveLength(0);

		// In-place property update or object replacement with same key
		player.currentSong = { ...player.currentSong!, lyrics: "[00:00.00]Lyrics" };
		expect(player.playedHistory).toHaveLength(0);

		// Switch to next song
		player.playSong(song2);
		expect(player.playedHistory).toHaveLength(1);
		expect(player.playedHistory[0].id).toBe("dedupe-1");

		// Switching again does not duplicate dedupe-1
		player.playSong(song1);
		expect(player.playedHistory).toHaveLength(2);
		expect(player.playedHistory[0].id).toBe("dedupe-2");
		expect(player.playedHistory[1].id).toBe("dedupe-1");
	});

	it("remembers previous volume and restores it when toggling mute", () => {
		const store = usePlayerStore();
		store.setVolume(0.85);
		expect(store.volume).toBe(0.85);
		expect(store.isMuted).toBe(false);

		store.toggleMute();
		expect(store.volume).toBe(0);
		expect(store.isMuted).toBe(true);

		store.toggleMute();
		expect(store.volume).toBe(0.85);
		expect(store.isMuted).toBe(false);
	});

	it("falls back to 0.5 if volume was initially 0 when unmuting", () => {
		localStorage.setItem("playerVolume", "0");
		try {
			const store = usePlayerStore();
			expect(store.volume).toBe(0);
			store.toggleMute();
			expect(store.volume).toBe(0.5);
			expect(store.isMuted).toBe(false);
		} finally {
			localStorage.removeItem("playerVolume");
		}
	});

	it("initializes lastNonZeroVolume to restored initial volume when > 0", () => {
		localStorage.setItem("playerVolume", "0.75");
		try {
			const store = usePlayerStore();
			expect(store.volume).toBe(0.75);
			expect(store.lastNonZeroVolume).toBe(0.75);
			store.toggleMute();
			expect(store.volume).toBe(0);
			store.toggleMute();
			expect(store.volume).toBe(0.75);
		} finally {
			localStorage.removeItem("playerVolume");
		}
	});

	it("transitions audio source smoothly when swapping tracks during active playback", async () => {
		vi.useFakeTimers();
		try {
			const store = usePlayerStore();
			const song1 = { id: "trans-1", title: "Song 1", audio_url: "s1.mp3" } as any;
			const song2 = { id: "trans-2", title: "Song 2", audio_url: "s2.mp3" } as any;

			store.playSong(song1);
			const audio = audioInstances.at(-1)!;
			expect(audio.src).toBe("s1.mp3");
			audio.paused = false;
			audio.currentTime = 15;
			audio.play.mockClear();

			store.playSong(song2);
			expect(store.currentSong?.id).toBe("trans-2");
			// During the micro-fadeout, audio.src has not transitioned yet and play has not been called on the new track
			expect(audio.src).toBe("s1.mp3");
			expect(audio.play).not.toHaveBeenCalled();

			// Advance timers to let transitionAudioSource complete (35ms micro fade-out)
			await vi.advanceTimersByTimeAsync(50);

			// After transition completes, audio.src has been swapped and play was invoked
			expect(audio.src).toBe("s2.mp3");
			expect(audio.play).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("does not fail playback if broadcastPlayRequest throws an error", async () => {
		const store = usePlayerStore();
		const song = { id: "sync-err-1", title: "Sync Test", audio_url: "sync.mp3" } as any;

		// Even if BroadcastChannel throws InvalidStateError, playback should succeed
		const originalBC = globalThis.BroadcastChannel;
		try {
			globalThis.BroadcastChannel = class MockClosedChannel {
				postMessage() {
					throw new DOMException("Failed to execute 'postMessage' on 'BroadcastChannel': Channel is closed", "InvalidStateError");
				}
				close() {}
			} as any;

			store.playSong(song);
			const audio = audioInstances[0];
			await audio.play.mock.results.at(-1)?.value;
			await nextTick();

			expect(store.isPlaying).toBe(true);
			expect(store.playbackError).toBe("");
		} finally {
			globalThis.BroadcastChannel = originalBC;
		}
	});

	it("clears playbackError on timeupdate when audio is actively playing", async () => {
		const store = usePlayerStore();
		const song = { id: "timeupdate-1", title: "Timeupdate Test", audio_url: "timeupdate.mp3" } as any;

		store.playSong(song);
		const audio = audioInstances[0];
		await audio.play.mock.results.at(-1)?.value;
		await nextTick();

		// Simulate an error string lingering while audio is playing
		store.playbackError = "音频加载失败，请重试";
		expect(store.playbackError).toBe("音频加载失败，请重试");

		audio.paused = false;
		audio.currentTime = 5;
		audio.emit("timeupdate");

		expect(store.playbackError).toBe("");
	});

	it("preserves playbackRate across retryPlayback", async () => {
		const store = usePlayerStore();
		const song = { id: "rate-test", title: "Rate Test", audio_url: "rate.mp3" } as any;

		store.setPlaybackRate(1.75);
		store.playSong(song);
		const audio = audioInstances[0];
		await audio.play.mock.results.at(-1)?.value;

		expect(audio.playbackRate).toBe(1.75);

		store.retryPlayback();
		expect(audio.playbackRate).toBe(1.75);
	});

	it("skips time correctly even before audio starts playing", () => {
		const store = usePlayerStore();
		store.currentTime = 120;
		store.duration = 600;

		store.skip(15);
		expect(store.currentTime).toBe(135);

		store.skip(-30);
		expect(store.currentTime).toBe(105);
	});
});

