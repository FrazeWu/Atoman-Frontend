import { defineConfig, devices } from "@playwright/test";

const useLocalServers = !process.env.PLAYWRIGHT_BASE_URL;
const frontendPort = Number(process.env.PLAYWRIGHT_PORT || 5175);
const backendPort = Number(process.env.E2E_BACKEND_PORT || 8081);
const baseURL =
	process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${frontendPort}`;

export default defineConfig({
	testDir: "./tests/e2e",
	globalSetup:
		process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP === "1"
			? undefined
			: "./tests/e2e/global-setup.ts",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 1,
	workers: 1,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	webServer: useLocalServers
		? [
				{
					command: `cd ../Atoman-Backend && PORT=${backendPort} OWNER_USERNAME=e2e-owner OWNER_EMAIL=e2e-owner@example.test OWNER_PASSWORD=e2e-password go run ./cmd/start_server --mode dev`,
					url: `http://127.0.0.1:${backendPort}/api/v1/auth/session`,
					reuseExistingServer: false,
					timeout: 120000,
				},
				{
					command: `bun --bun vite --mode development --host 0.0.0.0 --port ${frontendPort}`,
					url: `${baseURL}/`,
					reuseExistingServer: false,
					timeout: 120000,
					env: {
						...process.env,
						NODE_ENV: "development",
						VITE_API_URL: "/api",
						VITE_DEV_PROXY_TARGET: `http://127.0.0.1:${backendPort}`,
						VITE_DEV_PROXY_ORIGIN: baseURL,
					},
				},
			]
		: undefined,
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				launchOptions: {
					args: ["--no-sandbox", "--disable-dev-shm-usage"],
				},
			},
		},
	],
});
