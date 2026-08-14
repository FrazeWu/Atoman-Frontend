type MusicUploadResumeRecord = {
	fingerprint: string;
	uploadId: string;
	expiresAt: string;
};

const databaseName = "atoman-music-uploads";
const storeName = "resumes";

function fingerprint(file: File): string {
	return [file.name, file.size, file.lastModified, file.type].join("|");
}

function openDatabase(): Promise<IDBDatabase | null> {
	if (typeof indexedDB === "undefined") return Promise.resolve(null);
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName, 1);
		request.onupgradeneeded = () =>
			request.result.createObjectStore(storeName, { keyPath: "fingerprint" });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function withStore<T>(
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
	const database = await openDatabase();
	if (!database) return undefined;
	try {
		return await new Promise<T>((resolve, reject) => {
			const request = action(
				database.transaction(storeName, mode).objectStore(storeName),
			);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	} finally {
		database.close();
	}
}

export async function loadMusicUploadResume(
	file: File,
): Promise<string | undefined> {
	const record = await withStore<MusicUploadResumeRecord>("readonly", (store) =>
		store.get(fingerprint(file)),
	);
	if (!record) return undefined;
	if (Date.parse(record.expiresAt) > Date.now()) return record.uploadId;
	await clearMusicUploadResume(file);
	return undefined;
}

export async function saveMusicUploadResume(
	file: File,
	uploadId: string,
	expiresAt: string,
): Promise<void> {
	await withStore<IDBValidKey>("readwrite", (store) =>
		store.put({ fingerprint: fingerprint(file), uploadId, expiresAt }),
	);
}

export async function clearMusicUploadResume(file: File): Promise<void> {
	await withStore<undefined>("readwrite", (store) =>
		store.delete(fingerprint(file)),
	);
}
