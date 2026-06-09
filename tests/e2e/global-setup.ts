import { chromium, request, type FullConfig } from '@playwright/test'

import { loginViaAPI } from './helpers/auth'

const AUTH_FILE = './tests/e2e/.auth/admin.json'

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  const baseURL = String((config.projects[0]?.use as { baseURL?: string } | undefined)?.baseURL || 'http://localhost:5173')
  const requestContext = await request.newContext({ baseURL })
  const { token, user } = await loginViaAPI(requestContext)

  await page.goto(new URL('/login', baseURL).toString())
  await page.evaluate(({ authToken, authUser }) => {
    localStorage.setItem('token', authToken)
    localStorage.setItem('user', JSON.stringify(authUser))
    const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith('blog_editor_'))
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  }, { authToken: token, authUser: user })
  await context.storageState({ path: AUTH_FILE })

  await requestContext.dispose()
  await browser.close()
}

export default globalSetup
