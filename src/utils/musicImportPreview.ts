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

const imageContentTypes: Record<string, string> = {
	bmp: "image/bmp",
	gif: "image/gif",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
};
const preferredCoverNames =
	/(?:^|[\s_.-])(cover|folder|front|album)(?:[\s_.-]|$)/i;
const maxRarPreviewBytes = 256 * 1024 * 1024;

function imageContentType(fileName: string): string | null {
	const extension = fileName.split(".").pop()?.toLowerCase() || "";
	return imageContentTypes[extension] ?? null;
}

function coverFileFromPicture(
	picture: { data: Uint8Array; format?: string } | undefined,
): File | undefined {
	if (!picture) return undefined;
	const contentType = picture.format?.trim() || "image/jpeg";
	const extension = coverFileExtension(contentType);
	const blob = new Blob([picture.data], { type: contentType });
	return new File([blob], `cover_extracted.${extension}`, {
		type: contentType,
	});
}

function coverFileFromArchiveImage(
	entry: JSZip.JSZipObject,
	contentType: string,
): Promise<File> {
	return entry.async("blob").then(
		(blob) =>
			new File([blob], entry.name.split("/").pop() || "cover", {
				type: contentType,
			}),
	);
}

function archiveTracks(paths: string[]): string[] {
	return paths
		.filter(isAudioPath)
		.sort((left, right) => trackPathCollator.compare(left, right))
		.map((entry) => trackTitle(entry.split("/").pop() ?? entry))
		.filter(Boolean);
}

async function readRarAlbumImportPreview(
	file: File,
	title: string,
): Promise<MusicAlbumImportPreview> {
	if (file.size > maxRarPreviewBytes) return { title, tracks: [] };

	const [{ createExtractorFromData }, wasmModule] = await Promise.all([
		import("node-unrar-js/esm"),
		import("node-unrar-js/esm/js/unrar.wasm?url"),
	]);
	const response = await fetch(wasmModule.default);
	if (!response.ok) throw new Error("无法加载 RAR 预览组件");
	const extractor = await createExtractorFromData({
		data: await file.arrayBuffer(),
		wasmBinary: await response.arrayBuffer(),
	});
	const archive = extractor.getFileList();
	if (archive.arcHeader.flags.headerEncrypted) {
		return { title, tracks: [] };
	}
	const paths = Array.from(archive.fileHeaders)
		.filter((entry) => !entry.flags.directory)
		.map((entry) => entry.name)
		.filter((entry) => !shouldIgnoreAlbumImportPath(entry));
	return { title, tracks: archiveTracks(paths) };
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

			const albumCoverFile = coverFileFromPicture(metadata.common.picture?.[0]);

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

	const lowerFileName = file.name.toLowerCase();
	if (lowerFileName.endsWith(".rar")) {
		return readRarAlbumImportPreview(file, title);
	}
	if (!lowerFileName.endsWith(".zip")) return { title, tracks: [] };

	const archive = await JSZip.loadAsync(file);
	const entries = Object.values(archive.files).filter(
		(entry) => !entry.dir && !shouldIgnoreAlbumImportPath(entry.name),
	);
	const audioEntries = entries
		.filter((entry) => isAudioPath(entry.name))
		.sort((left, right) => trackPathCollator.compare(left.name, right.name));
	const tracks = archiveTracks(audioEntries.map((entry) => entry.name));

	const imageEntries = entries
		.map((entry) => ({ entry, contentType: imageContentType(entry.name) }))
		.filter(
			(
				candidate,
			): candidate is { entry: JSZip.JSZipObject; contentType: string } =>
				!!candidate.contentType,
		)
		.sort(
			(left, right) =>
				Number(preferredCoverNames.test(right.entry.name)) -
				Number(preferredCoverNames.test(left.entry.name)),
		);
	if (imageEntries[0]) {
		return {
			title,
			tracks,
			albumCoverFile: await coverFileFromArchiveImage(
				imageEntries[0].entry,
				imageEntries[0].contentType,
			),
		};
	}

	for (const entry of audioEntries.slice(0, 8)) {
		try {
			const metadata = await parseBlob(await entry.async("blob"));
			const albumCoverFile = coverFileFromPicture(metadata.common.picture?.[0]);
			if (albumCoverFile) return { title, tracks, albumCoverFile };
		} catch {
			// A malformed audio file must not prevent the remaining files from being checked.
		}
	}

	return { title, tracks };
}
