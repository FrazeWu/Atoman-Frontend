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
	vi.spyOn(musicApi, "uploadMusicAlbumImportFilePart").mockImplementation(
		async (_uploadUrl, body, options = {}) => {
			options.onProgress?.({ loaded: body.size, total: body.size });
			return "etag-1";
		},
	);
	vi.spyOn(musicApi, "completeMusicAlbumImportFilePart").mockResolvedValue(
		importFile(),
	);
	vi.spyOn(musicApi, "completeMusicAlbumImportFile").mockResolvedValue(
		importFile(),
	);
}

describe("MusicCreationAlbumImportStep.vue", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		const drawers = useMusicDrawers();
		drawers.closeAll();
		drawers.openMusicCreationFlow({
			artistId: "artist-seeded",
			startStep: "albumImport",
		});
		drawers.setMusicCreationStep("albumImport");
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
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

	it("通过统一文件入口以 archive 自动模式注册并逐文件上传", async () => {
		const archive = new File(["zip"], "graduation.zip", {
			type: "application/zip",
		});
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(
			snapshot({ inputMode: "archive" }),
		);
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
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(
			snapshot({ status: "queued", inputMode: "archive" }),
		);

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
		);
		expect(musicApi.completeMusicAlbumImportFilePart).toHaveBeenCalledWith(
			"import-1",
			"file-1",
			1,
			"etag-1",
			archive.size,
		);
		expect(musicApi.completeMusicAlbumImportFile).toHaveBeenCalledWith(
			"import-1",
			"file-1",
		);
		expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalledWith(
			"import-1",
		);
		expect(useMusicDrawers().state.value.creationFlow?.step).toBe(
			"albumDetails",
		);
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
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({ files: [fileRecord] }),
		);
		vi.spyOn(
			musicApi,
			"createMusicAlbumImportFilePartUpload",
		).mockResolvedValue({
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
		);
		expect(completeFile).toHaveBeenCalledWith("import-1", "file-1");
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
		vi.spyOn(musicApi, "createMusicAlbumImport")
			.mockResolvedValueOnce(snapshot({ importId: "import-1" }))
			.mockResolvedValueOnce(snapshot({ importId: "import-2" }));
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockImplementation(
			async (importId: string) =>
				snapshot({
					importId,
					files: [importId === "import-1" ? firstRecord : secondRecord],
				}),
		);
		vi.spyOn(
			musicApi,
			"createMusicAlbumImportFilePartUpload",
		).mockImplementation(async (importId: string) => ({
			partNumber: 1,
			uploadUrl: `https://upload.test/${importId}`,
		}));
		vi.spyOn(musicApi, "completeMusicAlbumImportFilePart").mockResolvedValue(
			firstRecord,
		);
		const completeFile = vi
			.spyOn(musicApi, "completeMusicAlbumImportFile")
			.mockResolvedValue({ ...firstRecord, uploadStatus: "uploaded" });
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockImplementation(
			async (importId: string) =>
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
			expect(completeFile).toHaveBeenCalledWith("import-1", "first-file");
			expect(completeFile).toHaveBeenCalledWith("import-2", "second-file");
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

		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(
			snapshot({ inputMode: "archive" }),
		);
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({ files: [] }),
		);
		mockUploadTransport();
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(
			snapshot({ status: "queued" }),
		);

		const wrapper = mount(MusicCreationAlbumSeedStep);
		setFiles(fileInput(wrapper).element as HTMLInputElement, [archive]);
		await fileInput(wrapper).trigger("change");
		await flushPromises();

		await vi.waitFor(() => {
			const draft = useMusicDrawers().state.value.creationFlow?.draft;
			expect(draft?.albumDetails.title).toBe("Day Cycle");
			expect(
				draft?.tracks.map((track: { title: string }) => track.title),
			).toEqual(["Dawn", "Dusk"]);
		});
		expect(musicApi.createMusicAlbumImport).toHaveBeenCalledTimes(1);
	});

	it("多文件选择自动使用 files 模式并保留所有注册文件", async () => {
		const audio = new File(["audio"], "01-song.mp3", { type: "audio/mpeg" });
		const cover = new File(["cover"], "cover.jpg", { type: "image/jpeg" });
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(snapshot());
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({ files: [] }),
		);
		mockUploadTransport();
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(
			snapshot({ status: "queued" }),
		);

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
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({ files: [fileRecord] }),
		);
		vi.spyOn(
			musicApi,
			"createMusicAlbumImportFilePartUpload",
		).mockResolvedValue({
			partNumber: 1,
			uploadUrl: "https://upload.test/part-1",
		});
		let resolveUpload!: (etag: string) => void;
		vi.spyOn(musicApi, "uploadMusicAlbumImportFilePart").mockImplementation(
			(_uploadUrl, body, options = {}) => {
				options.onProgress?.({ loaded: body.size / 2, total: body.size });
				return new Promise<string>((resolve) => {
					resolveUpload = resolve;
				});
			},
		);
		vi.spyOn(musicApi, "completeMusicAlbumImportFilePart").mockResolvedValue(
			fileRecord,
		);
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
			expect(wrapper.get(".progress-panel").text()).toContain("上传进度 50%");
		});
		expect(
			useMusicDrawers().state.value.creationFlow?.draft.albumImport
				.totalBytesLoaded,
		).toBe(audio.size / 2);

		resolveUpload("etag-1");
		await vi.waitFor(() => expect(completeSession).toHaveBeenCalledTimes(1));
	});

	it("手动封面与识别封面同时存在时明确显示手动封面", async () => {
		const drawers = useMusicDrawers();
		const flow = drawers.state.value.creationFlow;
		if (!flow) throw new Error("creation flow missing");

		flow.draft.albumImport.derivedCover =
			"https://img.example/imported-cover.jpg";
		vi.spyOn(musicApi, "uploadMusicAsset").mockResolvedValue({
			key: "music/manual-cover.jpg",
			url: "https://img.example/manual-cover.jpg",
			content_type: "image/jpeg",
			size: 5,
		});

		const wrapper = mount(MusicCreationAlbumSeedStep);
		const input = wrapper.get('[data-testid="album-details-cover-input"]');
		setFiles(input.element as HTMLInputElement, [
			new File(["cover"], "manual-cover.jpg", { type: "image/jpeg" }),
		]);
		await input.trigger("change");
		await flushPromises();

		expect(
			wrapper
				.get('[data-testid="album-import-cover-preview"]')
				.attributes("src"),
		).toBe("https://img.example/imported-cover.jpg");
		expect(
			wrapper
				.get('[data-testid="album-selected-cover-preview"]')
				.attributes("src"),
		).toBe("https://img.example/manual-cover.jpg");
		expect(flow.draft.albumDetails.coverUrl).toBe(
			"https://img.example/manual-cover.jpg",
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

	it("上传有文件列表时仍显示当前上传速度", async () => {
		const drawers = useMusicDrawers();
		if (!drawers.state.value.creationFlow)
			throw new Error("creation flow missing");
		Object.assign(drawers.state.value.creationFlow.draft.albumImport, {
			status: "uploading",
			uploadSpeed: 128 * 1024,
			files: [
				{
					fileId: "file-1",
					relativePath: "album.zip",
					fileName: "album.zip",
					role: "archive",
					detectedFormat: "zip",
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

		expect(wrapper.get('[data-testid="album-import-speed"]').text()).toContain(
			"上传速度 128 KB/s",
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
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(
			snapshot({ inputMode: "archive" }),
		);
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
		vi.spyOn(musicApi, "completeMusicAlbumImportSession").mockResolvedValue(
			snapshot({ status: "queued", stage: "queued" }),
		);
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

		expect(musicApi.getMusicAlbumImport).toHaveBeenCalledTimes(1);
		expect(
			useMusicDrawers().state.value.creationFlow?.draft.albumImport,
		).toEqual(
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
		vi.spyOn(musicApi, "retryMusicAlbumImportFile").mockResolvedValue(
			snapshot({ status: "uploading", files: [fileRecord] }),
		);
		vi.spyOn(musicApi, "replaceMusicAlbumImportFile").mockResolvedValue(
			importFile({
				...fileRecord,
				fileName: "fixed.mp3",
				relativePath: "fixed.mp3",
			}),
		);
		vi.spyOn(musicApi, "createMusicAlbumImport").mockResolvedValue(
			snapshot({ inputMode: "files" }),
		);
		vi.spyOn(musicApi, "registerMusicAlbumImportFiles").mockResolvedValue(
			snapshot({ files: [fileRecord] }),
		);
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
		);
		expect(musicApi.completeMusicAlbumImportSession).toHaveBeenCalledTimes(1);
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
		const createPart = vi.spyOn(
			musicApi,
			"createMusicAlbumImportFilePartUpload",
		);
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
