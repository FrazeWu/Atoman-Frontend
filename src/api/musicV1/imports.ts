import { apiFetch } from "@/api/transport";
import {
	clearMusicUploadResume,
	loadMusicUploadResume,
	saveMusicUploadResume,
} from "@/utils/musicUploadResume";
import {
	apiDeleteJson,
	apiGet,
	apiGetEnvelope,
	apiPostJson,
	apiPostMultipart,
} from "../client";
import { configureApiXHR } from "../transport";
import { uploadBlobPart } from "../uploadTransport";
import type { PaginationMeta, UploadAsset, UploadPurpose } from "../types";
import {
	listResponseWithPaginationFallback,
	musicV1Endpoints,
	queryString,
} from "./core";
import {
	normalizeMusicAlbumImport,
	type AlbumEditDraft,
	type ArtistEditDraft,
	type CreateMusicAlbumImportInput,
	type MusicAlbumImport,
	type MusicAlbumImportCommitInput,
	type MusicAlbumImportFile,
	type MusicAlbumImportFilePartUpload,
	type MusicAlbumImportMultipart,
	type MusicAlbumImportMultipartPart,
	type MusicListResponse,
	type MusicAlbumImportMultipartPartUpload,
	type MusicAlbumImportMetadataPreview,
	type MusicAlbumImportMetadataPreviewInput,
	type MusicRevisionSummary,
	type MusicReleaseConversionInput,
	type MusicReleaseConversionResult,
	type SongEditDraft,
	type MusicAlbumTrackEditInput,
	type MusicUploadTarget,
	type RegisterMusicAlbumImportFileInput,
	type RegisterMusicAlbumImportFilesInput,
	type StartMusicAlbumImportMultipartInput,
	type UploadMusicAlbumArchiveOptions,
} from "./types";

type MusicAlbumImportRequestOptions = {
	signal?: AbortSignal;
};

function normalizeMusicAlbumImportMultipart(
	multipart: MusicAlbumImportMultipart,
): MusicAlbumImportMultipart {
	return {
		...multipart,
		completedParts: Array.isArray(multipart.completedParts)
			? multipart.completedParts
			: [],
	};
}

function albumPayloadFromDraft(draft: AlbumEditDraft): Record<string, unknown> {
	return {
		...(draft.title === undefined ? {} : { title: draft.title }),
		...(draft.artist_ids === undefined ? {} : { artist_ids: draft.artist_ids }),
		...(draft.artist_credits === undefined
			? {}
			: { artist_credits: draft.artist_credits }),
		...(draft.release_date === undefined
			? {}
			: { release_date: draft.release_date }),
		...(draft.cover
			? { cover_url: draft.cover.url, cover_key: draft.cover.key }
			: {}),
		...(draft.description === undefined
			? {}
			: { description: draft.description }),
		...(draft.album_type === undefined ? {} : { album_type: draft.album_type }),
		...("tracks" in draft &&
		Array.isArray(
			(draft as AlbumEditDraft & { tracks?: MusicAlbumTrackEditInput[] }).tracks,
		)
			? {
					tracks: (draft as AlbumEditDraft & { tracks?: MusicAlbumTrackEditInput[] })
						.tracks,
				}
			: {}),
	};
}

function artistPayloadFromDraft(
	draft: ArtistEditDraft,
): Record<string, unknown> {
	return {
		...(draft.name === undefined ? {} : { name: draft.name }),
		...(draft.disambiguation === undefined
			? {}
			: { disambiguation: draft.disambiguation }),
		...(draft.legal_name === undefined ? {} : { legal_name: draft.legal_name }),
		...(draft.stage_names_json === undefined
			? {}
			: { stage_names_json: draft.stage_names_json }),
		...(draft.bio === undefined ? {} : { bio: draft.bio }),
		...(draft.image_url === undefined ? {} : { image_url: draft.image_url }),
		...(draft.nationality === undefined
			? {}
			: { nationality: draft.nationality }),
		...(draft.birth_place === undefined
			? {}
			: { birth_place: draft.birth_place }),
		...(draft.birth_date === undefined ? {} : { birth_date: draft.birth_date }),
		...(draft.birth_year === undefined ? {} : { birth_year: draft.birth_year }),
		...(draft.death_year === undefined ? {} : { death_year: draft.death_year }),
		...(draft.artist_form === undefined
			? {}
			: { artist_form: draft.artist_form }),
		...(draft.active_start_date === undefined
			? {}
			: { active_start_date: draft.active_start_date }),
		...(draft.active_end_date === undefined
			? {}
			: { active_end_date: draft.active_end_date }),
		...(draft.members === undefined ? {} : { members: draft.members }),
		...(draft.sources === undefined ? {} : { sources: draft.sources }),
	};
}

