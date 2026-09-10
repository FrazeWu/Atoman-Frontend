import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
// @ts-expect-error Vue SFC declarations are unavailable to the standalone TypeScript server.
import MusicCreationAlbumSeedStep from "../../../../src/components/music/MusicCreationAlbumSeedStep.vue";
// @ts-expect-error Vue SFC declarations are unavailable to the standalone TypeScript server.
import MusicCreationAlbumDetailsStep from "../../../../src/components/music/MusicCreationAlbumDetailsStep.vue";
// @ts-expect-error Vue SFC declarations are unavailable to the standalone TypeScript server.
import MusicCreationAlbumUploadZone from "../../../../src/components/music/MusicCreationAlbumUploadZone.vue";
import * as musicApi from "../../../../src/api/musicV1";
import * as musicImportPreview from "../../../../src/utils/musicImportPreview";
import { useMusicDrawers } from "../../../../src/composables/useMusicDrawers";
import { useAlbumImportUpload } from "../../../../src/composables/useAlbumImportUpload";

function snapshot(
	overrides: Partial<musicApi.MusicAlbumImport> = {},
): musicApi.MusicAlbumImport {
	return {
		importId: "import-1",
		targetAlbumId: "",
		status: "pending_upload",
		archiveName: "",
		uploadProgress: 0,
		uploadSpeed: 0,
		coverUrl: "",
		coverKey: "",
		derivedAlbumTitle: "",
		derivedCover: "",
		derivedTracks: [],
		lastSyncedAt: "",
		errorMessage: "",
		inputMode: "files",
		stage: "upload",
		progress: { current: 0, total: 0 },
		files: [],
		errors: [],
		...overrides,
	};
}

function importFile(
	overrides: Partial<musicApi.MusicAlbumImportFile> = {},
): musicApi.MusicAlbumImportFile {
	return {
		fileId: "file-1",
		relativePath: "album.mp3",
		fileName: "album.mp3",
		role: "audio",
		detectedFormat: "mp3",
		size: 1,
		uploadStatus: "pending",
		processingStatus: "pending",
		discNumber: 1,
		trackNumber: 1,
		title: "",
		errorMessage: "",
		...overrides,
	};
}

function fileInput(wrapper: ReturnType<typeof mount>) {
	return wrapper.get('[data-testid="album-import-files-input"]');
}

function setFiles(input: HTMLInputElement, files: File[]) {
	Object.defineProperty(input, "files", { configurable: true, value: files });
}

function mockUploadTransport() {
	vi.spyOn(musicApi, "createMusicAlbumImportFilePartUpload").mockResolvedValue({
		partNumber: 1,
		uploadUrl: "https://upload.test/part-1",
	});
	vi
		.spyOn(musicApi, "uploadMusicAlbumImportFilePart")
		.mockImplementation(async (_uploadUrl, body, options = {}) => {
			options.onProgress?.({ loaded: body.size, total: body.size });
			return "etag-1";
		});
	vi
		.spyOn(musicApi, "completeMusicAlbumImportFilePart")
		.mockResolvedValue(importFile());
	vi
		.spyOn(musicApi, "completeMusicAlbumImportFile")
		.mockResolvedValue(importFile());
}

