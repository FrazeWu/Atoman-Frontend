const internalImportErrorSources = new Set([
	"处理上传失败",
	"上传失败",
	"音频上传失败",
	"音频上传失败，请重试",
]);

export function normalizeMusicImportSource(value?: string | null) {
	const normalized = value?.trim() ?? "";
	return internalImportErrorSources.has(normalized) ? "" : normalized;
}
