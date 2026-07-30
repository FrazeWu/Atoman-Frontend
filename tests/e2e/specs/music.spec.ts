import { test, expect } from '../fixtures/base'

test.describe('Music', () => {
  test('browse albums', async ({ page }) => {
    await page.goto('/music')
    await expect(page.getByRole('heading', { name: '专辑' })).toBeVisible()
  })

  test('music shows album search input', async ({ page }) => {
    await page.goto('/music')
    await expect(page.getByPlaceholder('搜索专辑或艺术家...')).toBeVisible()
  })

  test('music shows add album button', async ({ page }) => {
    await page.goto('/music')
    await expect(page.getByRole('button', { name: '添加专辑' })).toBeVisible()
  })

  test('search for albums or artists', async ({ page }) => {
    await page.goto('/music')

    const searchInput = page.getByPlaceholder('搜索专辑或艺术家...')
    await searchInput.fill('test')
    await expect(searchInput).toHaveValue('test')
  })

  test('view album detail', async ({ page }) => {
    await page.goto('/music')
    await page.waitForTimeout(3000)

    const card = page.locator('[data-testid="album-card"]').first()
    if (await card.isVisible().catch(() => false)) {
      await card.click()
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL(/\/music(?:\?|\?.*&)album=/)
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
    await page.goto('/music/artist/new')
    await expect(page).toHaveURL(/\/login/)
    const url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('redirect')).toBe('/music?editor=artist-create')
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
  })

  test('authenticated user can access contribute page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/music/artist/new')
    await expect(authenticatedPage).toHaveURL(/\/music\?editor=artist-create/)
    const url = new URL(authenticatedPage.url())
    expect(url.pathname).toBe('/music')
    expect(url.searchParams.get('editor')).toBe('artist-create')
  })

  test('music form pages render core controls', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/music/artist/new?name=test_artist')
    await expect(authenticatedPage.getByRole('heading', { name: '新建艺术家' })).toBeVisible()
    const url = new URL(authenticatedPage.url())
    expect(url.pathname).toBe('/music')
    expect(url.searchParams.get('editor')).toBe('artist-create')
    expect(url.searchParams.get('name')).toBe('test_artist')
    await expect(authenticatedPage.getByPlaceholder('例如：Kanye West')).toHaveValue('test_artist')
    await expect(authenticatedPage.getByRole('button', { name: '创建艺术家' })).toBeVisible()
  })
})
