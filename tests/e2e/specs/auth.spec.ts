import { test, expect } from '../fixtures/base'
import { loginViaUI, ADMIN_USERNAME, ADMIN_PASSWORD } from '../helpers/auth'
import { expectTextVisible } from '../helpers/common'

test.describe('Authentication', () => {
  test('login with valid credentials redirects to feed', async ({ page }) => {
    await loginViaUI(page, ADMIN_USERNAME, ADMIN_PASSWORD)
    await expectTextVisible(page, 'ATOMAN')
  })

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('输入用户名或邮箱').fill('wrong@email.com')
    await page.getByPlaceholder('输入密码').fill('wrongpassword')
    await page.getByRole('button', { name: '登 录' }).click()
    await expect(page.locator('.a-error')).toBeVisible()
  })

  test('logout returns to login page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/feed')
    const userBtn = authenticatedPage.locator('.user-btn')
    await expect(userBtn).toBeVisible({ timeout: 10000 })
    await userBtn.click()
    await authenticatedPage.getByRole('button', { name: '退出登录' }).click()
    await expect(authenticatedPage).toHaveURL(/\/login/)
  })

  test('unauthenticated user redirected to login when accessing protected route', async ({ page }) => {
    await page.goto('/studio')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('.studio-layout')).toHaveCount(0)
  })

  test('unauthenticated user redirected to login when accessing forum new topic', async ({ page }) => {
    await page.goto('/forum/new')
    await expect(page.getByRole('heading', { name: '发布话题' })).toHaveCount(0)
  })

  test('unauthenticated user redirected to login when accessing music contribute', async ({ page }) => {
    await page.goto('/music/contribute')
    await expect(page.locator('form.form-stack')).toHaveCount(0)
  })

  test('authenticated user can still access login page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/login')
    await expect(authenticatedPage).toHaveURL(/\/login$/)
    await expect(authenticatedPage.getByText('欢迎回来')).toBeVisible()
  })

  test('register page shows registration form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('link', { name: 'ATOMAN' })).toBeVisible()
    await expect(page.locator('header nav')).toHaveCount(0)
    await expect(page.getByText('加入我们')).toBeVisible()
    await expect(page.getByPlaceholder('请输入邮箱地址')).toBeVisible()
    await expect(page.getByText('获取验证码')).toBeVisible()
  })

  test('login page shows login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: 'ATOMAN' })).toBeVisible()
    await expect(page.locator('header nav')).toHaveCount(0)
    await expect(page.getByText('欢迎回来')).toBeVisible()
    await expect(page.getByPlaceholder('输入用户名或邮箱')).toBeVisible()
  })

  test('switch between login and register pages', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: '立即注册' }).click()
    await expect(page).toHaveURL('/register')
    await expect(page.getByText('加入我们')).toBeVisible()

    await page.getByRole('link', { name: '立即登录' }).click()
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('欢迎回来')).toBeVisible()
  })
})
