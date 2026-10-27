import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_SMOKE_PORT ?? "5175");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("PLAYWRIGHT_SMOKE_PORT must be an integer between 1024 and 65535");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e-smoke",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // A fresh Vite server may compile the lazy reader route on first access.
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun --bun vite --mode development --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${baseURL}/`,
    // A server from another worktree must never satisfy this run.
    reuseExistingServer: false,
    timeout: 120000,
  },
});
