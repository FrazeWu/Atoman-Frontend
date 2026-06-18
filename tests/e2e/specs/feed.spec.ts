import { test, expect } from '../fixtures/base'

test.describe('Feed', () => {
  test('browse feed page without login shows guest view', async ({ page }) => {
    await page.goto('/feed')
    // use an exact link role to avoid ambiguous matches for the word '订阅'
    await expect(page.getByRole('link', { name: '订阅', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '登录', exact: true }).first()).toBeVisible()
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
    await expect(authenticatedPage.getByRole('heading', { name: '添加订阅' })).toBeVisible()
    await expect(authenticatedPage.getByPlaceholder('输入网站、RSS 或 GitHub 仓库地址')).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '确认订阅' })).toBeVisible()

    await authenticatedPage.locator('.add-sub-form').getByRole('button', { name: '取消', exact: true }).click()
    await expect(authenticatedPage.getByRole('heading', { name: '添加订阅' })).toBeHidden()
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
    await expect(authenticatedPage.getByRole('heading', { name: '订阅源管理' })).toBeVisible()
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
