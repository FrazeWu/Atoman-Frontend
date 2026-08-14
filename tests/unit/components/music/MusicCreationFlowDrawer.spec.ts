import { flushPromises, mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vue SFC declarations are unavailable to the standalone TypeScript server.
import MusicCreationFlowDrawer from "../../../../src/components/music/MusicCreationFlowDrawer.vue";
import type { MusicCreationFlowState } from "../../../../src/components/music/musicCreationTypes";
import * as musicApi from "../../../../src/api/musicV1";

const createFlowState = (
	overrides: Partial<MusicCreationFlowState> = {},
): MusicCreationFlowState => ({
	step: "albumImport",
	draft: {
		artist: {
			id: "artist-seeded",
			disambiguation: "",
			avatarUrl: "",
			kind: "person",
			legalName: "Seeded Artist",
			avatarAsset: null,
			stageNames: [
				{
					id: "stage-name-primary",
					name: "",
					isPrimary: true,
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
					startDateText: "",
					endDateText: "",
				},
			],
			nationality: "",
			birthPlace: "",
			birthDateParts: {
				year: "",
				month: "",
				day: "",
			},
			activeStartDateParts: {
				year: "",
				month: "",
				day: "",
			},
			activeEndDateParts: {
				year: "",
				month: "",
				day: "",
			},
			members: [],
			birthDate: "",
			bio: "",
			source: "",
		},
		albumImport: {
			importId: "import-1",
			inputMode: "archive",
			archiveName: "seed.zip",
			status: "pending_upload",
			stage: "upload",
			uploadProgress: 0,
			uploadSpeed: 0,
			files: [],
			totalBytesLoaded: 0,
			totalBytesTotal: 0,
			coverUrl: "",
			coverKey: "",
			derivedAlbumTitle: "",
			derivedCover: "",
			derivedTracks: [],
			lastSyncedAt: "",
			errorMessage: "",
		},
		albumSeed: {
			title: "",
			uploadedAssets: [],
		},
		albumDetails: {
			coverUrl: "https://img.test/default-cover.jpg",
			coverAsset: null,
			title: "",
			contributors: [
				{
					id: "contributor-artist-seeded",
					artistId: "artist-seeded",
					name: "Seeded Artist",
					avatarUrl: "",
					kind: "person",
					locked: false,
					roles: [{ id: "role-primary", role: "primary", label: "" }],
				},
			],
			releaseDateParts: {
				year: "2020",
				month: "01",
				day: "01",
			},
			releaseDate: "",
			type: "album",
			releaseYear: "",
			bio: "",
			source: "资料来源",
		},
		tracks: [{ id: "track-default", sequence: 1, title: "Default Track" }],
	},
	tracksCustomized: false,
	titleCustomized: false,
	dirty: false,
	assetUploading: false,
	submitting: false,
	errorMessage: "",
	...overrides,
});

const drawerMocks = {
	state: ref({
		artistId: null as string | null,
		creationFlow: null as MusicCreationFlowState | null,
	}),
	closeMusicCreationFlow: vi.fn(),
	refreshArtist: vi.fn(),
	refreshAlbum: vi.fn(),
	openArtist: vi.fn(),
	openNestedAction: vi.fn(),
	setMusicCreationStep: vi.fn(),
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
};

vi.mock("../../../../src/api/musicV1", async () => {
	const actual = await vi.importActual<
		typeof import("../../../../src/api/musicV1")
	>("../../../../src/api/musicV1");
	return {
		...actual,
		commitMusicAlbumImport: vi.fn(),
		completeMusicAlbumImportSession: vi.fn(),
		createMusicArtist: vi.fn(),
		getMusicArtist: vi.fn(),
		getMusicAlbum: vi.fn(),
		submitArtistRevision: vi.fn(),
		submitAlbumRevision: vi.fn(),
	};
});

vi.mock("@/components/ui/PSheet.vue", () => ({
	default: {
		name: "PSheet",
		props: ["show", "width", "index"],
		template: '<section v-if="show"><slot /></section>',
	},
}));

vi.mock("vue-router", () => ({
	useRouter: () => ({
		push: drawerMocks.routerPush,
		replace: drawerMocks.routerReplace,
	}),
}));

vi.mock("@/components/music/MusicCreationArtistStep.vue", () => ({
	default: {
		name: "MusicCreationArtistStep",
		template: '<section data-testid="artist-step">artist step</section>',
	},
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		state: drawerMocks.state,
		closeMusicCreationFlow: drawerMocks.closeMusicCreationFlow,
		refreshArtist: drawerMocks.refreshArtist,
		refreshAlbum: drawerMocks.refreshAlbum,
		openArtist: drawerMocks.openArtist,
		openNestedAction: drawerMocks.openNestedAction,
		setMusicCreationStep: drawerMocks.setMusicCreationStep,
		isMainShifted: computed(() => false),
		isCreationFlowOpen: computed(
			() => drawerMocks.state.value.creationFlow !== null,
		),
	}),
}));

