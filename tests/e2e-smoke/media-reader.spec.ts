import { expect, test } from '@playwright/test'

test('public TXT reader supports search, bookmarks, and display preferences', async ({ page }) => {
  // 新阅读入口固定到文件修订；访客不创建私人云端记录。
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/session')) return route.fulfill({ status: 204 })
    if (path.endsWith('/asset-revisions/revision-e2e/content')) {
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '序章\n这里有一个可搜索的关键词。' })
    }
    const data = path.endsWith('/works/work-e2e')
      ? { id: 'work-e2e', title: '公共阅读', authors: [{ name: '测试作者' }], editions: [] }
      : path.endsWith('/works/work-e2e/assets')
        ? { items: [{ id: 'public-e2e', work_id: 'work-e2e', format: 'txt', status: 'active' }] }
        : path.endsWith('/assets/public-e2e/revisions')
          ? { items: [{ id: 'revision-e2e', asset_id: 'public-e2e', number: 1, status: 'ready', original_filename: 'smoke.txt', created_at: '2026-10-10T00:00:00Z' }] }
          : { items: [], total: 0 }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
  })

  const response = await page.goto('/books/read/work-e2e/public-e2e/revision-e2e')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: '公共阅读' })).toBeVisible()
  await expect(page.getByText('文件版本 1', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: '目录与检索', exact: true }).click()
  await page.getByRole('searchbox', { name: '搜索正文' }).fill('关键词')
  await page.getByRole('searchbox', { name: '搜索正文' }).press('Enter')
  await expect(page.getByText('找到 1 处匹配')).toBeVisible()

  await page.getByRole('button', { name: '添加书签' }).click()
  await expect(page.getByText('书签（1）')).toBeVisible()

  await page.getByRole('button', { name: '显示设置', exact: true }).click()
  await page.getByLabel('字号').selectOption('1.35')
  await page.getByRole('button', { name: '夜间主题' }).click()
  await expect(page.locator('main.public-reader--theme-night')).toBeVisible()
})
