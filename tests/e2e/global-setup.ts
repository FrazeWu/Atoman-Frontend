import { request, type FullConfig } from "@playwright/test";

import { ADMIN_PASSWORD, ADMIN_USERNAME } from "./helpers/auth";

const ADMIN_AUTH_FILE = "./tests/e2e/.auth/admin.json";
const useIsolatedMusicAccount = process.env.MUSIC_WIKI_ISOLATED_ACCOUNT === "1";

function authConfig() {
	if (!useIsolatedMusicAccount) {
		return {
			file: ADMIN_AUTH_FILE,
			username: ADMIN_USERNAME,
			password: ADMIN_PASSWORD,
		};
	}

	const file = process.env.MUSIC_WIKI_AUTH_FILE?.trim();
	const username = process.env.MUSIC_WIKI_USERNAME?.trim();
	const password = process.env.MUSIC_WIKI_PASSWORD;
	if (!file || !username || !password) {
		throw new Error(
			"MUSIC_WIKI_ISOLATED_ACCOUNT=1 requires MUSIC_WIKI_AUTH_FILE, MUSIC_WIKI_USERNAME and MUSIC_WIKI_PASSWORD",
		);
	}
	return { file, username, password };
}

async function globalSetup(config: FullConfig) {
	if (process.env.E2E_SKIP_AUTH === "1") return;
	const auth = authConfig();
	const baseURL = String(
		(config.projects[0]?.use as { baseURL?: string } | undefined)?.baseURL ||
			"http://localhost:5173",
	);
	const apiBaseURL = process.env.E2E_API_BASE_URL || baseURL;
	const loginURL = new URL("/api/v1/auth/login", apiBaseURL).toString();
	const context = await request.newContext({ baseURL });
	try {
		const response = await context.post(loginURL, {
			data: { username: auth.username, password: auth.password },
			headers: { Origin: new URL(baseURL).origin },
		});
		if (!response.ok()) {
			const body = await response.text();
			throw new Error(
				`E2E login failed: ${response.status()} ${response.statusText()} ${body}`,
			);
		}

		await context.storageState({ path: auth.file });
	} finally {
		await context.dispose();
	}
}

export default globalSetup;
