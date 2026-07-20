import { type Page, type APIRequestContext, expect } from '@playwright/test'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin123'

export async function loginViaAPI(request: APIRequestContext): Promise<{ token: string; user: any }> {
	const response = await request.post('/api/v1/auth/token', {
    data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  })

  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  return {
    token: body.token,
    user: {
      ...body.user,
      onboarding_completed_at: body.user?.onboarding_completed_at || new Date().toISOString(),
    },
  }
}

export async function mockAuthenticatedSession(page: Page, user: Record<string, unknown> = {
	uuid: 'user-1',
	username: 'creator',
	email: 'creator@example.com',
	role: 'user',
	onboarding_completed_at: '2026-07-15T09:00:00Z',
}): Promise<void> {
	await page.route('**/api/v1/auth/session', route => route.fulfill({
		status: 200,
		json: { csrf_token: 'e2e-csrf-token', user },
	}))
}

export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('输入用户名或邮箱').fill(email)
  await page.getByPlaceholder('输入密码').fill(password)
	await page.getByRole('button', { name: '登录' }).click()
  await page.waitForURL(/^(?!\/login)/)
}

export async function logoutViaUI(page: Page): Promise<void> {
  await page.getByRole('button', { name: /▾/ }).first().click()
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.waitForURL(/\/login/)
}

export { ADMIN_USERNAME, ADMIN_PASSWORD }
