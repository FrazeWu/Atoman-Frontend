import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { parseBlob } from "music-metadata-browser";
import {
	readAlbumImportPreview,
	shouldIgnoreAlbumImportPath,
} from "../../../src/utils/musicImportPreview";

vi.mock("music-metadata-browser", () => ({
	parseBlob: vi.fn(),
}));

describe("readAlbumImportPreview", () => {
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

		await expect(readAlbumImportPreview(file)).resolves.toEqual({
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
