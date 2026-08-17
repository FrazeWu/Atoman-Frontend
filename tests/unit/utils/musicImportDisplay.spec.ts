import { describe, expect, it } from "vitest";
import type { MusicAlbumImport } from "../../../src/api/musicV1";
import {
	musicImportAlbumTitle,
	musicImportGroupForStatus,
	uniqueMusicAlbumImports,
} from "../../../src/utils/musicImportDisplay";

function importRecord(
	overrides: Partial<MusicAlbumImport> = {},
): MusicAlbumImport {
	return {
		importId: "import-1",
		targetAlbumId: "",
		albumTitle: "",
		status: "ready",
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
		inputMode: "auto",
		stage: "upload",
		progress: { current: 0, total: 0 },
		files: [],
		errors: [],
		...overrides,
	};
}

describe("music import album display", () => {
	it("prefers the final album title and never uses a track or file as the title", () => {
		expect(
			musicImportAlbumTitle(
				importRecord({
					albumTitle: "Late Registration",
					derivedAlbumTitle: "Archive Guess",
					archiveName: "upload.rar",
					derivedTracks: [
						{ title: "Wake Up Mr. West", audioKey: "", origin: "tag" },
					],
				}),
			),
		).toBe("Late Registration");

		expect(
			musicImportAlbumTitle(
				importRecord({
					archiveName: "upload.rar",
					derivedTracks: [
						{ title: "Wake Up Mr. West", audioKey: "", origin: "tag" },
					],
				}),
			),
		).toBe("未命名专辑");
	});

	it("counts repeated sessions for the same target album once", () => {
		const records = uniqueMusicAlbumImports([
			importRecord({ importId: "latest", targetAlbumId: "album-1" }),
			importRecord({ importId: "older", targetAlbumId: "album-1" }),
			importRecord({ importId: "draft-1" }),
			importRecord({ importId: "draft-2" }),
		]);

		expect(records.map((item) => item.importId)).toEqual([
			"latest",
			"draft-1",
			"draft-2",
		]);
	});

	it("deduplicates unresolved retries for the same artist and album title", () => {
		const records = uniqueMusicAlbumImports([
			importRecord({
				importId: "latest-retry",
				artistId: "artist-1",
				albumTitle: "GNX",
			}),
			importRecord({
				importId: "older-retry",
				artistId: "artist-1",
				albumTitle: " gnx ",
			}),
			importRecord({
				importId: "other-album",
				artistId: "artist-1",
				albumTitle: "DAMN.",
			}),
		]);

		expect(records.map((item) => item.importId)).toEqual([
			"latest-retry",
			"other-album",
		]);
	});

	it("keeps unresolved imports separate when artist or title is unavailable", () => {
		const records = uniqueMusicAlbumImports([
			importRecord({ importId: "missing-artist-1", albumTitle: "GNX" }),
			importRecord({ importId: "missing-artist-2", albumTitle: "GNX" }),
		]);

		expect(records.map((item) => item.importId)).toEqual([
			"missing-artist-1",
			"missing-artist-2",
		]);

		const retried = uniqueMusicAlbumImports([
			importRecord({
				importId: "archive-latest",
				albumTitle: "GNX",
				archiveName: "GNX.zip",
				status: "needs_attention",
			}),
			importRecord({
				importId: "archive-older",
				albumTitle: "gnx",
				archiveName: "gnx.zip",
				status: "needs_attention",
			}),
		]);
		expect(retried.map((item) => item.importId)).toEqual(["archive-latest"]);
	});

	it("maps import statuses to the four center groups", () => {
		expect(musicImportGroupForStatus("ready")).toBe("in_progress");
		expect(musicImportGroupForStatus("analyzing")).toBe("in_progress");
		expect(musicImportGroupForStatus("failed")).toBe("needs_attention");
		expect(musicImportGroupForStatus("committed")).toBe("published");
	});
});