export function submitArtistRevision(
	artistId: string,
	draft: ArtistEditDraft,
): Promise<MusicRevisionSummary> {
	return apiPostJson<MusicRevisionSummary>(
		musicV1Endpoints.artistRevisions(artistId),
		{
			base_revision: 0,
			changes: artistPayloadFromDraft(draft),
			edit_summary: draft.reason,
		},
	);
}

export function submitAlbumRevision(
	albumId: string,
	draft: AlbumEditDraft,
): Promise<MusicRevisionSummary> {
	return apiPostJson<MusicRevisionSummary>(
		musicV1Endpoints.albumRevisions(albumId),
		{
			base_revision: 0,
			changes: albumPayloadFromDraft(draft),
			edit_summary: draft.reason,
		},
	);
}

export function submitSongRevision(
	songId: string,
	draft: SongEditDraft,
): Promise<MusicRevisionSummary> {
	return apiPostJson<MusicRevisionSummary>(
		musicV1Endpoints.songRevisions(songId),
		{
			base_revision: 0,
			changes: {
				...(draft.title === undefined ? {} : { title: draft.title }),
				...(draft.description === undefined
					? {}
					: { description: draft.description }),
				...(draft.release_type === undefined
					? {}
					: { release_type: draft.release_type }),
				...(draft.release_date === undefined
					? {}
					: { release_date: draft.release_date }),
				...(draft.sources === undefined ? {} : { sources: draft.sources }),
				...(draft.cover ? { cover_url: draft.cover.url } : {}),
				...(draft.artist_credits === undefined
					? {}
					: { artist_credits: draft.artist_credits }),
			},
			edit_summary: draft.reason,
		},
	);
}

export function convertMusicSongToAlbum(
	songId: string,
	input: MusicReleaseConversionInput,
): Promise<MusicReleaseConversionResult> {
	return apiPostJson<MusicReleaseConversionResult>(
		musicV1Endpoints.songToAlbumConversion(songId),
		input,
	);
}

export function convertMusicAlbumToSong(
	albumId: string,
	input: MusicReleaseConversionInput,
): Promise<MusicReleaseConversionResult> {
	return apiPostJson<MusicReleaseConversionResult>(
		musicV1Endpoints.albumToSongConversion(albumId),
		input,
	);
}

export async function uploadMusicAsset(
	file: File,
	purpose: Extract<UploadPurpose, "music.cover" | "music.audio">,
	target?: MusicUploadTarget,
): Promise<UploadAsset> {
	if (purpose === "music.audio" && file.size > MAX_MUSIC_AUDIO_UPLOAD_SIZE) {
		throw new Error("音频文件不能超过 200MB");
	}
	const form = new FormData();
	form.append("file", file);
	form.append("purpose", purpose);
	if (target) {
		form.append("entity_type", target.entityType);
		form.append("entity_id", target.entityId);
		form.append("staging_id", target.stagingId);
	}
	return apiPostMultipart<UploadAsset>(musicV1Endpoints.uploads(), form);
}

export type MusicAssetUploadOptions = {
	onProgress?: (progress: { loaded: number; total: number }) => void;
	signal?: AbortSignal;
	timeoutMs?: number;
};

