import { test as base, expect, type Page } from '@playwright/test'
import { loginViaAPI, ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers/auth'

const AUTH_FILE_ADMIN = './tests/e2e/.auth/admin.json'

type Fixtures = {
  authenticatedPage: Page
  adminPage: Page
}

function routeForCurrentModule(url: string) {
  if (!url.startsWith('/')) return url

  const [path, query = ''] = url.split('?')
  const legacyPrefixes: Array<[string, string]> = [
    ['/blog', 'blog'],
    ['/feed', 'feed'],
    ['/music', 'music'],
    ['/forum', 'forum'],
    ['/debate', 'debate'],
    ['/timeline', 'timeline'],
    ['/podcast', 'podcast'],
    ['/video', 'video'],
  ]

  for (const [prefix, site] of legacyPrefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      const modulePath = path === prefix ? '/' : path.slice(prefix.length)
      const params = new URLSearchParams(query)
      params.set('site', site)
      return `${modulePath || '/'}?${params.toString()}`
    }
  }

  const modulePaths: Array<[string, string]> = [
    ['/post', 'blog'], ['/editor', 'blog'], ['/channel', 'blog'], ['/collection', 'blog'],
    ['/inbox', 'feed'], ['/reading-list', 'feed'],
    ['/album', 'music'], ['/artist', 'music'], ['/song', 'music'],
  ]

  for (const [prefix, site] of modulePaths) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      const params = new URLSearchParams(query)
      params.set('site', site)
      return `${path}?${params.toString()}`
    }
  }

  return url
}

function patchGoto(page: Page) {
  const originalGoto = page.goto.bind(page)
  page.goto = async (url: string, options?: any) => originalGoto(routeForCurrentModule(url), options)
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    patchGoto(page)

    await use(page)
  },
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: AUTH_FILE_ADMIN })
    const page = await context.newPage()
    patchGoto(page)
    await use(page)
    await context.close()
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: AUTH_FILE_ADMIN })
    const page = await context.newPage()
    patchGoto(page)
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
  await page.getByPlaceholder('输入用户名或邮箱').fill(ADMIN_EMAIL)
  await page.getByPlaceholder('输入密码').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForURL(/^(?!\/login)/, { timeout: 10000 })

  await context.storageState({ path: AUTH_FILE_ADMIN })
  await browser.close()
}
