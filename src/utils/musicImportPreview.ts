import JSZip from "jszip";
import { parseBlob } from "music-metadata-browser";

const audioExtensions = new Set([
	"mp3",
	"flac",
	"wav",
	"m4a",
	"aac",
	"ogg",
	"opus",
	"aiff",
	"aif",
	"wma",
	"ape",
	"alac",
]);

const trackPathCollator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
});

function nameWithoutExtension(fileName: string): string {
	return fileName.replace(/\.[^.]+$/, "").trim();
}

function trackTitle(fileName: string): string {
	const base = nameWithoutExtension(fileName);
	const multiDisc = base.match(
		/^\s*\d{1,2}\s*[-_.]\s*\d{1,3}(?:\s*[-_.]\s*|\s+)(.+?)\s*$/i,
	);
	if (multiDisc?.[1]) return multiDisc[1].trim();
	const explicitTrack = base.match(
		/^\s*(?:track\s*)?\d{1,3}\s*(?:[-_]\s*|\.\s+)(.+?)\s*$/i,
	);
	if (explicitTrack?.[1]) return explicitTrack[1].trim();
	const zeroPaddedTrack = base.match(/^\s*0\d{1,2}\s+(.+?)\s*$/);
	return zeroPaddedTrack?.[1]?.trim() || base;
}

function isAudioPath(fileName: string): boolean {
	const extension = fileName.split(".").pop()?.toLowerCase();
	return !!extension && audioExtensions.has(extension);
}

export function shouldIgnoreAlbumImportPath(fileName: string): boolean {
	const segments = fileName.replaceAll("\\", "/").split("/");
	return segments.some((rawSegment) => {
		const segment = rawSegment.trim();
		if (!segment || segment === "." || segment === "..") return false;
		if (segment.startsWith(".")) return true;
		return [
			"__macosx",
			"thumbs.db",
			"desktop.ini",
			"system volume information",
		].includes(segment.toLowerCase());
	});
}

function coverFileExtension(contentType: string): string {
	switch (contentType.toLowerCase()) {
		case "image/png":
			return "png";
		case "image/webp":
			return "webp";
		case "image/gif":
			return "gif";
		case "image/bmp":
			return "bmp";
		default:
			return "jpg";
	}
}

export type MusicAlbumImportPreview = {
	title: string;
	tracks: string[];
	artist?: string;
	albumCoverFile?: File;
};

export async function readAlbumImportPreview(
	file: File,
): Promise<MusicAlbumImportPreview> {
	const title = nameWithoutExtension(file.name);

	if (isAudioPath(file.name)) {
		try {
			const metadata = await parseBlob(file);
			const trackTitle = metadata.common.title || title;
			const albumTitle = metadata.common.album || trackTitle;

			let albumCoverFile: File | undefined;
			if (metadata.common.picture && metadata.common.picture.length > 0) {
				const picture = metadata.common.picture[0];
				const contentType = picture.format?.trim() || "image/jpeg";
				const extension = coverFileExtension(contentType);
				const blob = new Blob([picture.data], { type: contentType });
				albumCoverFile = new File([blob], `cover_extracted.${extension}`, {
					type: contentType,
				});
			}

			const artist =
				metadata.common.artist || metadata.common.albumartist || "";
			return {
				title: albumTitle,
				tracks: [trackTitle],
				...(artist ? { artist } : {}),
				...(albumCoverFile ? { albumCoverFile } : {}),
			};
		} catch (e) {
			console.warn("ID3 parse failed", e);
		}
		return { title, tracks: [title] };
	}

	if (!file.name.toLowerCase().endsWith(".zip")) return { title, tracks: [] };

	const archive = await JSZip.loadAsync(file);
	const tracks = Object.values(archive.files)
		.filter(
			(entry) =>
				!entry.dir &&
				!shouldIgnoreAlbumImportPath(entry.name) &&
				isAudioPath(entry.name),
		)
		.sort((left, right) => trackPathCollator.compare(left.name, right.name))
		.map((entry) => trackTitle(entry.name.split("/").pop() ?? entry.name))
		.filter(Boolean);

	return { title, tracks };
}
