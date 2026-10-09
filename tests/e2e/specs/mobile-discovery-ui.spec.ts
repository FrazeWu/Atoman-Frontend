import { test, expect as baseExpect } from '@playwright/test'
import { mockDiscoveryPreview } from '../helpers/discovery-preview'

test.setTimeout(90_000)
const expect = baseExpect.configure({ timeout: 20_000 })

for (const width of [320, 390]) {
  for (const module of [
    { path: '/feed', name: 'feed', content: '.content-stream-entry', search: 'discovery-search-input' },
    { path: '/music', name: 'music', content: '.music-album-card', search: 'music-explore-search-input' },
    { path: '/videos', name: 'videos', content: '.vc-card', search: 'video-module-search-input' },
  ]) {
    test(`${module.name} content and navigation fit ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 })
      await mockDiscoveryPreview(page)
      await page.goto(module.path)
      await expect(page.locator(module.content).first()).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId(module.search)).toBeVisible()
      await expect(page.getByRole('navigation', { name: '当前模块导航' })).toBeVisible()
      const bounds = await page.locator(module.content).evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }
      }))
      for (const bound of bounds) {
        expect(bound.left).toBeGreaterThanOrEqual(0)
        expect(bound.right).toBeLessThanOrEqual(width)
        expect(bound.scrollWidth).toBeLessThanOrEqual(bound.clientWidth + 1)
      }
      await page.screenshot({ path: testInfo.outputPath(`${module.name}-${width}.png`), fullPage: true, animations: 'disabled' })
      if (module.name === 'feed') {
        const request = page.waitForRequest((request) => request.url().includes('/feed/recommend/articles?') && request.url().includes('category=news'))
        await page.getByRole('button', { name: '新闻', exact: true }).click()
        await request
        await expect(page.getByRole('button', { name: '新闻', exact: true })).toHaveClass(/is-active/)
      } else if (module.name === 'music') {
        await page.locator('.music-album-card .cover-action').first().click()
        await expect(page).toHaveURL(/\/music\/album\/album-1/)
        await expect(page.locator('.p-sheet-mobile-page').first()).toBeVisible()
      } else {
        const feedback = page.getByRole('button', { name: '调整 沿着海岸线，找回生活的节奏 推荐' })
        await expect(feedback).toBeVisible()
        const feedbackBounds = await feedback.boundingBox()
        expect(feedbackBounds!.x).toBeGreaterThanOrEqual(0)
        expect(feedbackBounds!.x + feedbackBounds!.width).toBeLessThanOrEqual(width)
        await feedback.click()
        await expect(page.getByRole('menuitem', { name: '不感兴趣', exact: true })).toBeVisible()
        await feedback.click()
        const request = page.waitForRequest((request) => request.url().includes('/videos?') && request.url().includes('sort=popular'))
        await page.getByRole('button', { name: '最热播放', exact: true }).click()
        await request
        await page.locator('.vc-thumb-link').first().click()
        await expect(page).toHaveURL(/\/videos\/watch\/video-1/)
        await expect(page.locator('.p-sheet-mobile-page').first()).toBeVisible()
      }
      const navigation = page.getByRole('navigation', { name: '当前模块导航' })
      await expect(navigation).toBeVisible()
      expect(await navigation.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))
      })).toBe(true)
    })
  }
}

test('desktop discovery keeps its own layout', async ({ page }, testInfo) => {
  test.skip(!process.env.DESKTOP_PREVIEW_URL, '需要独立桌面预览服务')
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockDiscoveryPreview(page)
  for (const pathname of ['/feed', '/music', '/videos']) {
    await page.goto(`${process.env.DESKTOP_PREVIEW_URL}${pathname}`)
    await expect(page.locator('.p-page-header__title').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.mobile-app-shell')).toHaveCount(0)
    await expect(page.locator('.mobile-bottom-nav')).toBeHidden()
    await page.screenshot({ path: testInfo.outputPath(`desktop-${pathname.slice(1)}.png`), animations: 'disabled' })
  }
})