const resumableMusicAudioThreshold = 32 * 1024 * 1024;
export const MAX_MUSIC_AUDIO_UPLOAD_SIZE = 200 * 1024 * 1024;

type MusicAssetUploadPart = {
	part_number: number;
	etag: string;
	size: number;
};

type MusicAssetUploadSession = {
	id: string;
	status: string;
	file_name: string;
	content_type: string;
	size: number;
	part_size: number;
	completed_parts: MusicAssetUploadPart[];
	expires_at: string;
};

type MusicAssetUploadPartURL = {
	part_number: number;
	upload_url: string;
};

async function uploadMusicAudioResumable(
	file: File,
	options: MusicAssetUploadOptions,
): Promise<UploadAsset> {
	let session: MusicAssetUploadSession | undefined;
	const resumeId = await loadMusicUploadResume(file);
	if (resumeId) {
		try {
			const resumed = await apiGet<MusicAssetUploadSession>(
				musicV1Endpoints.musicUpload(resumeId),
			);
			if (
				resumed.status === "uploading" &&
				Date.parse(resumed.expires_at) > Date.now()
			) {
				session = resumed;
			} else {
				await clearMusicUploadResume(file);
			}
		} catch {
			await clearMusicUploadResume(file);
		}
	}
	if (!session) {
		session = await apiPostJson<MusicAssetUploadSession>(
			musicV1Endpoints.musicUploads(),
			{ file_name: file.name, content_type: file.type, size: file.size },
		);
		await saveMusicUploadResume(file, session.id, session.expires_at);
	}
	if (!session) throw new Error("音频上传会话创建失败");
	const activeSession = session;
	const completed = new Set(
		activeSession.completed_parts.map((part) => part.part_number),
	);
	const totalParts = Math.ceil(file.size / activeSession.part_size);
	let loaded = activeSession.completed_parts.reduce(
		(sum, part) => sum + part.size,
		0,
	);
	const reportProgress = () =>
		options.onProgress?.({
			loaded: Math.min(loaded, file.size),
			total: file.size,
		});
	const missing = Array.from(
		{ length: totalParts },
		(_, index) => index + 1,
	).filter((partNumber) => !completed.has(partNumber));

	async function uploadPart(partNumber: number): Promise<void> {
		if (options.signal?.aborted) throw new Error("音频上传已取消");
		const start = (partNumber - 1) * activeSession.part_size;
		const body = file.slice(
			start,
			Math.min(start + activeSession.part_size, file.size),
		);
		const presigned = await apiPostJson<MusicAssetUploadPartURL>(
			musicV1Endpoints.musicUploadPart(activeSession.id, partNumber),
			{},
		);
		const response = await apiFetch(presigned.upload_url, {
			method: "PUT",
			body,
			signal: options.signal,
		});
		if (!response.ok) throw new Error(`上传分片失败 (${response.status})`);
		const etag = response.headers.get("ETag") || response.headers.get("etag");
		if (!etag) throw new Error("上传分片失败");
		await apiPostJson<MusicAssetUploadSession>(
			musicV1Endpoints.musicUploadPartComplete(activeSession.id, partNumber),
			{ etag, size: body.size },
		);
		loaded += body.size;
		reportProgress();
	}

	try {
		let next = 0;
		await Promise.all(
			Array.from({ length: Math.min(3, missing.length) }, async () => {
				while (next < missing.length) {
					const partNumber = missing[next];
					next += 1;
					if (partNumber !== undefined) await retry(() => uploadPart(partNumber), 2);
				}
				return undefined;
			}),
		);
		if (missing.length === 0) reportProgress();
		const asset = await apiPostJson<UploadAsset>(
			musicV1Endpoints.musicUploadComplete(activeSession.id),
			{},
		);
		await clearMusicUploadResume(file);
		return asset;
	} catch (error) {
		if (options.signal?.aborted) {
			await apiDeleteJson<void>(
				musicV1Endpoints.musicUpload(activeSession.id),
			).catch(() => undefined);
			await clearMusicUploadResume(file);
			throw new Error("音频上传已取消");
		}
		throw error;
	}
}

