import JSZip from "jszip";
import { parseBlob } from "music-metadata";
import type { MusicAlbumImportTrack } from "@/api/musicV1";

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
	// 优先使用有空格的分隔符，保留 Ab-Soul 和歌曲后缀中的连字符。
	const separator = /\s+(?:-|–|—)\s+/.exec(normalizedTitle) ?? /(?:-|–|—)/.exec(normalizedTitle)
	if (!separator) return normalizedTitle
	const left = normalizedTitle.slice(0, separator.index).trim()
	const right = normalizedTitle.slice(separator.index + separator[0].length).trim()
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
	return !!extension && (audioExtensions.has(extension) || ["mp4", "mkv", "mov", "webm", "avi", "m4v"].includes(extension));
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

function archiveTrackDetails(paths: string[], artist = ""): MusicAlbumImportTrack[] {
	const sorted = paths.filter(isAudioPath).sort((left, right) => trackPathCollator.compare(left, right));
	const titles = archiveTracks(sorted, artist);
	const nextByDisc = new Map<number, number>();
	return sorted.map((origin, index) => {
		const discNumber = archiveTrackDisc(origin);
		const trackNumber = (nextByDisc.get(discNumber) ?? 0) + 1;
		nextByDisc.set(discNumber, trackNumber);
		return { title: titles[index], origin, audioKey: "", discNumber, trackNumber, originalTitle: titles[index], originalDiscNumber: discNumber, originalTrackNumber: trackNumber };
	});
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
	return { title, tracks: archiveTracks(paths, artist), trackDetails: archiveTrackDetails(paths, artist) };
}

export type MusicAlbumImportPreview = {
	title: string;
	tracks: string[];
	trackDetails?: MusicAlbumImportTrack[];
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
				trackDetails: [{ title: trackTitle, origin: file.name, audioKey: "", discNumber: metadata.common.disk?.no || undefined, trackNumber: metadata.common.track?.no || undefined, originalTitle: trackTitle, originalDiscNumber: metadata.common.disk?.no || undefined, originalTrackNumber: metadata.common.track?.no || undefined }],
				...(detectedArtist ? { artist: detectedArtist } : {}),
				...(albumCoverFile ? { albumCoverFile } : {}),
			};
		} catch {
			// 没有可读标签时保留文件名，上传和匹配均可继续。
		}
		return { title, tracks: [normalizeImportedTrackTitle(title, artist)], trackDetails: [{ title: normalizeImportedTrackTitle(title, artist), origin: file.name, audioKey: '' }] };
	}

	const lowerFileName = file.name.toLowerCase();
	if (lowerFileName.endsWith(".rar")) {
		return readRarAlbumImportPreview(file, title, artist);
	}
	if (/\.tar(?:\.gz)?$/.test(lowerFileName)) {
		const buffer = lowerFileName.endsWith('.gz')
			? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
			: await file.arrayBuffer();
		const bytes = new Uint8Array(buffer);
		const decoder = new TextDecoder();
		const paths: string[] = [];
		for (let offset = 0; offset + 512 <= bytes.length;) {
			const name = decoder.decode(bytes.slice(offset, offset + 100)).split('\0')[0];
			if (!name) break;
			const size = parseInt(decoder.decode(bytes.slice(offset + 124, offset + 136)).replace(/\0/g, '').trim(), 8) || 0;
			const prefix = decoder.decode(bytes.slice(offset + 345, offset + 500)).split('\0')[0];
			const origin = prefix ? `${prefix}/${name}` : name;
			if (!shouldIgnoreAlbumImportPath(origin)) paths.push(origin);
			offset += 512 + Math.ceil(size / 512) * 512;
		}
		if (paths.some((path) => /\.cue$/i.test(path))) return { title, tracks: [] };
		return { title: title.replace(/\.tar$/i, ''), tracks: archiveTracks(paths, artist), trackDetails: archiveTrackDetails(paths, artist) };
	}
	if (!lowerFileName.endsWith(".zip")) return { title, tracks: [] };

	const archive = await JSZip.loadAsync(file);
	const entries = Object.values(archive.files).filter(
		(entry) => !entry.dir && !shouldIgnoreAlbumImportPath(entry.name),
	);
	const audioEntries = entries
		.filter((entry) => isAudioPath(entry.name))
		.sort((left, right) => trackPathCollator.compare(left.name, right.name));
	// CUE 会把一个来源文件拆成多首曲目，交给后端解析，避免提前锁定错误列表。
	if (entries.some((entry) => /\.cue$/i.test(entry.name))) return { title, tracks: [] };
	const details = archiveTrackDetails(audioEntries.map((entry) => entry.name), artist);
	let detectedArtist = "";
	let detectedTitle = title;
	let embeddedCover: File | undefined;
	for (let offset = 0; offset < audioEntries.length; offset += 3) {
		await Promise.all(audioEntries.slice(offset, offset + 3).map(async (entry, innerIndex) => {
			try {
				const metadata = await parseBlob(await entry.async("blob"));
				const detail = details[offset + innerIndex];
				const tagArtist = metadata.common.albumartist || metadata.common.artist || "";
				if (tagArtist && !detectedArtist) detectedArtist = tagArtist;
				if (metadata.common.album) detectedTitle = metadata.common.album;
				detail.title = normalizeImportedTrackTitle(metadata.common.title || detail.title, artist || tagArtist);
				detail.originalTitle = detail.title;
				detail.discNumber = detail.originalDiscNumber = metadata.common.disk?.no || detail.discNumber;
				detail.trackNumber = detail.originalTrackNumber = metadata.common.track?.no || detail.trackNumber;
				embeddedCover ||= coverFileFromPicture(metadata.common.picture?.[0]);
			} catch { /* 文件名仍可用于元信息预览。 */ }
		}));
	}
	const knownArtist = artist || detectedArtist || inferCommonTrackArtist(details.map((track) => track.title));
	for (const detail of details) detail.title = normalizeImportedTrackTitle(detail.title, knownArtist);
	const preview = { title: detectedTitle, tracks: details.map((track) => track.title), trackDetails: details, ...(detectedArtist ? { artist: detectedArtist } : {}) };

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
			...preview,
			albumCoverFile: await coverFileFromArchiveImage(
				imageEntries[0].entry,
				imageEntries[0].contentType,
			),
		};
	}

	return { ...preview, ...(embeddedCover ? { albumCoverFile: embeddedCover } : {}) };
}

