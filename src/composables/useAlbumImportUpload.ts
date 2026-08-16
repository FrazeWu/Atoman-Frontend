import { apiRequest } from "@/api/client";
import { ref, computed } from "vue";
import {
	createMusicAlbumImport,
	validateMusicAlbumArchiveFile,
	SUPPORTED_ARCHIVE_ACCEPT,
	createMusicAlbumImportFilePartUpload,
	completeMusicAlbumImportFilePart,
	completeMusicAlbumImportFile,
	registerMusicAlbumImportFiles,
	getMusicAlbumImport,
	retryMusicAlbumImportFile,
	replaceMusicAlbumImportFile,
	deleteMusicAlbumImportFile,
	cancelMusicAlbumImportSession,
	type MusicAlbumImport,
	type MusicAlbumImportInputMode,
} from "@/api/musicV1";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import {
	readAlbumImportPreview,
	shouldIgnoreAlbumImportPath,
} from "@/utils/musicImportPreview";
import { parseMusicLyricDraft } from "@/utils/musicLyricsDraft";
import { parsePartialDateParts } from "@/components/music/birthDateMask";

// Global state for album import upload so it survives step transitions
const uploading = ref(false);
const errorMessage = ref("");
const fileProgress = ref<Map<string, number>>(new Map());
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let uploadStartedAt = 0;
let operationGeneration = 0;
let pollingGeneration = 0;

const FILE_PART_SIZE = 10 * 1024 * 1024; // 10MB
const selectedFiles = new Map<string, File>();

