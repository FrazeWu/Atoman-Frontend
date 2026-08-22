import { request, type FullConfig } from "@playwright/test";

import { ADMIN_PASSWORD, ADMIN_USERNAME } from "./helpers/auth";

const AUTH_FILE = "./tests/e2e/.auth/admin.json";

async function globalSetup(config: FullConfig) {
	if (process.env.E2E_SKIP_AUTH === "1") return;
	const baseURL = String(
		(config.projects[0]?.use as { baseURL?: string } | undefined)?.baseURL ||
			"http://localhost:5173",
	);
	const loginURL = new URL("/api/v1/auth/login", baseURL).toString();
	const context = await request.newContext({ baseURL });
	try {
		const response = await context.post(loginURL, {
			data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
			headers: { Origin: new URL(baseURL).origin },
		});
		if (!response.ok()) {
			const body = await response.text();
			throw new Error(
				`E2E login failed: ${response.status()} ${response.statusText()} ${body}`,
			);
		}

		await context.storageState({ path: AUTH_FILE });
	} finally {
		await context.dispose();
	}
}

export default globalSetup;
