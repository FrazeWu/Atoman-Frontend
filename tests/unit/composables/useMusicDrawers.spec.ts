import { describe, it, expect, beforeEach } from "vitest";
import { useMusicDrawers } from "../../../src/composables/useMusicDrawers";
import type { MusicSheetLayer } from "../../../src/components/music/musicSheetTypes";

describe("useMusicDrawers", () => {
	beforeEach(() => {
		const { closeAll } = useMusicDrawers();
		closeAll();
	});

	it("manages artist drawer state", () => {
		const { state, openArtist, closeArtist } = useMusicDrawers();
		expect(state.value.artistId).toBeNull();

		openArtist("artist-123");
		expect(state.value.artistId).toBe("artist-123");

		closeArtist();
		expect(state.value.artistId).toBeNull();
	});

	it("manages album drawer state", () => {
		const { state, openAlbum, closeAlbum } = useMusicDrawers();
		openAlbum("album-456");
		expect(state.value.albumId).toBe("album-456");

		closeAlbum();
		expect(state.value.albumId).toBeNull();
	});

	it("closes an album and the action layers above it", () => {
		const { state, openArtist, openAlbum, openNestedAction, closeAlbum } =
			useMusicDrawers();

		openArtist("artist-1");
		openAlbum("album-1");
		openNestedAction("history", { albumId: "album-1" });
		closeAlbum();

		expect(state.value.artistId).toBe("artist-1");
		expect(state.value.albumId).toBeNull();
		expect(state.value.nestedAction).toBeNull();
	});

	it("manages nested action drawer state", () => {
		const { state, openNestedAction, closeNestedAction } = useMusicDrawers();
		openNestedAction("revise", { title: "Test" });
		expect(state.value.nestedAction).toBe("revise");
		expect(state.value.nestedPayload).toEqual({ title: "Test" });

		closeNestedAction();
		expect(state.value.nestedAction).toBeNull();
	});

	it("manages song editor state", () => {
		const { state, openMusicEditor, closeMusicEditor } = useMusicDrawers();

		openMusicEditor({ entity: "song", mode: "edit", id: "song-1" });
		expect(state.value.musicEditor).toEqual({
			entity: "song",
			mode: "edit",
			id: "song-1",
		});

		closeMusicEditor();
		expect(state.value.musicEditor).toBeNull();
	});

	it("computes shifted states correctly", () => {
		const {
			isMainShifted,
			isArtistShifted,
			isAlbumShifted,
			openArtist,
			openAlbum,
			openNestedAction,
		} = useMusicDrawers();

		expect(isMainShifted.value).toBe(false);

		openArtist("1");
		expect(isMainShifted.value).toBe(true);
		expect(isArtistShifted.value).toBe(false);

		openAlbum("2");
		expect(isArtistShifted.value).toBe(true);
		expect(isAlbumShifted.value).toBe(false);

		openNestedAction("revise");
		expect(isAlbumShifted.value).toBe(true);
	});

	it("computes isMainShifted correctly with add_artist", () => {
		const { isMainShifted, openNestedAction } = useMusicDrawers();
		expect(isMainShifted.value).toBe(false);
		openNestedAction("add_artist");
		expect(isMainShifted.value).toBe(true);
	});

	it("shifts the main content while the song editor is open", () => {
		const { isMainShifted, openMusicEditor } = useMusicDrawers();

		openMusicEditor({ entity: "song", mode: "edit", id: "song-1" });
		expect(isMainShifted.value).toBe(true);
	});

	it("computes isArtistShifted correctly with add_album", () => {
		const { isArtistShifted, openNestedAction } = useMusicDrawers();
		expect(isArtistShifted.value).toBe(false);
		openNestedAction("add_album");
		expect(isArtistShifted.value).toBe(true);
	});

	it("computes isArtistShifted correctly with revise_artist", () => {
		const { isArtistShifted, openNestedAction } = useMusicDrawers();
		expect(isArtistShifted.value).toBe(false);
		openNestedAction("revise_artist");
		expect(isArtistShifted.value).toBe(true);
	});

	it("can refresh artist drawer data explicitly", () => {
		const { state, refreshArtist } = useMusicDrawers();
		expect(state.value.artistRefreshToken).toBe(0);
		refreshArtist();
		expect(state.value.artistRefreshToken).toBe(1);
	});

	it("can refresh playlist lists explicitly", () => {
		const { state, refreshPlaylists } = useMusicDrawers();
		expect(state.value.playlistRefreshToken).toBe(0);
		refreshPlaylists();
		expect(state.value.playlistRefreshToken).toBe(1);
	});

	it("rebuilds the shortest path when opening a fourth sheet", () => {
		const drawers = useMusicDrawers();
		drawers.openArtist("artist-1");
		drawers.openAlbum("album-1");
		drawers.openNestedAction("revise", { albumId: "album-1" });
		drawers.openNestedAction("history", { albumId: "album-1" });

		expect(
			drawers.layers.value.map((layer: MusicSheetLayer) => layer.key),
		).toEqual(["album:album-1", "action:history:album-1"]);
	});
});