type MusicAssetUploadResponse = {
	data?: UploadAsset;
	error?: { message?: string };
	message?: string;
};

export async function uploadMusicAssetWithProgress(
	file: File,
	purpose: Extract<UploadPurpose, "music.cover" | "music.audio">,
	options: MusicAssetUploadOptions = {},
): Promise<UploadAsset> {
	if (purpose === "music.audio" && file.size > MAX_MUSIC_AUDIO_UPLOAD_SIZE) {
		throw new Error("音频文件不能超过 200MB");
	}
	if (purpose === "music.audio" && file.size >= resumableMusicAudioThreshold) {
		return uploadMusicAudioResumable(file, options);
	}
	const form = new FormData();
	form.append("file", file);
	form.append("purpose", purpose);

	return new Promise<UploadAsset>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const abort = () => xhr.abort();
		if (options.signal?.aborted) {
			reject(new Error("音频上传已取消"));
			return;
		}
		xhr.open("POST", musicV1Endpoints.uploads());
		if (options.timeoutMs && options.timeoutMs > 0)
			xhr.timeout = options.timeoutMs;
		options.signal?.addEventListener("abort", abort, { once: true });
		configureApiXHR(xhr, "POST");
		xhr.setRequestHeader("Accept", "application/json");
		xhr.upload.addEventListener("progress", (event) => {
			if (event.lengthComputable) {
				options.onProgress?.({ loaded: event.loaded, total: event.total });
			}
		});
		xhr.addEventListener("load", () => {
			let payload: MusicAssetUploadResponse | null = null;
			try {
				payload = xhr.responseText
					? (JSON.parse(xhr.responseText) as MusicAssetUploadResponse)
					: null;
			} catch {
				// The status check below provides the fallback message for malformed responses.
			}
			if (xhr.status >= 200 && xhr.status < 300 && payload?.data) {
				resolve(payload.data);
				return;
			}
			reject(
				new Error(
					payload?.error?.message ||
						payload?.message ||
						`音频上传失败 (${xhr.status})`,
				),
			);
		});
		xhr.addEventListener("error", () =>
			reject(new Error("音频上传失败，请重试")),
		);
		xhr.addEventListener("timeout", () =>
			reject(new Error("音频上传超时，请重试")),
		);
		xhr.addEventListener("abort", () => reject(new Error("音频上传已取消")));
		xhr.send(form);
	});
}

export async function uploadMusicAudioBatch(
	files: File[],
): Promise<UploadAsset[]> {
	return Promise.all(files.map((file) => uploadMusicAsset(file, "music.audio")));
}

export async function createMusicAlbumImport(
	input: CreateMusicAlbumImportInput = {},
): Promise<MusicAlbumImport> {
	return normalizeMusicAlbumImport(
		await apiPostJson<MusicAlbumImport>(musicV1Endpoints.albumImports(), input),
	);
}

export async function previewMusicAlbumImportMetadata(
	input: MusicAlbumImportMetadataPreviewInput,
): Promise<MusicAlbumImportMetadataPreview> {
	return apiPostJson<MusicAlbumImportMetadataPreview>(
		musicV1Endpoints.albumImportMetadataPreview(),
		input,
	);
}

export async function getMusicAlbumImport(
	importId: string,
): Promise<MusicAlbumImport> {
	return normalizeMusicAlbumImport(
		await apiGet<MusicAlbumImport>(musicV1Endpoints.albumImport(importId)),
	);
}

export async function listMusicAlbumImports(
	filters: { page?: number; page_size?: number } = {},
): Promise<MusicListResponse<MusicAlbumImport>> {
	const response = await apiGetEnvelope<MusicAlbumImport[], PaginationMeta>(
		`${musicV1Endpoints.albumImports()}${queryString(filters)}`,
	);
	const normalized = listResponseWithPaginationFallback(response, filters);
	return {
		...normalized,
		data: normalized.data.map(normalizeMusicAlbumImport),
	};
}

