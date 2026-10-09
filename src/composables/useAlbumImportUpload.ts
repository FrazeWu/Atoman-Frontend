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
	matchMusicAlbumImportMetadata,
	registerMusicAlbumImportFiles,
	getMusicAlbumImport,
	retryMusicAlbumImportFile,
	replaceMusicAlbumImportFile,
	deleteMusicAlbumImportFile,
	cancelMusicAlbumImportSession,
	type MusicAlbumImport,
	type MusicAlbumImportFile,
	type MusicAlbumImportInputMode,
	type MusicAlbumImportTrack,
} from "@/api/musicV1";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { runMultipartUpload } from "@/api/multipartUpload";
import {
	readAlbumImportPreview,
	readAlbumImportFilesPreview,
	shouldIgnoreAlbumImportPath,
	type MusicAlbumImportPreview,
} from "@/utils/musicImportPreview";
import { parsePartialDateParts } from "@/components/music/birthDateMask";
import { localizedMusicCountry } from "@/utils/musicImportMetadata";
import type { MusicCreationFlowState } from "@/components/music/musicCreationTypes";
import { useMusicCreationFlow } from "@/components/music/musicCreationFlowContext";
import { mergeImportedTracksIntoDraft } from "@/utils/musicImportTrackMerge";

type AlbumImportUploadState = {
	uploading: Ref<boolean>;
	errorMessage: Ref<string>;
	fileProgress: Ref<Map<string, number>>;
	pollTimer: ReturnType<typeof setTimeout> | null;
	uploadStartedAt: number;
	operationGeneration: number;
	pollingGeneration: number;
	serverDerivedSnapshotApplied: boolean;
	matchGeneration: number;
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
		serverDerivedSnapshotApplied: false,
		matchGeneration: 0,
		selectedFiles: new Map(),
		abortControllers: new Set(),
	};
	uploadStates.set(flow, uploadState);
	return uploadState;
}

