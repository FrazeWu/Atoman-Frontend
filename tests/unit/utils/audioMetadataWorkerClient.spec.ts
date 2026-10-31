import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBlob } from "music-metadata";
import {
	parseAudioTrackTitleAsync,
	readAlbumImportPreviewAsync,
	readAlbumImportFilesPreviewAsync,
	terminateAudioMetadataWorker,
} from "@/utils/audioMetadataWorkerClient";

vi.mock("music-metadata", () => ({
	parseBlob: vi.fn(),
}));

describe("audioMetadataWorkerClient (Fallback & Core Integration)", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
		terminateAudioMetadataWorker();
	});

	it("在 Worker 不可用时无缝降级提取单曲音频标题", async () => {
		vi.mocked(parseBlob).mockResolvedValueOnce({
			common: {
				title: "Beethoven - Moonlight Sonata",
				artist: "Beethoven",
			},
		} as never);

		const fakeFile = new File(["audio"], "01 - Moonlight Sonata.mp3", {
			type: "audio/mp3",
		});
		const title = await parseAudioTrackTitleAsync(fakeFile, fakeFile.name, "Beethoven");
		expect(title).toBe("Moonlight Sonata");
	});

	it("单曲解析异常时优雅回退为文件名提取标题", async () => {
		vi.mocked(parseBlob).mockRejectedValueOnce(new Error("Corrupt audio header"));

		const fakeFile = new File(["corrupted"], "02 Track Title.wav", {
			type: "audio/wav",
		});
		const title = await parseAudioTrackTitleAsync(fakeFile, fakeFile.name);
		expect(title).toBe("Track Title");
	});

	it("支持 ZIP 归档预览与进度回调", async () => {
		const zip = new JSZip();
		zip.file("01 - First Movement.flac", "audio");
		zip.file("02 - Second Movement.flac", "audio");
		zip.file("cover.jpg", "cover_data");

		const zipFile = new File(
			[await zip.generateAsync({ type: "uint8array" })],
			"Sonatas.zip",
			{ type: "application/zip" },
		);

		const progressValues: number[] = [];
		const preview = await readAlbumImportPreviewAsync(
			zipFile,
			"",
			(ratio) => progressValues.push(ratio),
		);

		expect(preview.title).toBe("Sonatas");
		expect(preview.tracks).toEqual(["First Movement", "Second Movement"]);
		expect(preview.albumCoverFile).toBeDefined();
		expect(progressValues.length).toBeGreaterThan(0);
		expect(progressValues[progressValues.length - 1]).toBe(1);
	});

	it("支持多文件批量列表解析与进度回调", async () => {
		vi.mocked(parseBlob).mockResolvedValue({ common: {} } as never);

		const files = [
			new File(["audio1"], "Chopin - Nocturne Op 9 No 2.mp3"),
			new File(["audio2"], "Chopin - Ballade No 1.mp3"),
		];

		const progressValues: number[] = [];
		const preview = await readAlbumImportFilesPreviewAsync(
			files,
			"Chopin",
			(ratio) => progressValues.push(ratio),
		);

		expect(preview.tracks).toEqual(["Ballade No 1", "Nocturne Op 9 No 2"]);
		expect(progressValues.length).toBeGreaterThan(0);
	});
});
