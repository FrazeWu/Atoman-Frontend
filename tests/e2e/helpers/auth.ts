import { type Page, type APIRequestContext, expect } from '@playwright/test'

const ADMIN_EMAIL = 'admin@atoman.com'
const ADMIN_PASSWORD = 'admin123'

export async function loginViaAPI(request: APIRequestContext): Promise<{ token: string; user: any }> {
  let response = await request.post('/api/auth/login', {
    data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })

  // If the dev server proxy isn't forwarding /api, try backend directly.
  if (!response.ok()) {
    try {
      const fallback = await request.post('http://localhost:8080/api/auth/login', {
        data: { username: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      })
      if (fallback.ok()) response = fallback
    } catch (e) {
      // ignore and let the expect below surface the error
    }
  }

  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  return { token: body.token, user: body.user }
}

export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('输入用户名或邮箱').fill(email)
  await page.getByPlaceholder('输入密码').fill(password)
  await page.getByRole('button', { name: '登 录' }).click()
  await page.waitForURL(/^(?!\/login)/)
}

export async function logoutViaUI(page: Page): Promise<void> {
  await page.getByRole('button', { name: /▾/ }).first().click()
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.waitForURL(/\/login/)
}

export { ADMIN_EMAIL, ADMIN_PASSWORD }
