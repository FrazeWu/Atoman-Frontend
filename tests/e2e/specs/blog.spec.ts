import { test, expect } from '../fixtures/base'

test.describe('Blog', () => {
  test('browse blog home page', async ({ page }) => {
    await page.goto('/posts')
    await expect(page).toHaveURL(/\/posts$/)
    await expect(page.getByRole('heading', { name: '文章', exact: true })).toBeVisible()
  })

  test('create new post as authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/studio/blog/new')
    await expect(authenticatedPage).toHaveURL(/\/studio\/blog\/new$/)
    const saveBtn = authenticatedPage.getByRole('button', { name: '存草稿' })
    const publishBtn = authenticatedPage.getByRole('button', { name: '发布文章' })
    await expect(saveBtn).toBeVisible({ timeout: 10000 })
    await expect(publishBtn).toBeVisible({ timeout: 10000 })
  })

  test('bookmark page accessible as authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/posts/bookmarks')
    await expect(authenticatedPage).toHaveURL(/\/posts\/bookmarks$/)
    await expect(authenticatedPage.getByRole('heading', { name: '收藏', exact: true })).toBeVisible()
  })

  test('visit blog settings page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/users/admin/settings')
    await expect(authenticatedPage).toHaveURL(/\/users\/admin\/settings$/)
    await expect(authenticatedPage.getByRole('heading', { name: '设置', exact: true })).toBeVisible()
  })

  test('editor uses the workbench compose workflow', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/studio/blog/new')
    await expect(authenticatedPage).toHaveURL(/\/studio\/blog\/new$/)

    await authenticatedPage.waitForSelector('.editor-shell', { timeout: 10000 })
    await expect(authenticatedPage.getByText('新建文章', { exact: true })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '存草稿' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '发布文章' })).toBeVisible()
  })
})
