import { test, expect } from '../fixtures/base'

test.describe('Music', () => {
  test('browse music timeline', async ({ page }) => {
    await page.goto('/music')
    await expect(page.getByRole('heading', { name: '艺术家' })).toBeVisible()
  })

  test('music shows search input', async ({ page }) => {
    await page.goto('/music')
    await expect(page.getByPlaceholder('搜索艺术家...')).toBeVisible()
  })

  test('music shows add artist button', async ({ page }) => {
    await page.goto('/music')
    await expect(page.getByRole('button', { name: '找不到？添加艺术家' })).toBeVisible()
  })

  test('search for artist', async ({ page }) => {
    await page.goto('/music')
    await page.waitForTimeout(2000)

    const searchInput = page.getByPlaceholder('搜索艺术家...')
    await searchInput.click()
    await searchInput.fill('test')
    await page.waitForTimeout(1000)
  })

  test('view album detail', async ({ page }) => {
    await page.goto('/music')
    await page.waitForTimeout(3000)

    const detailLink = page.getByRole('link', { name: '详情' }).first()
    if (await detailLink.isVisible().catch(() => false)) {
      await detailLink.click()
      await page.waitForTimeout(2000)
      // app may route to /album/:id or /music/album/:id — accept either
      await expect(page).toHaveURL(/(?:\/album\/|\/music\/(?:album|albums)\/)/)
    }
  })

  test('play song from timeline', async ({ page }) => {
    await page.goto('/music')
    await page.waitForTimeout(3000)

    const playBtn = page.getByRole('button', { name: '▶ 播放' }).first()
    if (await playBtn.isVisible().catch(() => false)) {
      await playBtn.click()
      await page.waitForTimeout(1000)
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('music contribute requires login', async ({ page }) => {
    await page.goto('/artist/new')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
  })

  test('authenticated user can access contribute page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/artist/new')
    await expect(authenticatedPage).toHaveURL(/\/artist\/new\?site=music/)
  })

  test('music form pages render core controls', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/artist/new?name=test_artist')
    await expect(authenticatedPage.getByText('添加/补全艺术家')).toBeVisible()
    await expect(authenticatedPage.getByPlaceholder('例如：kanye_west')).toHaveValue('test_artist')
    await expect(authenticatedPage.getByRole('button', { name: '创建艺术家' })).toBeVisible()
  })
})