export function useAlbumImportUpload() {
	const { state, setMusicCreationStep } = useMusicDrawers();

	const creationFlow = computed(() => state.value.creationFlow);
	const albumImportDraft = computed(
		() => creationFlow.value?.draft.albumImport ?? null,
	);

	function applyImportSnapshot(
		snapshot: MusicAlbumImport,
		expectedImportId = snapshot.importId,
	) {
		if (
			!creationFlow.value ||
			albumImportDraft.value?.importId !== expectedImportId
		)
			return false;
		const derivedTracks = snapshot.derivedTracks ?? [];
		const previousDerivedAlbumType =
			creationFlow.value.draft.albumImport.derivedAlbumType;
		const previousMetadataSourceURL =
			creationFlow.value.draft.albumImport.metadataSourceUrl;

		creationFlow.value.draft.albumImport.importId = snapshot.importId;
		creationFlow.value.draft.albumImport.inputMode = snapshot.inputMode;
		creationFlow.value.draft.albumImport.status = snapshot.status;
		creationFlow.value.draft.albumImport.stage = snapshot.stage;
		creationFlow.value.draft.albumImport.archiveName = snapshot.archiveName;
		if (snapshot.stage === "upload") {
			creationFlow.value.draft.albumImport.uploadProgress =
				snapshot.uploadProgress;
			creationFlow.value.draft.albumImport.uploadSpeed = snapshot.uploadSpeed;
			if (snapshot.progress.total > 0) {
				creationFlow.value.draft.albumImport.totalBytesLoaded =
					snapshot.progress.current;
				creationFlow.value.draft.albumImport.totalBytesTotal =
					snapshot.progress.total;
			}
		} else {
			creationFlow.value.draft.albumImport.uploadSpeed = 0;
		}
		creationFlow.value.draft.albumImport.coverUrl = snapshot.coverUrl;
		creationFlow.value.draft.albumImport.coverKey = snapshot.coverKey;
		creationFlow.value.draft.albumImport.derivedAlbumTitle =
			snapshot.derivedAlbumTitle;
		if (snapshot.derivedCover) {
			creationFlow.value.draft.albumImport.derivedCover = snapshot.derivedCover;
		}
		if (derivedTracks.length > 0) {
			creationFlow.value.draft.albumImport.derivedTracks = derivedTracks;
		}
		creationFlow.value.draft.albumImport.derivedReleaseDate =
			snapshot.derivedReleaseDate;
		creationFlow.value.draft.albumImport.derivedAlbumType =
			snapshot.derivedAlbumType;
		creationFlow.value.draft.albumImport.metadataSourceUrl =
			snapshot.metadataSourceUrl;
		creationFlow.value.draft.albumImport.missingArtists =
			snapshot.missingArtists ?? [];
		creationFlow.value.draft.albumImport.lastSyncedAt = snapshot.lastSyncedAt;
		creationFlow.value.draft.albumImport.errorMessage =
			snapshot.errorMessage || snapshot.errors?.[0]?.message || "";
		creationFlow.value.draft.albumImport.files = snapshot.files ?? [];
		if (!creationFlow.value.titleCustomized) {
			creationFlow.value.draft.albumDetails.title =
				snapshot.derivedAlbumTitle ||
				creationFlow.value.draft.albumDetails.title;
		}
		if (
			snapshot.derivedReleaseDate &&
			!creationFlow.value.draft.albumDetails.releaseDate.trim()
		) {
			creationFlow.value.draft.albumDetails.releaseDateParts =
				parsePartialDateParts(snapshot.derivedReleaseDate);
		}
		if (
			snapshot.derivedAlbumType &&
			(!previousDerivedAlbumType ||
				creationFlow.value.draft.albumDetails.type === previousDerivedAlbumType)
		) {
			creationFlow.value.draft.albumDetails.type = snapshot.derivedAlbumType;
		}
		if (
			snapshot.metadataSourceUrl &&
			(!creationFlow.value.draft.albumDetails.source.trim() ||
				creationFlow.value.draft.albumDetails.source ===
					previousMetadataSourceURL)
		) {
			creationFlow.value.draft.albumDetails.source = snapshot.metadataSourceUrl;
		}

		if (!creationFlow.value.tracksCustomized && derivedTracks.length > 0) {
			creationFlow.value.draft.tracks = derivedTracks.map((track, index) => ({
				id: `import-track-${index + 1}`,
				...(track.songId ? { songId: track.songId } : {}),
				sequence: track.trackNumber ?? index + 1,
				...(track.discNumber ? { discNumber: track.discNumber } : {}),
				title: track.title,
				audioKey: track.audioKey,
				origin: track.origin,
				...(track.lyrics
					? {
							lyrics: track.lyrics.content,
							lyricsDraft: {
								content: track.lyrics.content,
								translation: track.lyrics.translation || "",
								format: track.lyrics.format,
								language: track.lyrics.language || "",
								editSummary: track.lyrics.edit_summary || "自动匹配歌词",
								lines: parseMusicLyricDraft(
									track.lyrics.content,
									track.lyrics.translation || "",
									track.lyrics.format,
								).map((row) => ({
									line_key: row.lineKey,
									text: row.original,
									translation: row.translation,
									time_ms: row.timeMs,
								})),
							},
						}
					: {}),
			}));
		}
		return true;
	}

	function startPolling(importId: string) {
		if (pollTimer) clearTimeout(pollTimer);
		const generation = ++pollingGeneration;
		const poll = async () => {
			if (
				generation !== pollingGeneration ||
				albumImportDraft.value?.importId !== importId
			) {
				pollTimer = null;
				return;
			}
			try {
				const snapshot = await getMusicAlbumImport(importId);
				if (
					generation !== pollingGeneration ||
					!applyImportSnapshot(snapshot, importId)
				)
					return;
				const done = [
					"ready",
					"needs_attention",
					"failed",
					"canceled",
					"committed",
				].includes(snapshot.status);
				pollTimer = done ? null : setTimeout(poll, 3000);
			} catch {
				if (
					generation === pollingGeneration &&
					albumImportDraft.value?.importId === importId
				) {
					pollTimer = setTimeout(poll, 5000);
				}
			}
		};
		pollTimer = setTimeout(poll, 2000);
	}

	function stopPolling() {
		pollingGeneration += 1;
		if (pollTimer) {
			clearTimeout(pollTimer);
			pollTimer = null;
		}
	}

	async function uploadSingleFileMultipart(
		importId: string,
		file: File,
		fileId: string,
		isCurrent: () => boolean = () =>
			albumImportDraft.value?.importId === importId,
	): Promise<void> {
		const totalParts = Math.ceil(file.size / FILE_PART_SIZE);
		for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
			if (!isCurrent()) return;
			const start = (partNumber - 1) * FILE_PART_SIZE;
			const end = Math.min(start + FILE_PART_SIZE, file.size);
			const chunk = file.slice(start, end);
			const partSize = end - start;

			const upload = await createMusicAlbumImportFilePartUpload(
				importId,
				fileId,
				partNumber,
				partSize,
			);

			const response = await apiRequest(upload.uploadUrl, {
				method: "PUT",
				body: chunk,
			});
			if (!response.ok) throw new Error(`分片 ${partNumber} 上传失败`);

			const etag = response.headers.get("ETag") ?? "";
			await completeMusicAlbumImportFilePart(
				importId,
				fileId,
				partNumber,
				etag,
				partSize,
			);

			if (!isCurrent()) return;

			fileProgress.value = new Map(fileProgress.value).set(
				fileId,
				Math.round((end / file.size) * 100),
			);

			if (albumImportDraft.value?.importId === importId) {
				albumImportDraft.value.totalBytesLoaded += partSize;
				const elapsedSeconds = Math.max(
					(Date.now() - uploadStartedAt) / 1000,
					0.001,
				);
				albumImportDraft.value.uploadSpeed =
					albumImportDraft.value.totalBytesLoaded / elapsedSeconds;
			}
		}
		if (!isCurrent()) return;
		await completeMusicAlbumImportFile(importId, fileId);
		if (!isCurrent()) return;
		fileProgress.value = new Map(fileProgress.value).set(fileId, 100);
	}

	function startPollingWhenProcessing(
		snapshot: MusicAlbumImport,
		importId: string,
	) {
		if (
			["queued", "extracting", "analyzing", "transcoding"].includes(
				snapshot.status,
			)
		) {
			startPolling(importId);
		}
	}

	function refreshWhenFilesUploaded(
		snapshot: MusicAlbumImport,
		importId: string,
	) {
		if (!applyImportSnapshot(snapshot, importId)) return;
		startPollingWhenProcessing(snapshot, importId);
	}

	async function handleFilesUpload(fileList: FileList) {
		if (!creationFlow.value || !albumImportDraft.value) return;
		const flow = creationFlow.value;
		const generation = ++operationGeneration;
		const files = Array.from(fileList).filter((file) => {
			const relativePath =
				(file as File & { webkitRelativePath?: string }).webkitRelativePath ||
				file.name;
			return !shouldIgnoreAlbumImportPath(relativePath);
		});
		if (files.length === 0) {
			errorMessage.value = "未发现可导入的音频文件";
			return;
		}

		const hasRelativePaths = files.some(
			(f) => !!(f as File & { webkitRelativePath?: string }).webkitRelativePath,
		);
		const isArchive =
			files.length === 1 &&
			SUPPORTED_ARCHIVE_ACCEPT.split(",").some((extension) =>
				files[0].name.toLowerCase().endsWith(extension.trim()),
			);
		try {
			if (isArchive) validateMusicAlbumArchiveFile(files[0]);
		} catch (error) {
			errorMessage.value =
				error instanceof Error ? error.message : "文件无法上传";
			return;
		}

		uploading.value = true;
		errorMessage.value = "";
		fileProgress.value = new Map();
		selectedFiles.clear();

		const draft = albumImportDraft.value;
		draft.status = "uploading";
		const autoMode: MusicAlbumImportInputMode = isArchive
			? "archive"
			: hasRelativePaths
				? "folder"
				: "files";
		draft.inputMode = autoMode;
		draft.totalBytesLoaded = 0;
		draft.totalBytesTotal = files.reduce((sum, f) => sum + f.size, 0);
		draft.uploadSpeed = 0;
		uploadStartedAt = Date.now();

		const previewFile = isArchive
			? files[0]
			: files.find(
					(file) =>
						file.type.startsWith("audio/") ||
						/\.(?:aac|aif|aiff|alac|ape|flac|m4a|mp3|ogg|opus|wav|wma)$/i.test(
							file.name,
						),
				);
		if (previewFile) {
			void readAlbumImportPreview(previewFile)
				.then((preview) => {
					if (
						generation !== operationGeneration ||
						creationFlow.value !== flow ||
						albumImportDraft.value !== draft
					)
						return;
					if (files.length === 1) {
						draft.derivedAlbumTitle = preview.title;
						draft.derivedTracks = preview.tracks.map((title) => ({
							title,
							audioKey: "",
							origin: "local_preview",
						}));
						if (!flow.titleCustomized) {
							flow.draft.albumDetails.title = preview.title;
						}
						if (!flow.tracksCustomized && preview.tracks.length > 0) {
							flow.draft.tracks = preview.tracks.map((title, index) => ({
								id: `preview-track-${index + 1}`,
								sequence: index + 1,
								discNumber: 1,
								title,
								origin: "local_preview",
							}));
						}
					}
					if (preview.albumCoverFile) {
						draft.derivedCover = URL.createObjectURL(preview.albumCoverFile);
					}
				})
				.catch(() => {
					// 后台提取会在上传完成后提供完整信息。
				});
		}

		try {
			const artistName =
				creationFlow.value.draft.artist.stageNames
					.find((item) => item.isPrimary && item.name.trim())
					?.name.trim() ||
				creationFlow.value.draft.artist.stageNames
					.find((item) => item.name.trim())
					?.name.trim() ||
				creationFlow.value.draft.artist.legalName.trim();
			const session = await createMusicAlbumImport({
				artistId: creationFlow.value.draft.artist.id,
				...(artistName ? { artistName } : {}),
				inputMode: autoMode,
			});
			if (
				generation !== operationGeneration ||
				creationFlow.value !== flow ||
				albumImportDraft.value !== draft
			)
				return;
			draft.importId = session.importId;
			setMusicCreationStep("albumDetails");

			const fileInputs = files.map((f) => ({
				relativePath:
					(f as File & { webkitRelativePath?: string }).webkitRelativePath ||
					f.name,
				fileName: f.name,
				fileSize: f.size,
				contentType: f.type || "application/octet-stream",
			}));

			const registered = await registerMusicAlbumImportFiles(session.importId, {
				files: fileInputs,
			});
			if (
				generation !== operationGeneration ||
				draft.importId !== session.importId
			)
				return;
			draft.files = registered.files ?? [];

			const fileMap = new Map<string, File>();
			for (const f of files) {
				const relPath =
					(f as File & { webkitRelativePath?: string }).webkitRelativePath ||
					f.name;
				fileMap.set(relPath, f);
				fileMap.set(f.name, f);
				selectedFiles.set(f.name, f);
				selectedFiles.set(relPath, f);
			}

			const uploadTasks = (registered.files ?? []).map(
				(registeredFile) => async () => {
					const file =
						fileMap.get(registeredFile.relativePath) ??
						fileMap.get(registeredFile.fileName);
					if (!file) throw new Error(`${registeredFile.fileName} 未找到`);
					selectedFiles.set(registeredFile.fileId, file);
					await uploadSingleFileMultipart(
						session.importId,
						file,
						registeredFile.fileId,
						() => generation === operationGeneration,
					);
				},
			);

			for (let i = 0; i < uploadTasks.length; i += 3) {
				await Promise.all(uploadTasks.slice(i, i + 3).map((fn) => fn()));
			}

			const snapshot = await getMusicAlbumImport(session.importId);
			if (
				generation === operationGeneration &&
				draft.importId === session.importId
			) {
				await refreshWhenFilesUploaded(snapshot, session.importId);
			}
		} catch (error) {
			if (
				generation !== operationGeneration ||
				albumImportDraft.value !== draft
			)
				return;
			draft.status = "failed";
			draft.errorMessage = error instanceof Error ? error.message : "上传失败";
			errorMessage.value = draft.errorMessage;
		} finally {
			if (generation === operationGeneration) uploading.value = false;
		}
	}

	async function handleAutoFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const fileList = input.files;
		if (!fileList || fileList.length === 0) return;

		await handleFilesUpload(fileList);

		input.value = "";
	}

	async function handleRetryFile(fileId: string) {
		const draft = albumImportDraft.value;
		if (!draft?.importId) return;
		const needsUpload =
			draft.files.find((file) => file.fileId === fileId)?.uploadStatus ===
			"failed";
		const file = selectedFiles.get(fileId);
		if (needsUpload && !file) {
			errorMessage.value = "请替换文件后重新上传";
			return;
		}

		const importId = draft.importId;
		const generation = ++operationGeneration;
		uploading.value = true;
		errorMessage.value = "";
		try {
			const snapshot = await retryMusicAlbumImportFile(importId, fileId);
			if (
				generation !== operationGeneration ||
				!applyImportSnapshot(snapshot, importId)
			)
				return;
			if (needsUpload && file) {
				await uploadSingleFileMultipart(
					importId,
					file,
					fileId,
					() =>
						generation === operationGeneration &&
						albumImportDraft.value?.importId === importId,
				);
				await refreshWhenFilesUploaded(
					await getMusicAlbumImport(importId),
					importId,
				);
			} else if (!needsUpload) {
				startPolling(importId);
			}
		} catch (error) {
			if (generation === operationGeneration)
				errorMessage.value =
					error instanceof Error ? error.message : "重试失败";
		} finally {
			if (generation === operationGeneration) uploading.value = false;
		}
	}

	async function handleReplaceFile(fileId: string, file: File) {
		const draft = albumImportDraft.value;
		if (!draft?.importId) return;
		const importId = draft.importId;
		const generation = ++operationGeneration;
		uploading.value = true;
		try {
			await replaceMusicAlbumImportFile(importId, fileId, {
				relativePath: file.name,
				fileName: file.name,
				fileSize: file.size,
				contentType: file.type || "application/octet-stream",
			});
			const snapshot = await getMusicAlbumImport(importId);
			if (
				generation !== operationGeneration ||
				!applyImportSnapshot(snapshot, importId)
			)
				return;
			selectedFiles.set(fileId, file);
			await uploadSingleFileMultipart(
				importId,
				file,
				fileId,
				() =>
					generation === operationGeneration &&
					albumImportDraft.value?.importId === importId,
			);
			await refreshWhenFilesUploaded(
				await getMusicAlbumImport(importId),
				importId,
			);
		} catch (error) {
			if (generation === operationGeneration)
				errorMessage.value =
					error instanceof Error ? error.message : "替换失败";
		} finally {
			if (generation === operationGeneration) uploading.value = false;
		}
	}

	async function cancelUpload() {
		const importId = albumImportDraft.value?.importId;
		if (!importId) return;
		try {
			await cancelMusicAlbumImportSession(importId);
			stopPolling();
			if (albumImportDraft.value) albumImportDraft.value.status = "canceled";
		} catch (error) {
			errorMessage.value =
				error instanceof Error ? error.message : "取消上传失败";
		}
	}

	async function handleDeleteFile(fileId: string) {
		const draft = albumImportDraft.value;
		if (!draft?.importId) return;
		try {
			await deleteMusicAlbumImportFile(draft.importId, fileId);
			draft.files = draft.files.filter((f) => f.fileId !== fileId);
		} catch (error) {
			errorMessage.value = error instanceof Error ? error.message : "移除失败";
		}
	}

	function resetUploadState() {
		operationGeneration += 1;
		uploading.value = false;
		errorMessage.value = "";
		fileProgress.value.clear();
		stopPolling();
	}

	return {
		uploading,
		errorMessage,
		fileProgress,
		handleAutoFileChange,
		handleFilesUpload,
		handleRetryFile,
		handleReplaceFile,
		handleDeleteFile,
		cancelUpload,
		applyImportSnapshot,
		startPolling,
		stopPolling,
		resetUploadState,
	};
}
