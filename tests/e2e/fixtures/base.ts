import { test as base, expect, type Page } from '@playwright/test'
import { loginViaAPI, ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers/auth'

const AUTH_FILE_ADMIN = './tests/e2e/.auth/admin.json'

type Fixtures = {
  authenticatedPage: Page
  adminPage: Page
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    // patch page.goto for anonymous pages as well
    const originalGoto = page.goto.bind(page)
    page.goto = async (url: string, options?: any) => {
      if (typeof url === 'string' && url.startsWith('/')) {
        const prefixToModule: Record<string, string> = {
          '/blog': 'blog', '/post': 'blog', '/editor': 'blog', '/channel': 'blog', '/collection': 'blog',
          '/feed': 'feed', '/inbox': 'feed', '/reading-list': 'feed',
          '/music': 'music', '/music/': 'music',
          '/forum': 'forum', '/debate': 'debate', '/timeline': 'timeline', '/podcast': 'podcast', '/video': 'video',
        }

        for (const p of Object.keys(prefixToModule)) {
          if (url === p || url.startsWith(p + '/')) {
            const site = prefixToModule[p]
            await originalGoto(`/?site=${site}`)
            const sep = url.includes('?') ? '&' : '?'
            return originalGoto(`${url}${sep}site=${site}`)
          }
        }
      }
      return originalGoto(url, options)
    }

    await use(page)
  },
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: AUTH_FILE_ADMIN })
    const page = await context.newPage()
    // Patch page.goto to support host-scoped module routing in local dev
    const originalGoto = page.goto.bind(page)
    page.goto = async (url: string, options?: any) => {
      if (typeof url === 'string' && url.startsWith('/')) {
        const prefixToModule: Record<string, string> = {
          '/blog': 'blog', '/post': 'blog', '/editor': 'blog', '/channel': 'blog', '/collection': 'blog',
          '/feed': 'feed', '/inbox': 'feed', '/reading-list': 'feed',
          '/music': 'music', '/music/': 'music',
          '/forum': 'forum', '/debate': 'debate', '/timeline': 'timeline', '/podcast': 'podcast', '/video': 'video',
        }

        for (const p of Object.keys(prefixToModule)) {
          if (url === p || url.startsWith(p + '/')) {
            const site = prefixToModule[p]
            // ensure site query is set first, then navigate to target path under that module
            await originalGoto(`/?site=${site}`)
            const sep = url.includes('?') ? '&' : '?'
            return originalGoto(`${url}${sep}site=${site}`)
          }
        }
      }
      return originalGoto(url, options)
    }
    await use(page)
    await context.close()
  },
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: AUTH_FILE_ADMIN })
    const page = await context.newPage()
    // same patch for adminPage
    const originalGotoAdmin = page.goto.bind(page)
    page.goto = async (url: string, options?: any) => {
      if (typeof url === 'string' && url.startsWith('/')) {
        const prefixToModule: Record<string, string> = {
          '/blog': 'blog', '/post': 'blog', '/editor': 'blog', '/channel': 'blog', '/collection': 'blog',
          '/feed': 'feed', '/inbox': 'feed', '/reading-list': 'feed',
          '/music': 'music', '/music/': 'music',
          '/forum': 'forum', '/debate': 'debate', '/timeline': 'timeline', '/podcast': 'podcast', '/video': 'video',
        }

        for (const p of Object.keys(prefixToModule)) {
          if (url === p || url.startsWith(p + '/')) {
            const site = prefixToModule[p]
            await originalGotoAdmin(`/?site=${site}`)
            const sep = url.includes('?') ? '&' : '?'
            return originalGotoAdmin(`${url}${sep}site=${site}`)
          }
        }
      }
      return originalGotoAdmin(url, options)
    }
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