export async function commitMusicAlbumImport(
	importId: string,
	input: MusicAlbumImportCommitInput,
): Promise<MusicAlbumImport> {
	return normalizeMusicAlbumImport(
		await apiPostJson<MusicAlbumImport>(
			musicV1Endpoints.albumImportCommit(importId),
			input,
		),
	);
}

export async function repairMusicAlbumImport(
	importId: string,
): Promise<MusicAlbumImport> {
	return normalizeMusicAlbumImport(
		await apiPostJson<MusicAlbumImport>(
			musicV1Endpoints.albumImportRepair(importId),
			{},
		),
	);
}

const maxAlbumArchiveBytes = 2 * 1024 * 1024 * 1024;

const SUPPORTED_ARCHIVE_EXTENSIONS = [
	".zip",
	".rar",
	".7z",
	".tar",
	".tar.gz",
	".tgz",
	".tar.bz2",
	".tar.xz",
];

export function validateMusicAlbumArchiveFile(file: File): void {
	const lower = file.name.toLowerCase();
	const supported = SUPPORTED_ARCHIVE_EXTENSIONS.some((ext) =>
		lower.endsWith(ext),
	);
	if (!supported) {
		throw new Error("请上传压缩包文件（支持 ZIP、RAR、7Z、TAR 等格式）");
	}
	if (file.size > maxAlbumArchiveBytes) {
		throw new Error("文件需在 2GB 以内，请转换或压缩后上传");
	}
}

export const SUPPORTED_ARCHIVE_ACCEPT =
	".zip,.rar,.7z,.tar,.tar.gz,.tgz,.tar.bz2,.tar.xz";

export const SUPPORTED_AUDIO_EXTENSIONS = [
	".mp3",
	".flac",
	".wav",
	".m4a",
	".aac",
	".ogg",
	".opus",
	".aiff",
	".aif",
	".wma",
	".ape",
	".alac",
];

export const SUPPORTED_AUDIO_ACCEPT = SUPPORTED_AUDIO_EXTENSIONS.join(",");

export async function startMusicAlbumImportMultipart(
	importId: string,
	input: StartMusicAlbumImportMultipartInput,
): Promise<MusicAlbumImportMultipart> {
	return normalizeMusicAlbumImportMultipart(
		await apiPostJson<MusicAlbumImportMultipart>(
			musicV1Endpoints.albumImportMultipart(importId),
			input,
		),
	);
}

export async function createMusicAlbumImportMultipartPartUpload(
	importId: string,
	partNumber: number,
): Promise<MusicAlbumImportMultipartPartUpload> {
	return apiPostJson<MusicAlbumImportMultipartPartUpload>(
		musicV1Endpoints.albumImportMultipartPart(importId, partNumber),
		{},
	);
}

export async function completeMusicAlbumImportMultipartPart(
	importId: string,
	partNumber: number,
	etag: string,
	size: number,
): Promise<MusicAlbumImportMultipartPart> {
	return apiPostJson<MusicAlbumImportMultipartPart>(
		musicV1Endpoints.albumImportMultipartPartComplete(importId, partNumber),
		{ etag, size },
	);
}

export async function completeMusicAlbumImportMultipart(
	importId: string,
): Promise<MusicAlbumImport> {
	return normalizeMusicAlbumImport(
		await apiPostJson<MusicAlbumImport>(
			musicV1Endpoints.albumImportMultipartComplete(importId),
			{},
		),
	);
}

async function retry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError;
}

async function uploadAlbumArchivePart(
	uploadUrl: string,
	body: Blob,
): Promise<string> {
	return uploadBlobPart(uploadUrl, body, { transport: "fetch" });
}

export type MusicAlbumImportPartUploadOptions = {
	signal?: AbortSignal;
	timeoutMs?: number;
	onProgress?: (progress: { loaded: number; total: number }) => void;
};

export function uploadMusicAlbumImportFilePart(
	uploadUrl: string,
	body: Blob,
	options: MusicAlbumImportPartUploadOptions = {},
): Promise<string> {
	return uploadBlobPart(uploadUrl, body, options);
}

