import type { MusicAlbumImportTrack } from "@/api/musicV1";
import {
	normalizeImportedTrackTitle,
	shouldIgnoreAlbumImportPath,
	archiveTracks,
	archiveTrackDetails,
	type MusicAlbumImportPreview,
} from "@/utils/musicImportCore";
import {
	readAlbumImportPreviewAsync,
	readAlbumImportFilesPreviewAsync,
	parseAudioTrackTitleAsync,
} from "@/utils/audioMetadataWorkerClient";

export {
	normalizeImportedTrackTitle,
	shouldIgnoreAlbumImportPath,
	archiveTracks,
	archiveTrackDetails,
	parseAudioTrackTitleAsync,
};
export type { MusicAlbumImportPreview, MusicAlbumImportTrack };

export async function readAlbumImportPreview(
	file: File,
	artist = "",
	onProgress?: (ratio: number) => void,
): Promise<MusicAlbumImportPreview> {
	return readAlbumImportPreviewAsync(file, artist, onProgress);
}

export async function readAlbumImportFilesPreview(
	files: File[],
	artist = "",
	onProgress?: (ratio: number) => void,
): Promise<MusicAlbumImportPreview> {
	return readAlbumImportFilesPreviewAsync(files, artist, onProgress);
}