export async function readAlbumImportFilesPreview(files: File[], artist = ''): Promise<MusicAlbumImportPreview> {
	const media = files.filter((file) => isAudioPath(file.name));
	const origins = media.map((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
	const details = archiveTrackDetails(origins, artist);
	const byOrigin = new Map(details.map((track) => [track.origin, track]));
	let title = origins[0]?.includes('/') ? origins[0].split('/')[0] : '';
	let detectedArtist = artist;
	let cover = files.find((file) => imageContentType(file.name));
	for (let offset = 0; offset < media.length; offset += 3) {
		await Promise.all(media.slice(offset, offset + 3).map(async (file) => {
			const preview = await readAlbumImportPreview(file, artist);
			const origin = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
			const detail = byOrigin.get(origin)!;
			detail.title = detail.originalTitle = preview.tracks[0] || detail.title;
			if (preview.trackDetails?.[0].trackNumber) detail.trackNumber = detail.originalTrackNumber = preview.trackDetails[0].trackNumber;
			if (preview.trackDetails?.[0].discNumber) detail.discNumber = detail.originalDiscNumber = preview.trackDetails[0].discNumber;
			title ||= preview.title;
			detectedArtist ||= preview.artist || '';
			cover ||= preview.albumCoverFile;
		}));
	}
	const knownArtist = detectedArtist || inferCommonTrackArtist(details.map((track) => track.title));
	for (const detail of details) {
		detail.title = normalizeImportedTrackTitle(detail.title, knownArtist);
	}
	return { title, tracks: details.map((track) => track.title), trackDetails: details, artist: detectedArtist, albumCoverFile: cover };
}
