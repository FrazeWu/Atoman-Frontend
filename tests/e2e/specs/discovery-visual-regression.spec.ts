import { expect, test } from '@playwright/test'
import { mockDiscoveryPreview } from '../helpers/discovery-preview'

// Use the installed system Chrome where Playwright's bundled browser is absent.
if (process.env.CHROME_BIN) test.use({ launchOptions: { executablePath: process.env.CHROME_BIN } })

test.describe('discovery visual regressions', () => {
  test.setTimeout(60_000)

  test('desktop topic controls are styled and discovery columns do not overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockDiscoveryPreview(page)
    await page.goto('/feed/explore')

    const topic = page.locator('.topic-pill').first()
    await expect(topic).toBeVisible()
    await expect(topic).toHaveClass(/is-active/)

    // CSS compiled successfully before a prior regression but v-for buttons
    // lacked scoped attributes, leaving the browser's native button styling.
    const appearance = await topic.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        borderRadius: parseFloat(style.borderTopLeftRadius),
        paddingLeft: parseFloat(style.paddingLeft),
        background: style.backgroundColor,
      }
    })
    expect(appearance.borderRadius).toBeGreaterThan(0)
    expect(appearance.paddingLeft).toBeGreaterThan(6)
    expect(appearance.background).not.toBe('rgb(239, 239, 239)')

    const columns = page.locator('.dual-streams-container > .stream-column')
    await expect(columns).toHaveCount(2)
    const bounds = await columns.evaluateAll((els) => els.map((el) => {
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right }
    }))
    expect(bounds[1]!.left - bounds[0]!.right).toBeGreaterThanOrEqual(16)
    expect(bounds[1]!.right).toBeLessThanOrEqual(1440)

    await page.locator('.topic-pill').nth(1).click()
    await expect(page.locator('.topic-pill').nth(1)).toHaveClass(/is-active/)
    await expect(page).toHaveURL(/category=blog/)
  })

  test('mobile legacy bookmarks is a protected route, not a 404', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('**/api/v1/auth/session', (route) => route.fulfill({ status: 204, body: '' }))
    await page.goto('/bookmarks')
    await expect(page).toHaveURL(/\/login(?:\?|$)/)
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '页面不存在' })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