export async function uploadMusicAlbumArchiveMultipart(
	importId: string,
	file: File,
	options: UploadMusicAlbumArchiveOptions = {},
): Promise<MusicAlbumImport> {
	validateMusicAlbumArchiveFile(file);

	const startedAt = Date.now();
	const multipart = await startMusicAlbumImportMultipart(importId, {
		fileName: file.name,
		fileSize: file.size,
		contentType: file.type || "application/octet-stream",
	});
	const completedParts = new Set(
		multipart.completedParts.map((part) => part.partNumber),
	);
	const totalParts = Math.ceil(file.size / multipart.partSize);
	let loaded = multipart.completedParts.reduce((sum, part) => {
		const start = (part.partNumber - 1) * multipart.partSize;
		return sum + Math.max(Math.min(file.size - start, multipart.partSize), 0);
	}, 0);

	const missingPartNumbers = Array.from(
		{ length: totalParts },
		(_, index) => index + 1,
	).filter((partNumber) => !completedParts.has(partNumber));

	function reportProgress(): void {
		const completedBytes = Math.min(loaded, file.size);
		const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
		options.onProgress?.({
			loaded: completedBytes,
			total: file.size,
			bytesPerSecond: completedBytes / elapsedSeconds,
		});
	}

	if (missingPartNumbers.length === 0) {
		reportProgress();
	}

	async function uploadPart(partNumber: number): Promise<void> {
		const start = (partNumber - 1) * multipart.partSize;
		const end = Math.min(start + multipart.partSize, file.size);
		const partBody = file.slice(start, end);
		const upload = await createMusicAlbumImportMultipartPartUpload(
			importId,
			partNumber,
		);
		const etag = await uploadAlbumArchivePart(upload.uploadUrl, partBody);
		await completeMusicAlbumImportMultipartPart(
			importId,
			partNumber,
			etag,
			partBody.size,
		);

		loaded += partBody.size;
		reportProgress();
	}

	let cursor = 0;
	const workers = Array.from(
		{ length: Math.min(3, missingPartNumbers.length) },
		async () => {
			while (cursor < missingPartNumbers.length) {
				const partNumber = missingPartNumbers[cursor];
				cursor += 1;
				await retry(() => uploadPart(partNumber), 2);
			}
			return undefined;
		},
	);

	await Promise.all(workers);
	return completeMusicAlbumImportMultipart(importId);
}

export async function registerMusicAlbumImportFiles(
	importId: string,
	input: RegisterMusicAlbumImportFilesInput,
): Promise<MusicAlbumImport> {
	return normalizeMusicAlbumImport(
		await apiPostJson<MusicAlbumImport>(
			musicV1Endpoints.albumImportFiles(importId),
			input,
		),
	);
}

export async function createMusicAlbumImportFilePartUpload(
	importId: string,
	fileId: string,
	partNumber: number,
	partSize: number,
	options: MusicAlbumImportRequestOptions = {},
): Promise<MusicAlbumImportFilePartUpload> {
	return apiPostJson<MusicAlbumImportFilePartUpload>(
		musicV1Endpoints.albumImportFilePart(importId, fileId, partNumber),
		{ partSize },
		options,
	);
}

export async function completeMusicAlbumImportFilePart(
	importId: string,
	fileId: string,
	partNumber: number,
	etag: string,
	size: number,
	options: MusicAlbumImportRequestOptions = {},
): Promise<MusicAlbumImportFile> {
	return apiPostJson<MusicAlbumImportFile>(
		musicV1Endpoints.albumImportFilePartComplete(importId, fileId, partNumber),
		{ etag, size },
		options,
	);
}

export async function completeMusicAlbumImportFile(
	importId: string,
	fileId: string,
	options: MusicAlbumImportRequestOptions = {},
): Promise<MusicAlbumImportFile> {
	return apiPostJson<MusicAlbumImportFile>(
		musicV1Endpoints.albumImportFileComplete(importId, fileId),
		{},
		options,
	);
}

