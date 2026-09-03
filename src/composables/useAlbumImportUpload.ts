import { computed, ref, type Ref } from "vue";
import {
	createMusicAlbumImport,
	validateMusicAlbumArchiveFile,
	SUPPORTED_ARCHIVE_ACCEPT,
	createMusicAlbumImportFilePartUpload,
	uploadMusicAlbumImportFilePart,
	completeMusicAlbumImportFilePart,
	completeMusicAlbumImportFile,
	completeMusicAlbumImportSession,
	registerMusicAlbumImportFiles,
	getMusicAlbumImport,
	retryMusicAlbumImportFile,
	replaceMusicAlbumImportFile,
	deleteMusicAlbumImportFile,
	cancelMusicAlbumImportSession,
	type MusicAlbumImport,
	type MusicAlbumImportFile,
	type MusicAlbumImportInputMode,
} from "@/api/musicV1";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { runMultipartUpload } from "@/api/multipartUpload";
import {
	readAlbumImportPreview,
	shouldIgnoreAlbumImportPath,
} from "@/utils/musicImportPreview";
import { parseMusicLyricDraft } from "@/utils/musicLyricsDraft";
import { parsePartialDateParts } from "@/components/music/birthDateMask";
import type { MusicCreationFlowState } from "@/components/music/musicCreationTypes";
import { useMusicCreationFlow } from "@/components/music/musicCreationFlowContext";

type AlbumImportUploadState = {
	uploading: Ref<boolean>;
	errorMessage: Ref<string>;
	fileProgress: Ref<Map<string, number>>;
	pollTimer: ReturnType<typeof setTimeout> | null;
	uploadStartedAt: number;
	operationGeneration: number;
	pollingGeneration: number;
	selectedFiles: Map<string, File>;
	abortControllers: Set<AbortController>;
};

const FILE_PART_SIZE = 16 * 1024 * 1024;
const ALBUM_IMPORT_CONTROL_TIMEOUT_MS = 30_000;
const ALBUM_IMPORT_PART_TIMEOUT_MS = 5 * 60 * 1000;

async function withUploadRequestTimeout<T>(
	parentSignal: AbortSignal,
	timeoutMs: number,
	timeoutMessage: string,
	request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	if (parentSignal.aborted) throw new Error("上传已取消");

	const requestController = new AbortController();
	let timedOut = false;
	const abortRequest = () => requestController.abort();
	parentSignal.addEventListener("abort", abortRequest, { once: true });
	const timer = setTimeout(() => {
		timedOut = true;
		requestController.abort();
	}, timeoutMs);

	try {
		return await request(requestController.signal);
	} catch (error) {
		if (timedOut && !parentSignal.aborted) throw new Error(timeoutMessage);
		if (parentSignal.aborted) throw new Error("上传已取消");
		throw error;
	} finally {
		clearTimeout(timer);
		parentSignal.removeEventListener("abort", abortRequest);
	}
}

function mergeUploadedImportFile(
	draft: MusicCreationFlowState["draft"]["albumImport"],
	updated: MusicAlbumImportFile,
) {
	draft.files = draft.files.map((file) =>
		file.fileId === updated.fileId
			? {
					...file,
					...updated,
					partSize: updated.partSize ?? file.partSize,
					completedParts: updated.completedParts ?? file.completedParts,
				}
			: file,
	);
}

const uploadStates = new WeakMap<
	MusicCreationFlowState,
	AlbumImportUploadState
>();

function uploadStateFor(flow: MusicCreationFlowState) {
	let uploadState = uploadStates.get(flow);
	if (uploadState) return uploadState;

	uploadState = {
		uploading: ref(false),
		errorMessage: ref(""),
		fileProgress: ref(new Map()),
		pollTimer: null,
		uploadStartedAt: 0,
		operationGeneration: 0,
		pollingGeneration: 0,
		selectedFiles: new Map(),
		abortControllers: new Set(),
	};
	uploadStates.set(flow, uploadState);
	return uploadState;
}

