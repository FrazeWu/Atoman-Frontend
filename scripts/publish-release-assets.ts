import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const bucketName =
	process.env.FRONTEND_RELEASE_ASSET_BUCKET || "atoman-frontend-releases";
const distAssetsDirectory = join(process.cwd(), "dist", "assets");

function parsePositiveInteger(value: string | undefined, fallback: number) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return fallback;
	return Math.floor(parsed);
}

const uploadConcurrency = parsePositiveInteger(
	process.env.FRONTEND_RELEASE_ASSET_UPLOAD_CONCURRENCY,
	1,
);
const maxUploadAttempts = parsePositiveInteger(
	process.env.FRONTEND_RELEASE_ASSET_UPLOAD_ATTEMPTS,
	5,
);

const contentTypes = {
	".avif": "image/avif",
	".css": "text/css; charset=utf-8",
	".gif": "image/gif",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".woff": "font/woff",
	".woff2": "font/woff2",
} as const;

async function listFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const path = join(directory, entry.name);
			return entry.isDirectory() ? listFiles(path) : [path];
		}),
	);
	return files.flat();
}

function wait(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableStatus(status: number) {
	return status === 429 || status >= 500;
}

function retryDelayMs(attempt: number, response: Response | null) {
	const retryAfterSeconds = Number(response?.headers.get("retry-after"));
	if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
		return retryAfterSeconds * 1_000;
	}
	return Math.min(attempt * 1_000, 10_000);
}

async function uploadAsset(file: string) {
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
	const token = process.env.CLOUDFLARE_API_TOKEN!;
	const key = `assets/${relative(distAssetsDirectory, file).replaceAll("\\", "/")}`;
	const contentType =
		contentTypes[extname(file).toLowerCase() as keyof typeof contentTypes] ||
		"application/octet-stream";
	const objectKey = key.split("/").map(encodeURIComponent).join("/");
	const body = await readFile(file);

	for (let attempt = 1; attempt <= maxUploadAttempts; attempt += 1) {
		let response: Response | null = null;
		try {
			response = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${objectKey}`,
				{
					method: "PUT",
					headers: {
						authorization: ["Bearer", token].join(" "),
						"content-type": contentType,
					},
					body,
				},
			);
			if (response.ok) return;

			const message = await response.text();
			if (isRetryableStatus(response.status) && attempt < maxUploadAttempts) {
				const delay = retryDelayMs(attempt, response);
				process.stderr.write(
					`Retrying ${key} after ${response.status} (attempt ${attempt}/${maxUploadAttempts})\n`,
				);
				await wait(delay);
				continue;
			}
			throw new Error(`Failed to archive ${key}: ${response.status} ${message}`);
		} catch (error) {
			if (attempt >= maxUploadAttempts) {
				throw new Error(
					`Failed to archive ${key}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
			const delay = retryDelayMs(attempt, response);
			process.stderr.write(
				`Retrying ${key} after network/transient error (attempt ${attempt}/${maxUploadAttempts})\n`,
			);
			await wait(delay);
		}
	}
}

async function main() {
	if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) {
		throw new Error(
			"CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required to archive release assets",
		);
	}

	const files = await listFiles(distAssetsDirectory);
	for (let index = 0; index < files.length; index += uploadConcurrency) {
		await Promise.all(
			files.slice(index, index + uploadConcurrency).map(uploadAsset),
		);
	}
	process.stdout.write(
		`Archived ${files.length} release assets in ${bucketName} (concurrency=${uploadConcurrency})\n`,
	);
}

void main().catch((error) => {
	process.stderr.write(
		`${error instanceof Error ? error.stack || error.message : String(error)}\n`,
	);
	process.exitCode = 1;
});
