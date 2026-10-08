import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBlob } from "music-metadata";
import {
	readAlbumImportPreview,
	readAlbumImportFilesPreview,
	shouldIgnoreAlbumImportPath,
} from "../../../src/utils/musicImportPreview";

const rarMocks = vi.hoisted(() => ({
	createExtractorFromData: vi.fn(),
}));

vi.mock("node-unrar-js/esm/index.esm.js", () => rarMocks);
vi.mock("node-unrar-js/esm/js/unrar.wasm?url", () => ({
	default: "/assets/unrar.wasm",
}));

vi.mock("music-metadata", () => ({
	parseBlob: vi.fn(),
}));

describe("readAlbumImportPreview", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it("从 RAR 文件目录预填专辑名与曲目", async () => {
		rarMocks.createExtractorFromData.mockResolvedValue({
			getFileList: () => ({
				arcHeader: { flags: { headerEncrypted: false } },
				fileHeaders: [
					{ name: "Disc 1/10 - Finale.mp3", flags: { directory: false } },
					{ name: "01 - Intro.flac", flags: { directory: false } },
					{ name: "__MACOSX/._02 - Hidden.mp3", flags: { directory: false } },
					{ name: "Disc 1", flags: { directory: true } },
					{ name: "Disc 1/2-01 Main Theme.mp3", flags: { directory: false } },
				].values(),
			}),
		});
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: async () => new ArrayBuffer(8),
			}),
		);

		const preview = await readAlbumImportPreview(
			new File(["rar"], "Northern Lights.rar", {
				type: "application/vnd.rar",
			}),
		);

		expect(preview).toMatchObject({
			title: "Northern Lights",
			tracks: ["Intro", "Main Theme", "Finale"],
		});
		expect(rarMocks.createExtractorFromData).toHaveBeenCalledOnce();
	});

	it("从 ZIP 文件名和目录预填专辑名与曲目", async () => {
		const zip = new JSZip();
		zip.file("01 - Intro.flac", "audio");
		zip.file("Disc 1/10 - Finale.mp3", "audio");
		zip.file("Disc 1/2-01 Main Theme.mp3", "audio");
		zip.file("Disc 1/99 Problems.mp3", "audio");
		zip.file("__MACOSX/._01 - Intro.flac", "apple-double");
		zip.file("._02 - Hidden.mp3", "apple-double");
		zip.file(".hidden/03 - Hidden.flac", "hidden");
		zip.file("cover.jpg", "cover");
		const file = new File(
			[await zip.generateAsync({ type: "uint8array" })],
			"Northern Lights.zip",
			{
				type: "application/zip",
			},
		);

		const preview = await readAlbumImportPreview(file);
		expect(preview.title).toBe("Northern Lights");
		expect(preview.tracks).toEqual([
			"Intro",
			"Main Theme",
			"Finale",
			"99 Problems",
		]);
		expect(preview.albumCoverFile).toBeInstanceOf(File);
		expect(preview.albumCoverFile?.name).toBe("cover.jpg");
		expect(preview.albumCoverFile?.type).toBe("image/jpeg");
	});

	it.each(["ZIP", "文件夹"])(
		"%s 多媒体预览保留完整来源路径及标签碟号曲号",
		async (input) => {
			const sources = [
				{ path: "录音集/CD2/01 - Filename.mp4", content: "video" },
				{ path: "录音集/CD1/01 - Filename.flac", content: "audio" },
			];
			vi.mocked(parseBlob).mockImplementation(async (blob) => {
				const isVideo = await blob.text() === "video";
				return {
					common: {
						album: "标签专辑", albumartist: "标签艺术家",
						title: isVideo ? "现场版 (完整)" : "序曲 (重制版)",
						disk: { no: isVideo ? 4 : 3 }, track: { no: isVideo ? 9 : 7 },
					},
				} as never;
			});

			let preview;
			if (input === "ZIP") {
				const zip = new JSZip();
				for (const { path, content } of sources) zip.file(path, content);
				preview = await readAlbumImportPreview(new File(
					[await zip.generateAsync({ type: "uint8array" })],
					"录音集.zip",
					{ type: "application/zip" },
				));
			} else {
				const files = sources.map(({ path, content }) => {
					const file = new File([content], path.split("/").pop()!);
					Object.defineProperty(file, "webkitRelativePath", { value: path });
					return file;
				});
				preview = await readAlbumImportFilesPreview(files);
			}

			expect(preview).toMatchObject({
				artist: "标签艺术家",
				tracks: ["序曲 (重制版)", "现场版 (完整)"],
				trackDetails: [
					{
						title: "序曲 (重制版)", origin: sources[1].path, audioKey: "",
						discNumber: 3, trackNumber: 7,
						originalTitle: "序曲 (重制版)", originalDiscNumber: 3, originalTrackNumber: 7,
					},
					{
						title: "现场版 (完整)", origin: sources[0].path, audioKey: "",
						discNumber: 4, trackNumber: 9,
						originalTitle: "现场版 (完整)", originalDiscNumber: 4, originalTrackNumber: 9,
					},
				],
			});
		},
	);

	it("ZIP 中的 CUE 整轨音频等待后端拆曲，不提前识别成单首", async () => {
		const zip = new JSZip();
		zip.file("Album/Album.flac", "audio");
		zip.file("Album/Album.cue", [
			'FILE "Album.flac" WAVE',
			'  TRACK 01 AUDIO',
			'    TITLE "Intro"',
			'    INDEX 01 00:00:00',
			'  TRACK 02 AUDIO',
			'    TITLE "Finale"',
			'    INDEX 01 03:00:00',
		].join("\n"));
		vi.mocked(parseBlob).mockResolvedValue({ common: { title: "整轨音频" } } as never);

		const preview = await readAlbumImportPreview(new File(
			[await zip.generateAsync({ type: "uint8array" })],
			"Album.zip",
			{ type: "application/zip" },
		));

		expect(preview).toEqual({ title: "Album", tracks: [] });
	});

	it("预览曲目会移除已知艺术家前缀", async () => {
		const zip = new JSZip();
		zip.file("01 - 交工乐队 - 两代人.mp3", "audio");
		zip.file("02 - 交工乐队 - 县道184(卷首诗).mp3", "audio");
		const file = new File(
			[await zip.generateAsync({ type: "uint8array" })],
			"菊花夜行军.zip",
			{ type: "application/zip" },
		);

		await expect(readAlbumImportPreview(file, "交工乐队")).resolves.toMatchObject({
			tracks: ["两代人", "县道184(卷首诗)"],
		});
	});

	it("多首曲目共享作者前缀时无需提前填写艺术家", async () => {
		const zip = new JSZip();
		zip.file("01 - 交工乐队 - 两代人.mp3", "audio");
		zip.file("02 - 交工乐队 - 县道184(卷首诗).mp3", "audio");
		const file = new File([await zip.generateAsync({ type: "uint8array" })], "菊花夜行军.zip", { type: "application/zip" });

		await expect(readAlbumImportPreview(file)).resolves.toMatchObject({
			tracks: ["两代人", "县道184(卷首诗)"],
		});
	});

	it("预览曲目会移除合作艺术家前缀", async () => {
		const zip = new JSZip();
		zip.file("01 - Kendrick Lamar,SZA - Loved Ones.mp3", "audio");
		const file = new File([await zip.generateAsync({ type: "uint8array" })], "Unfinished Unreleased.zip", { type: "application/zip" });

		await expect(readAlbumImportPreview(file, "Kendrick Lamar")).resolves.toMatchObject({
			tracks: ["Loved Ones"],
		});
	});

	it("识别常见系统元数据路径", () => {
		for (const path of [
			"Album/._01.flac",
			"Album/__MACOSX/01.flac",
			"Album/.DS_Store",
			"Album/Thumbs.db",
			"Album/.hidden/01.flac",
			"Album/System Volume Information/01.flac",
		]) {
			expect(shouldIgnoreAlbumImportPath(path), path).toBe(true);
		}
		expect(shouldIgnoreAlbumImportPath("Album/Disc 1/01.flac")).toBe(false);
	});

	it("非 ZIP 文件仅从文件名预填专辑名", async () => {
		const file = new File(["audio"], "Live at Home.flac", {
			type: "audio/flac",
		});

		await expect(readAlbumImportPreview(file)).resolves.toMatchObject({
			title: "Live at Home",
			tracks: ["Live at Home"],
		});
	});

	it("在压缩包没有图片时读取音频的内嵌封面", async () => {
		const zip = new JSZip();
		zip.file("01 - Track.mp3", "audio");
		const file = new File(
			[await zip.generateAsync({ type: "uint8array" })],
			"Embedded Cover.zip",
			{ type: "application/zip" },
		);
		vi.mocked(parseBlob).mockResolvedValue({
			common: {
				picture: [{ data: new Uint8Array([1, 2, 3]), format: "image/png" }],
			},
		} as never);

		const preview = await readAlbumImportPreview(file);

		expect(preview.albumCoverFile?.name).toBe("cover_extracted.png");
		expect(preview.albumCoverFile?.type).toBe("image/png");
	});

	it("uses JPEG when embedded cover metadata omits its MIME type", async () => {
		vi.mocked(parseBlob).mockResolvedValue({
			common: {
				title: "Track Title",
				album: "Album Title",
				picture: [{ data: new Uint8Array([1, 2, 3]), format: "" }],
			},
		} as never);

		const preview = await readAlbumImportPreview(
			new File(["audio"], "track.mp3", { type: "audio/mpeg" }),
		);

		expect(preview.albumCoverFile).toBeInstanceOf(File);
		expect(preview.albumCoverFile?.name).toBe("cover_extracted.jpg");
		expect(preview.albumCoverFile?.type).toBe("image/jpeg");
	});
});
