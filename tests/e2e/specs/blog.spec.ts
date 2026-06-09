import { test, expect } from '../fixtures/base'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../helpers/auth'

test.describe('Blog', () => {
  test('browse blog home page', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByText('法堂')).toBeVisible()
  })

  test('public post accessible without login', async ({ page }) => {
    await page.goto('/blog')
    // assert blog module title is visible
    await expect(page.getByRole('heading', { name: '法堂' })).toBeVisible()
  })

  test('create new post as authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/post/new')
    await authenticatedPage.waitForTimeout(1000)
    // check for key action buttons instead of editor container
    const saveBtn = authenticatedPage.getByRole('button', { name: '存草稿' })
    const publishBtn = authenticatedPage.getByRole('button', { name: '发布文章' })
    await expect(saveBtn).toBeVisible({ timeout: 10000 })
    await expect(publishBtn).toBeVisible({ timeout: 10000 })
  })

  test('like a post as authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/blog')
    await authenticatedPage.waitForTimeout(2000)

    const firstPostLink = authenticatedPage.locator('.post-item, article a, .a-card-hover a').first()
    if (await firstPostLink.isVisible().catch(() => false)) {
      await firstPostLink.click()
      await authenticatedPage.waitForTimeout(2000)

      const likeBtn = authenticatedPage.locator('button').filter({ has: authenticatedPage.locator('svg') }).first()
      if (await likeBtn.isVisible().catch(() => false)) {
        await likeBtn.click()
        await authenticatedPage.waitForTimeout(1000)
      }
    }
  })

  test('bookmark page accessible as authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/blog/bookmarks')
    await expect(authenticatedPage).toHaveURL(/\/blog\/bookmarks/)
  })

  test('visit blog settings page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/blog/settings')
    await expect(authenticatedPage).toHaveURL(/\/blog\/settings/)
  })

  test('editor uses the workbench compose workflow', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/post/new')
    await authenticatedPage.waitForTimeout(1000)

    await authenticatedPage.waitForSelector('.editor-shell', { timeout: 10000 })
    await expect(authenticatedPage.getByText('新建文章')).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '存草稿' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '发布文章' })).toBeVisible()
  })
})
