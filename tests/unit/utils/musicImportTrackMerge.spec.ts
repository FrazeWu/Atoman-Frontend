import { describe, expect, it } from "vitest";
import type { MusicAlbumImportTrack } from "@/api/musicV1";
import type { MusicCreationFlowState } from "@/components/music/musicCreationTypes";
import { mergeImportedTracksIntoDraft } from "@/utils/musicImportTrackMerge";

function flowWithTracks(tracks: MusicCreationFlowState["draft"]["tracks"]): MusicCreationFlowState {
	return {
		draft: { tracks },
		deletedImportTrackKeys: [],
	} as unknown as MusicCreationFlowState;
}

describe("mergeImportedTracksIntoDraft", () => {
	it("uses stable file identity when the server snapshot is reordered", () => {
		const flow = flowWithTracks([
			{
				id: "local-first",
				sequence: 2,
				title: "用户改过的第二首",
				originalTrackNumber: 1,
				titleCustomized: true,
				importFileId: "file-first",
			},
		]);
		const serverTracks: MusicAlbumImportTrack[] = [
			{
				fileId: "file-first",
				audioKey: "audio-first",
				title: "First",
				trackNumber: 1,
				originalTrackNumber: 1,
				origin: "file",
			},
		];

		mergeImportedTracksIntoDraft(flow, serverTracks);

		expect(flow.draft.tracks).toHaveLength(1);
		expect(flow.draft.tracks[0]).toMatchObject({
			id: "local-first",
			title: "用户改过的第二首",
			audioKey: "audio-first",
		});
	});

	it("does not attach a stable server track to an unrelated local track by position", () => {
		const flow = flowWithTracks([
			{ id: "manual", sequence: 1, title: "Manual", origin: "manual" },
		]);
		mergeImportedTracksIntoDraft(flow, [{
			fileId: "file-server",
			audioKey: "audio-server",
			title: "Server track",
			trackNumber: 1,
			origin: "file",
		}]);

		expect(flow.draft.tracks.map((track) => track.id)).toEqual(["import-track-1", "manual"]);
	});

	it("preserves processed audio when metadata preview renames an imported track", () => {
		const flow = flowWithTracks([
			{
				id: "imported-track",
				sequence: 1,
				title: "Kendrick Lamar - Celebration",
				origin: "import",
				importFileId: "file-celebration",
				audioKey: "audio-celebration",
				audioUrl: "https://assets.example.test/celebration.mp3",
			},
		]);

		mergeImportedTracksIntoDraft(flow, [{
			title: "Celebration",
			audioKey: "",
			originalTitle: "Kendrick Lamar - Celebration",
			trackNumber: 1,
			originalTrackNumber: 1,
			origin: "local_preview:1",
		}]);

		expect(flow.draft.tracks).toHaveLength(1);
		expect(flow.draft.tracks[0]).toMatchObject({
			title: "Celebration",
			importFileId: "file-celebration",
			audioKey: "audio-celebration",
			audioUrl: "https://assets.example.test/celebration.mp3",
		});
	});
});
