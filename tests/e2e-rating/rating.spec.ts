import { expect, test, type BrowserContext } from '@playwright/test'

type Fixture = { episodes: Record<string, string>; book_id: string; username: string; password: string }
const backend = `http://127.0.0.1:${process.env.RATING_ACCEPTANCE_BACKEND_PORT || 8187}`
const origin = process.env.RATING_ACCEPTANCE_BASE_URL || 'http://127.0.0.1:5187'

async function login(context: BrowserContext, username: string, password: string) {
  const response = await context.request.post('/api/v1/auth/login', {
    headers: { Origin: origin }, data: { username, password },
  })
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json()).csrf_token as string
}

test('真实评分链路：冷启动、个人评分、五人门槛、权限、移动布局和图书入口', async ({ page, context, browser }, info) => {
  const metadata = await context.request.get(`${backend}/__rating_acceptance`)
  expect(metadata.status()).toBe(200)
  const fixture: Fixture = await metadata.json()
  const csrf = await login(context, fixture.username, fixture.password)
  const headers = { Origin: origin, 'X-CSRF-Token': csrf }
  const path = `/api/v1/podcast/episodes/${fixture.episodes.first}/rating`
  const detailURL = `/podcasts/episode/${fixture.episodes.first}`
  const secondURL = `/podcasts/episode/${fixture.episodes.second}`
  expect((await context.request.delete(path, { headers })).status()).toBe(200)
  const bookPath = `/api/v1/books/works/${fixture.book_id}/rating`
  expect((await context.request.delete(bookPath, { headers })).status()).toBe(200)

  // 不是后端 mock：五位用户都通过真实 Cookie/CSRF 登录及真实评分接口写入。
  const others: Array<{ context: BrowserContext; headers: Record<string, string> }> = []
  try {
    for (const suffix of ['b', 'c', 'd', 'e']) {
      const other = await browser.newContext({ baseURL: origin })
      const otherCSRF = await login(other, `rating-${suffix}`, fixture.password)
      const otherHeaders = { Origin: origin, 'X-CSRF-Token': otherCSRF }
      others.push({ context: other, headers: otherHeaders })
      expect((await other.request.delete(path, { headers: otherHeaders })).status()).toBe(200)
    }
    await page.goto(detailURL)
    const rating = page.getByRole('region', { name: '播客单集评分' })
    // HTML 返回 200 不代表 Vite 首次模块加载完成；仅首次等待页面就绪。
    await expect(rating).toBeVisible({ timeout: 15000 })
    await expect(rating).toContainText('暂无评分')
    await rating.locator('[data-score="9"]').click()
    await expect(rating).toContainText('我的评分：9/10')
    await expect(rating).toContainText('已保存')
    await expect(rating.locator('.rating-control__public-score')).toHaveCount(0)
    await page.reload()
    await expect(rating).toContainText('我的评分：9/10')

    await rating.locator('[data-score="7"]').click()
    await expect(rating).toContainText('我的评分：7/10')
    const updated = await (await context.request.get(path)).json()
    expect(updated.rating_count).toBe(1)

    // 连续方向键应逐半星移动；保存后焦点不能丢失。
    await rating.locator('[data-score="7"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(rating).toContainText('我的评分：8/10')
    await expect(rating.locator('[data-score="8"]')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(rating).toContainText('我的评分：9/10')
    const lastScore = await rating.locator('[data-score="10"]').boundingBox()
    expect(lastScore).not.toBeNull()
    expect(lastScore!.x + lastScore!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await page.screenshot({ path: info.outputPath('saved-rating.png'), fullPage: true })
    await rating.screenshot({ path: info.outputPath('rating-control.png') })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    // 500 只用于验证失败反馈；不伪造任何成功的评分响应。
    await page.route(`**${path}`, route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 500, json: { error: '验收用临时失败' } }) : route.continue())
    await rating.locator('[data-score="6"]').click()
    await expect(rating.getByRole('alert')).toContainText('评分未保存')
    expect((await (await context.request.get(path)).json()).viewer_rating).toBe(9)
    await page.unroute(`**${path}`)

    for (const other of others) {
      expect((await other.context.request.put(path, { headers: other.headers, data: { score: 7 } })).status()).toBe(200)
    }
    await page.reload()
    await expect(rating.locator('.rating-control__public-score')).toHaveText('7.4 / 10')
    await expect(rating).toContainText('5 人')
    await page.screenshot({ path: info.outputPath('public-five-ratings.png'), fullPage: true })
    await rating.getByRole('button', { name: '清除评分' }).click()
    await expect(rating).toContainText('评分人数不足（4/5）')
    await expect(rating.locator('.rating-control__mine')).toHaveCount(0)
    await page.goto(secondURL)
    await expect(rating).toContainText('暂无评分')
    await expect(rating.locator('.rating-control__mine')).toHaveCount(0)

    headers['X-CSRF-Token'] = (await (await context.request.get('/api/v1/auth/session')).json()).csrf_token
    for (const state of ['draft', 'private']) {
      const forbidden = `/api/v1/podcast/episodes/${fixture.episodes[state]}/rating`
      const viewer = state === 'draft' ? { context, headers } : others[0]
      expect((await viewer.context.request.put(forbidden, { headers: viewer.headers, data: { score: 8 } })).status()).toBe(404)
    }
    for (const score of [0, 11]) {
      expect((await context.request.put(path, { headers, data: { score } })).status()).toBe(400)
    }

    await page.goto(`/books/work/${fixture.book_id}`)
    const bookRating = page.locator('.rating-control')
    await expect(bookRating).toContainText('暂无评分')
    await bookRating.locator('[data-score="8"]').click()
    await expect(bookRating).toContainText('我的评分：8/10')

    // Drawer 是尚未挂到页面路由的复用组件，使用测试专用入口挂载真实组件。
    await page.goto(`/tests/e2e-rating/drawer.html?workId=${fixture.book_id}`)
    const drawer = page.locator('.book-work-drawer')
    await expect(drawer).toContainText('我的评分：8/10')
    await drawer.locator('[data-score="9"]').click()
    await expect(drawer).toContainText('我的评分：9/10')
    await drawer.getByRole('button', { name: '清除评分' }).click()
    await expect(drawer).toContainText('暂无评分')
    await page.screenshot({ path: info.outputPath('book-drawer.png'), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await context.clearCookies()
    await page.goto(detailURL)
    await expect(rating).toContainText('登录后评分')
    await expect(rating.locator('[data-score="9"]')).toBeDisabled()
    expect((await context.request.put(path, { data: { score: 8 } })).status()).toBe(401)
  } finally {
    await Promise.all(others.map(other => other.context.close()))
  }
})
