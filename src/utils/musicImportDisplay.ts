import type { MusicAlbumImport } from "@/api/musicV1";

export type MusicImportGroup =
	| "in_progress"
	| "needs_attention"
	| "published"
	| "canceled";

function archiveTitle(value: string): string {
	return value.replace(/\.(?:zip|rar|7z|tar(?:\.(?:bz2|gz|xz))?)$/i, "").trim();
}

export function musicImportAlbumTitle(item: MusicAlbumImport): string {
	return (
		item.albumTitle?.trim() ||
		item.derivedAlbumTitle?.trim() ||
		archiveTitle(item.archiveName?.trim() || "") ||
		"待上传专辑"
	);
}

export function musicImportGroupForStatus(status: string): MusicImportGroup {
	if (status === "committed") return "published";
	if (status === "canceled") return "canceled";
	if (["needs_attention", "failed"].includes(status)) return "needs_attention";
	return "in_progress";
}

function normalizedImportIdentityPart(value?: string | null): string {
	return value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") || "";
}

function importIdentityKey(item: MusicAlbumImport): string {
	const targetSongId = item.targetSongId?.trim();
	if (targetSongId) return `song:${targetSongId}`;
	const targetAlbumId = item.targetAlbumId?.trim();
	if (targetAlbumId) return `album:${targetAlbumId}`;

	const title = normalizedImportIdentityPart(
		item.albumTitle || item.derivedAlbumTitle,
	);
	const artistId = normalizedImportIdentityPart(item.artistId);
	if (artistId && title) return `draft:${artistId}:${title}`;

	const archiveName = normalizedImportIdentityPart(item.archiveName);
	if (
		title &&
		archiveName &&
		["needs_attention", "failed"].includes(item.status)
	) {
		return `retry:${title}:${archiveName}`;
	}

	return `import:${item.importId}`;
}

export function uniqueMusicAlbumImports(
	items: MusicAlbumImport[],
): MusicAlbumImport[] {
	const seen = new Set<string>();

	return items.filter((item) => {
		const key = importIdentityKey(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