describe("useMusicDrawers music creation flow", () => {
	beforeEach(() => {
		const { closeAll } = useMusicDrawers();
		closeAll();
	});

	it("opens the creation flow with upload step and preserves seeded artist context", () => {
		const drawers = useMusicDrawers();

		expect(drawers.isMainShifted.value).toBe(false);
		expect(drawers.isArtistShifted.value).toBe(false);

		drawers.openMusicCreationFlow({
			artistId: "artist-7",
			artistSource: "https://example.test/artist-7",
		});

		expect(drawers.state.value.creationFlow?.step).toBe("albumImport");
		expect(drawers.state.value.creationFlow?.draft.artist.id).toBe("artist-7");
		expect(drawers.state.value.creationFlow?.draft.artist.source).toBe(
			"https://example.test/artist-7",
		);
		expect(drawers.state.value.creationFlow?.draft.artist.members).toEqual([]);
		expect(
			drawers.state.value.creationFlow?.draft.artist.birthDateParts,
		).toEqual({
			year: "",
			month: "",
			day: "",
		});
		expect(
			drawers.state.value.creationFlow?.draft.artist.activeStartDateParts,
		).toEqual({
			year: "",
			month: "",
			day: "",
		});
		expect(
			drawers.state.value.creationFlow?.draft.artist.activeEndDateParts,
		).toEqual({
			year: "",
			month: "",
			day: "",
		});
		expect(
			drawers.state.value.creationFlow?.draft.artist.stageNames[0],
		).toMatchObject({
			startDateParts: {
				year: "",
				month: "",
				day: "",
			},
			endDateParts: {
				year: "",
				month: "",
				day: "",
			},
		});
		expect(drawers.state.value.creationFlow?.draft.albumSeed.title).toBe("");
		expect(
			drawers.state.value.creationFlow?.draft.albumDetails.releaseDateParts,
		).toEqual({
			year: "",
			month: "",
			day: "",
		});
		expect(
			drawers.state.value.creationFlow?.draft.albumDetails.contributors,
		).toEqual([
			{
				id: "contributor-artist-7",
				artistId: "artist-7",
				name: "",
				avatarUrl: "",
				kind: "person",
				locked: false,
				roles: [{ id: "role-artist-7-primary", role: "primary", label: "" }],
			},
		]);
		expect(
			"name" in (drawers.state.value.creationFlow?.draft.artist ?? {}),
		).toBe(false);
		expect(
			"country" in (drawers.state.value.creationFlow?.draft.artist ?? {}),
		).toBe(false);
		expect(
			"birthday" in (drawers.state.value.creationFlow?.draft.artist ?? {}),
		).toBe(false);

		expect(drawers.isMainShifted.value).toBe(true);
		expect(drawers.isArtistShifted.value).toBe(true);
	});

	it("opens standalone artist-first flow with empty contributors and reusable member draft structure", () => {
		const drawers = useMusicDrawers();

		drawers.openMusicCreationFlow();

		expect(drawers.state.value.creationFlow?.draft.artist.members).toEqual([]);
		expect(
			drawers.state.value.creationFlow?.draft.albumDetails.contributors,
		).toEqual([]);
	});

	it("resumes a committed import repair at the album creation page with its original artists", () => {
		const drawers = useMusicDrawers();
		drawers.resumeMusicCreationFlow(
			{
				importId: "import-1",
				targetAlbumId: "album-1",
				status: "ready",
				inputMode: "auto",
				stage: "ready",
				progress: { current: 1, total: 1 },
				files: [],
				errors: [],
				archiveName: "Discovery.zip",
				artistSource: "https://example.test/artist",
				albumSource: "https://example.test/album",
				commitRequest: {
					artist_id: "artist-1",
					artist: {
						name: "Daft Punk",
						legal_name: "Daft Punk",
						bio: "人工艺人简介",
						nationality: "FR",
						birth_date: "1974-01-01",
						stage_names: [
							{
								name: "Daft Punk",
								is_primary: true,
								start_date_text: "",
								end_date_text: "",
							},
						],
						birth_place: "Paris",
					},
					artists: [
						{
							artist_id: "artist-1",
							name: "Daft Punk",
							roles: [{ role: "primary" }],
							legal_name: "",
							bio: "",
							nationality: "",
							birth_date: "",
							stage_names: [],
							birth_place: "",
							artist_form: "person",
							active_start_date: "",
							active_end_date: "",
							members: [],
						},
					],
					artist_source: "https://example.test/artist",
					album: {
						title: "Discovery",
						description: "人工专辑简介",
						album_type: "album",
						cover_url: "https://cdn.example.com/manual.jpg",
						release_date: "2001-02-26",
						release_year: 2001,
						tracks: [
							{
								title: "One More Time",
								disc_number: 1,
								track_number: 1,
								audio_url: "https://cdn.example.com/one-more-time.mp3",
							},
						],
					},
					album_source: "https://example.test/album",
				},
				uploadProgress: 100,
				uploadSpeed: 0,
				coverUrl: "https://cdn.example.com/discovery.jpg",
				coverKey: "",
				derivedAlbumTitle: "Discovery",
				derivedCover: "",
				derivedTracks: [
					{ title: "One More Time", audioKey: "track-1", origin: "archive" },
				],
				lastSyncedAt: "",
				errorMessage: "",
			},
			[{ id: "artist-1", name: "Daft Punk" }],
		);

		expect(drawers.state.value.creationFlow?.draft.albumDetails.bio).toBe(
			"人工专辑简介",
		);
		expect(drawers.state.value.creationFlow?.draft.albumDetails.coverUrl).toBe(
			"https://cdn.example.com/manual.jpg",
		);
		expect(drawers.state.value.creationFlow?.draft.tracks).toEqual([
			expect.objectContaining({
				audioUrl: "https://cdn.example.com/one-more-time.mp3",
			}),
		]);
		expect(drawers.state.value.creationFlow?.tracksCustomized).toBe(true);
		expect(drawers.state.value.creationFlow?.titleCustomized).toBe(true);
		expect(
			drawers.state.value.creationFlow?.draft.albumDetails.contributors,
		).toEqual([
			expect.objectContaining({
				artistId: "artist-1",
				name: "Daft Punk",
				locked: true,
			}),
		]);
	});

	it("resumes an unfinished import without an artist at the album creation page", () => {
		const drawers = useMusicDrawers();

		drawers.resumeMusicCreationFlow({
			importId: "import-unassigned",
			targetAlbumId: "",
			artistId: "",
			albumTitle: "Freshman Adjustment",
			status: "ready",
			inputMode: "archive",
			stage: "ready",
			progress: { current: 1, total: 1 },
			files: [],
			errors: [],
			archiveName: "Freshman Adjustment.zip",
			uploadProgress: 100,
			uploadSpeed: 0,
			coverUrl: "",
			coverKey: "",
			derivedAlbumTitle: "Freshman Adjustment",
			derivedCover: "",
			derivedTracks: [
				{ title: "Intro", audioKey: "track-1", origin: "archive" },
			],
			lastSyncedAt: "",
			errorMessage: "",
		});

		expect(drawers.state.value.creationFlow?.step).toBe("albumDetails");
		expect(drawers.state.value.creationFlow?.draft.artist.id).toBeNull();
		expect(
			drawers.state.value.creationFlow?.draft.albumDetails.contributors,
		).toEqual([]);
		expect(drawers.state.value.creationFlow?.draft.tracks).toEqual([
			expect.objectContaining({ title: "Intro", audioKey: "track-1" }),
		]);
	});

	it("resumes an unfinished import at upload when the original artist is stored", () => {
		const drawers = useMusicDrawers();

		drawers.resumeMusicCreationFlow({
			importId: "import-2",
			targetAlbumId: "",
			artistId: "artist-2",
			albumTitle: "Discovery",
			status: "queued",
			inputMode: "folder",
			stage: "queued",
			progress: { current: 0, total: 0 },
			files: [],
			errors: [],
			archiveName: "",
			uploadProgress: 100,
			uploadSpeed: 0,
			coverUrl: "",
			coverKey: "",
			derivedAlbumTitle: "",
			derivedCover: "",
			derivedTracks: [],
			lastSyncedAt: "",
			errorMessage: "",
		});

		expect(drawers.state.value.creationFlow?.step).toBe("albumDetails");
		expect(drawers.state.value.creationFlow?.draft.artist.id).toBe("artist-2");
		expect(drawers.state.value.creationFlow?.draft.albumDetails.title).toBe(
			"Discovery",
		);
		expect(
			drawers.layers.value.map((layer: MusicSheetLayer) => layer.kind),
		).toEqual(["creation"]);
	});

	it("clears the creation flow draft when closeMusicCreationFlow is called", () => {
		const drawers = useMusicDrawers();

		drawers.openMusicCreationFlow();
		drawers.state.value.creationFlow!.draft.artist.legalName = "Kanye West";
		drawers.closeMusicCreationFlow();

		expect(drawers.state.value.creationFlow).toBeNull();
	});

	it("clears creationFlow together when closing the music editor", () => {
		const drawers = useMusicDrawers();

		drawers.openMusicEditor({ entity: "song", mode: "edit", id: "song-1" });
		drawers.openMusicCreationFlow();
		drawers.closeMusicEditor();

		expect(drawers.state.value.musicEditor).toBeNull();
		expect(drawers.state.value.creationFlow).toBeNull();
	});

	it("keeps the underlying song editor when closing the creation flow", () => {
		const drawers = useMusicDrawers();

		drawers.openMusicEditor({ entity: "song", mode: "edit", id: "song-1" });
		drawers.openMusicCreationFlow();
		drawers.closeMusicCreationFlow();

		expect(drawers.state.value.creationFlow).toBeNull();
		expect(drawers.state.value.musicEditor).toEqual({
			entity: "song",
			mode: "edit",
			id: "song-1",
		});
	});

	it("opens album creation as one creation layer without an editor layer", () => {
		const drawers = useMusicDrawers();

		drawers.openArtist("artist-1");
		drawers.openMusicCreationFlow({ artistId: "artist-1" });

		expect(drawers.state.value.creationFlow).not.toBeNull();
		expect(drawers.state.value.musicEditor).toBeNull();
		expect(
			drawers.layers.value.some(
				(layer: MusicSheetLayer) => layer.kind === "editor",
			),
		).toBe(false);
		expect(
			drawers.layers.value.map((layer: MusicSheetLayer) => layer.kind),
		).toEqual(["artist", "creation"]);
	});
});
