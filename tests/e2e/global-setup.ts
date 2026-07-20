import { chromium, expect, type FullConfig } from '@playwright/test'

import { ADMIN_PASSWORD, ADMIN_USERNAME } from './helpers/auth'

const AUTH_FILE = './tests/e2e/.auth/admin.json'

async function globalSetup(config: FullConfig) {
	if (process.env.E2E_SKIP_AUTH === '1') return
	const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  const baseURL = String((config.projects[0]?.use as { baseURL?: string } | undefined)?.baseURL || 'http://localhost:5173')
	const origin = new URL(baseURL).origin
	const response = await context.request.post(new URL('/api/v1/auth/login', baseURL).toString(), {
		data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
		headers: { Origin: origin },
	})
	expect(response.ok()).toBeTruthy()

	await page.goto(new URL('/login', baseURL).toString())
	await page.evaluate(() => {
		const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith('blog_editor_'))
		keysToRemove.forEach((k) => localStorage.removeItem(k))
	})
	await context.storageState({ path: AUTH_FILE })

	await browser.close()
}

export default globalSetup
