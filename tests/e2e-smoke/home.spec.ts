import { expect, test } from "@playwright/test";

test("home shell renders without a backend dependency", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("#app")).toBeVisible();
});

test('topbar stays pinned while the document scrolls without horizontal overflow', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: { items: [], total: 0 } }),
  }))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/music')
  const topbar = page.locator('header.topbar')
  await expect(topbar).toBeVisible()
  // 页面内容数量不影响滚动回归测试。
  await page.locator('.app-main').evaluate(el => { (el as HTMLElement).style.minHeight = '200vh' })
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect.poll(() => topbar.evaluate(el => el.getBoundingClientRect().top)).toBe(0)

  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true)
  }
})