const commitMusicAlbumImportMock = vi.mocked(
	(
		musicApi as typeof musicApi & {
			commitMusicAlbumImport: ReturnType<typeof vi.fn>;
		}
	).commitMusicAlbumImport,
);
const createMusicArtistMock = vi.mocked(musicApi.createMusicArtist);
const getMusicArtistMock = vi.mocked(musicApi.getMusicArtist);
const getMusicAlbumMock = vi.mocked(musicApi.getMusicAlbum);
const submitArtistRevisionMock = vi.mocked(musicApi.submitArtistRevision);
const submitAlbumRevisionMock = vi.mocked(musicApi.submitAlbumRevision);
const completeMusicAlbumImportSessionMock = vi.mocked(
	musicApi.completeMusicAlbumImportSession,
);

describe("MusicCreationFlowDrawer", () => {
	beforeEach(() => {
		commitMusicAlbumImportMock.mockReset();
		createMusicArtistMock.mockReset();
		getMusicArtistMock.mockReset();
		getMusicAlbumMock.mockReset();
		submitArtistRevisionMock.mockReset();
		submitAlbumRevisionMock.mockReset();
		completeMusicAlbumImportSessionMock.mockReset();
		completeMusicAlbumImportSessionMock.mockResolvedValue({
			importId: "import-1",
			status: "queued",
		} as never);
		drawerMocks.closeMusicCreationFlow.mockReset();
		drawerMocks.closeMusicCreationFlow.mockImplementation(() => {
			drawerMocks.state.value.creationFlow = null;
		});
		drawerMocks.refreshArtist.mockReset();
		drawerMocks.refreshAlbum.mockReset();
		drawerMocks.openArtist.mockReset();
		drawerMocks.openNestedAction.mockReset();
		drawerMocks.setMusicCreationStep.mockReset();
		drawerMocks.routerPush.mockReset();
		drawerMocks.routerReplace.mockReset();
		drawerMocks.routerPush.mockResolvedValue(undefined);
		drawerMocks.routerReplace.mockResolvedValue(undefined);
		drawerMocks.setMusicCreationStep.mockImplementation(
			(step: MusicCreationFlowState["step"]) => {
				if (drawerMocks.state.value.creationFlow) {
					drawerMocks.state.value.creationFlow.step = step;
				}
			},
		);
		drawerMocks.state.value.artistId = null;
		drawerMocks.state.value.creationFlow = createFlowState();
	});

	afterEach(() => {
		drawerMocks.state.value.creationFlow = null;
	});

	it("回填 ready import 的专辑标题和曲目", async () => {
		const wrapper = mount(MusicCreationFlowDrawer);

		drawerMocks.state.value.creationFlow = createFlowState({
			draft: {
				...createFlowState().draft,
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Imported Album",
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					status: "ready",
					derivedAlbumTitle: "Imported Album",
					derivedCover: "https://img.test/cover.jpg",
					derivedTracks: [
						{
							songId: "song-a",
							title: "Track A",
							audioKey: "audio-a",
							origin: "import",
						},
						{
							songId: "song-b",
							title: "Track B",
							audioKey: "audio-b",
							origin: "import",
						},
					],
				},
			},
		});

		await flushPromises();

		const flow = drawerMocks.state.value.creationFlow;
		expect(flow?.draft.albumDetails.title).toBe("Imported Album");
		expect(flow?.draft.albumDetails.coverUrl).toBe(
			"https://img.test/default-cover.jpg",
		);
		expect(flow?.draft.albumImport.derivedCover).toBe(
			"https://img.test/cover.jpg",
		);
		expect(flow?.draft.tracks).toEqual([
			{
				id: "import-track-1",
				songId: "song-a",
				sequence: 1,
				title: "Track A",
				audioKey: "audio-a",
				origin: "import",
			},
			{
				id: "import-track-2",
				songId: "song-b",
				sequence: 2,
				title: "Track B",
				audioKey: "audio-b",
				origin: "import",
			},
		]);

		wrapper.unmount();
	});

	it("创建艺术家后打开已有专辑关联", async () => {
		const baseFlow = createFlowState();
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "artist",
			draft: {
				...baseFlow.draft,
				artist: {
					...baseFlow.draft.artist,
					id: null,
					avatarUrl: "https://img.test/artist.jpg",
					legalName: "Kanye Omari West",
					stageNames: [
						{
							...baseFlow.draft.artist.stageNames[0],
							name: "Ye",
							isPrimary: true,
						},
					],
					nationality: "美国",
					birthPlace: "Atlanta",
					birthDateParts: { year: "1977", month: "06", day: "08" },
					source: "https://example.test/ye",
				},
			},
		});
		createMusicArtistMock.mockResolvedValue({
			id: "artist-created",
			name: "Ye",
		} as never);

		const wrapper = mount(MusicCreationFlowDrawer);
		expect(wrapper.get('[data-testid="artist-next-button"]').text()).toBe(
			"创建新专辑",
		);
		await wrapper
			.get('[data-testid="artist-link-album-button"]')
			.trigger("click");
		await flushPromises();

		expect(createMusicArtistMock).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Ye",
				legal_name: "Kanye Omari West",
				image_url: "https://img.test/artist.jpg",
				nationality: "美国",
				birth_place: "Atlanta",
				birth_date: "1977-06-08",
				artist_form: "person",
				stage_names: [
					expect.objectContaining({ name: "Ye", is_primary: true }),
				],
				members: [],
				sources: [{ type: "url", url: "https://example.test/ye" }],
			}),
		);
		expect(drawerMocks.closeMusicCreationFlow).toHaveBeenCalledTimes(1);
		expect(drawerMocks.openArtist).toHaveBeenCalledWith("artist-created");
		expect(drawerMocks.openNestedAction).toHaveBeenCalledWith("link_album", {
			artistId: "artist-created",
			artistName: "Ye",
		});
		expect(drawerMocks.routerPush).not.toHaveBeenCalled();
	});

	it("创建艺术家失败时保留当前表单", async () => {
		const baseFlow = createFlowState();
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "artist",
			draft: {
				...baseFlow.draft,
				artist: {
					...baseFlow.draft.artist,
					id: null,
					avatarUrl: "https://img.test/artist.jpg",
					legalName: "Test Artist",
					stageNames: [
						{ ...baseFlow.draft.artist.stageNames[0], name: "Test Artist" },
					],
					nationality: "中国",
					birthDateParts: { year: "1990", month: "01", day: "01" },
					source: "https://example.test/artist",
				},
			},
		});
		createMusicArtistMock.mockRejectedValue(
			new Error("创建艺术家失败，请检查资料后重试"),
		);

		const wrapper = mount(MusicCreationFlowDrawer);
		await wrapper.get('[data-testid="artist-next-button"]').trigger("click");
		await flushPromises();

		expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled();
		expect(
			wrapper.get('[data-testid="music-creation-error"]').text(),
		).toContain("创建艺术家失败");
	});

	it("完全未知的出生日期可以满足必填并提交", async () => {
		const baseFlow = createFlowState();
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "artist",
			draft: {
				...baseFlow.draft,
				artist: {
					...baseFlow.draft.artist,
					id: null,
					avatarUrl: "https://img.test/artist.jpg",
					legalName: "Unknown Date Artist",
					stageNames: [
						{
							...baseFlow.draft.artist.stageNames[0],
							name: "Unknown Date Artist",
						},
					],
					nationality: "中国",
					birthDateParts: { year: "----", month: "--", day: "--" },
					source: "https://example.test/artist",
				},
			},
		});
		createMusicArtistMock.mockResolvedValue({
			id: "artist-unknown-date",
			name: "Unknown Date Artist",
		} as never);

		const wrapper = mount(MusicCreationFlowDrawer);
		await wrapper.get('[data-testid="artist-next-button"]').trigger("click");
		await flushPromises();

		expect(createMusicArtistMock).toHaveBeenCalledWith(
			expect.objectContaining({
				birth_date: "----/--/--",
			}),
		);
		expect(drawerMocks.state.value.creationFlow?.step).toBe("albumImport");
		expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled();
		expect(drawerMocks.openArtist).not.toHaveBeenCalled();
		expect(drawerMocks.openNestedAction).not.toHaveBeenCalled();
	});

	it("修改艺术家复用创建表单并提交完整修订", async () => {
		drawerMocks.state.value.creationFlow = createFlowState({
			mode: "edit",
			entity: "artist",
			targetId: "artist-1",
			step: "artist",
		});
		getMusicArtistMock.mockResolvedValue({
			id: "artist-1",
			name: "Jean Grae",
			legal_name: "Tsidi Ibrahim",
			image_url: "https://img.test/jean.jpg",
			nationality: "US",
			birth_date: "1976-11-26",
			birth_date_precision: "day",
			artist_form: "person",
			stage_names_json: '[{"name":"Jean Grae","is_primary":true}]',
			sources: [{ type: "url", url: "https://example.test/jean" }],
			member_groups: { current: [], former: [] },
			entry_status: "open",
		});
		submitArtistRevisionMock.mockResolvedValue({ status: "approved" } as never);

		const wrapper = mount(MusicCreationFlowDrawer);
		await flushPromises();

		expect(
			wrapper.get('[data-testid="music-creation-finish-button"]').text(),
		).toBe("保存");
		expect(drawerMocks.state.value.creationFlow?.draft.artist.source).toBe("");
		if (!drawerMocks.state.value.creationFlow)
			throw new Error("creation flow missing");
		drawerMocks.state.value.creationFlow.draft.artist.source = "修正艺人资料";
		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(submitArtistRevisionMock).toHaveBeenCalledWith(
			"artist-1",
			expect.objectContaining({
				name: "Jean Grae",
				legal_name: "Tsidi Ibrahim",
				artist_form: "person",
				birth_date: "1976-11-26",
			}),
		);
		expect(drawerMocks.refreshArtist).toHaveBeenCalled();
	});

	it("修改专辑无需压缩包即可提交修订", async () => {
		const base = createFlowState();
		drawerMocks.state.value.creationFlow = createFlowState({
			mode: "edit",
			entity: "album",
			targetId: "album-1",
			step: "albumDetails",
			draft: {
				...base.draft,
				albumImport: {
					...base.draft.albumImport,
					importId: null,
					archiveName: "",
				},
			},
		});
		getMusicAlbumMock.mockResolvedValue({
			id: "album-1",
			title: "Attack of the Attacking Things",
			cover_url: "https://img.test/album.jpg",
			release_date: "2002-01-01",
			release_date_precision: "day",
			album_type: "album",
			description: "Album bio",
			sources: [{ type: "url", url: "https://example.test/album" }],
			artists: [{ id: "artist-1", name: "Jean Grae" }],
			songs: [
				{
					id: "song-1",
					title: "Track One",
					track_number: 1,
					status: "open",
					artist_credits: [],
				},
			],
		} as never);
		submitAlbumRevisionMock.mockResolvedValue({ status: "approved" } as never);

		const wrapper = mount(MusicCreationFlowDrawer);
		await flushPromises();

		expect(
			wrapper.get('[data-testid="music-creation-finish-button"]').text(),
		).toBe("保存");
		expect(
			drawerMocks.state.value.creationFlow?.draft.albumDetails.source,
		).toBe("");
		if (!drawerMocks.state.value.creationFlow)
			throw new Error("creation flow missing");
		drawerMocks.state.value.creationFlow.draft.albumDetails.source =
			"修正专辑资料";
		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(submitAlbumRevisionMock).toHaveBeenCalledWith(
			"album-1",
			expect.objectContaining({
				title: "Attack of the Attacking Things",
				release_date: "2002-01-01",
			}),
		);
		expect(drawerMocks.refreshAlbum).toHaveBeenCalled();
	});

	it("预览步骤点击提交后只调用一次 commitMusicAlbumImport", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...createFlowState().draft,
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Imported Album",
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);

		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledTimes(1);
		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				artist_id: "artist-seeded",
				artist: expect.objectContaining({
					name: "Seeded Artist",
					legal_name: "Seeded Artist",
					bio: "",
					nationality: "",
					birth_date: "",
					stage_names: [],
					birth_place: "",
				}),
				artists: [
					expect.objectContaining({
						artist_id: "artist-seeded",
						name: "Seeded Artist",
						legal_name: "",
						bio: "",
						stage_names: [],
						birth_place: "",
						nationality: "",
						birth_date: "",
						artist_form: "person",
						active_start_date: "",
						active_end_date: "",
						members: [],
					}),
				],
				artist_source: "",
				album: expect.objectContaining({
					title: "Imported Album",
					description: "",
					album_type: "album",
					release_year: 2020,
					tracks: [{ title: "Default Track", disc_number: 1, track_number: 1 }],
				}),
				album_source: "资料来源",
			}),
		);
		expect(drawerMocks.closeMusicCreationFlow).toHaveBeenCalledTimes(1);
		expect(drawerMocks.state.value.creationFlow).toBeNull();
	});

	it("提交新艺术家时按后端协议发送阶段名字段", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		const baseFlow = createFlowState();
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...baseFlow.draft,
				artist: {
					...baseFlow.draft.artist,
					id: null,
					legalName: "宋冬野",
					stageNames: [
						{
							...baseFlow.draft.artist.stageNames[0],
							name: "宋冬野",
							isPrimary: true,
							startDateText: "2010",
							endDateText: "2026",
						},
					],
				},
				albumImport: {
					...baseFlow.draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
				albumDetails: {
					...baseFlow.draft.albumDetails,
					title: "再想想",
					contributors: [
						{
							...baseFlow.draft.albumDetails.contributors[0],
							artistId: null,
							name: "宋冬野",
						},
					],
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);
		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				artist: expect.objectContaining({
					stage_names: [
						{
							name: "宋冬野",
							is_primary: true,
							start_date_text: "2010",
							end_date_text: "2026",
						},
					],
				}),
				artists: [
					expect.objectContaining({
						name: "宋冬野",
						stage_names: [
							{
								name: "宋冬野",
								is_primary: true,
								start_date_text: "2010",
								end_date_text: "2026",
							},
						],
					}),
				],
				album: expect.objectContaining({ title: "再想想" }),
			}),
		);
		wrapper.unmount();
	});

	it("提交成功后跳转到已有艺术家的详情页", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			targetAlbumId: "album-1",
			status: "committed",
		});
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...createFlowState().draft,
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Imported Album",
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					status: "ready",
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);
		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(drawerMocks.routerPush).toHaveBeenCalledWith("/music/album/album-1");
	});

	it("提交时携带已上传的艺人头像和专辑封面", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		const base = createFlowState();
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...base.draft,
				artist: {
					...base.draft.artist,
					id: null,
					avatarUrl:
						"https://assets.atoman.test/music/covers/uploads/avatar.webp",
					legalName: "Kanye Omari West",
					stageNames: [
						{
							...base.draft.artist.stageNames[0],
							name: "Ye",
						},
					],
				},
				albumImport: {
					...base.draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
				albumDetails: {
					...base.draft.albumDetails,
					title: "The College Dropout",
					coverUrl:
						"https://assets.atoman.test/music/covers/uploads/cover.webp",
					contributors: [
						{
							id: "contributor-new",
							artistId: null,
							name: "Ye",
							avatarUrl:
								"https://assets.atoman.test/music/covers/uploads/avatar.webp",
							kind: "person",
							locked: true,
							roles: [{ id: "role-primary", role: "primary", label: "" }],
						},
					],
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);
		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				artist: expect.objectContaining({
					image_url:
						"https://assets.atoman.test/music/covers/uploads/avatar.webp",
				}),
				artists: [
					expect.objectContaining({
						image_url:
							"https://assets.atoman.test/music/covers/uploads/avatar.webp",
					}),
				],
				album: expect.objectContaining({
					cover_url:
						"https://assets.atoman.test/music/covers/uploads/cover.webp",
				}),
			}),
		);
	});

	it("详情完成后进入独立预览步骤，预览展示导入结果并提交", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "albumDetails",
			draft: {
				...createFlowState().draft,
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Preview Album",
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "ready",
					coverUrl: "https://img.test/cover.jpg",
					metadataSourceUrl: "https://musicbrainz.org/release/release-id",
					derivedTracks: [
						{ title: "Preview Track", audioKey: "audio-1", origin: "import" },
					],
					files: [
						{
							fileId: "file-failed",
							relativePath: "broken.mp3",
							fileName: "broken.mp3",
							role: "audio",
							detectedFormat: "mp3",
							size: 1,
							uploadStatus: "failed",
							processingStatus: "failed",
							discNumber: 1,
							trackNumber: 1,
							title: "",
							errorMessage: "上传失败",
						},
					],
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);
		await wrapper.get('[data-testid="artist-next-button"]').trigger("click");
		await flushPromises();

		expect(drawerMocks.state.value.creationFlow?.step).toBe("preview");
		expect(
			wrapper.get('[data-testid="album-import-preview-step"]').text(),
		).toContain("Preview Track");
		expect(
			wrapper
				.get('[data-testid="album-import-metadata-source"] a')
				.attributes("href"),
		).toBe("https://musicbrainz.org/release/release-id");
		expect(wrapper.get('img[alt="专辑封面预览"]').attributes("src")).toBe(
			"https://img.test/default-cover.jpg",
		);
		expect(wrapper.text()).toContain("broken.mp3");

		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();
		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.any(Object),
		);
	});

	it("导入在处理中时仍可从详情进入预览", async () => {
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "albumDetails",
			draft: {
				...createFlowState().draft,
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Still Processing",
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "extracting",
					stage: "extracting",
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);
		const nextButton = wrapper.get('[data-testid="artist-next-button"]');

		expect(nextButton.attributes("disabled")).toBeUndefined();
		expect(nextButton.text()).toBe("继续");
		await nextButton.trigger("click");

		expect(drawerMocks.state.value.creationFlow?.step).toBe("preview");
	});

	it.each([
		["uploading", [{ fileId: "file-1", uploadStatus: "uploading" }]],
		["extracting", []],
	] as const)(
		"%s 状态可提前提交且不重复完成上传会话",
		async (status, files) => {
			commitMusicAlbumImportMock.mockResolvedValue({
				importId: "import-1",
				status,
				files,
			});
			drawerMocks.state.value.creationFlow = createFlowState({
				step: "preview",
				draft: {
					...createFlowState().draft,
					albumDetails: {
						...createFlowState().draft.albumDetails,
						title: "Background Upload Album",
					},
					albumImport: {
						...createFlowState().draft.albumImport,
						importId: "import-1",
						status,
					},
				},
			});

			const wrapper = mount(MusicCreationFlowDrawer);
			const finishButton = wrapper.get(
				'[data-testid="music-creation-finish-button"]',
			);
			expect(finishButton.attributes("disabled")).toBeUndefined();

			await finishButton.trigger("click");
			await flushPromises();

			expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
				"import-1",
				expect.any(Object),
			);
			expect(completeMusicAlbumImportSessionMock).not.toHaveBeenCalled();
			expect(drawerMocks.closeMusicCreationFlow).toHaveBeenCalled();
			expect(drawerMocks.routerPush).toHaveBeenCalledWith("/music/imports");
		},
	);

	it("提前提交时所有文件已上传则立即完成上传会话", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "uploading",
			files: [{ fileId: "file-1", uploadStatus: "uploaded" }],
		});
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...createFlowState().draft,
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Uploaded Album",
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "uploading",
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);
		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(completeMusicAlbumImportSessionMock).toHaveBeenCalledTimes(1);
		expect(completeMusicAlbumImportSessionMock).toHaveBeenCalledWith(
			"import-1",
		);
		expect(drawerMocks.routerPush).toHaveBeenCalledWith("/music/imports");
	});

	it("从已有艺术家进入时提交 artist_id 复用现有艺术家", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...createFlowState().draft,
				artist: {
					...createFlowState().draft.artist,
					id: "artist-existing",
					legalName: "",
					stageNames: [
						{
							id: "stage-name-primary",
							name: "",
							isPrimary: true,
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
							startDateText: "",
							endDateText: "",
						},
					],
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Graduation",
					releaseDateParts: {
						year: "2007",
						month: "",
						day: "",
					},
					releaseYear: "",
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);

		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				artist_id: "artist-existing",
				artist: expect.objectContaining({
					name: "",
					legal_name: "",
					bio: "",
					nationality: "",
					birth_date: "",
					stage_names: [],
					birth_place: "",
				}),
				artists: [
					expect.objectContaining({
						artist_id: "artist-existing",
						name: "Seeded Artist",
						legal_name: "",
						bio: "",
						stage_names: [],
						birth_place: "",
						nationality: "",
						birth_date: "",
						artist_form: "person",
						active_start_date: "",
						active_end_date: "",
						members: [],
					}),
				],
				artist_source: "",
				album: expect.objectContaining({
					title: "Graduation",
					description: "",
					album_type: "album",
					release_year: 2007,
					tracks: [{ title: "Default Track", disc_number: 1, track_number: 1 }],
				}),
				album_source: "资料来源",
			}),
		);
	});

	it("填写发行日期时会同时提交 release_date 和推导后的 release_year", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...createFlowState().draft,
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Late Registration",
					releaseDateParts: {
						year: "2005",
						month: "08",
						day: "30",
					},
					releaseDate: "1999-01-01",
					releaseYear: "1999",
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);

		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				artist_id: "artist-seeded",
				artist: expect.objectContaining({
					name: "Seeded Artist",
					legal_name: "Seeded Artist",
					bio: "",
					nationality: "",
					birth_date: "",
					stage_names: [],
					birth_place: "",
				}),
				artists: [
					expect.objectContaining({
						artist_id: "artist-seeded",
						name: "Seeded Artist",
						legal_name: "",
						bio: "",
						stage_names: [],
						birth_place: "",
						nationality: "",
						birth_date: "",
						artist_form: "person",
						active_start_date: "",
						active_end_date: "",
						members: [],
					}),
				],
				artist_source: "",
				album: expect.objectContaining({
					title: "Late Registration",
					description: "",
					album_type: "album",
					release_date: "2005-08-30",
					release_year: 2005,
					tracks: [{ title: "Default Track", disc_number: 1, track_number: 1 }],
				}),
				album_source: "资料来源",
			}),
		);
	});

	it("提交时保留艺术家和专辑的补充信息", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		const base = createFlowState();
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...base.draft,
				artist: {
					...base.draft.artist,
					id: null,
					legalName: "Tahliah Debrett Barnett",
					nationality: "英国",
					birthDateParts: { year: "1988", month: "01", day: "16" },
					bio: "英国歌手",
					source: "https://example.com/artist",
					stageNames: [
						{ ...base.draft.artist.stageNames[0], name: "FKA twigs" },
					],
				},
				albumImport: {
					...base.draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
				albumDetails: {
					...base.draft.albumDetails,
					title: "LP1",
					type: "ep",
					bio: "首张录音室专辑",
					source: "https://example.com/album",
					contributors: [
						{
							id: "new-artist",
							artistId: null,
							name: "FKA twigs",
							avatarUrl: "",
							kind: "person",
							locked: true,
							roles: [{ id: "role-primary", role: "primary", label: "" }],
						},
					],
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);
		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				artist: expect.objectContaining({
					bio: "英国歌手",
					nationality: "英国",
					birth_date: "1988-01-16",
				}),
				artists: [
					expect.objectContaining({
						bio: "英国歌手",
						nationality: "英国",
						birth_date: "1988-01-16",
					}),
				],
				artist_source: "https://example.com/artist",
				album: expect.objectContaining({
					description: "首张录音室专辑",
					album_type: "ep",
				}),
				album_source: "https://example.com/album",
			}),
		);
	});

	it("提交时按当前曲目顺序重新生成连续 track_number", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...createFlowState().draft,
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Dragged Album",
				},
				tracks: [
					{ id: "track-9", songId: "song-outro", sequence: 9, title: "Outro" },
					{ id: "track-3", songId: "song-intro", sequence: 3, title: "Intro" },
					{
						id: "track-5",
						songId: "song-middle",
						sequence: 5,
						title: "Middle",
					},
				],
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);

		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				artists: [
					expect.objectContaining({
						artist_id: "artist-seeded",
					}),
				],
				album: expect.objectContaining({
					title: "Dragged Album",
					tracks: [
						{
							song_id: "song-outro",
							title: "Outro",
							disc_number: 1,
							track_number: 1,
						},
						{
							song_id: "song-intro",
							title: "Intro",
							disc_number: 1,
							track_number: 2,
						},
						{
							song_id: "song-middle",
							title: "Middle",
							disc_number: 1,
							track_number: 3,
						},
					],
				}),
			}),
		);
	});

	it("提交流里会带上多个创作者，并保留锁定的新艺人", async () => {
		commitMusicAlbumImportMock.mockResolvedValue({
			importId: "import-1",
			status: "committed",
		});
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...createFlowState().draft,
				artist: {
					...createFlowState().draft.artist,
					id: null,
					kind: "group",
					legalName: "",
					stageNames: [
						{
							...createFlowState().draft.artist.stageNames[0],
							name: "Sweet Trip",
						},
					],
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "You Will Never Know Why",
					contributors: [
						{
							id: "contributor-new-artist",
							artistId: null,
							name: "Sweet Trip",
							avatarUrl: "",
							kind: "group",
							locked: true,
							roles: [{ id: "role-primary", role: "primary", label: "" }],
						},
						{
							id: "contributor-artist-2",
							artistId: "artist-2",
							name: "Roby Burgos",
							avatarUrl: "",
							kind: "person",
							locked: false,
							roles: [{ id: "role-featured", role: "featured", label: "" }],
						},
					],
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);

		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({
				artists: [
					expect.objectContaining({
						artist_id: "",
						name: "Sweet Trip",
						artist_form: "group",
					}),
					expect.objectContaining({
						artist_id: "artist-2",
						name: "Roby Burgos",
					}),
				],
			}),
		);
	});

	it("ready import 不会覆盖已经手动调整过的曲目", async () => {
		const wrapper = mount(MusicCreationFlowDrawer);

		drawerMocks.state.value.creationFlow = createFlowState({
			tracksCustomized: true,
			draft: {
				...createFlowState().draft,
				tracks: [
					{ id: "manual-1", sequence: 1, title: "Manual Intro" },
					{ id: "manual-2", sequence: 2, title: "Manual Outro" },
				],
				albumImport: {
					...createFlowState().draft.albumImport,
					status: "ready",
					derivedAlbumTitle: "Imported Album",
					derivedCover: "https://img.test/cover.jpg",
					derivedTracks: [
						{ title: "Imported A", audioKey: "audio-a", origin: "import" },
						{ title: "Imported B", audioKey: "audio-b", origin: "import" },
					],
				},
			},
		});

		await flushPromises();

		const flow = drawerMocks.state.value.creationFlow;
		expect(flow?.draft.albumDetails.title).toBe("Imported Album");
		expect(flow?.draft.albumDetails.coverUrl).toBe(
			"https://img.test/default-cover.jpg",
		);
		expect(flow?.draft.albumImport.derivedCover).toBe(
			"https://img.test/cover.jpg",
		);
		expect(flow?.draft.tracks).toEqual([
			{ id: "manual-1", sequence: 1, title: "Manual Intro" },
			{ id: "manual-2", sequence: 2, title: "Manual Outro" },
		]);

		wrapper.unmount();
	});

	it("仅填写新的生日分段字段时，关闭前仍会视为有未保存内容", async () => {
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "artist",
			draft: {
				...createFlowState().draft,
				albumImport: {
					...createFlowState().draft.albumImport,
					archiveName: "",
				},
				artist: {
					...createFlowState().draft.artist,
					legalName: "",
					stageNames: [
						{
							...createFlowState().draft.artist.stageNames[0],
							name: "",
						},
					],
					birthDateParts: {
						year: "2001",
						month: "06",
						day: "08",
					},
					birthDate: "",
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);

		await wrapper
			.get('[data-testid="music-creation-close-button"]')
			.trigger("click");

		const confirm = wrapper.getComponent({ name: "PConfirm" });
		expect(confirm.props("show")).toBe(true);
		expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled();

		confirm.vm.$emit("cancel");
		await flushPromises();
		expect(confirm.props("show")).toBe(false);
		expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled();
	});

	it("提交失败时保留抽屉并显示错误", async () => {
		commitMusicAlbumImportMock.mockRejectedValue(new Error("commit failed"));
		drawerMocks.state.value.creationFlow = createFlowState({
			step: "preview",
			draft: {
				...createFlowState().draft,
				albumDetails: {
					...createFlowState().draft.albumDetails,
					title: "Failure Album",
				},
				albumImport: {
					...createFlowState().draft.albumImport,
					importId: "import-1",
					status: "ready",
				},
			},
		});

		const wrapper = mount(MusicCreationFlowDrawer);

		await wrapper
			.get('[data-testid="music-creation-finish-button"]')
			.trigger("click");
		await flushPromises();

		expect(commitMusicAlbumImportMock).toHaveBeenCalledTimes(1);
		expect(drawerMocks.closeMusicCreationFlow).not.toHaveBeenCalled();
		expect(drawerMocks.state.value.creationFlow).not.toBeNull();
		expect(
			wrapper.get('[data-testid="music-creation-error"]').text(),
		).toContain("commit failed");
	});
});