export function useAlbumImportUpload() {
	const { state, setMusicCreationStep } = useMusicDrawers();

	const creationFlowFallback = computed(() => state.value.creationFlow);
	const creationFlow = useMusicCreationFlow(creationFlowFallback);
	const albumImportDraft = computed(
		() => creationFlow.value?.draft.albumImport ?? null,
	);
	const currentUploadState = computed(() =>
		creationFlow.value ? uploadStateFor(creationFlow.value) : null,
	);
	const uploading = computed(
		() => currentUploadState.value?.uploading.value ?? false,
	);
	const errorMessage = computed(
		() => currentUploadState.value?.errorMessage.value ?? "",
	);
	const fileProgress = computed(
		() =>
			currentUploadState.value?.fileProgress.value ?? new Map<string, number>(),
	);

	function applyImportSnapshotToFlow(
		flow: MusicCreationFlowState,
		snapshot: MusicAlbumImport,
		expectedImportId = snapshot.importId,
	) {
		const draft = flow.draft.albumImport;
		if (draft.importId !== expectedImportId) return false;
		const derivedTracks = snapshot.derivedTracks ?? [];
		const previousDerivedAlbumType = draft.derivedAlbumType;
		const previousMetadataSourceURL = draft.metadataSourceUrl;

		draft.importId = snapshot.importId;
		draft.inputMode = snapshot.inputMode;
		draft.status = snapshot.status;
		draft.stage = snapshot.stage;
		draft.archiveName = snapshot.archiveName;
		if (snapshot.stage === "upload") {
			draft.uploadProgress = snapshot.uploadProgress;
			draft.uploadSpeed = snapshot.uploadSpeed;
			if (snapshot.progress.total > 0) {
				draft.totalBytesLoaded = snapshot.progress.current;
				draft.totalBytesTotal = snapshot.progress.total;
			}
		} else {
			draft.uploadSpeed = 0;
		}
		draft.coverUrl = snapshot.coverUrl;
		draft.coverKey = snapshot.coverKey;
		draft.derivedAlbumTitle = snapshot.derivedAlbumTitle;
		if (snapshot.derivedCover) draft.derivedCover = snapshot.derivedCover;
		if (derivedTracks.length > 0) draft.derivedTracks = derivedTracks;
		draft.derivedReleaseDate = snapshot.derivedReleaseDate;
		draft.derivedAlbumType = snapshot.derivedAlbumType;
		draft.metadataSourceUrl = snapshot.metadataSourceUrl;
		draft.missingArtists = snapshot.missingArtists ?? [];
		draft.lastSyncedAt = snapshot.lastSyncedAt;
		draft.errorMessage =
			snapshot.errorMessage || snapshot.errors?.[0]?.message || "";
		draft.files = snapshot.files ?? [];
		if (!flow.titleCustomized) {
			flow.draft.albumDetails.title =
				snapshot.derivedAlbumTitle || flow.draft.albumDetails.title;
		}
		if (
			snapshot.derivedReleaseDate &&
			!flow.draft.albumDetails.releaseDate.trim()
		) {
			flow.draft.albumDetails.releaseDateParts = parsePartialDateParts(
				snapshot.derivedReleaseDate,
			);
		}
		if (
			snapshot.derivedAlbumType &&
			(!previousDerivedAlbumType ||
				flow.draft.albumDetails.type === previousDerivedAlbumType)
		) {
			flow.draft.albumDetails.type = snapshot.derivedAlbumType;
		}
		if (
			snapshot.metadataSourceUrl &&
			(!flow.draft.albumDetails.source.trim() ||
				flow.draft.albumDetails.source === previousMetadataSourceURL)
		) {
			flow.draft.albumDetails.source = snapshot.metadataSourceUrl;
		}

		if (!flow.tracksCustomized && derivedTracks.length > 0) {
			flow.draft.tracks = derivedTracks.map((track, index) => ({
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

	function applyImportSnapshot(
		snapshot: MusicAlbumImport,
		expectedImportId = snapshot.importId,
	) {
		const flow = creationFlow.value;
		return flow
			? applyImportSnapshotToFlow(flow, snapshot, expectedImportId)
			: false;
	}

	function stopPollingFor(flow: MusicCreationFlowState) {
		const uploadState = uploadStateFor(flow);
		uploadState.pollingGeneration += 1;
		if (uploadState.pollTimer) {
			clearTimeout(uploadState.pollTimer);
			uploadState.pollTimer = null;
		}
	}

	function startPollingFor(flow: MusicCreationFlowState, importId: string) {
		const uploadState = uploadStateFor(flow);
		if (uploadState.pollTimer) clearTimeout(uploadState.pollTimer);
		const generation = ++uploadState.pollingGeneration;
		const poll = async () => {
			if (
				generation !== uploadState.pollingGeneration ||
				flow.draft.albumImport.importId !== importId
			) {
				uploadState.pollTimer = null;
				return;
			}
			try {
				const snapshot = await getMusicAlbumImport(importId);
				if (
					generation !== uploadState.pollingGeneration ||
					!applyImportSnapshotToFlow(flow, snapshot, importId)
				)
					return;
				const done = [
					"ready",
					"needs_attention",
					"failed",
					"canceled",
					"committed",
				].includes(snapshot.status);
				uploadState.pollTimer = done ? null : setTimeout(poll, 3000);
			} catch {
				if (
					generation === uploadState.pollingGeneration &&
					flow.draft.albumImport.importId === importId
				) {
					uploadState.pollTimer = setTimeout(poll, 5000);
				}
			}
		};
		uploadState.pollTimer = setTimeout(poll, 2000);
	}

	function startPolling(importId: string) {
		const flow = creationFlow.value;
		if (flow) startPollingFor(flow, importId);
	}

	function stopPolling() {
		const flow = creationFlow.value;
		if (flow) stopPollingFor(flow);
	}

	function beginUploadOperation(uploadState: AlbumImportUploadState) {
		for (const controller of uploadState.abortControllers) controller.abort();
		uploadState.abortControllers.clear();
		return ++uploadState.operationGeneration;
	}

	async function completeUploadSession(
		uploadState: AlbumImportUploadState,
		importId: string,
	): Promise<MusicAlbumImport> {
		const controller = new AbortController();
		uploadState.abortControllers.add(controller);
		try {
			return await withUploadRequestTimeout(
				controller.signal,
				ALBUM_IMPORT_CONTROL_TIMEOUT_MS,
				"提交上传会话超时，请重试",
				(signal) => completeMusicAlbumImportSession(importId, { signal }),
			);
		} finally {
			uploadState.abortControllers.delete(controller);
		}
	}

	async function uploadSingleFileMultipart(
		uploadState: AlbumImportUploadState,
		draft: MusicCreationFlowState["draft"]["albumImport"],
		importId: string,
		file: File,
		fileId: string,
		generation: number,
		fileRecord?: MusicAlbumImportFile,
	): Promise<void> {
		const isCurrent = () => generation === uploadState.operationGeneration;
		const partSize =
			fileRecord?.partSize && fileRecord.partSize > 0
				? fileRecord.partSize
				: FILE_PART_SIZE;
		const totalParts = Math.ceil(file.size / partSize);
		const completedPartNumbers = new Set(
			(fileRecord?.completedParts ?? [])
				.map((part) => part.partNumber)
				.filter((partNumber) => partNumber > 0 && partNumber <= totalParts),
		);
		const completedFileBytes = [...completedPartNumbers].reduce(
			(total, partNumber) => total + Math.max(
				0,
				Math.min(partSize, file.size - (partNumber - 1) * partSize),
			),
			0,
		);
		const otherFileBytes = Math.max(
			0,
			draft.totalBytesLoaded - completedFileBytes,
		);

		const finished = await runMultipartUpload(file, {
			partSize,
			completedParts: completedPartNumbers,
			isActive: isCurrent,
			uploadPart: async ({ partNumber, body, size, onProgress }) => {
				let lastError: unknown;
				for (let attempt = 0; attempt < 3; attempt += 1) {
					const controller = new AbortController();
					uploadState.abortControllers.add(controller);
					try {
						const upload = await withUploadRequestTimeout(
							controller.signal,
							ALBUM_IMPORT_CONTROL_TIMEOUT_MS,
							"获取上传地址超时，请重试",
							(signal) => createMusicAlbumImportFilePartUpload(
								importId,
								fileId,
								partNumber,
								size,
								{ signal },
							),
						);
						if (!isCurrent()) throw new Error("上传已取消");

						const etag = await uploadMusicAlbumImportFilePart(upload.uploadUrl, body, {
							signal: controller.signal,
							timeoutMs: ALBUM_IMPORT_PART_TIMEOUT_MS,
							onProgress: (progress) => onProgress(progress.loaded),
						});
						if (!isCurrent()) throw new Error("上传已取消");

						return await withUploadRequestTimeout(
							controller.signal,
							ALBUM_IMPORT_CONTROL_TIMEOUT_MS,
							"保存分片进度超时，请重试",
							(signal) => completeMusicAlbumImportFilePart(
								importId,
								fileId,
								partNumber,
								etag,
								size,
								{ signal },
							),
						);
					} catch (error) {
						lastError = error;
						onProgress(0);
						if (!isCurrent() || attempt === 2) throw error;
					} finally {
						uploadState.abortControllers.delete(controller);
					}
				}
				throw lastError;
			},
			completePart: async ({ result: completedFile }) => {
				mergeUploadedImportFile(draft, completedFile);
			},
			onProgress: ({ loaded }) => {
				if (!isCurrent()) return;
				const fileBytesLoaded = Math.min(loaded, file.size);
				const nextTotalBytesLoaded = otherFileBytes + fileBytesLoaded;
				draft.totalBytesLoaded =
					draft.totalBytesTotal > 0
						? Math.min(nextTotalBytesLoaded, draft.totalBytesTotal)
						: nextTotalBytesLoaded;
				uploadState.fileProgress.value = new Map(uploadState.fileProgress.value).set(
					fileId,
					file.size > 0 ? Math.round((fileBytesLoaded / file.size) * 100) : 0,
				);
				const elapsedSeconds = Math.max(
					(Date.now() - uploadState.uploadStartedAt) / 1000,
					0.001,
				);
				draft.uploadSpeed = draft.totalBytesLoaded / elapsedSeconds;
			},
		});
		if (!finished) return;

		const controller = new AbortController();
		uploadState.abortControllers.add(controller);
		try {
			const completedFile = await withUploadRequestTimeout(
				controller.signal,
				ALBUM_IMPORT_CONTROL_TIMEOUT_MS,
				"确认文件上传超时，请重试",
				(signal) => completeMusicAlbumImportFile(importId, fileId, { signal }),
			);
			if (!isCurrent()) return;
			mergeUploadedImportFile(draft, completedFile);
			uploadState.fileProgress.value = new Map(uploadState.fileProgress.value).set(
				fileId,
				100,
			);
		} finally {
			uploadState.abortControllers.delete(controller);
		}
	}

	function startPollingWhenProcessing(
		flow: MusicCreationFlowState,
		snapshot: MusicAlbumImport,
		importId: string,
	) {
		if (
			["queued", "extracting", "analyzing", "transcoding"].includes(
				snapshot.status,
			)
		) {
			startPollingFor(flow, importId);
		}
	}

	function refreshWhenFilesUploaded(
		flow: MusicCreationFlowState,
		snapshot: MusicAlbumImport,
		importId: string,
	) {
		if (!applyImportSnapshotToFlow(flow, snapshot, importId)) return;
		startPollingWhenProcessing(flow, snapshot, importId);
	}

	async function handleFilesUpload(fileList: FileList) {
		const flow = creationFlow.value;
		const draft = flow?.draft.albumImport;
		if (!flow || !draft) return;
		const uploadState = uploadStateFor(flow);
		const generation = beginUploadOperation(uploadState);
		const isCurrent = () => generation === uploadState.operationGeneration;
		const files = Array.from(fileList).filter((file) => {
			const relativePath =
				(file as File & { webkitRelativePath?: string }).webkitRelativePath ||
				file.name;
			return !shouldIgnoreAlbumImportPath(relativePath);
		});
		if (files.length === 0) {
			uploadState.errorMessage.value = "未发现可导入的音频文件";
			return;
		}
		const emptyFile = files.find((file) => file.size <= 0);
		if (emptyFile) {
			uploadState.errorMessage.value = `文件“${emptyFile.name}”为空，请重新选择`;
			return;
		}

		const hasRelativePaths = files.some((file) =>
			Boolean((file as File & { webkitRelativePath?: string }).webkitRelativePath),
		);
		const isArchive =
			files.length === 1 &&
			SUPPORTED_ARCHIVE_ACCEPT.split(",").some((extension) =>
				files[0].name.toLowerCase().endsWith(extension.trim()),
			);
		try {
			if (isArchive) validateMusicAlbumArchiveFile(files[0]);
		} catch (error) {
			uploadState.errorMessage.value =
				error instanceof Error ? error.message : "文件无法上传";
			return;
		}

		uploadState.uploading.value = true;
		uploadState.errorMessage.value = "";
		uploadState.fileProgress.value = new Map();
		uploadState.selectedFiles.clear();
		draft.status = "uploading";
		draft.errorMessage = "";
		let autoMode: MusicAlbumImportInputMode = "files";
		if (isArchive) {
			autoMode = "archive";
		} else if (hasRelativePaths) {
			autoMode = "folder";
		}
		draft.inputMode = autoMode;
		draft.totalBytesLoaded = 0;
		draft.totalBytesTotal = files.reduce((sum, file) => sum + file.size, 0);
		draft.uploadSpeed = 0;
		uploadState.uploadStartedAt = Date.now();

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
					if (!isCurrent()) return;
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
				flow.draft.artist.stageNames
					.find((item) => item.isPrimary && item.name.trim())
					?.name.trim() ||
				flow.draft.artist.stageNames
					.find((item) => item.name.trim())
					?.name.trim() ||
				flow.draft.artist.legalName.trim();
			const session = await createMusicAlbumImport({
				artistId: flow.draft.artist.id,
				...(artistName ? { artistName } : {}),
				inputMode: autoMode,
			});
			if (!isCurrent()) return;
			draft.importId = session.importId;
			if (creationFlow.value === flow) setMusicCreationStep("albumDetails");

			const fileInputs = files.map((file) => ({
				relativePath:
					(file as File & { webkitRelativePath?: string }).webkitRelativePath ||
					file.name,
				fileName: file.name,
				fileSize: file.size,
				contentType: file.type || "application/octet-stream",
			}));
			const registered = await registerMusicAlbumImportFiles(session.importId, {
				files: fileInputs,
			});
			if (!isCurrent() || draft.importId !== session.importId) return;
			draft.files = registered.files ?? [];

			const fileMap = new Map<string, File>();
			for (const file of files) {
				const relativePath =
					(file as File & { webkitRelativePath?: string }).webkitRelativePath ||
					file.name;
				fileMap.set(relativePath, file);
				fileMap.set(file.name, file);
				uploadState.selectedFiles.set(file.name, file);
				uploadState.selectedFiles.set(relativePath, file);
			}

			const uploadTasks = (registered.files ?? []).map(
				(registeredFile) => async () => {
					const file =
						fileMap.get(registeredFile.relativePath) ??
						fileMap.get(registeredFile.fileName);
					if (!file) throw new Error(`${registeredFile.fileName} 未找到`);
					uploadState.selectedFiles.set(registeredFile.fileId, file);
					await uploadSingleFileMultipart(
						uploadState,
						draft,
						session.importId,
						file,
						registeredFile.fileId,
						generation,
						registeredFile,
					);
				},
			);
			for (let index = 0; index < uploadTasks.length; index += 3) {
				await Promise.all(
					uploadTasks.slice(index, index + 3).map((task) => task()),
				);
			}
			if (!isCurrent()) return;
			const completed = await completeUploadSession(uploadState, session.importId);
			if (isCurrent() && draft.importId === session.importId) {
				refreshWhenFilesUploaded(flow, completed, session.importId);
			}
		} catch (error) {
			if (!isCurrent()) return;
			draft.status = "failed";
			draft.errorMessage = error instanceof Error ? error.message : "上传失败";
			uploadState.errorMessage.value = draft.errorMessage;
		} finally {
			if (isCurrent()) uploadState.uploading.value = false;
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
		const flow = creationFlow.value;
		const draft = flow?.draft.albumImport;
		if (!flow || !draft?.importId) return;
		const uploadState = uploadStateFor(flow);
		const fileRecord = draft.files.find((file) => file.fileId === fileId);
		const needsUpload = fileRecord?.uploadStatus === "failed";
		const file = uploadState.selectedFiles.get(fileId);
		const canResumeUpload =
			fileRecord?.uploadStatus === "uploading" && Boolean(file);
		if (needsUpload && !file) {
			uploadState.errorMessage.value = "请替换文件后重新上传";
			return;
		}

		const importId = draft.importId;
		const generation = beginUploadOperation(uploadState);
		const isCurrent = () => generation === uploadState.operationGeneration;
		uploadState.uploading.value = true;
		uploadState.errorMessage.value = "";
		try {
			let uploadRecord = fileRecord;
			if (!canResumeUpload) {
				const snapshot = await retryMusicAlbumImportFile(importId, fileId);
				if (!isCurrent() || !applyImportSnapshotToFlow(flow, snapshot, importId))
					return;
				uploadRecord = snapshot.files.find((file) => file.fileId === fileId);
			}

			if (needsUpload || canResumeUpload) {
				if (!file || !uploadRecord) return;
				if (canResumeUpload) {
					draft.status = "uploading";
					draft.stage = "upload";
					draft.errorMessage = "";
				}
				await uploadSingleFileMultipart(
					uploadState,
					draft,
					importId,
					file,
					fileId,
					generation,
					uploadRecord,
				);
				if (!isCurrent()) return;
				const latest = await getMusicAlbumImport(importId);
				if (!isCurrent()) return;
				if (
					latest.status === "uploading" &&
					latest.files.length > 0 &&
					latest.files.every((item) => item.uploadStatus === "uploaded")
				) {
					const completed = await completeUploadSession(uploadState, importId);
					if (!isCurrent()) return;
					refreshWhenFilesUploaded(flow, completed, importId);
				} else {
					refreshWhenFilesUploaded(flow, latest, importId);
				}
			} else {
				startPollingFor(flow, importId);
			}
		} catch (error) {
			if (isCurrent()) {
				uploadState.errorMessage.value =
					error instanceof Error ? error.message : "重试失败";
			}
		} finally {
			if (isCurrent()) uploadState.uploading.value = false;
		}
	}

	async function handleReplaceFile(fileId: string, file: File) {
		const flow = creationFlow.value;
		const draft = flow?.draft.albumImport;
		if (!flow || !draft?.importId) return;
		const uploadState = uploadStateFor(flow);
		const importId = draft.importId;
		const generation = beginUploadOperation(uploadState);
		const isCurrent = () => generation === uploadState.operationGeneration;
		uploadState.uploading.value = true;
		try {
			await replaceMusicAlbumImportFile(importId, fileId, {
				relativePath: file.name,
				fileName: file.name,
				fileSize: file.size,
				contentType: file.type || "application/octet-stream",
			});
			const snapshot = await getMusicAlbumImport(importId);
			if (!isCurrent() || !applyImportSnapshotToFlow(flow, snapshot, importId))
				return;
			uploadState.selectedFiles.set(fileId, file);
			await uploadSingleFileMultipart(
				uploadState,
				draft,
				importId,
				file,
				fileId,
				generation,
				draft.files.find((item) => item.fileId === fileId),
			);
			if (!isCurrent()) return;
			const latest = await getMusicAlbumImport(importId);
			if (!isCurrent()) return;
			refreshWhenFilesUploaded(flow, latest, importId);
		} catch (error) {
			if (isCurrent()) {
				uploadState.errorMessage.value =
					error instanceof Error ? error.message : "替换失败";
			}
		} finally {
			if (isCurrent()) uploadState.uploading.value = false;
		}
	}

	async function cancelUpload() {
		const flow = creationFlow.value;
		const draft = flow?.draft.albumImport;
		if (!flow || !draft?.importId) return;
		const uploadState = uploadStateFor(flow);
		const generation = beginUploadOperation(uploadState);
		const isCurrent = () => generation === uploadState.operationGeneration;
		try {
			await cancelMusicAlbumImportSession(draft.importId);
			if (!isCurrent()) return;
			stopPollingFor(flow);
			draft.status = "canceled";
			uploadState.uploading.value = false;
		} catch (error) {
			uploadState.errorMessage.value =
				error instanceof Error ? error.message : "取消上传失败";
		}
	}

	async function handleDeleteFile(fileId: string) {
		const draft = albumImportDraft.value;
		if (!draft?.importId) return;
		const uploadState = currentUploadState.value;
		try {
			await deleteMusicAlbumImportFile(draft.importId, fileId);
			draft.files = draft.files.filter((file) => file.fileId !== fileId);
		} catch (error) {
			if (uploadState) {
				uploadState.errorMessage.value =
					error instanceof Error ? error.message : "移除失败";
			}
		}
	}

	function resetUploadState() {
		const flow = creationFlow.value;
		if (!flow) return;
		const uploadState = uploadStateFor(flow);
		beginUploadOperation(uploadState);
		uploadState.uploading.value = false;
		uploadState.errorMessage.value = "";
		uploadState.fileProgress.value.clear();
		stopPollingFor(flow);
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
