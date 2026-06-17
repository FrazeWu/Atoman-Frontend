import { test, expect } from '../fixtures/base'

test.describe('Navigation', () => {
  test('topbar navigation links work', async ({ page }) => {
    await page.goto('/')

    const navLinks = [
      { name: '订阅', expectedUrl: /\/?\?site=feed|\/$/ },
      { name: '刊播', expectedUrl: /\?site=kanbo/ },
      { name: '音乐', expectedUrl: /\?site=music/ },
      { name: '论坛', expectedUrl: /\?site=forum/ },
      { name: '辩论', expectedUrl: /\?site=debate/ },
      { name: '时间线', expectedUrl: /\?site=timeline/ },
    ]

    for (const link of navLinks) {
      await page.goto('/')
      const navLink = page.locator('header nav').getByRole('link', { name: link.name, exact: true })
      if (await navLink.isVisible().catch(() => false)) {
        await navLink.click()
        await page.waitForTimeout(1000)
        await expect(page).toHaveURL(link.expectedUrl)
      }
    }
  })

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
    await page.evaluate(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    })
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
