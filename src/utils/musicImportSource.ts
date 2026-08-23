const internalImportErrorSources = new Set([
	"处理上传失败",
	"上传失败",
	"音频上传失败",
	"音频上传失败，请重试",
]);

export function isMusicBrainzSource(value?: string | null) {
	const normalized = value?.trim() ?? ""
	if (!normalized) return false
	if (normalized.toLowerCase() === "musicbrainz") return true
	try {
		const url = new URL(normalized)
		return (
			(url.hostname === "musicbrainz.org" || url.hostname === "www.musicbrainz.org") &&
			/^\/(release|release-group)\//.test(url.pathname)
		)
	} catch {
		return false
	}
}

export function hasMusicBrainzSource(
	sources?: Array<{ url?: string | null; title?: string | null }>,
) {
	return sources?.some((source) => isMusicBrainzSource(source.url) || isMusicBrainzSource(source.title)) ?? false
}
