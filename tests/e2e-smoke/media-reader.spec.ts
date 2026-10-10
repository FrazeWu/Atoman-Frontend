import { expect, test } from '@playwright/test'

test('public TXT reader supports search, bookmarks, and display preferences', async ({ page }) => {
  await page.route('**/api/v1/books/catalog/assets/public-e2e', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'public-e2e',
          work_id: 'work-e2e',
          format: 'txt',
          file_name: 'smoke.txt',
          content_type: 'text/plain',
          size: 32,
          status: 'published',
          created_at: '2026-10-10T00:00:00Z',
        },
      }),
    })
  })
  await page.route('**/api/v1/books/catalog/assets/public-e2e/content', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/plain', body: '序章\n这里有一个可搜索的关键词。' })
  })

  const response = await page.goto('/books/public-read/public-e2e')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: '公共阅读' })).toBeVisible()

  await page.getByRole('searchbox', { name: '搜索正文' }).fill('关键词')
  await page.getByRole('searchbox', { name: '搜索正文' }).press('Enter')
  await expect(page.getByText('找到 1 处匹配')).toBeVisible()

  await page.getByRole('button', { name: '添加书签' }).click()
  await expect(page.getByText('书签（1）')).toBeVisible()

  await page.getByLabel('字号').selectOption('1.35')
  await page.getByRole('button', { name: '夜间主题' }).click()
  await expect(page.locator('main.public-reader--theme-night')).toBeVisible()
})
