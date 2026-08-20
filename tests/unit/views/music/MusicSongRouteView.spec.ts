import { flushPromises, mount } from "@vue/test-utils";
import { reactive, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vitest resolves Vue SFC imports through Vite, outside tsconfig's src-only include.
import MusicSongRouteView from "../../../../src/views/music/MusicSongRouteView.vue";

const mocks = vi.hoisted(() => ({
	getMusicSongDetail: vi.fn(),
	listMusicAlbums: vi.fn(),
	route: { params: { songId: "song-1" } },
	drawerState: { songRefreshToken: 0 },
	loadLyrics: vi.fn(),
	currentLyricLine: vi.fn(),
	openSong: vi.fn(),
}));
const route = reactive(mocks.route);
const currentRoute = ref({ path: "/music/song/song-1" });
const drawerState = ref(mocks.drawerState);
const drawerLayers = ref<unknown[]>([]);
const lyrics = ref<any>(null);
const lyricsLoading = ref(false);
const lyricsError = ref("");

vi.mock("@/api/musicV1", async (importOriginal) => ({
	...(await importOriginal()),
	getMusicSongDetail: mocks.getMusicSongDetail,
	listMusicAlbums: mocks.listMusicAlbums,
	addMusicSongToLater: vi.fn(),
}));
vi.mock("vue-router", () => ({
	useRoute: () => ({ ...route, query: {} }),
	useRouter: () => ({
		currentRoute,
		push: vi.fn(),
		replace: vi.fn(),
		go: vi.fn(),
	}),
}));
vi.mock("@/stores/player", () => ({
	usePlayerStore: () => ({
		currentSong: null,
		currentTime: 0,
		playSong: vi.fn(),
		addToQueue: vi.fn(),
	}),
}));
vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		state: drawerState,
		layers: drawerLayers,
		openSong: mocks.openSong,
		popToLayer: vi.fn(),
		closeAll: vi.fn(),
		openAlbum: vi.fn(),
		openArtist: vi.fn(),
		openMusicEditor: vi.fn(),
		openNestedAction: vi.fn(),
	}),
}));
vi.mock("@/composables/useLoginRedirect", () => ({
	useLoginRedirect: () => ({ requireLogin: () => true }),
}));
vi.mock("@/composables/useMusicFavoritePlaylist", () => ({
	useMusicFavoritePlaylist: () => ({
		favoriteSongIds: ref(new Set<string>()),
		playlists: ref([]),
		loadFavoriteSongs: vi.fn(),
		loadPlaylists: vi.fn(),
		toggleFavoriteSong: vi.fn(),
		addSongToPlaylist: vi.fn(),
	}),
}));
vi.mock("@/composables/useMusicLyrics", () => ({
	useMusicLyrics: () => ({
		lyrics,
		loading: lyricsLoading,
		errorMessage: lyricsError,
		load: mocks.loadLyrics,
		currentLine: mocks.currentLyricLine,
	}),
}));
vi.mock("@/components/music/MusicLyricsLine.vue", () => ({
	default: {
		props: ["line", "active", "bilingual"],
		template:
			'<div class="lyric-line-stub"><span>{{ line.text }}</span><span v-if="bilingual">{{ line.translation }}</span></div>',
	},
}));
vi.mock("@/components/music/MusicSongLyricsEditorDrawer.vue", () => ({
	default: {
		props: ["show", "songId", "songTitle"],
		template:
			"<div v-if=\"show\" data-testid=\"song-lyrics-editor\"><button data-testid=\"song-lyrics-editor-save\" @click=\"$emit('saved', { song_id: songId, content: 'Updated', translation: '', format: 'plain', version: 2, lines: [{ line_key: 'line-2', line_index: 0, time_ms: null, text: 'Updated', translation: '' }], annotations: [] })\">save</button></div>",
	},
}));
vi.mock("@/components/ui/PSegmentedControl.vue", () => ({
	default: {
		props: ["modelValue", "options"],
		template:
			'<div><button v-for="option in options" :key="option.value" :data-testid="`lyrics-mode-${option.value}`" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button></div>',
	},
}));

describe("MusicSongRouteView", () => {
	beforeEach(() => {
		mocks.getMusicSongDetail.mockReset();
		mocks.listMusicAlbums.mockReset();
		mocks.listMusicAlbums.mockResolvedValue({ data: [], meta: { total: 0 } });
		route.params.songId = "song-1";
		drawerState.value.songRefreshToken = 0;
		mocks.loadLyrics.mockReset();
		mocks.openSong.mockReset();
		mocks.loadLyrics.mockResolvedValue(undefined);
		mocks.currentLyricLine.mockReset();
		mocks.currentLyricLine.mockReturnValue(null);
		lyricsLoading.value = false;
		lyricsError.value = "";
		lyrics.value = {
			song_id: "song-1",
			content: "[00:01.00]Original",
			translation: "[00:01.00]翻译",
			format: "lrc",
			version: 1,
			lines: [
				{
					line_key: "line-1",
					line_index: 0,
					time_ms: 1000,
					text: "Original",
					translation: "翻译",
				},
			],
			annotations: [],
		};
	});

	it("opens the song sheet for the route parameter", async () => {
		mount(MusicSongRouteView);
		await flushPromises();

		expect(mocks.openSong).toHaveBeenCalledWith("song-1");
	});

	it("opens the latest song when the route parameter changes", async () => {
		mount(MusicSongRouteView);
		await flushPromises();

		route.params.songId = "song-2";
		await flushPromises();

		expect(mocks.openSong).toHaveBeenLastCalledWith("song-2");
	});
});
