import { test as base, expect, type Page } from '@playwright/test'
import { ADMIN_USERNAME, ADMIN_PASSWORD } from '../helpers/auth'

const AUTH_FILE_ADMIN = './tests/e2e/.auth/admin.json'

type Fixtures = {
  authenticatedPage: Page
  adminPage: Page
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await use(page)
  },
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: AUTH_FILE_ADMIN })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: AUTH_FILE_ADMIN })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect }

export async function setupAdminAuth() {
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/login')
  await page.getByPlaceholder('输入用户名或邮箱').fill(ADMIN_USERNAME)
  await page.getByPlaceholder('输入密码').fill(ADMIN_PASSWORD)
	await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL(/^(?!\/login)/, { timeout: 10000 })

  await context.storageState({ path: AUTH_FILE_ADMIN })
  await browser.close()
}