export async function retryMusicAlbumImportFile(
	importId: string,
	fileId: string,
): Promise<MusicAlbumImport> {
	return normalizeMusicAlbumImport(
		await apiPostJson<MusicAlbumImport>(
			musicV1Endpoints.albumImportFileRetry(importId, fileId),
			{},
		),
	);
}

export async function replaceMusicAlbumImportFile(
	importId: string,
	fileId: string,
	input: RegisterMusicAlbumImportFileInput,
): Promise<MusicAlbumImportFile> {
	return apiPostJson<MusicAlbumImportFile>(
		musicV1Endpoints.albumImportFileReplace(importId, fileId),
		input,
	);
}

export async function replaceAndUploadMusicAlbumImportFile(
	importId: string,
	fileId: string,
	file: File,
): Promise<void> {
	const partSize = 16 * 1024 * 1024;
	await replaceMusicAlbumImportFile(importId, fileId, {
		relativePath: file.name,
		fileName: file.name,
		fileSize: file.size,
		contentType: file.type || "application/octet-stream",
	});
	const totalParts = Math.max(1, Math.ceil(file.size / partSize));
	for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
		const start = (partNumber - 1) * partSize;
		const upload = await createMusicAlbumImportFilePartUpload(
			importId,
			fileId,
			partNumber,
			partSize,
		);
		const chunk = file.slice(start, Math.min(start + partSize, file.size));
		const etag = await uploadAlbumArchivePart(upload.uploadUrl, chunk);
		await completeMusicAlbumImportFilePart(
			importId,
			fileId,
			partNumber,
			etag,
			chunk.size,
		);
	}
	await completeMusicAlbumImportFile(importId, fileId);
}

export async function deleteMusicAlbumImportFile(
	importId: string,
	fileId: string,
): Promise<void> {
	await apiDeleteJson<void>(
		musicV1Endpoints.albumImportFileDelete(importId, fileId),
	);
}

export async function completeMusicAlbumImportSession(
	importId: string,
	options: MusicAlbumImportRequestOptions = {},
): Promise<MusicAlbumImport> {
	return normalizeMusicAlbumImport(
		await apiPostJson<MusicAlbumImport>(
			musicV1Endpoints.albumImportSessionComplete(importId),
			{},
			options,
		),
	);
}

export async function cancelMusicAlbumImportSession(
	importId: string,
): Promise<void> {
	await apiDeleteJson<void>(musicV1Endpoints.albumImportSessionCancel(importId));
}

export async function deleteMusicAlbumImportRecord(
	importId: string,
): Promise<void> {
	await apiDeleteJson<void>(musicV1Endpoints.albumImportRecord(importId));
}

export async function uploadMusicAlbumArchive(
	importId: string,
	file: File,
	options: UploadMusicAlbumArchiveOptions = {},
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const form = new FormData();
		form.append("archive", file);

		const xhr = new XMLHttpRequest();
		const startedAt = Date.now();
		xhr.open("POST", musicV1Endpoints.albumImportArchive(importId));
		configureApiXHR(xhr, "POST");
		xhr.setRequestHeader("Accept", "application/json");

		xhr.upload.addEventListener("progress", (event) => {
			if (!event.lengthComputable) return;
			const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
			options.onProgress?.({
				loaded: event.loaded,
				total: event.total,
				bytesPerSecond: event.loaded / elapsedSeconds,
			});
		});

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve();
				return;
			}
			try {
				const payload = xhr.responseText
					? (JSON.parse(xhr.responseText) as { error?: { message?: string } })
					: null;
				const message = payload?.error?.message?.trim();
				reject(new Error(message || `上传压缩包失败 (${xhr.status})`));
			} catch {
				reject(new Error(`上传压缩包失败 (${xhr.status})`));
			}
		});

		xhr.addEventListener("error", () => {
			reject(new Error("上传压缩包失败"));
		});

		xhr.addEventListener("abort", () => {
			reject(new Error("上传已取消"));
		});

		xhr.send(form);
	});
}
