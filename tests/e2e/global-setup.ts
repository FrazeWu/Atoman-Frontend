import { expect, request, type FullConfig } from '@playwright/test'

import { ADMIN_PASSWORD, ADMIN_USERNAME } from './helpers/auth'

const AUTH_FILE = './tests/e2e/.auth/admin.json'

async function globalSetup(config: FullConfig) {
	if (process.env.E2E_SKIP_AUTH === '1') return
  const baseURL = String((config.projects[0]?.use as { baseURL?: string } | undefined)?.baseURL || 'http://localhost:5173')
	const context = await request.newContext({ baseURL })
	const origin = new URL(baseURL).origin
	const response = await context.post(new URL('/api/v1/auth/login', baseURL).toString(), {
		data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
		headers: { Origin: origin },
	})
	expect(response.ok()).toBeTruthy()

	await context.storageState({ path: AUTH_FILE })
	await context.dispose()
}

export default globalSetup
