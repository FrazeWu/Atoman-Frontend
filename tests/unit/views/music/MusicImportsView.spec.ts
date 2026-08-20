import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error Vue SFC modules are resolved by the Vitest Vite plugin.
import ImportsView from "@/views/music/ImportsView.vue";

const mocks = vi.hoisted(() => ({
	listMusicAlbumImports: vi.fn(),
	getMusicAlbum: vi.fn(),
	getMusicArtist: vi.fn(),
	resumeMusicCreationFlow: vi.fn(),
}));

vi.mock("@/api/musicV1", () => ({
	listMusicAlbumImports: mocks.listMusicAlbumImports,
	cancelMusicAlbumImportSession: vi.fn(),
	deleteMusicAlbumImportRecord: vi.fn(),
	deleteMusicAlbumImportFile: vi.fn(),
	getMusicAlbum: mocks.getMusicAlbum,
	getMusicArtist: mocks.getMusicArtist,
	repairMusicAlbumImport: vi.fn(),
	replaceAndUploadMusicAlbumImportFile: vi.fn(),
	retryMusicAlbumImportFile: vi.fn(),
}));

vi.mock("@/composables/useMusicDrawers", () => ({
	useMusicDrawers: () => ({
		resumeMusicCreationFlow: mocks.resumeMusicCreationFlow,
	}),
}));

function importRecord(
	status:
		| "pending_upload"
		| "uploaded"
		| "extracting"
		| "ready"
		| "needs_attention",
	importId = "import-1",
) {
	return {
		importId,
		targetAlbumId: "",
		albumTitle: "Album",
		status,
		archiveName: "album.zip",
		uploadProgress: 100,
		uploadSpeed: 0,
		coverUrl: "",
		coverKey: "",
		derivedAlbumTitle: "Album",
		derivedCover: "",
		derivedTracks: [],
		lastSyncedAt: "",
		errorMessage: "",
		inputMode: "archive",
		stage: status === "needs_attention" ? "ready" : "processing",
		progress: {},
		files: [],
		errors: [],
	};
}

function response(
	status:
		| "pending_upload"
		| "uploaded"
		| "extracting"
		| "ready"
		| "needs_attention",
) {
	return {
		data: [importRecord(status)],
		meta: { page: 1, page_size: 50, total: 1, has_more: false },
	};
}

