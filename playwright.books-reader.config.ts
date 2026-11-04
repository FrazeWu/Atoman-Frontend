import { defineConfig, devices } from '@playwright/test'
const port = Number(process.env.PLAYWRIGHT_BOOKS_PORT || 5187)
export default defineConfig({
  testDir: './tests/e2e-smoke', testMatch: 'book-reader-real.spec.ts',
  workers: 1, timeout: 90000, expect: { timeout: 30000 },
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium-real', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_BIN || '/usr/bin/google-chrome', args: ['--no-sandbox'] } } }],
  webServer: { command: `bun --bun vite --mode development --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}/`, reuseExistingServer: false, timeout: 120000 },
})
