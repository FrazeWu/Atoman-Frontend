import { test, expect as baseExpect } from '@playwright/test'
import { mockSavedPreview } from '../helpers/saved-preview'

const expect = baseExpect.configure({ timeout: 20_000 })
test.setTimeout(90_000)
test.use({ viewport: { width: 390, height: 844 } })
const pages = [
  { path: '/feed/starred', name: 'starred', content: '.content-stream-entry' },
  { path: '/feed/reading-list', name: 'reading', content: '.content-stream-entry' },
  { path: '/music/bookmarks', name: 'music-library', content: '.music-album-card' },
  { path: '/music/history', name: 'history', content: '.history-row' },
  { path: '/posts/bookmarks', name: 'blog-bookmarks', content: '.content-stream-entry' },
  { path: '/videos/favorites', name: 'video-favorites', content: '.video-queue-item' },
]

for (const width of [320, 390]) {
  for (const savedPage of pages) {
    test(`${savedPage.name} fits ${width}px with saved content`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 })
      await mockSavedPreview(page)
      await page.goto(savedPage.path)
      await expect(page.locator('.mobile-saved-heading')).toBeVisible()
      if (savedPage.name === 'video-favorites') await page.getByRole('radio', { name: '稍后看', exact: true }).click()
      await expect(page.locator(savedPage.content).first()).toBeVisible()
      const bounds = await page.locator(savedPage.content).evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }
      }))
      for (const bound of bounds) {
        expect(bound.left).toBeGreaterThanOrEqual(0)
        expect(bound.right).toBeLessThanOrEqual(width)
        expect(bound.scrollWidth).toBeLessThanOrEqual(bound.clientWidth + 1)
      }
      const navigation = page.getByRole('navigation', { name: '当前模块导航' })
      await expect(navigation).toBeVisible()
      expect(await navigation.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))
      })).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`${savedPage.name}-${width}.png`), fullPage: true, animations: 'disabled' })
    })
  }
}

test('article detail returns to the original list and scroll position', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockSavedPreview(page)
  await page.goto('/feed/starred')
  await page.getByRole('button', { name: '阅读灵感', exact: true }).click()
  await expect(page).toHaveURL(/group=group-2/)
  await expect(page.locator('.content-stream-entry')).toHaveCount(8)
  await page.locator('.content-stream-entry').nth(4).scrollIntoViewIfNeeded()
  const savedScroll = await page.evaluate(() => window.scrollY)
  await page.locator('.content-stream-entry').nth(4).locator('.feed-entry-title').click()
  await expect(page).toHaveURL(/\/feed\/item\/saved-5/)
  await expect(page.locator('.article-title')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('article-detail.png'), animations: 'disabled' })
  await page.getByRole('button', { name: '返回列表', exact: true }).click()
  await expect(page).toHaveURL(/\/feed\/starred\?group=group-2$/)
  await expect(page.getByRole('button', { name: '阅读灵感', exact: true })).toHaveClass(/active/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(savedScroll - 100)
})

test('music collection keeps its selected tab when returning from detail', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockSavedPreview(page)
  await page.goto('/music/bookmarks')
  await page.getByRole('radio', { name: '稍后播放', exact: true }).click()
  await expect(page.locator('.music-library__song-card')).toHaveCount(4)
  await page.screenshot({ path: testInfo.outputPath('later-music.png'), animations: 'disabled' })
  await page.getByTestId('library-song-album-album-1').click()
  await expect(page).toHaveURL(/\/music\/album\/album-1/)
  await expect(page.locator('.p-sheet-mobile-page')).toBeVisible()
  await page.locator('.p-sheet-mobile-page__back').click()
  await expect(page.getByRole('radio', { name: '稍后播放', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.music-library__song-card')).toHaveCount(4)
  await page.getByRole('button', { name: '取消稍后播放 夏天的风', exact: true }).click()
  await expect(page.locator('.music-library__song-card')).toHaveCount(3)
  await page.reload()
  await page.getByRole('radio', { name: '稍后播放', exact: true }).click()
  await expect(page.locator('.music-library__song-card')).toHaveCount(3)
})

test('reading removal updates the persisted list', async ({ page }) => {
  await mockSavedPreview(page)
  await page.goto('/feed/reading-list')
  await expect(page.locator('.content-stream-entry')).toHaveCount(3)
  await page.locator('.content-stream-entry').first().getByRole('button', { name: '取消稍后阅读', exact: true }).click()
  await expect(page.locator('.content-stream-entry')).toHaveCount(2)
  await page.reload()
  await expect(page.locator('.content-stream-entry')).toHaveCount(2)
})

test('failed music removal preserves saved content', async ({ page }) => {
  await mockSavedPreview(page, { failRemoval: true })
  await page.goto('/music/bookmarks')
  await expect(page.locator('.music-album-card')).toHaveCount(4)
  await page.locator('.music-album-card').first().getByRole('button', { name: '取消收藏', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('取消收藏失败')
  await expect(page.locator('.music-album-card')).toHaveCount(4)
})

test('empty saved content has a usable recovery action', async ({ page }) => {
  await mockSavedPreview(page, { empty: true })
  await page.goto('/music/bookmarks')
  await expect(page.getByRole('link', { name: '去发现音乐', exact: true })).toBeVisible()
})

test('failed reading list can recover without leaving the page', async ({ page }) => {
  await mockSavedPreview(page, { failLoad: true })
  await page.goto('/feed/reading-list')
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.content-stream-entry')).toHaveCount(3)
})

test('desktop saved pages retain desktop layouts', async ({ page }, testInfo) => {
  test.skip(!process.env.DESKTOP_PREVIEW_URL, '需要桌面预览服务')
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockSavedPreview(page)
  for (const savedPage of pages) {
    await page.goto(`${process.env.DESKTOP_PREVIEW_URL}${savedPage.path}`)
    await expect(page.locator('.p-page-header__title').first()).toBeVisible()
    await expect(page.locator('.mobile-saved-page')).toHaveCount(0)
    await expect(page.locator('.mobile-bottom-nav')).toBeHidden()
    await page.screenshot({ path: testInfo.outputPath(`desktop-${savedPage.name}.png`), animations: 'disabled' })
  }
})
