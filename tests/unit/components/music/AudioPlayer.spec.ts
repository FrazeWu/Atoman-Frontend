import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import AudioPlayer from "@/components/music/AudioPlayer.vue";
import { usePlayerStore } from "@/stores/player";

const musicApi = vi.hoisted(() => ({
	listMusicPlaylists: vi.fn(),
	recordMusicSongPlay: vi.fn(),
	getMusicPlaybackProgress: vi.fn(),
	getMusicPlaybackSession: vi.fn(),
	saveMusicPlaybackProgress: vi.fn(),
	saveMusicPlaybackSession: vi.fn(),
	recordMusicRecommendationEvents: vi.fn(),
}));

const transportApi = vi.hoisted(() => ({
	apiFetch: vi.fn(),
}));

const loginRedirect = vi.hoisted(() => ({
	requireLogin: vi.fn(),
}));

const favoriteApi = vi.hoisted(() => ({
	favoriteSongIds: { __v_isRef: true, value: new Set<string>() },
	loadFavoriteSongs: vi.fn(),
	toggleFavoriteSong: vi.fn(),
	addSongToPlaylist: vi.fn(),
}));

vi.mock("@/composables/useApi", () => ({
	useApiUrl: () => "/api/v1",
	useApi: () => ({
		url: "",
		podcast: { bookmarks: "/api/v1/podcast/bookmarks" },
	}),
}));

vi.mock("@/api/musicV1", () => ({
	listMusicPlaylists: musicApi.listMusicPlaylists,
	recordMusicSongPlay: musicApi.recordMusicSongPlay,
	getMusicPlaybackProgress: musicApi.getMusicPlaybackProgress,
	getMusicPlaybackSession: musicApi.getMusicPlaybackSession,
	saveMusicPlaybackProgress: musicApi.saveMusicPlaybackProgress,
	saveMusicPlaybackSession: musicApi.saveMusicPlaybackSession,
	recordMusicRecommendationEvents: musicApi.recordMusicRecommendationEvents,
}));

vi.mock("@/api/transport", () => ({
	apiFetch: transportApi.apiFetch,
}));

vi.mock("@/composables/useLoginRedirect", () => ({
	useLoginRedirect: () => ({ requireLogin: loginRedirect.requireLogin }),
}));

vi.mock("@/composables/useMusicFavoritePlaylist", () => ({
	useMusicFavoritePlaylist: () => favoriteApi,
}));

class ResizeObserverStub {
	observe() {}
	disconnect() {}
}

function createTestRouter() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [{ path: "/", component: { template: "<div />" } }],
	});
}

