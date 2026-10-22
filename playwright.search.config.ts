import { defineConfig, devices } from '@playwright/test'

// 先运行 scripts/start-rating-acceptance.sh --foreground；不接触远端数据。
export default defineConfig({
  testDir: './tests/e2e-search', workers: 1, retries: 0, timeout: 60000,
  outputDir: './test-results/search', reporter: [['list']],
  use: {
    baseURL: process.env.RATING_ACCEPTANCE_BASE_URL || 'http://127.0.0.1:5187',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
})
