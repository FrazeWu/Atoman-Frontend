import type { MusicAlbumImportPreview } from "@/utils/musicImportCore";
import type {
	AudioMetadataWorkerRequest,
	AudioMetadataWorkerResponse,
} from "@/workers/audioMetadata.worker";

type PendingTask = {
	resolve: (value: any) => void;
	reject: (reason: any) => void;
	onProgress?: (ratio: number) => void;
	timer: ReturnType<typeof setTimeout>;
};

let workerInstance: Worker | null = null;
let taskCounter = 0;
const pendingTasks = new Map<string, PendingTask>();
const TASK_TIMEOUT_MS = 120_000;

function isWorkerSupported(): boolean {
	return typeof window !== "undefined" && typeof Worker !== "undefined";
}

function terminateWorkerInstance() {
	if (workerInstance) {
		workerInstance.terminate();
		workerInstance = null;
	}
	for (const [id, task] of pendingTasks.entries()) {
		clearTimeout(task.timer);
		task.reject(new Error("Worker terminated"));
		pendingTasks.delete(id);
	}
}

export function terminateAudioMetadataWorker() {
	terminateWorkerInstance();
}

function getWorker(): Worker | null {
	if (!isWorkerSupported()) return null;
	if (workerInstance) return workerInstance;

	try {
		workerInstance = new Worker(
			new URL("@/workers/audioMetadata.worker.ts", import.meta.url),
			{ type: "module" },
		);

		workerInstance.addEventListener(
			"message",
			(event: MessageEvent<AudioMetadataWorkerResponse>) => {
				const data = event.data;
				if (!data || !data.id) return;

				const task = pendingTasks.get(data.id);
				if (!task) return;

				if (data.type === "PROGRESS") {
					task.onProgress?.(data.progress);
					return;
				}

				clearTimeout(task.timer);
				pendingTasks.delete(data.id);

				if (data.type === "SUCCESS_TITLE") {
					task.resolve(data.title);
				} else if (data.type === "SUCCESS") {
					const { albumCover, ...rest } = data.result;
					let albumCoverFile: File | undefined;
					if (albumCover) {
						albumCoverFile = new File([albumCover.buffer], albumCover.name, {
							type: albumCover.type,
						});
					}
					task.resolve({
						...rest,
						...(albumCoverFile ? { albumCoverFile } : {}),
					} as MusicAlbumImportPreview);
				} else if (data.type === "ERROR") {
					task.reject(new Error(data.error));
				}
			},
		);

		workerInstance.addEventListener("error", (err) => {
			console.error("[AudioMetadataWorker] Worker error:", err);
			terminateWorkerInstance();
		});

		return workerInstance;
	} catch (e) {
		console.warn("[AudioMetadataWorker] Failed to create Worker, fallback to core:", e);
		workerInstance = null;
		return null;
	}
}

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

type WorkerRequestPayload = DistributiveOmit<AudioMetadataWorkerRequest, "id">;

function executeInWorker<T>(
	request: WorkerRequestPayload,
	onProgress?: (ratio: number) => void,
): Promise<T> {
	const worker = getWorker();
	if (!worker) {
		throw new Error("Worker not available");
	}

	const id = `task_${++taskCounter}_${Date.now()}`;

	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			pendingTasks.delete(id);
			reject(new Error(`Audio metadata task timed out after ${TASK_TIMEOUT_MS}ms`));
		}, TASK_TIMEOUT_MS);

		pendingTasks.set(id, {
			resolve,
			reject,
			onProgress,
			timer,
		});

		const fullRequest = { ...request, id } as AudioMetadataWorkerRequest;
		worker.postMessage(fullRequest);
	});
}

export async function parseAudioTrackTitleAsync(
	file: Blob,
	fileName: string,
	artist = "",
): Promise<string> {
	if (isWorkerSupported()) {
		try {
			return await executeInWorker<string>({
				action: "PARSE_TRACK_TITLE",
				file,
				fileName,
				artist,
			});
		} catch (e) {
			console.warn("[AudioMetadataWorker] parseAudioTrackTitle worker error, fallback to core:", e);
		}
	}

	// 降级使用主线程纯解析核心
	const { parseAudioTrackTitleCore } = await import("@/utils/musicImportCore");
	return parseAudioTrackTitleCore(file, fileName, artist);
}

export async function readAlbumImportPreviewAsync(
	file: File,
	artist = "",
	onProgress?: (ratio: number) => void,
): Promise<MusicAlbumImportPreview> {
	if (isWorkerSupported()) {
		try {
			return await executeInWorker<MusicAlbumImportPreview>(
				{
					action: "PARSE_ARCHIVE",
					file,
					artist,
				},
				onProgress,
			);
		} catch (e) {
			console.warn("[AudioMetadataWorker] readAlbumImportPreview worker error, fallback to core:", e);
		}
	}

	// 降级使用主线程纯解析核心
	const { readAlbumImportPreviewCore } = await import("@/utils/musicImportCore");
	return readAlbumImportPreviewCore(file, artist, onProgress);
}

export async function readAlbumImportFilesPreviewAsync(
	files: File[],
	artist = "",
	onProgress?: (ratio: number) => void,
): Promise<MusicAlbumImportPreview> {
	if (isWorkerSupported()) {
		try {
			return await executeInWorker<MusicAlbumImportPreview>(
				{
					action: "PARSE_FILES",
					files,
					artist,
				},
				onProgress,
			);
		} catch (e) {
			console.warn("[AudioMetadataWorker] readAlbumImportFilesPreview worker error, fallback to core:", e);
		}
	}

	// 降级使用主线程纯解析核心
	const { readAlbumImportFilesPreviewCore } = await import("@/utils/musicImportCore");
	return readAlbumImportFilesPreviewCore(files, artist, onProgress);
}