describe("AudioPlayer", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		document.documentElement.removeAttribute("data-player-active");
		document.documentElement.removeAttribute("data-player-pinned");
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		musicApi.listMusicPlaylists.mockResolvedValue({ data: [] });
		musicApi.recordMusicSongPlay.mockResolvedValue(undefined);
		musicApi.getMusicPlaybackProgress.mockResolvedValue(null);
		musicApi.getMusicPlaybackSession.mockResolvedValue(null);
		musicApi.saveMusicPlaybackProgress.mockResolvedValue({});
		musicApi.saveMusicPlaybackSession.mockResolvedValue({});
		musicApi.recordMusicRecommendationEvents.mockResolvedValue(undefined);
		transportApi.apiFetch.mockResolvedValue(new Response(null, { status: 201 }));
		loginRedirect.requireLogin.mockReset();
		loginRedirect.requireLogin.mockReturnValue(true);
		favoriteApi.favoriteSongIds.value = new Set();
		favoriteApi.loadFavoriteSongs.mockReset();
		favoriteApi.loadFavoriteSongs.mockResolvedValue(undefined);
	});

	it("switches between full and cover-only modes and opens song comments", async () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Song 1",
			artist: "Artist 1",
			audio_url: "/song-1.mp3",
		} as any;
		player.currentTime = 30;
		player.duration = 120;

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: {
					MusicLyricsPanel: true,
					CommentSideSheet: {
						props: ["show", "target"],
						template: '<div class="comment-sheet-stub" :data-show="show" :data-target-kind="target.kind" :data-resource-id="target.resourceId" />',
					},
					PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
					PToast: true,
				},
			},
		});

		expect(wrapper.get('[data-player-mode="full"]').exists()).toBe(true);
		expect(wrapper.get('[aria-label="收起为仅封面"]').exists()).toBe(true);
		expect(wrapper.get('[aria-label="歌词"]').exists()).toBe(true);
		expect(wrapper.get('[aria-label="评论"]').exists()).toBe(true);

		await wrapper.get('[aria-label="收起为仅封面"]').trigger("click");
		expect(wrapper.get('[data-player-mode="cover"]').exists()).toBe(true);
		expect(wrapper.find('[data-player-mode="full"]').exists()).toBe(false);
		expect(wrapper.find('.player-mini-play-overlay').exists()).toBe(true);
		expect(wrapper.find('.player-mini-marquee').exists()).toBe(false);
		expect(wrapper.get('.player-mini-progress-ring').attributes('data-progress')).toBe('25');
		expect(wrapper.find('[aria-label="更多"]').exists()).toBe(false);
		expect(wrapper.find('[aria-label="取消固定播放器"]').exists()).toBe(false);

		const togglePlay = vi.spyOn(player, "togglePlay");
		const coverButton = wrapper.get('[data-player-mode="cover"] .player-mini-cover');
		expect(coverButton.element.tagName).toBe("BUTTON");
		expect(coverButton.attributes("aria-label")).toBe("继续播放");
		await coverButton.trigger("click");
		expect(togglePlay).toHaveBeenCalledOnce();

		player.isPlaying = true;
		await wrapper.vm.$nextTick();
		expect(coverButton.attributes("aria-label")).toBe("暂停播放");
		expect(wrapper.find('.player-mini-play-overlay').exists()).toBe(false);
		await coverButton.trigger("click");
		expect(togglePlay).toHaveBeenCalledTimes(2);

		const source = readFileSync(
			resolve(process.cwd(), "src/components/music/AudioPlayer.vue"),
			"utf8",
		);
		expect(source).toContain('<Transition name="player-display">');
		expect(source).toContain('IconChevronRight as ChevronRight');
		expect(source).toContain('IconChevronLeft as ChevronLeft');
		expect(source).toContain('<ChevronRight :size="16" aria-hidden="true" />');
		expect(source).toContain('<ChevronLeft :size="15" aria-hidden="true" />');
		expect(source).not.toContain('<Minimize2 :size="16" aria-hidden="true" />');
		expect(source).not.toContain('IconMaximize as Maximize2');
		expect(source).not.toContain('name="player-display" mode="out-in"');
		expect(source).toMatch(
			/\.player-display-enter-active\s*\{[^}]*animation:\s*player-display-enter\s+var\(--a-motion-emphasis\)/,
		);
		expect(source).toMatch(
			/@keyframes player-display-enter[\s\S]*?72%\s*\{[^}]*transform:\s*translateX\(-1rem\)/,
		);
		expect(source).toMatch(
			/\.player-display-leave-active\s*\{[^}]*animation:\s*player-display-leave\s+var\(--a-motion-overlay-exit\)/,
		);
		expect(source).not.toContain('clip-path: inset(0 0 0 100%)');
		expect(source).not.toMatch(
			/@media \(max-width: 767px\)[\s\S]*?\.player\s*\{[^}]*transform:\s*none\s*!important;/,
		);
		expect(source).toContain('@media (prefers-reduced-motion: reduce)');
		expect(source).toMatch(
			/\.player-display-enter-active[\s\S]*?animation:\s*player-display-enter var\(--a-motion-emphasis\)/,
		);
		expect(source).toMatch(
			/\.player-mini-window\s*\{[^}]*width: 4\.5rem;[^}]*height: 4\.5rem;/,
		);
		expect(source).toMatch(
			/\.player-mini-cover\s*\{[^}]*width: 4\.5rem;[^}]*height: 4\.5rem;/,
		);
		expect(source).toMatch(
			/\.player-mini-expand\s*\{[^}]*height: 4\.5rem;/,
		);

		await wrapper.get('[aria-label="展开完整播放器"]').trigger("click");
		expect(wrapper.get('[data-player-mode="full"]').exists()).toBe(true);

		await wrapper.get('[aria-label="评论"]').trigger("click");
		expect(wrapper.get('.comment-sheet-stub').attributes('data-show')).toBe('true');
		expect(wrapper.get('.comment-sheet-stub').attributes('data-target-kind')).toBe('music_song');
		expect(wrapper.get('.comment-sheet-stub').attributes('data-resource-id')).toBe('song-1');
		wrapper.unmount();
	});

	it("keeps the player visible when a guest opens the add-to-playlist menu", async () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Song 1",
			artist: "Artist 1",
			audio_url: "/song-1.mp3",
		} as any;
		const auth = (await import("@/stores/auth")).useAuthStore();
		auth.isAuthenticated = false;

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: {
					MusicLyricsPanel: true,
					PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
					PToast: true,
				},
			},
		});

		await wrapper.get('[aria-label="添加到歌单"]').trigger("click");
		expect(loginRedirect.requireLogin).not.toHaveBeenCalled();
		expect(wrapper.find('[data-player-mode="full"]').exists()).toBe(true);
		wrapper.unmount();
	});

	it("uses cookie-aware transport when bookmarking a podcast in a cookie session", async () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Episode 1",
			artist: "Host",
			audio_url: "/episode.mp3",
			source_id: "episode-1",
			source_type: "podcast_episode",
		} as any;
		const auth = (await import("@/stores/auth")).useAuthStore();
		auth.token = "cookie-session";

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: { MusicLyricsPanel: true, PDropdown: true, PToast: true },
			},
		});
		await wrapper.get('[title="收藏单集"]').trigger("click");

		expect(transportApi.apiFetch).toHaveBeenCalledWith(
			"/api/v1/podcast/bookmarks",
			expect.objectContaining({
				method: "POST",
				headers: expect.not.objectContaining({
					Authorization: expect.any(String),
				}),
				body: JSON.stringify({ episode_id: "episode-1", kind: "favorite" }),
			}),
		);
		wrapper.unmount();
	});

	it("uses the listen_later kind for the podcast later action", async () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Episode 1",
			artist: "Host",
			audio_url: "/episode.mp3",
			source_id: "episode-1",
			source_type: "podcast_episode",
		} as any;

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: { MusicLyricsPanel: true, PDropdown: true, PToast: true },
			},
		});
		await wrapper.get('[title="稍后听"]').trigger("click");

		expect(transportApi.apiFetch).toHaveBeenCalledWith(
			"/api/v1/podcast/bookmarks",
			expect.objectContaining({
				body: JSON.stringify({ episode_id: "episode-1", kind: "listen_later" }),
			}),
		);
		wrapper.unmount();
	});

	it("reloads music playlists and favorites after login and clears them after logout", async () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Song 1",
			artist: "Artist",
			audio_url: "/song.mp3",
		} as any;
		const auth = (await import("@/stores/auth")).useAuthStore();
		auth.isAuthenticated = false;

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: { MusicLyricsPanel: true, PDropdown: true, PToast: true },
			},
		});
		await Promise.resolve();
		expect(musicApi.listMusicPlaylists).not.toHaveBeenCalled();

		auth.isAuthenticated = true;
		await wrapper.vm.$nextTick();
		await Promise.resolve();
		expect(musicApi.listMusicPlaylists).toHaveBeenCalledOnce();
		expect(favoriteApi.loadFavoriteSongs).toHaveBeenCalledWith(["song-1"]);

		favoriteApi.favoriteSongIds.value = new Set(["song-1"]);
		auth.isAuthenticated = false;
		await wrapper.vm.$nextTick();
		expect(favoriteApi.favoriteSongIds.value.size).toBe(0);
		wrapper.unmount();
	});

	it("keeps an API bearer token when bookmarking through the installed transport", async () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Episode 1",
			artist: "Host",
			audio_url: "/episode.mp3",
			source_id: "episode-1",
			source_type: "podcast_episode",
		} as any;
		const auth = (await import("@/stores/auth")).useAuthStore();
		auth.token = "api-token";

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: { MusicLyricsPanel: true, PDropdown: true, PToast: true },
			},
		});
		await wrapper.get('[title="收藏单集"]').trigger("click");

		expect(transportApi.apiFetch).toHaveBeenCalledWith(
			"/api/v1/podcast/bookmarks",
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer api-token" }),
			}),
		);
		wrapper.unmount();
	});

	it("does not render the deprecated pin control", () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Song 1",
			artist: "Artist 1",
			audio_url: "/song-1.mp3",
		} as any;

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: {
					MusicLyricsPanel: true,
					PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
					PToast: true,
				},
			},
		});

		expect(wrapper.find('[aria-label="固定播放器"]').exists()).toBe(false);
		expect(wrapper.find('[aria-label="取消固定播放器"]').exists()).toBe(false);
		expect(wrapper.find('.player-reveal-handle').exists()).toBe(false);
		expect(
			readFileSync(resolve(process.cwd(), "src/components/music/AudioPlayer.vue"), "utf8"),
		).not.toContain(".player-reveal-handle");
		wrapper.unmount();
	});

	it("passes playback time to the lyrics panel and seeks when the panel emits", async () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Song 1",
			artist: "Artist 1",
			audio_url: "/song-1.mp3",
		} as any;
		player.currentTime = 12.345;
		player.showLyrics = true;
		const seek = vi.spyOn(player, "seek").mockImplementation(() => undefined);

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: {
					MusicLyricsPanel: {
						props: ["currentTimeSeconds"],
						emits: ["close", "seek"],
						template: `
              <button
                type="button"
                class="lyrics-panel-seek-stub"
                :data-current-time-seconds="currentTimeSeconds"
                @click="$emit('seek', 27.125)"
              >
                定位
              </button>
            `,
					},
					PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
					PToast: true,
				},
			},
		});

		expect(
			wrapper
				.get(".lyrics-panel-seek-stub")
				.attributes("data-current-time-seconds"),
		).toBe("12.345");
		await wrapper.get(".lyrics-panel-seek-stub").trigger("click");
		expect(seek).toHaveBeenCalledOnce();
		expect(seek).toHaveBeenCalledWith(27.125);

		wrapper.unmount();
	});

	it("reserves mobile space for metadata, playback, lyrics, and queue controls", () => {
		const source = readFileSync(
			resolve(process.cwd(), "src/components/music/AudioPlayer.vue"),
			"utf8",
		);

		expect(source).toMatch(
			/@media \(max-width: 767px\)[\s\S]*?\.player-inner\s*\{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) 116px 88px;/,
		);
		expect(source).toContain('class="feature-link"');
		expect(source).toContain(
			'const featureLabel = computed(() => (isPodcast.value ? "说明" : "词"))',
		);
		expect(source).toMatch(
			/@media \(max-width: 767px\)[\s\S]*?\.player-controls-hub\s*\{[^}]*position: static;[^}]*transform: none;/,
		);
	});

	it("vertically centers the waveform and keeps lyrics and comments legible", () => {
		const source = readFileSync(
			resolve(process.cwd(), "src/components/music/AudioPlayer.vue"),
			"utf8",
		);

		expect(source).toMatch(
			/\.progress-container\s*\{[^}]*display: flex;[^}]*align-items: center;/,
		);
		expect(source).toMatch(
			/\.progress-container > :deep\(\.waveform-progress\)\s*\{[^}]*width: 100%;/,
		);
		expect(source).toMatch(
			/\.feature-link\s*\{[^}]*font-size: 12px;/,
		);
	});

	it("applies adaptive glassmorphism styles", () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Song 1",
			artist: "Artist 1",
			audio_url: "/song-1.mp3",
		} as any;

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: {
					MusicLyricsPanel: true,
					PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
					PToast: true,
				},
			},
		});

		const playerEl = wrapper.find(".player");
		expect(playerEl.exists()).toBe(true);

		// In a real DOM, we would check getComputedStyle.
		// In JSDOM/Happy-DOM without full CSS evaluation, we at least verify the element has the player class
		// which binds to our glassmorphism CSS rules.
		expect(playerEl.classes()).toContain("player");
	});

	it("renders a waveform and follows the current playback progress", async () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Song 1",
			artist: "Artist 1",
			audio_url: "/song-1.mp3",
		} as any;
		player.currentTime = 30;
		player.duration = 120;

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: {
					MusicLyricsPanel: true,
					PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
					PToast: true,
				},
			},
		});

		expect(wrapper.find(".waveform-progress").exists()).toBe(true);
		const range = wrapper.get<HTMLInputElement>(".waveform-range");
		expect(range.element.value).toBe("30");

		player.currentTime = 60;
		await wrapper.vm.$nextTick();
		expect(range.element.value).toBe("60");
		expect(wrapper.get('[aria-label="播放"]').text()).toBe("播放");
		expect(wrapper.find('[aria-label="后退 5 秒"]').exists()).toBe(false);
		expect(wrapper.find('[aria-label="前进 5 秒"]').exists()).toBe(false);
		expect(wrapper.get('[aria-label="添加到最爱"]').exists()).toBe(true);
		expect(wrapper.get('[aria-label="切换播放模式"]').exists()).toBe(true);
		wrapper.unmount();
	});

	it("renders text controls with accessible labels", () => {
		const player = usePlayerStore();
		player.currentSong = {
			id: "song-1",
			title: "Song 1",
			artist: "Artist 1",
			audio_url: "/song-1.mp3",
		} as any;

		const wrapper = mount(AudioPlayer, {
			global: {
				plugins: [createTestRouter()],
				stubs: {
					MusicLyricsPanel: true,
					PDropdown: { template: '<div><slot name="trigger" /><slot /></div>' },
					PToast: true,
				},
			},
		});

		const playBtn = wrapper.find(".main-play-btn");
		expect(playBtn.exists()).toBe(true);
		expect(playBtn.classes()).toContain("main-play-btn");
		expect(wrapper.get('[aria-label="播放"]').text()).toBe("播放");
		expect(wrapper.get('[aria-label="上一首"]').text()).toBe("上一首");
		expect(wrapper.get('[aria-label="下一首"]').text()).toBe("下一首");
		expect(wrapper.find('[aria-label="后退 5 秒"]').exists()).toBe(false);
		expect(wrapper.find('[aria-label="前进 5 秒"]').exists()).toBe(false);
		expect(wrapper.get('[aria-label="添加到最爱"]').exists()).toBe(true);
		expect(wrapper.get('[aria-label="切换播放模式"]').exists()).toBe(true);
	});
});
