import {
	parseAudioTrackTitleCore,
	readAlbumImportPreviewCore,
	readAlbumImportFilesPreviewCore,
	type MusicAlbumImportPreview,
} from "@/utils/musicImportCore";

export type AudioMetadataWorkerRequest =
	| {
			id: string;
			action: "PARSE_TRACK_TITLE";
			file: Blob;
			fileName: string;
			artist?: string;
	  }
	| {
			id: string;
			action: "PARSE_ARCHIVE";
			file: File;
			artist?: string;
	  }
	| {
			id: string;
			action: "PARSE_FILES";
			files: File[];
			artist?: string;
	  };

export interface CoverBufferData {
	name: string;
	type: string;
	buffer: ArrayBuffer;
}

export type AudioMetadataWorkerResponse =
	| {
			id: string;
			type: "PROGRESS";
			progress: number;
	  }
	| {
			id: string;
			type: "SUCCESS";
			result: Omit<MusicAlbumImportPreview, "albumCoverFile"> & {
				albumCover?: CoverBufferData;
			};
	  }
	| {
			id: string;
			type: "SUCCESS_TITLE";
			title: string;
	  }
	| {
			id: string;
			type: "ERROR";
			error: string;
	  };

async function serializePreview(
	preview: MusicAlbumImportPreview,
): Promise<{
	payload: Omit<MusicAlbumImportPreview, "albumCoverFile"> & {
		albumCover?: CoverBufferData;
	};
	transferables: Transferable[];
}> {
	const transferables: Transferable[] = [];
	let albumCover: CoverBufferData | undefined;

	if (preview.albumCoverFile) {
		try {
			const buffer = await preview.albumCoverFile.arrayBuffer();
			albumCover = {
				name: preview.albumCoverFile.name,
				type: preview.albumCoverFile.type,
				buffer,
			};
			transferables.push(buffer);
		} catch {
			// 忽略封面读取异常，保证元信息正常返回
		}
	}

	const { albumCoverFile: _, ...rest } = preview;
	return {
		payload: {
			...rest,
			...(albumCover ? { albumCover } : {}),
		},
		transferables,
	};
}

self.addEventListener("message", async (event: MessageEvent<AudioMetadataWorkerRequest>) => {
	const data = event.data;
	if (!data || !data.id) return;

	const onProgress = (ratio: number) => {
		const progressMsg: AudioMetadataWorkerResponse = {
			id: data.id,
			type: "PROGRESS",
			progress: ratio,
		};
		self.postMessage(progressMsg);
	};

	try {
		switch (data.action) {
			case "PARSE_TRACK_TITLE": {
				const title = await parseAudioTrackTitleCore(data.file, data.fileName, data.artist);
				const resp: AudioMetadataWorkerResponse = {
					id: data.id,
					type: "SUCCESS_TITLE",
					title,
				};
				self.postMessage(resp);
				break;
			}
			case "PARSE_ARCHIVE": {
				const preview = await readAlbumImportPreviewCore(data.file, data.artist, onProgress);
				const { payload, transferables } = await serializePreview(preview);
				const resp: AudioMetadataWorkerResponse = {
					id: data.id,
					type: "SUCCESS",
					result: payload,
				};
				self.postMessage(resp, { transfer: transferables });
				break;
			}
			case "PARSE_FILES": {
				const preview = await readAlbumImportFilesPreviewCore(data.files, data.artist, onProgress);
				const { payload, transferables } = await serializePreview(preview);
				const resp: AudioMetadataWorkerResponse = {
					id: data.id,
					type: "SUCCESS",
					result: payload,
				};
				self.postMessage(resp, { transfer: transferables });
				break;
			}
		}
	} catch (err: unknown) {
		const errorMsg: AudioMetadataWorkerResponse = {
			id: data.id,
			type: "ERROR",
			error: err instanceof Error ? err.message : String(err),
		};
		self.postMessage(errorMsg);
	}
});
