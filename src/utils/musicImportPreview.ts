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

function trackTitle(fileName: string, expectedTrack = 0): string {
	const base = nameWithoutExtension(fileName)
	const multiDisc = base.match(
		/^\s*\d{1,2}\s*[-_.]\s*\d{1,3}(?:\s*[-_.]\s*|\s+)(.+?)\s*$/i,
	)
	if (multiDisc?.[1]) return multiDisc[1].trim()
	const explicitTrack = base.match(
		/^\s*(?:track\s*)?\d{1,3}\s*(?:[-_]\s*|\.\s+)(.+?)\s*$/i,
	)
	if (explicitTrack?.[1]) return explicitTrack[1].trim()
	const zeroPaddedTrack = base.match(/^\s*0\d{1,2}\s+(.+?)\s*$/)
	if (zeroPaddedTrack?.[1]) return zeroPaddedTrack[1].trim()
	const numberedTrack = base.match(/^\s*(\d{1,3})\s+(.+?)\s*$/)
	if (numberedTrack?.[1] && Number(numberedTrack[1]) === expectedTrack) {
		return numberedTrack[2].trim()
	}
	return base
}

function compactMusicText(value: string): string {
	return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "")
}

export function normalizeImportedTrackTitle(title: string, artist = ""): string {
	const normalizedTitle = title.trim()
	const normalizedArtist = artist.trim()
	if (!normalizedTitle || !normalizedArtist) return normalizedTitle
	const parts = normalizedTitle.split(/\s*(?:-|–|—)\s*/, 2)
	if (parts.length !== 2) return normalizedTitle
	const [left, right] = parts.map((part) => part.trim())
	const artistKey = compactMusicText(normalizedArtist)
	const leftKey = compactMusicText(left)
	const rightKey = compactMusicText(right)
	if (leftKey === artistKey || leftKey.startsWith(artistKey) && leftKey.length > artistKey.length) return right
	if (rightKey === artistKey || rightKey.startsWith(artistKey) && rightKey.length > artistKey.length) return left
	return normalizedTitle
}

function inferCommonTrackArtist(titles: string[]): string {
	const prefixes = titles.map((title) => title.match(/^\s*(.+?)\s+(?:-|–|—)\s+.+$/)?.[1]?.trim() || "")
	if (prefixes.length < 2 || prefixes.some((prefix) => !prefix)) return ""
	const first = compactMusicText(prefixes[0])
	return prefixes.every((prefix) => compactMusicText(prefix) === first) ? prefixes[0] : ""
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

function archiveTrackDisc(fileName: string): number {
	const match = fileName.match(/(?:^|[\\/])(?:disc|cd)\s*(\d+)/i)
	return match?.[1] ? Number(match[1]) || 1 : 1
}

function archiveTracks(paths: string[], artist = ""): string[] {
	const nextTrackByDisc = new Map<number, number>()
	const titles = paths
		.filter(isAudioPath)
		.sort((left, right) => trackPathCollator.compare(left, right))
		.map((entry) => {
			const disc = archiveTrackDisc(entry)
			const expectedTrack = (nextTrackByDisc.get(disc) ?? 0) + 1
			nextTrackByDisc.set(disc, expectedTrack)
			return trackTitle(entry.split(/[\\/]/).pop() ?? entry, expectedTrack)
		})
		.filter(Boolean)
	const knownArtist = artist || inferCommonTrackArtist(titles)
	return titles.map((title) => normalizeImportedTrackTitle(title, knownArtist))
}

async function readRarAlbumImportPreview(
	file: File,
	title: string,
	artist = "",
): Promise<MusicAlbumImportPreview> {
	if (file.size > maxRarPreviewBytes) return { title, tracks: [] };

	const [{ createExtractorFromData }, wasmModule] = await Promise.all([
		import("node-unrar-js/esm/index.esm.js"),
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
	return { title, tracks: archiveTracks(paths, artist) };
}

export type MusicAlbumImportPreview = {
	title: string;
	tracks: string[];
	artist?: string;
	albumCoverFile?: File;
};

export async function readAlbumImportPreview(
	file: File,
	artist = "",
): Promise<MusicAlbumImportPreview> {
	const title = nameWithoutExtension(file.name);

	if (isAudioPath(file.name)) {
		try {
			const metadata = await parseBlob(file);
			const metadataArtist = metadata.common.artist || metadata.common.albumartist || "";
			const trackTitle = normalizeImportedTrackTitle(metadata.common.title || title, artist || metadataArtist);
			const albumTitle = metadata.common.album || trackTitle;

			const albumCoverFile = coverFileFromPicture(metadata.common.picture?.[0]);

			const detectedArtist = metadataArtist;
			return {
				title: albumTitle,
				tracks: [trackTitle],
				...(detectedArtist ? { artist: detectedArtist } : {}),
				...(albumCoverFile ? { albumCoverFile } : {}),
			};
		} catch (e) {
			console.warn("ID3 parse failed", e);
		}
		return { title, tracks: [normalizeImportedTrackTitle(title, artist)] };
	}

	const lowerFileName = file.name.toLowerCase();
	if (lowerFileName.endsWith(".rar")) {
		return readRarAlbumImportPreview(file, title, artist);
	}
	if (!lowerFileName.endsWith(".zip")) return { title, tracks: [] };

	const archive = await JSZip.loadAsync(file);
	const entries = Object.values(archive.files).filter(
		(entry) => !entry.dir && !shouldIgnoreAlbumImportPath(entry.name),
	);
	const audioEntries = entries
		.filter((entry) => isAudioPath(entry.name))
		.sort((left, right) => trackPathCollator.compare(left.name, right.name));
	const tracks = archiveTracks(audioEntries.map((entry) => entry.name), artist);

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
