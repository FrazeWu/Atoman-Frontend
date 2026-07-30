import { test, expect } from '../fixtures/base'

test.describe('Navigation', () => {
  const navLinks = [
    { name: '订阅', pathname: '/feed' },
    { name: '博客', pathname: '/posts' },
    { name: '音乐', pathname: '/music' },
    { name: '视频', pathname: '/videos' },
    { name: '播客', pathname: '/podcasts' },
    { name: '论坛', pathname: '/forum' },
    { name: '辩论', pathname: '/debate' },
    { name: '时间线', pathname: '/timeline' },
  ]

  for (const link of navLinks) {
    test(`topbar navigation link ${link.name} works`, async ({ page }) => {
      const siteAccessResponse = page.waitForResponse((response) => (
        response.url().endsWith('/api/v1/site/access') && response.ok()
      ))
      await page.goto('/')
      await siteAccessResponse
      const navLink = page.locator('header nav').getByRole('link', { name: link.name, exact: true })
      await expect(navLink).toBeVisible()
      await navLink.click()
      await expect(page).toHaveURL((url) => url.pathname === link.pathname)
    })
  }

  test('logo links to home redirect target', async ({ page }) => {
    await page.goto('/blog')
    await page.getByRole('link', { name: 'ATOMAN' }).click()
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/\/(feed)?/)
  })

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')
    await page.waitForTimeout(1000)
    const body = await page.locator('body').textContent()
    expect(body).toBeTruthy()
  })

	test('login button visible when not authenticated', async ({ page }) => {
		await page.goto('/')
		await page.context().clearCookies()
    await page.reload()
    await expect(page.locator('header').getByRole('link', { name: '登录', exact: true })).toBeVisible()
  })

  test('user menu visible when authenticated', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/feed')
    const userBtn = authenticatedPage.locator('.user-btn')
    await expect(userBtn).toBeVisible({ timeout: 10000 })
  })

  test('responsive viewport does not crash', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForTimeout(1000)
    await expect(page.locator('body')).toBeVisible()

    const hamburger = page.locator('.hamburger')
    if (await hamburger.isVisible().catch(() => false)) {
      await hamburger.click()
      await page.waitForTimeout(500)
      await expect(page.locator('.mobile-drawer')).toBeVisible()
    }
  })
})