describe("Music ImportsView", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mocks.listMusicAlbumImports.mockReset();
		mocks.getMusicAlbum.mockReset();
		mocks.getMusicArtist.mockReset();
		mocks.resumeMusicCreationFlow.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("opens an import before its artist source lookup finishes", async () => {
		const pendingImport = {
			...importRecord("pending_upload"),
			artistId: "artist-1",
		};
		mocks.listMusicAlbumImports.mockResolvedValue({
			data: [pendingImport],
			meta: { page: 1, page_size: 50, total: 1, has_more: false },
		});
		mocks.resumeMusicCreationFlow.mockReturnValue({
			draft: {
				artist: { source: "" },
				albumDetails: { contributors: [] },
			},
		});
		mocks.getMusicArtist.mockReturnValue(new Promise(() => {}));
		const wrapper = mount(ImportsView);
		await flushPromises();

		const continueButton = wrapper
			.findAll("button")
			.find((button) => button.text() === "继续导入");
		expect(continueButton).toBeDefined();
		await continueButton!.trigger("click");

		expect(mocks.resumeMusicCreationFlow).toHaveBeenCalledWith(pendingImport);
		expect(mocks.getMusicArtist).toHaveBeenCalledWith("artist-1");
		wrapper.unmount();
	});

	it("uses the saved draft without loading album or artist details again", async () => {
		const savedImport = {
			...importRecord("ready"),
			targetAlbumId: "album-1",
			artistId: "artist-1",
			commitRequest: {
				artist: {
					legal_name: "Artist",
					stage_names: [],
					nationality: "",
					birth_date: "",
					birth_place: "",
				},
				album: { release_year: 0, tracks: [] },
			},
		};
		mocks.listMusicAlbumImports.mockResolvedValue({
			data: [savedImport],
			meta: { page: 1, page_size: 50, total: 1, has_more: false },
		});
		const wrapper = mount(ImportsView);
		await flushPromises();

		const continueButton = wrapper
			.findAll("button")
			.find((button) => button.text() === "继续导入");
		expect(continueButton).toBeDefined();
		await continueButton!.trigger("click");

		expect(mocks.resumeMusicCreationFlow).toHaveBeenCalledWith(savedImport);
		expect(mocks.getMusicAlbum).not.toHaveBeenCalled();
		expect(mocks.getMusicArtist).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it("describes empty tracks as recognition in progress while processing", async () => {
		mocks.listMusicAlbumImports.mockResolvedValue(response("extracting"));
		const wrapper = mount(ImportsView);
		await flushPromises();

		expect(wrapper.text()).toContain("正在识别曲目");
		expect(wrapper.text()).not.toContain("未识别到曲目");
		wrapper.unmount();
	});

	it("reports no recognized tracks after processing finishes", async () => {
		mocks.listMusicAlbumImports.mockResolvedValue(response("ready"));
		const wrapper = mount(ImportsView);
		await flushPromises();

		expect(wrapper.text()).toContain("未识别到曲目");
		expect(wrapper.text()).not.toContain("正在识别曲目");
		wrapper.unmount();
	});

	it("does not poll while waiting for the user to upload files", async () => {
		mocks.listMusicAlbumImports.mockResolvedValue(response("pending_upload"));
		const wrapper = mount(ImportsView);
		await flushPromises();

		await vi.advanceTimersByTimeAsync(3_000);
		expect(mocks.listMusicAlbumImports).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it("continues polling after a transient error and stops when the import is ready", async () => {
		mocks.listMusicAlbumImports
			.mockResolvedValueOnce(response("uploaded"))
			.mockRejectedValueOnce(new Error("temporary"))
			.mockResolvedValueOnce(response("ready"));
		const wrapper = mount(ImportsView);
		await flushPromises();

		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();
		expect(mocks.listMusicAlbumImports).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();
		expect(mocks.listMusicAlbumImports).toHaveBeenCalledTimes(3);

		await vi.advanceTimersByTimeAsync(3_000);
		expect(mocks.listMusicAlbumImports).toHaveBeenCalledTimes(3);
		wrapper.unmount();
	});

	it("replaces the current page when pagination changes and polling refreshes it", async () => {
		mocks.listMusicAlbumImports
			.mockResolvedValueOnce({
				data: [importRecord("uploaded", "import-1")],
				meta: { page: 1, page_size: 50, total: 51, has_more: true },
			})
			.mockResolvedValueOnce({
				data: [importRecord("uploaded", "import-2")],
				meta: { page: 2, page_size: 50, total: 51, has_more: true },
			})
			.mockResolvedValueOnce({
				data: [importRecord("ready", "import-2")],
				meta: { page: 2, page_size: 50, total: 51, has_more: true },
			});

		const wrapper = mount(ImportsView);
		await flushPromises();
		const nextPageButton = wrapper
			.findAll("button")
			.find((button) => button.attributes("title") === "下一页");
		expect(nextPageButton).toBeDefined();
		await nextPageButton!.trigger("click");
		await flushPromises();

		expect(wrapper.findAll(".music-imports-view__item")).toHaveLength(1);
		expect(mocks.listMusicAlbumImports).toHaveBeenLastCalledWith({
			page: 2,
			page_size: 50,
		});

		await vi.advanceTimersByTimeAsync(3_000);
		await flushPromises();
		expect(mocks.listMusicAlbumImports).toHaveBeenLastCalledWith({
			page: 2,
			page_size: 50,
		});
		wrapper.unmount();
	});

	it("opens the details action instead of file retry for a ready validation failure", async () => {
		const readyError = {
			...importRecord("needs_attention", "import-ready-error"),
			errorMessage: "at least one source is required",
		};
		mocks.listMusicAlbumImports.mockResolvedValue({
			data: [readyError],
			meta: { page: 1, page_size: 50, total: 1, has_more: false },
		});
		const wrapper = mount(ImportsView);
		await flushPromises();
		const attentionTab = wrapper
			.findAll("button")
			.find((button) => button.text().startsWith("需处理"));
		await attentionTab!.trigger("click");
		await flushPromises();

		expect(wrapper.text()).toContain(
			"媒体处理已完成，请补充艺术家和专辑资料后提交。",
		);
		expect(wrapper.text()).toContain("请填写艺术家和专辑资料来源");
		expect(wrapper.text()).not.toContain("一键重试失败文件");
		wrapper.unmount();
	});
});