describe("MusicCreationAlbumImportStep.vue", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		useAlbumImportUpload().stopPolling();
		const drawers = useMusicDrawers();
		drawers.closeAll();
		drawers.openMusicCreationFlow({
			artistId: "artist-seeded",
			startStep: "albumImport",
		});
		drawers.setMusicCreationStep("albumImport");
	});

	afterEach(() => {
		useAlbumImportUpload().stopPolling();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("上传页只显示上传与处理状态，不提前显示专辑表单", () => {
		const wrapper = mount(MusicCreationAlbumSeedStep);

		expect(wrapper.get('[data-testid="album-import-upload-page"]').exists()).toBe(
			true,
		);
		expect(wrapper.find('[data-testid="album-details-title-input"]').exists()).toBe(
			false,
		);
		expect(wrapper.find('[data-testid="album-import-track-title-input"]').exists()).toBe(
			false,
		);
	});

	it("allows selecting video files as album tracks", () => {
		const wrapper = mount(MusicCreationAlbumUploadZone);

		expect(fileInput(wrapper).attributes("accept")).toContain(".mp4");
		expect(fileInput(wrapper).attributes("accept")).toContain(".mkv");
	});

	it("上传页显示独立的上传与元信息匹配进度", () => {
		const wrapper = mount(MusicCreationAlbumSeedStep);

		expect(wrapper.get('[data-testid="album-import-parallel-progress"]').text()).toContain(
			"元信息匹配",
		);
		expect(wrapper.get('[data-testid="album-import-parallel-progress"]').text()).toContain(
			"上传文件",
		);
	});

	it("本地预览匹配成功后按匹配曲序显示曲目", async () => {
		const archive = new File(["zip"], "IGOR.zip", { type: "application/zip" });
		vi.spyOn(musicImportPreview, "readAlbumImportPreview").mockResolvedValue({
			title: "IGOR",
			tracks: ["EARFQUAKE", "IGOR'S THEME"],
		});
		vi.spyOn(musicApi, "previewMusicAlbumImportMetadata").mockResolvedValue({
			matched: true,
			sourceUrl: "https://musicbrainz.org/release/igor-release",
			tracks: [
				{ title: "IGOR'S THEME", audioKey: "", origin: "local_preview:2", trackNumber: 1 },
				{ title: "EARFQUAKE", audioKey: "", origin: "local_preview:1", trackNumber: 2 },
			],
		});
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(snapshot({ inputMode: "archive" }));
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(snapshot({
			inputMode: "archive",
			files: [importFile({ role: "archive", fileName: archive.name, relativePath: archive.name, detectedFormat: "zip" })],
		}));
		mockUploadTransport();
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(snapshot({ status: "queued", inputMode: "archive" }));

		const files = { 0: archive, length: 1, item: () => archive } as unknown as FileList;
		await useAlbumImportUpload().handleFilesUpload(files);
		await vi.waitFor(() => {
			expect(musicApi.previewMusicAlbumImportMetadata).toHaveBeenCalledWith({
				albumTitle: "IGOR",
				artist: "",
				trackTitles: ["EARFQUAKE", "IGOR'S THEME"],
			});
		});

		const flow = useMusicDrawers().state.value.creationFlow!;
		expect(flow.draft.albumImport.metadataMatched).toBe(true);
		expect(flow.draft.tracks.map((track) => track.title)).toEqual(["IGOR'S THEME", "EARFQUAKE"]);
		expect(flow.draft.tracks.map((track) => track.sequence)).toEqual([1, 2]);
	});

	it("直接创建专辑上传后先填写艺术家，不使用空艺术家名匹配", async () => {
		const drawers = useMusicDrawers();
		drawers.closeAll();
		drawers.openMusicCreationFlow({
			startStep: "albumImport",
			artistBeforeMatch: true,
		});
		const archive = new File(["zip"], "IGOR.zip", { type: "application/zip" });
		vi.spyOn(musicImportPreview, "readAlbumImportPreview").mockResolvedValue({
			title: "IGOR",
			tracks: ["EARFQUAKE", "IGOR'S THEME"],
		});
		const metadataPreview = vi.spyOn(musicApi, "previewMusicAlbumImportMetadata");
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(snapshot({ inputMode: "archive" }));
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(snapshot({
			inputMode: "archive",
			files: [importFile({ role: "archive", fileName: archive.name, relativePath: archive.name, detectedFormat: "zip", uploadStatus: "uploaded" })],
		}));
		mockUploadTransport();
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(snapshot({
			status: "uploaded",
			inputMode: "archive",
			archiveName: archive.name,
			files: [importFile({ role: "archive", fileName: archive.name, relativePath: archive.name, detectedFormat: "zip", uploadStatus: "uploaded" })],
		}));

		await useAlbumImportUpload().handleFilesUpload(
			{ 0: archive, length: 1, item: () => archive } as unknown as FileList,
		);

		const flow = drawers.state.value.creationFlow!;
		expect(flow.step).toBe("artist");
		expect(flow.draft.tracks.map((track) => track.title)).toEqual([
			"EARFQUAKE",
			"IGOR'S THEME",
		]);
		expect(metadataPreview).not.toHaveBeenCalled();
	});

	it("元信息匹配完成后立即进入表单，不等待音频上传结束", async () => {
		const archive = new File(["zip"], "IGOR.zip", { type: "application/zip" });
		vi.spyOn(musicImportPreview, "readAlbumImportPreview").mockResolvedValue({
			title: "IGOR",
			tracks: ["EARFQUAKE"],
		});
		let resolveMetadata!: (value: Awaited<ReturnType<typeof musicApi.previewMusicAlbumImportMetadata>>) => void;
		vi.spyOn(musicApi, "previewMusicAlbumImportMetadata").mockReturnValue(
			new Promise((resolve) => {
				resolveMetadata = resolve;
			}),
		);
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(snapshot({ inputMode: "archive" }));
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(snapshot({
			inputMode: "archive",
			files: [importFile({ role: "archive", fileName: archive.name, relativePath: archive.name, detectedFormat: "zip" })],
		}));
		vi.spyOn(musicApi, "createMusicAlbumImportFilePartUpload").mockResolvedValue({
			partNumber: 1,
			uploadUrl: "https://upload.test/part-1",
		});
		let resolveUpload!: (etag: string) => void;
		vi.spyOn(musicApi, "uploadMusicAlbumImportFilePart").mockReturnValue(
			new Promise((resolve) => {
				resolveUpload = resolve;
			}),
		);
		vi.spyOn(musicApi, "completeMusicAlbumImportFilePart").mockResolvedValue(importFile());
		vi.spyOn(musicApi, "completeMusicAlbumImportFile").mockResolvedValue(importFile());
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(
			snapshot({ status: "queued", inputMode: "archive" }),
		);

		const uploadPromise = useAlbumImportUpload().handleFilesUpload(
			{ 0: archive, length: 1, item: () => archive } as unknown as FileList,
		);
		const flow = useMusicDrawers().state.value.creationFlow!;
		await vi.waitFor(() => expect(musicApi.createMusicAlbumImport).toHaveBeenCalled());
		expect(flow.step).toBe("albumImport");

		resolveMetadata({
			matched: true,
			sourceUrl: "https://discogs.com/master/igor",
			tracks: [{ title: "EARFQUAKE", audioKey: "", origin: "local_preview:1", trackNumber: 1 }],
		});
		await vi.waitFor(() => expect(flow.step).toBe("albumDetails"));
		expect(flow.step).toBe("albumDetails");
		expect(flow.draft.albumImport.metadataMatched).toBe(true);

		resolveUpload("etag-1");
		await uploadPromise;
	});

	it("轮询快照不会覆盖手动修改的来源和专辑类型", () => {
		const drawers = useMusicDrawers();
		const flow = drawers.state.value.creationFlow!;
		flow.draft.albumImport.importId = "import-1";
		flow.draft.albumImport.derivedAlbumType = "single";
		flow.draft.albumImport.metadataSourceUrl = "https://metadata.test/original";
		flow.draft.albumDetails.type = "ep";
		flow.draft.albumDetails.source = "人工来源";

		useAlbumImportUpload().applyImportSnapshot(
			snapshot({
				derivedAlbumType: "album",
				metadataSourceUrl: "https://metadata.test/updated",
			}),
		);

		expect(flow.draft.albumDetails.type).toBe("ep");
		expect(flow.draft.albumDetails.source).toBe("人工来源");
	});

	it("终态空快照会清理过期导入曲目并重置匹配状态", () => {
		const drawers = useMusicDrawers();
		const flow = drawers.state.value.creationFlow!;
		flow.draft.albumImport.importId = "import-1";
		flow.draft.albumImport.metadataMatched = true;
		flow.draft.albumImport.derivedTracks = [{
			title: "旧曲目",
			audioKey: "audio-old",
			origin: "archive",
		}];
		flow.draft.tracks = [{
			id: "import-track-1",
			sequence: 1,
			title: "旧曲目",
			audioKey: "audio-old",
			origin: "archive",
		}];

		useAlbumImportUpload().applyImportSnapshot(snapshot({
			status: "failed",
			stage: "failed",
			derivedTracks: [],
			metadataSourceUrl: "",
		}));

		expect(flow.draft.albumImport.metadataMatched).toBe(false);
		expect(flow.draft.albumImport.derivedTracks).toEqual([]);
		expect(flow.draft.tracks).toEqual([]);
	});

	it("通过统一文件入口以 archive 自动模式注册并逐文件上传", async () => {
		const archive = new File(["zip"], "graduation.zip", {
			type: "application/zip",
		});
		vi
			.spyOn(musicApi, "createMusicAlbumImport")
			.mockResolvedValue(snapshot({ inputMode: "archive" }));
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({
				inputMode: "archive",
				files: [
					{
						fileId: "file-1",
						relativePath: "graduation.zip",
						fileName: "graduation.zip",
						role: "archive",
						detectedFormat: "zip",
						size: archive.size,
						uploadStatus: "pending",
						processingStatus: "pending",
						discNumber: 0,
						trackNumber: 0,
						title: "",
						errorMessage: "",
					},
				],
			}),
		);
		mockUploadTransport();
		vi
			.spyOn(musicApi, "completeMusicAlbumImportSession")
			.mockResolvedValue(snapshot({ status: "queued", inputMode: "archive" }));

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [archive]);
		await fileInput(wrapper).trigger("change");
		await flushPromises();

		expect(musicApi.createMusicAlbumImport).toHaveBeenCalledWith({
			artistId: "artist-seeded",
			inputMode: "archive",
		});
		expect(musicApi.registerMusicAlbumImportFiles).toHaveBeenCalledWith(
			"import-1",
			{
				files: [
					{
						relativePath: "graduation.zip",
						fileName: "graduation.zip",
						fileSize: archive.size,
						contentType: "application/zip",
					},
				],
			},
		);
		expect(musicApi.createMusicAlbumImportFilePartUpload).toHaveBeenCalledWith(
			"import-1",
			"file-1",
			1,
			archive.size,
			expect.objectContaining({ signal: expect.any(Object) }),
		);
		expect(musicApi.completeMusicAlbumImportFilePart).toHaveBeenCalledWith(
			"import-1",
			"file-1",
			1,
			"etag-1",
			archive.size,
			expect.objectContaining({ signal: expect.any(Object) }),
		);
		expect(musicApi.completeMusicAlbumImportFile).toHaveBeenCalledWith(
			"import-1",
			"file-1",
			expect.objectContaining({ signal: expect.any(Object) }),
		);
		expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalledWith(
			"import-1",
			expect.objectContaining({ signal: expect.any(Object) }),
		);
		expect(useMusicDrawers().state.value.creationFlow?.step).toBe("albumImport");
	});

	it("关闭创建抽屉后继续完成已开始的上传", async () => {
		const audio = new File(["audio"], "track.mp3", { type: "audio/mpeg" });
		const fileRecord = {
			fileId: "file-1",
			relativePath: "track.mp3",
			fileName: "track.mp3",
			role: "audio",
			detectedFormat: "mp3",
			size: audio.size,
			uploadStatus: "pending" as const,
			processingStatus: "pending" as const,
			discNumber: 1,
			trackNumber: 1,
			title: "",
			errorMessage: "",
		};
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(snapshot());
		vi
			.spyOn(musicApi, "registerMusicAlbumImportFiles")
			.mockResolvedValue(snapshot({ files: [fileRecord] }));
		vi.spyOn(musicApi, "createMusicAlbumImportFilePartUpload").mockResolvedValue({
			partNumber: 1,
			uploadUrl: "https://upload.test/part-1",
		});
		const completePart = vi
			.spyOn(musicApi, "completeMusicAlbumImportFilePart")
			.mockResolvedValue(fileRecord);
		const completeFile = vi
			.spyOn(musicApi, "completeMusicAlbumImportFile")
			.mockResolvedValue({ ...fileRecord, uploadStatus: "uploaded" });
		vi.spyOn(musicApi, "getMusicAlbumImport").mockResolvedValue(snapshot());

		let resolveUpload!: (etag: string) => void;
		const uploadResponse = new Promise<string>((resolve) => {
			resolveUpload = resolve;
		});
		const uploadPart = vi
			.spyOn(musicApi, "uploadMusicAlbumImportFilePart")
			.mockReturnValue(uploadResponse);

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [audio]);
		await fileInput(wrapper).trigger("change");
		await vi.waitFor(() => expect(uploadPart).toHaveBeenCalled());

		useMusicDrawers().closeMusicCreationFlow();
		resolveUpload("etag-1");
		await vi.waitFor(() => expect(completeFile).toHaveBeenCalled());

		expect(completePart).toHaveBeenCalledWith(
			"import-1",
			"file-1",
			1,
			"etag-1",
			audio.size,
			expect.objectContaining({ signal: expect.any(Object) }),
		);
		expect(completeFile).toHaveBeenCalledWith(
			"import-1",
			"file-1",
			expect.objectContaining({ signal: expect.any(Object) }),
		);
	});

	it("新建另一张专辑后不会中断已有上传", async () => {
		const firstFile = new File(["first"], "first.mp3", {
			type: "audio/mpeg",
		});
		const secondFile = new File(["second"], "second.mp3", {
			type: "audio/mpeg",
		});
		const firstRecord = {
			fileId: "first-file",
			relativePath: firstFile.name,
			fileName: firstFile.name,
			role: "audio" as const,
			detectedFormat: "mp3",
			size: firstFile.size,
			uploadStatus: "pending" as const,
			processingStatus: "pending" as const,
			discNumber: 1,
			trackNumber: 1,
			title: "",
			errorMessage: "",
		};
		const secondRecord = {
			...firstRecord,
			fileId: "second-file",
			relativePath: secondFile.name,
			fileName: secondFile.name,
			size: secondFile.size,
		};
		vi
			.spyOn(musicApi, "createMusicAlbumImport")
			.mockResolvedValueOnce(snapshot({ importId: "import-1" }))
			.mockResolvedValueOnce(snapshot({ importId: "import-2" }));
		vi
			.spyOn(musicApi, "registerMusicAlbumImportFiles")
			.mockImplementation(async (importId: string) =>
				snapshot({
					importId,
					files: [importId === "import-1" ? firstRecord : secondRecord],
				}),
			);
		vi
			.spyOn(musicApi, "createMusicAlbumImportFilePartUpload")
			.mockImplementation(async (importId: string) => ({
				partNumber: 1,
				uploadUrl: `https://upload.test/${importId}`,
			}));
		vi
			.spyOn(musicApi, "completeMusicAlbumImportFilePart")
			.mockResolvedValue(firstRecord);
		const completeFile = vi
			.spyOn(musicApi, "completeMusicAlbumImportFile")
			.mockResolvedValue({ ...firstRecord, uploadStatus: "uploaded" });
		vi
			.spyOn(musicApi, "completeMusicAlbumImportSession")
			.mockImplementation(async (importId: string) =>
				snapshot({ importId, status: "queued", stage: "queued" }),
			);

		let resolveFirstUpload!: (etag: string) => void;
		const firstUpload = new Promise<string>((resolve) => {
			resolveFirstUpload = resolve;
		});
		const uploadPart = vi
			.spyOn(musicApi, "uploadMusicAlbumImportFilePart")
			.mockImplementation((url: string) =>
				url.endsWith("import-1") ? firstUpload : Promise.resolve("etag-2"),
			);

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [firstFile]);
		await fileInput(wrapper).trigger("change");
		await vi.waitFor(() => expect(uploadPart).toHaveBeenCalledTimes(1));

		const drawers = useMusicDrawers();
		drawers.openMusicCreationFlow({
			artistId: "artist-seeded",
			startStep: "albumImport",
		});
		const secondFiles = {
			0: secondFile,
			length: 1,
			item: (index: number) => (index === 0 ? secondFile : null),
		} as unknown as FileList;
		void useAlbumImportUpload().handleFilesUpload(secondFiles);
		await vi.waitFor(() => expect(uploadPart).toHaveBeenCalledTimes(2));

		resolveFirstUpload("etag-1");
		await vi.waitFor(() => {
			expect(completeFile).toHaveBeenCalledWith(
				"import-1",
				"first-file",
				expect.objectContaining({ signal: expect.any(Object) }),
			);
			expect(completeFile).toHaveBeenCalledWith(
				"import-2",
				"second-file",
				expect.objectContaining({ signal: expect.any(Object) }),
			);
		});
	});

	it("拒绝过大的压缩包时不会进入上传中状态", async () => {
		const archive = new File(["zip"], "too-large.zip", {
			type: "application/zip",
		});
		Object.defineProperty(archive, "size", {
			configurable: true,
			value: 2 * 1024 * 1024 * 1024 + 1,
		});
		const createImport = vi.spyOn(musicApi, "createMusicAlbumImport");

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [archive]);
		await fileInput(wrapper).trigger("change");
		await flushPromises();

		expect(createImport).not.toHaveBeenCalled();
		expect(
			useMusicDrawers().state.value.creationFlow?.draft.albumImport.status,
		).toBe("pending_upload");
		expect(wrapper.text()).toContain("文件需在 2GB 以内");
	});

	it("拒绝空文件时不会创建导入会话", async () => {
		const archive = new File([], "empty.zip", {
			type: "application/zip",
		});
		const createImport = vi.spyOn(musicApi, "createMusicAlbumImport");

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [archive]);
		await fileInput(wrapper).trigger("change");
		await flushPromises();

		expect(createImport).not.toHaveBeenCalled();
		expect(
			useMusicDrawers().state.value.creationFlow?.draft.albumImport.status,
		).toBe("pending_upload");
		expect(wrapper.text()).toContain("文件“empty.zip”为空，请重新选择");
	});

	it("重新上传有效文件时立即清除上一次的大小错误", async () => {
		const archive = new File(["zip"], "album.zip", {
			type: "application/zip",
		});
		let rejectCreate!: (reason?: unknown) => void;
		const createImport = vi
			.spyOn(musicApi, "createMusicAlbumImport")
			.mockReturnValue(
				new Promise<musicApi.MusicAlbumImport>((_, reject) => {
					rejectCreate = reject;
				}),
			);

		const drawers = useMusicDrawers();
		if (!drawers.state.value.creationFlow)
			throw new Error("creation flow missing");
		Object.assign(drawers.state.value.creationFlow.draft.albumImport, {
			status: "failed",
			errorMessage: "album import file size is invalid",
		});
		const wrapper = mount(MusicCreationAlbumUploadZone);
		const files = {
			0: archive,
			length: 1,
			item: (index: number) => (index === 0 ? archive : null),
		} as unknown as FileList;

		const upload = useAlbumImportUpload().handleFilesUpload(files);
		await vi.waitFor(() => expect(createImport).toHaveBeenCalledTimes(1));

		expect(drawers.state.value.creationFlow.draft.albumImport).toEqual(
			expect.objectContaining({ status: "uploading", errorMessage: "" }),
		);
		expect(wrapper.text()).not.toContain("album import file size is invalid");

		rejectCreate(new Error("stop test upload"));
		await upload;
	});

	it("在 ZIP 上传期间预填专辑名和曲目", async () => {
		const zip = new JSZip();
		zip.file("01 - Dawn.flac", "audio");
		zip.file("02 - Dusk.mp3", "audio");
		const archive = new File(
			[await zip.generateAsync({ type: "uint8array" })],
			"Day Cycle.zip",
			{ type: "application/zip" },
		);

		vi
			.spyOn(musicApi, "createMusicAlbumImport")
			.mockResolvedValue(snapshot({ inputMode: "archive" }));
		vi
			.spyOn(musicApi, "registerMusicAlbumImportFiles")
			.mockResolvedValue(snapshot({ files: [] }));
		mockUploadTransport();
		vi
			.spyOn(musicApi, "completeMusicAlbumImportSession")
			.mockResolvedValue(snapshot({ status: "queued" }));

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [archive]);
		await fileInput(wrapper).trigger("change");
		await flushPromises();

		await vi.waitFor(() => {
			const draft = useMusicDrawers().state.value.creationFlow?.draft;
			expect(draft?.albumDetails.title).toBe("Day Cycle");
			expect(draft?.tracks.map((track: { title: string }) => track.title)).toEqual(
				["Dawn", "Dusk"],
			);
		});
		expect(musicApi.createMusicAlbumImport).toHaveBeenCalledTimes(1);
	});

	it("多文件选择自动使用 files 模式并保留所有注册文件", async () => {
		const audio = new File(["audio"], "01-song.mp3", { type: "audio/mpeg" });
		const cover = new File(["cover"], "cover.jpg", { type: "image/jpeg" });
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(snapshot());
		vi
			.spyOn(musicApi, "registerMusicAlbumImportFiles")
			.mockResolvedValue(snapshot({ files: [] }));
		mockUploadTransport();
		vi
			.spyOn(musicApi, "completeMusicAlbumImportSession")
			.mockResolvedValue(snapshot({ status: "queued" }));

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [audio, cover]);
		await fileInput(wrapper).trigger("change");

		expect(musicApi.createMusicAlbumImport).toHaveBeenCalledWith({
			artistId: "artist-seeded",
			inputMode: "files",
		});
		expect(musicApi.registerMusicAlbumImportFiles).toHaveBeenCalledWith(
			"import-1",
			{
				files: [
					{
						relativePath: "01-song.mp3",
						fileName: "01-song.mp3",
						fileSize: audio.size,
						contentType: "audio/mpeg",
					},
					{
						relativePath: "cover.jpg",
						fileName: "cover.jpg",
						fileSize: cover.size,
						contentType: "image/jpeg",
					},
				],
			},
		);
	});

	it("单曲分片完成前会显示实时上传进度", async () => {
		const audio = new File(["12345678"], "11.mp3", { type: "audio/mpeg" });
		const fileRecord = importFile({
			fileName: audio.name,
			relativePath: audio.name,
			size: audio.size,
		});
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(snapshot());
		vi
			.spyOn(musicApi, "registerMusicAlbumImportFiles")
			.mockResolvedValue(snapshot({ files: [fileRecord] }));
		vi.spyOn(musicApi, "createMusicAlbumImportFilePartUpload").mockResolvedValue({
			partNumber: 1,
			uploadUrl: "https://upload.test/part-1",
		});
		let resolveUpload!: (etag: string) => void;
		vi
			.spyOn(musicApi, "uploadMusicAlbumImportFilePart")
			.mockImplementation((_uploadUrl, body, options = {}) => {
				options.onProgress?.({ loaded: body.size / 2, total: body.size });
				return new Promise<string>((resolve) => {
					resolveUpload = resolve;
				});
			});
		vi
			.spyOn(musicApi, "completeMusicAlbumImportFilePart")
			.mockResolvedValue(fileRecord);
		vi.spyOn(musicApi, "completeMusicAlbumImportFile").mockResolvedValue({
			...fileRecord,
			uploadStatus: "uploaded",
		});
		const completeSession = vi
			.spyOn(musicApi, "completeMusicAlbumImportSession")
			.mockResolvedValue(snapshot({ status: "ready", stage: "ready" }));

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [audio]);
		await fileInput(wrapper).trigger("change");

		await vi.waitFor(() => {
			expect(wrapper.get(".import-file-progress").text()).toBe("50%");
			expect(wrapper.find(".progress-panel").exists()).toBe(false);
		});
		expect(
			useMusicDrawers().state.value.creationFlow?.draft.albumImport
				.totalBytesLoaded,
		).toBe(audio.size / 2);

		resolveUpload("etag-1");
		await vi.waitFor(() => expect(completeSession).toHaveBeenCalledTimes(1));
	});

	it("上传页不显示专辑封面表单", () => {
		const wrapper = mount(MusicCreationAlbumSeedStep);

		expect(wrapper.find('[data-testid="album-details-cover-input"]').exists()).toBe(
			false,
		);
	});

	it("接受会话快照中的空数组而不崩溃", async () => {
		const file = new File(["audio"], "song.mp3", { type: "audio/mpeg" });
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(snapshot());
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({
				files: null,
				errors: null,
				derivedTracks: null,
			} as unknown as Partial<musicApi.MusicAlbumImport>),
		);
		mockUploadTransport();
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(
			snapshot({
				status: "queued",
				files: null,
				errors: null,
				derivedTracks: null,
			} as unknown as Partial<musicApi.MusicAlbumImport>),
		);

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [file]);
		await fileInput(wrapper).trigger("change");
		await flushPromises();

		const draft = useMusicDrawers().state.value.creationFlow?.draft.albumImport;
		expect(draft?.files).toEqual([]);
		expect(draft?.derivedTracks).toEqual([]);
	});

	it("上传有文件列表时以紧凑格式在进度左侧显示当前上传速度", async () => {
		const drawers = useMusicDrawers();
		if (!drawers.state.value.creationFlow)
			throw new Error("creation flow missing");
		Object.assign(drawers.state.value.creationFlow.draft.albumImport, {
			status: "uploading",
			uploadSpeed: 3.3 * 1024 * 1024,
			files: [
				{
					fileId: "file-1",
					relativePath: "album.zip",
					fileName: "album.zip",
					role: "archive",
					detectedFormat: "rar",
					size: 1024,
					uploadStatus: "uploading",
					processingStatus: "pending",
					discNumber: 0,
					trackNumber: 0,
					title: "",
					errorMessage: "",
				},
			],
		});

		const wrapper = mount(MusicCreationAlbumUploadZone);

		const speed = wrapper.get('[data-testid="album-import-speed"]');
		expect(wrapper.get(".import-file-format").text()).toBe("速度：");
		expect(speed.text()).toBe("3.3M");
		expect(speed.element.nextElementSibling).toBe(
			wrapper.get(".import-file-progress").element,
		);
	});

	it("提示自动匹配并在成功后显示 MusicBrainz 来源", async () => {
		const drawers = useMusicDrawers();
		if (!drawers.state.value.creationFlow)
			throw new Error("creation flow missing");
		const wrapper = mount(MusicCreationAlbumUploadZone);

		expect(
			wrapper.get('[data-testid="album-import-metadata-hint"]').text(),
		).toContain("上传后将自动匹配专辑信息、曲序和歌词");

		drawers.state.value.creationFlow.draft.albumImport.metadataSourceUrl =
			"https://musicbrainz.org/release/release-id";
		await flushPromises();

		const source = wrapper.get('[data-testid="album-import-metadata-hint"] a');
		expect(source.text()).toContain("查看 MusicBrainz 来源");
		expect(source.attributes()).toMatchObject({
			href: "https://musicbrainz.org/release/release-id",
			target: "_blank",
			rel: "noopener noreferrer",
		});
	});

	it("提示补充 MusicBrainz 中缺少的艺术家", async () => {
		const drawers = useMusicDrawers();
		if (!drawers.state.value.creationFlow)
			throw new Error("creation flow missing");
		drawers.state.value.creationFlow.draft.albumImport.missingArtists = [
			"Jay-Z",
			"KIDS SEE GHOSTS",
		];
		const wrapper = mount(MusicCreationAlbumUploadZone);

		expect(wrapper.text()).toContain(
			"该发行版还包括 Jay-Z、KIDS SEE GHOSTS，请在专辑信息中补充艺术家",
		);
	});

	it("上传后应用后台处理中的最新快照", async () => {
		vi.useFakeTimers();
		const archive = new File(["zip"], "stages.zip", {
			type: "application/zip",
		});
		vi
			.spyOn(musicApi, "createMusicAlbumImport")
			.mockResolvedValue(snapshot({ inputMode: "archive" }));
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({
				files: [
					{
						fileId: "file-1",
						relativePath: archive.name,
						fileName: archive.name,
						role: "archive",
						detectedFormat: "zip",
						size: archive.size,
						uploadStatus: "pending",
						processingStatus: "pending",
						discNumber: 0,
						trackNumber: 0,
						title: "",
						errorMessage: "",
					},
				],
			}),
		);
		mockUploadTransport();
		vi
			.spyOn(musicApi, "completeMusicAlbumImportSession")
			.mockResolvedValue(snapshot({ status: "queued", stage: "queued" }));
		vi.spyOn(musicApi, "getMusicAlbumImport").mockResolvedValueOnce(
			snapshot({
				status: "extracting",
				stage: "extracting",
				inputMode: "archive",
			}),
		);

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [archive]);
		await fileInput(wrapper).trigger("change");
		await flushPromises();
		await vi.advanceTimersByTimeAsync(2000);

		expect(musicApi.getMusicAlbumImport).toHaveBeenCalled();
		expect(useMusicDrawers().state.value.creationFlow?.draft.albumImport).toEqual(
			expect.objectContaining({
				status: "extracting",
				stage: "extracting",
				inputMode: "archive",
				totalBytesLoaded: archive.size,
				totalBytesTotal: archive.size,
			}),
		);
	});

	it("失败文件可重试并可用替换文件重新上传", async () => {
		const original = new File(["audio"], "broken.mp3", { type: "audio/mpeg" });
		const replacement = new File(["audio"], "fixed.mp3", {
			type: "audio/mpeg",
		});
		const fileRecord = {
			fileId: "file-1",
			relativePath: "broken.mp3",
			fileName: "broken.mp3",
			role: "audio",
			detectedFormat: "mp3",
			size: original.size,
			uploadStatus: "failed" as const,
			processingStatus: "failed" as const,
			discNumber: 1,
			trackNumber: 1,
			title: "",
			errorMessage: "网络错误",
		};
		vi
			.spyOn(musicApi, "retryMusicAlbumImportFile")
			.mockResolvedValue(snapshot({ status: "uploading", files: [fileRecord] }));
		vi.spyOn(musicApi, "replaceMusicAlbumImportFile").mockResolvedValue(
			importFile({
				...fileRecord,
				fileName: "fixed.mp3",
				relativePath: "fixed.mp3",
			}),
		);
		vi
			.spyOn(musicApi, "createMusicAlbumImport")
			.mockResolvedValue(snapshot({ inputMode: "files" }));
		vi
			.spyOn(musicApi, "registerMusicAlbumImportFiles")
			.mockResolvedValue(snapshot({ files: [fileRecord] }));
		mockUploadTransport();
		vi.mocked(musicApi.completeMusicAlbumImportFile).mockResolvedValue({
			...fileRecord,
			uploadStatus: "uploaded",
			processingStatus: "pending",
		});
		vi.spyOn(musicApi, "getMusicAlbumImport").mockResolvedValue(
			snapshot({
				status: "uploaded",
				files: [
					{
						...fileRecord,
						uploadStatus: "uploaded",
						processingStatus: "pending",
					},
				],
			}),
		);
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(
			snapshot({
				status: "queued",
				stage: "queued",
				files: [
					{
						...fileRecord,
						uploadStatus: "uploaded",
						processingStatus: "pending",
					},
				],
			}),
		);

		const drawers = useMusicDrawers();
		const originalFiles = {
			0: original,
			length: 1,
			item: (index: number) => (index === 0 ? original : null),
		} as unknown as FileList;
		await useAlbumImportUpload().handleFilesUpload(originalFiles);
		drawers.setMusicCreationStep("albumDetails");
		if (!drawers.state.value.creationFlow)
			throw new Error("creation flow missing");
		drawers.state.value.creationFlow.mode = "edit";
		drawers.state.value.creationFlow.entity = "album";
		Object.assign(drawers.state.value.creationFlow.draft.albumImport, {
			importId: "import-1",
			status: "failed",
			files: [fileRecord],
		});
		const wrapper = mount(MusicCreationAlbumDetailsStep);
		const replacementInput = wrapper.findAll('input[type="file"]')[1];

		await wrapper.get(".import-file-action").trigger("click");
		await flushPromises();
		expect(musicApi.retryMusicAlbumImportFile).toHaveBeenCalledWith(
			"import-1",
			"file-1",
		);
		expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalledTimes(1);
		expect(drawers.state.value.creationFlow.draft.albumImport.status).toBe(
			"uploaded",
		);

		Object.assign(drawers.state.value.creationFlow.draft.albumImport, {
			status: "failed",
			files: [fileRecord],
		});
		await flushPromises();
		await wrapper.findAll(".import-file-action")[1].trigger("click");
		setFiles(replacementInput.element as HTMLInputElement, [replacement]);
		await replacementInput.trigger("change");
		await flushPromises();
		expect(musicApi.replaceMusicAlbumImportFile).toHaveBeenCalledWith(
			"import-1",
			"file-1",
			{
				relativePath: "fixed.mp3",
				fileName: "fixed.mp3",
				fileSize: replacement.size,
				contentType: "audio/mpeg",
			},
		);
		expect(musicApi.completeMusicAlbumImportFile).toHaveBeenCalledWith(
			"import-1",
			"file-1",
			expect.objectContaining({ signal: expect.any(Object) }),
		);
		expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalledTimes(1);
	});

	it("分片失败后从服务端已确认分片继续上传", async () => {
		const partSize = 16 * 1024 * 1024;
		const archive = new File(
			[new ArrayBuffer(partSize), new ArrayBuffer(1)],
			"resume.zip",
			{ type: "application/zip" },
		);
		const fileRecord = importFile({
			relativePath: archive.name,
			fileName: archive.name,
			role: "archive",
			detectedFormat: "zip",
			size: archive.size,
			partSize,
			uploadStatus: "pending",
			completedParts: [],
		});
		const partOne = { partNumber: 1, etag: "etag-1", size: partSize };
		const partTwo = { partNumber: 2, etag: "etag-2", size: 1 };
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(
			snapshot({
				inputMode: "archive",
				progress: { current: 0, total: archive.size },
			}),
		);
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({
				inputMode: "archive",
				progress: { current: 0, total: archive.size },
				files: [fileRecord],
			}),
		);
		const createPart = vi
			.spyOn(musicApi, "createMusicAlbumImportFilePartUpload")
			.mockImplementation(async (_importId, _fileId, partNumber) => ({
				partNumber,
				uploadUrl: `https://upload.test/part-${partNumber}`,
			}));
		let uploadCalls = 0;
		vi
			.spyOn(musicApi, "uploadMusicAlbumImportFilePart")
			.mockImplementation(async (_url, body, options = {}) => {
				uploadCalls += 1;
				options.onProgress?.({ loaded: body.size, total: body.size });
				if (uploadCalls >= 2 && uploadCalls <= 4) {
					throw new Error("连接中断");
				}
				return uploadCalls === 1 ? "etag-1" : "etag-2";
			});
		vi
			.spyOn(musicApi, "completeMusicAlbumImportFilePart")
			.mockImplementation(async (_importId, _fileId, partNumber) => ({
				...fileRecord,
				uploadStatus: "uploading",
				completedParts: partNumber === 1 ? [partOne] : [partOne, partTwo],
			}));
		vi.spyOn(musicApi, "completeMusicAlbumImportFile").mockResolvedValue({
			...fileRecord,
			uploadStatus: "uploaded",
			completedParts: [partOne, partTwo],
		});
		vi.spyOn(musicApi, "getMusicAlbumImport").mockResolvedValue(
			snapshot({
				status: "uploading",
				inputMode: "archive",
				progress: { current: archive.size, total: archive.size },
				files: [
					{
						...fileRecord,
						uploadStatus: "uploaded",
						completedParts: [partOne, partTwo],
					},
				],
			}),
		);
		vi
			.spyOn(musicApi, "completeMusicAlbumImportSession")
			.mockResolvedValue(
				snapshot({ status: "queued", stage: "queued", files: [fileRecord] }),
			);
		vi
			.spyOn(musicApi, "retryMusicAlbumImportFile")
			.mockRejectedValue(new Error("不应重建上传会话"));

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [archive]);
		await fileInput(wrapper).trigger("change");
		await vi.waitFor(() =>
			expect(
				wrapper.find('[data-testid="album-import-upload-retry"]').exists(),
			).toBe(true),
		);

		await wrapper
			.get('[data-testid="album-import-upload-retry"]')
			.trigger("click");
		await vi.waitFor(() =>
			expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalled(),
		);

		expect(musicApi.retryMusicAlbumImportFile).not.toHaveBeenCalled();
		expect(createPart.mock.calls.map((call) => call[2])).toEqual([1, 2, 2, 2, 2]);
	});

	it("会话处理失败后可直接重试而不重复上传", async () => {
		vi.useFakeTimers();
		const fileRecord = {
			fileId: "file-1",
			relativePath: "album.zip",
			fileName: "album.zip",
			role: "archive",
			detectedFormat: "zip",
			size: 1024,
			uploadStatus: "uploaded" as const,
			processingStatus: "pending" as const,
			discNumber: 0,
			trackNumber: 0,
			title: "",
			errorMessage: "",
		};
		vi.spyOn(musicApi, "retryMusicAlbumImportFile").mockResolvedValue(
			snapshot({
				status: "queued",
				stage: "queued",
				files: [fileRecord],
			}),
		);
		const createPart = vi.spyOn(musicApi, "createMusicAlbumImportFilePartUpload");
		vi.spyOn(musicApi, "getMusicAlbumImport").mockResolvedValue(
			snapshot({
				status: "ready",
				stage: "ready",
				derivedTracks: [
					{ title: "Recovered Track", audioKey: "audio-1", origin: "archive" },
				],
			}),
		);

		const drawers = useMusicDrawers();
		if (!drawers.state.value.creationFlow)
			throw new Error("creation flow missing");
		Object.assign(drawers.state.value.creationFlow.draft.albumImport, {
			importId: "import-1",
			status: "needs_attention",
			stage: "failed",
			errorMessage: "处理空间不足",
			files: [fileRecord],
		});
		const wrapper = mount(MusicCreationAlbumUploadZone);

		expect(wrapper.text()).toContain("处理失败，请重试");
		expect(wrapper.text()).not.toContain("处理空间不足");
		await wrapper
			.get('[data-testid="album-import-processing-retry"]')
			.trigger("click");
		await flushPromises();

		expect(musicApi.retryMusicAlbumImportFile).toHaveBeenCalledWith(
			"import-1",
			"file-1",
		);
		expect(createPart).not.toHaveBeenCalled();
		expect(drawers.state.value.creationFlow.draft.albumImport.status).toBe(
			"queued",
		);

		await vi.advanceTimersByTimeAsync(2_000);
		await flushPromises();

		expect(musicApi.getMusicAlbumImport).toHaveBeenCalledWith("import-1");
		expect(drawers.state.value.creationFlow.draft.tracks).toEqual([
			expect.objectContaining({
				title: "Recovered Track",
				audioKey: "audio-1",
			}),
		]);
	});
});