export function useAlbumImportUpload() {
	const { state } = useMusicDrawers();

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

	function clearExternalMetadata(flow: MusicCreationFlowState, clearTags = false) {
		const draft = flow.draft.albumImport;
		const albumDetails = flow.draft.albumDetails;
		const previousSourceURL = draft.metadataSourceUrl;
		const previousDerivedAlbumType = draft.derivedAlbumType;

		draft.derivedCover = "";
		draft.derivedReleaseDate = "";
		draft.derivedAlbumType = "";
		draft.metadataSourceUrl = "";
		draft.metadataSource = "";
		draft.metadataExternalId = "";
		draft.metadataMatchStatus = "";
		draft.metadataMatchConfidence = 0;
		draft.metadataMatched = false;
		draft.metadataMatchingStarted = false;
		draft.metadataError = "";
		draft.metadataGenres = [];
		draft.metadataStyles = [];
		draft.metadataLabels = [];
		draft.metadataCountry = "";
		draft.metadataFormats = [];
		draft.metadataSources = [];
		draft.metadataFieldSources = {};
		draft.missingArtists = [];
		draft.coverUrl = "";
		draft.derivedTracks = [];
		flow.draft.tracks = flow.draft.tracks.filter(
			(track) =>
				track.origin === "manual" ||
				Boolean(
					track.songId ||
					track.audioAssetId ||
					track.titleCustomized ||
					track.sequenceCustomized,
				),
		);

		if (!flow.releaseDateCustomized) {
			albumDetails.releaseDateParts = { year: "", month: "", day: "" };
			albumDetails.releaseDate = "";
			albumDetails.releaseYear = "";
		}
		if (!flow.coverCustomized) albumDetails.coverUrl = "";
		if (previousDerivedAlbumType && albumDetails.type === previousDerivedAlbumType) {
			albumDetails.type = "album";
		}
		if (clearTags) albumDetails.tags = [];
		if (!albumDetails.source.trim() || albumDetails.source === previousSourceURL) {
			albumDetails.source = "";
		}
	}

	function applyImportSnapshotToFlow(
		flow: MusicCreationFlowState,
		snapshot: MusicAlbumImport,
		expectedImportId = snapshot.importId,
	) {
		const draft = flow.draft.albumImport;
		if (draft.importId !== expectedImportId) return false;
		const previousSyncedAt = Date.parse(draft.lastSyncedAt || '');
		const nextSyncedAt = Date.parse(snapshot.lastSyncedAt || '');
		if (Number.isFinite(previousSyncedAt) && Number.isFinite(nextSyncedAt) && nextSyncedAt < previousSyncedAt) {
			return true;
		}
		const derivedTracks = snapshot.derivedTracks ?? [];
		const isTerminalSnapshot = [
			"ready",
			"needs_attention",
			"failed",
			"canceled",
			"committed",
		].includes(snapshot.status);
		const isCanceledSnapshot = snapshot.status === "canceled";
		const metadataMatchStatus = snapshot.metadataMatchStatus?.trim() ?? "";
		const hasMetadataResult = Boolean(
			snapshot.metadataSource?.trim() ||
			snapshot.metadataSourceUrl?.trim() ||
			snapshot.metadataExternalId?.trim() ||
			snapshot.metadataMatched === true ||
			snapshot.metadataError?.trim() ||
			["matched", "unmatched", "ambiguous", "manual"].includes(metadataMatchStatus) ||
			(snapshot.metadataGenres?.length ?? 0) > 0 ||
			(snapshot.metadataStyles?.length ?? 0) > 0 ||
			(snapshot.metadataLabels?.length ?? 0) > 0 ||
			(snapshot.metadataCountry?.trim() ?? "") !== "" ||
			(snapshot.metadataFormats?.length ?? 0) > 0
		);
		const shouldApplyMetadata =
			hasMetadataResult || ["failed", "canceled"].includes(snapshot.status);
		const uploadState = uploadStateFor(flow);
		const serverDerivedDataAvailable =
			derivedTracks.length > 0 ||
			Boolean(
				snapshot.coverUrl?.trim() ||
					snapshot.derivedAlbumTitle?.trim() ||
					snapshot.derivedCover?.trim() ||
					snapshot.derivedReleaseDate?.trim() ||
					snapshot.derivedAlbumType?.trim() ||
					snapshot.metadataSourceUrl?.trim() ||
					snapshot.metadataSource?.trim() ||
					snapshot.metadataExternalId?.trim() ||
					snapshot.metadataMatchStatus?.trim() ||
					snapshot.metadataMatched,
			);
		if (serverDerivedDataAvailable) {
			uploadState.serverDerivedSnapshotApplied = true;
		}
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
		if (!isCanceledSnapshot) draft.coverUrl = snapshot.coverUrl;
		draft.coverKey = snapshot.coverKey;
		if (!isCanceledSnapshot && serverDerivedDataAvailable) {
				draft.derivedAlbumTitle = snapshot.derivedAlbumTitle;
			draft.derivedCover = snapshot.derivedCover;
		}
		if (!isCanceledSnapshot && derivedTracks.length > 0) {
			draft.derivedTracks = derivedTracks;
			mergeImportedTracksIntoDraft(flow, derivedTracks);
		}
		if (isCanceledSnapshot) {
			clearExternalMetadata(flow, true);
			draft.derivedTracks = [];
		} else if (shouldApplyMetadata) {
			draft.derivedReleaseDate = snapshot.derivedReleaseDate;
			draft.derivedAlbumType = snapshot.derivedAlbumType;
			draft.metadataSourceUrl = snapshot.metadataSourceUrl;
			draft.metadataSource = snapshot.metadataSource;
			draft.metadataExternalId = snapshot.metadataExternalId;
				draft.metadataMatchStatus = snapshot.metadataMatchStatus;
				draft.metadataMatchConfidence = snapshot.metadataMatchConfidence;
				draft.metadataMatched = snapshot.metadataMatched ?? ['matched', 'manual'].includes(snapshot.metadataMatchStatus ?? '');
				draft.metadataMatchingStarted = metadataMatchStatus === 'matching';
				draft.metadataError = snapshot.metadataError || "";
				draft.metadataGenres = snapshot.metadataGenres ?? [];
				draft.metadataStyles = snapshot.metadataStyles ?? [];
				draft.metadataLabels = snapshot.metadataLabels ?? [];
				draft.metadataCountry = localizedMusicCountry(snapshot.metadataCountry);
				draft.metadataFormats = snapshot.metadataFormats ?? [];
				draft.metadataSources = snapshot.metadataSources ?? [];
				draft.metadataFieldSources = snapshot.metadataFieldSources ?? {};
				draft.missingArtists = snapshot.missingArtists ?? [];
		}
		if (isTerminalSnapshot && derivedTracks.length === 0) {
			draft.derivedTracks = [];
			flow.draft.tracks = flow.draft.tracks.filter(
				(track) =>
					track.origin === "manual" ||
					Boolean(
						track.songId ||
						track.audioAssetId ||
						track.titleCustomized ||
						track.sequenceCustomized,
					),
			);
		}
		draft.lastSyncedAt = snapshot.lastSyncedAt;
		draft.errorMessage =
			snapshot.errorMessage || snapshot.errors?.[0]?.message || "";
		draft.files = snapshot.files ?? [];
		if (!isCanceledSnapshot && !flow.titleCustomized) {
			flow.draft.albumDetails.title =
				snapshot.derivedAlbumTitle || flow.draft.albumDetails.title;
		}
		if (!isCanceledSnapshot && snapshot.derivedReleaseDate && !flow.releaseDateCustomized) {
			flow.draft.albumDetails.releaseDateParts = parsePartialDateParts(
				snapshot.derivedReleaseDate,
			);
		}
		const importedCover =
			snapshot.derivedCover?.trim() || snapshot.coverUrl?.trim();
		if (!isCanceledSnapshot && importedCover && !flow.coverCustomized) {
			flow.draft.albumDetails.coverUrl = importedCover;
		}
		if (!isCanceledSnapshot && shouldApplyMetadata && !flow.metadataTagsApplied) {
			const parentName = snapshot.metadataGenres?.length === 1 ? snapshot.metadataGenres[0] : undefined;
			const nextTags = [
				...(snapshot.metadataGenres ?? []).map((name) => ({ name, kind: "type" as const })),
				...(snapshot.metadataStyles ?? []).map((name) => ({ name, kind: "type" as const, parentName })),
			];
			const existingKeys = new Set(flow.draft.albumDetails.tags.map((tag) => `${tag.kind}\u0000${tag.name.toLocaleLowerCase()}`));
			for (const tag of nextTags) {
				const key = `${tag.kind}\u0000${tag.name.toLocaleLowerCase()}`;
				if (!existingKeys.has(key)) {
					flow.draft.albumDetails.tags.push(tag);
					existingKeys.add(key);
				}
			}
			if (nextTags.length) flow.metadataTagsApplied = true;
		}
		if (
			!isCanceledSnapshot &&
			snapshot.derivedAlbumType &&
			!flow.typeCustomized &&
			(!previousDerivedAlbumType ||
				flow.draft.albumDetails.type === previousDerivedAlbumType)
		) {
			flow.draft.albumDetails.type = snapshot.derivedAlbumType;
		}
		if (
			!isCanceledSnapshot &&
			snapshot.metadataSourceUrl &&
			(!flow.draft.albumDetails.source.trim() ||
				flow.draft.albumDetails.source === previousMetadataSourceURL)
		) {
			flow.draft.albumDetails.source = snapshot.metadataSourceUrl;
		}
		const metadataMatchFinished = ["matched", "unmatched", "ambiguous", "manual"].includes(
			metadataMatchStatus,
		);
		const processingFinished = isTerminalSnapshot;
		if (flow.step === "albumImport" && processingFinished && !flow.returnedToImport) {
			if (metadataMatchFinished || ["failed", "canceled"].includes(snapshot.status)) {
				flow.step = "albumDetails";
			}
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
		const isTrackedFlow = () =>
			Object.values(state.value.creationFlows).some(
				(candidate) => candidate === flow,
			);
		const poll = async () => {
			if (
				generation !== uploadState.pollingGeneration ||
				!isTrackedFlow() ||
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
				startMetadataMatch(flow);
				const done = [
					"ready",
					"needs_attention",
					"failed",
					"canceled",
					"committed",
				].includes(snapshot.status) && snapshot.metadataMatchStatus !== 'matching' && !flow.draft.albumImport.metadataMatchingStarted;
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

	function artistNameForMetadataMatch(flow: MusicCreationFlowState) {
		const primary = flow.draft.albumDetails.contributors.find((item) => item.roles.some((role) => role.role === 'primary'));
		if (primary?.name.trim()) return primary.name.trim();
		return (
			flow.draft.artist.stageNames.find((item) => item.isPrimary && item.name.trim())?.name.trim() ||
			flow.draft.artist.stageNames.find((item) => item.name.trim())?.name.trim() ||
			flow.draft.artist.legalName.trim()
		);
	}

	async function startMetadataMatch(flow: MusicCreationFlowState, force = false) {
		const draft = flow.draft.albumImport;
		if (
			!draft.importId ||
			draft.metadataMatchingStarted ||
			(!force && ['matching', 'matched', 'manual', 'ambiguous', 'unmatched'].includes(draft.metadataMatchStatus ?? ''))
		) return;
		const importId = draft.importId;
		if (['canceled', 'committed'].includes(draft.status)) return;
		const tracks = draft.derivedTracks ?? [];
		if (!tracks.length) return;
		const artist = artistNameForMetadataMatch(flow);
		const albumTitle = (flow.draft.albumDetails.title || draft.derivedAlbumTitle || draft.archiveName)
			.trim()
			.replace(/\.(?:zip|rar|7z|tar|gz|bz2|xz)$/i, '');
		if (!albumTitle) return;
		const matchGeneration = ++uploadStateFor(flow).matchGeneration;
		draft.metadataMatchingStarted = true;
		draft.metadataMatchStatus = 'matching';
		draft.metadataMatched = false;
		draft.metadataError = '';
		try {
			const matched = await matchMusicAlbumImportMetadata(importId, {
				albumTitle,
				artist,
				trackTitles: tracks.map((track) => track.title),
				tracks,
				force,
				async: true,
			});
			if (flow.draft.albumImport.importId === importId && matchGeneration === uploadStateFor(flow).matchGeneration) {
				applyImportSnapshotToFlow(flow, matched, importId);
				if (matched.metadataMatchStatus === 'matching') startPollingFor(flow, importId);
			}
		} catch (error) {
			if (flow.draft.albumImport.importId !== importId || matchGeneration !== uploadStateFor(flow).matchGeneration) return;
			draft.metadataMatchingStarted = false;
			draft.metadataMatchStatus = 'unmatched';
			draft.metadataError = error instanceof Error ? error.message : '外部元数据匹配失败';
			if (flow.step === 'albumImport') flow.step = 'albumDetails';
		}
	}

	function startMetadataMatching(force = false) {
		const flow = creationFlow.value;
		if (flow) return startMetadataMatch(flow, force);
	}

	function beginUploadOperation(uploadState: AlbumImportUploadState) {
		uploadState.matchGeneration += 1;
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
			["uploaded", "queued", "extracting", "analyzing", "transcoding"].includes(
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
		uploadState.serverDerivedSnapshotApplied = false;
		const isCurrent = () => generation === uploadState.operationGeneration;
		const files = Array.from(fileList).filter((file) => {
			const relativePath =
				(file as File & { webkitRelativePath?: string }).webkitRelativePath ||
				file.name;
			return !shouldIgnoreAlbumImportPath(relativePath);
		});
		if (files.length === 0) {
			uploadState.errorMessage.value = "未发现可导入的音频或视频文件";
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
		draft.metadataMatchingStarted = false;
		draft.metadataError = "";
		clearExternalMetadata(flow, true);
		flow.metadataTagsApplied = false;
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
		const artistName =
			flow.draft.artist.stageNames
				.find((item) => item.isPrimary && item.name.trim())
				?.name.trim() ||
			flow.draft.artist.stageNames
				.find((item) => item.name.trim())
				?.name.trim() ||
			flow.draft.artist.legalName.trim();

		let localPreviewData: Promise<MusicAlbumImportPreview> | null = null;
		let localPreviewPromise: Promise<void> | null = null;
		if (files.length) {
			localPreviewData = isArchive ? readAlbumImportPreview(files[0], artistName) : readAlbumImportFilesPreview(files, artistName);
			localPreviewPromise = localPreviewData
				.then(async (preview) => {
					if (!isCurrent() || uploadState.serverDerivedSnapshotApplied) return;
					const localTracks: MusicAlbumImportTrack[] = preview.trackDetails ?? preview.tracks.map((title, index) => ({
						title,
						audioKey: "",
						origin: `local_preview:${index + 1}`,
						originalTitle: title,
						originalDiscNumber: 1,
						originalTrackNumber: index + 1,
						matchStatus: "unmatched",
					}));
					draft.derivedAlbumTitle = preview.title;
					draft.derivedTracks = localTracks;
					mergeImportedTracksIntoDraft(flow, localTracks);
					if (!flow.titleCustomized) {
						flow.draft.albumDetails.title = preview.title;
					}
					if (preview.albumCoverFile) {
						draft.derivedCover = URL.createObjectURL(preview.albumCoverFile);
						if (!flow.coverCustomized) {
							flow.draft.albumDetails.coverUrl = draft.derivedCover;
						}
					}
				})
				.catch(() => {
					// 后台提取会在上传完成后提供完整信息。
				});
		}

		try {
			const session = await createMusicAlbumImport({
				artistId: flow.draft.artist.id,
				...(artistName ? { artistName } : {}),
				...(isArchive ? { archiveName: files[0].name } : {}),
				inputMode: autoMode,
			});
				if (!isCurrent()) return;
				draft.importId = session.importId;
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
			void localPreviewPromise?.then(() => {
				if (!isCurrent() || draft.importId !== session.importId) return;
				for (const track of draft.derivedTracks) {
					const record = draft.files.find((file) => file.relativePath === track.origin);
					if (record) track.fileId = record.fileId;
				}
				return startMetadataMatch(flow);
			});

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
			if (localPreviewPromise) await localPreviewPromise;
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
		uploadState.serverDerivedSnapshotApplied = false;
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
		startMetadataMatching,
		stopPolling,
		resetUploadState,
	};
}
