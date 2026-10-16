import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e-rating',
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [['list']],
  outputDir: process.env.RATING_ACCEPTANCE_OUTPUT_DIR || './test-results/rating-acceptance',
  use: {
    baseURL: process.env.RATING_ACCEPTANCE_BASE_URL || 'http://127.0.0.1:5187',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
})
