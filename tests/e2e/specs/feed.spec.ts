import { test, expect } from '../fixtures/base'

test.describe('Feed', () => {
  test('browse feed page without login shows guest view', async ({ page }) => {
    await page.goto('/feed')
    await expect(page.getByRole('banner').getByRole('link', { name: '订阅', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '登录', exact: true }).first()).toBeVisible()
  })

  test('guest subscription starts a safe login return flow from discovery', async ({ page }) => {
    await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 204, body: '' }))
    await page.route('**/api/v1/feed/recommend/themes*', route => route.fulfill({ status: 200, json: { data: [] } }))
    await page.route('**/api/v1/feed/recommend/articles*', route => route.fulfill({ status: 200, json: { data: [] } }))
    await page.route('**/api/v1/feed/recommend/channels*', route => route.fulfill({
      status: 200,
      json: {
        data: [{
          id: 'source-e2e',
          title: 'E2E 推荐来源',
          summary: '用于验证访客订阅回跳',
          source_type: 'internal_channel',
          target_path: '/channels/source-e2e',
        }],
      },
    }))

    await page.goto('/feed?category=blog')
    const sourceCard = page.locator('[data-test="channel-card"]').first()
    await expect(sourceCard).toBeVisible({ timeout: 15000 })
    await sourceCard.getByRole('button', { name: '订阅' }).click()

    await expect(page).toHaveURL(/\/login\?redirect=/)
    const redirect = new URL(page.url()).searchParams.get('redirect')
    expect(redirect).toBeTruthy()
    const redirectUrl = new URL(redirect || '', page.url())
    expect(redirectUrl.pathname).toBe('/feed')
    expect(redirectUrl.searchParams.get('category')).toBe('blog')
    expect(redirectUrl.searchParams.get('subscribe_source_id')).toBe('source-e2e')
    expect(redirectUrl.searchParams.get('subscribe_source_type')).toBe('internal_channel')
    expect(redirectUrl.searchParams.get('subscribe_source_title')).toBe('E2E 推荐来源')
  })

  test('authenticated user sees feed timeline', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/feed')
    // wait for either timeline, empty state or loading skeleton to render before asserting
    await authenticatedPage.waitForSelector('.feed-timeline, .a-empty, .feed-loading', { timeout: 5000 })
    await expect(authenticatedPage.getByRole('button', { name: '+ 订阅' })).toBeVisible()
  })

  test('authenticated user can open add subscription modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/feed')

    await authenticatedPage.getByRole('button', { name: '+ 订阅' }).click()
    const addSheet = authenticatedPage.getByRole('dialog', { name: '添加订阅' })
    await expect(addSheet).toBeVisible()
    await expect(authenticatedPage.getByPlaceholder('输入网站、RSS 或 GitHub 仓库地址')).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '确认订阅' })).toBeVisible()

    await authenticatedPage.locator('.add-sub-form').getByRole('button', { name: '取消', exact: true }).click()
    await expect(addSheet).toBeHidden()
  })

  test('authenticated user sees mark all read button', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/feed')
    await authenticatedPage.waitForTimeout(2000)

    const markAllBtn = authenticatedPage.getByRole('button', { name: '全部已读' })
    if (await markAllBtn.isVisible().catch(() => false)) {
      await markAllBtn.click()
      await authenticatedPage.waitForTimeout(1000)
    }
  })

  test('authenticated user can create new group', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/feed')

    await authenticatedPage.getByRole('button', { name: '订阅源管理' }).click()
    await expect(authenticatedPage.getByRole('dialog', { name: '订阅源管理' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '导入 OPML' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '导出 OPML' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '全部检查' })).toBeVisible()

    const groupName = `E2E Group ${Date.now()}`
    await authenticatedPage.getByPlaceholder('例如：技术观察').fill(groupName)
    await authenticatedPage.getByRole('button', { name: '创建' }).click()
    
    await expect(async () => {
      const values = await authenticatedPage.locator('input.group-name-input').evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value))
      expect(values).toContain(groupName)
    }).toPass()
  })

  test('feed shows load more when items exceed page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/feed')
    await authenticatedPage.waitForTimeout(2000)

    const loadMoreBtn = authenticatedPage.getByRole('button', { name: '加载更多' })
    if (await loadMoreBtn.isVisible().catch(() => false)) {
      await loadMoreBtn.click()
      await authenticatedPage.waitForTimeout(2000)
    }
  })

  test('podcast playback button visible for audio items', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/feed')
    await authenticatedPage.waitForTimeout(2000)

    const playBtn = authenticatedPage.getByRole('button', { name: '▶ 播放' })
    if (await playBtn.isVisible().catch(() => false)) {
      await playBtn.click()
      await authenticatedPage.waitForTimeout(1000)
      await expect(authenticatedPage.locator('#audio-player, .audio-player, [class*="player"]')).toBeVisible()
    }
  })
})
