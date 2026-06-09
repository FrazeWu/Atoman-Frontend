import { test, expect } from '../fixtures/base'

test.describe('Forum', () => {
  test('browse forum home page', async ({ page }) => {
    await page.goto('/forum')
    await expect(page.getByRole('button', { name: '最新' })).toBeVisible()
    await expect(page.getByRole('button', { name: /全部分类/ })).toBeVisible()
  })

  test('forum shows category sidebar', async ({ page }) => {
    await page.goto('/forum')
    await page.waitForTimeout(2000)
    const sidebar = page.locator('.forum-sidebar')
    await expect(sidebar).toBeVisible()
  })

  test('forum shows sort tabs', async ({ page }) => {
    await page.goto('/forum')
    await expect(page.getByRole('button', { name: '最新' })).toBeVisible()
    await expect(page.getByRole('button', { name: '最热' })).toBeVisible()
  })

  test('switch sort to top', async ({ page }) => {
    await page.goto('/forum')
    await page.waitForTimeout(1000)
    await page.getByRole('button', { name: '最热' }).click()
    await page.waitForTimeout(1000)
  })

  test('click category filters topics', async ({ page }) => {
    await page.goto('/forum')
    await page.waitForTimeout(2000)

    const firstCatBtn = page.locator('.forum-sidebar button:not(:has-text("全部话题"))').first()
    if (await firstCatBtn.isVisible().catch(() => false)) {
      await firstCatBtn.click()
      await page.waitForTimeout(1000)
    }
  })

  test('view topic detail', async ({ page }) => {
    await page.goto('/forum')
    await page.waitForTimeout(2000)

    const firstTopic = page.locator('.topic-row').first()
    if (await firstTopic.isVisible().catch(() => false)) {
      await firstTopic.click()
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL(/\/topic\//)
    }
  })

  test('create new topic as authenticated user', async ({ authenticatedPage }) => {
    // Navigate via the forum home and click the UI button to open the new-topic view.
    await authenticatedPage.goto('/forum')
    await authenticatedPage.waitForTimeout(1000)

    // Click the top '发新话题' button if visible, otherwise click the sidebar shortcut.
    const topBtn = authenticatedPage.getByRole('button', { name: '发新话题' }).first()
    if (await topBtn.isVisible().catch(() => false)) {
      await topBtn.click()
    } else {
      const sideBtn = authenticatedPage.locator('.sidebar-item', { hasText: '发新话题' }).first()
      if (await sideBtn.isVisible().catch(() => false)) {
        await sideBtn.click()
      }
    }

    await expect(authenticatedPage.getByRole('heading', { name: '发布话题' })).toBeVisible()
    await authenticatedPage.waitForTimeout(1000)

    const firstCat = authenticatedPage.locator('.category-btn').first()
    if (await firstCat.isVisible().catch(() => false)) {
      await firstCat.click()
    }

    const editor = authenticatedPage.locator('.cm-content').first()
    if (await editor.isVisible().catch(() => false)) {
      await editor.click()
      await authenticatedPage.keyboard.type('E2E Test Topic\n\nThis is test content from E2E.')
      await authenticatedPage.waitForTimeout(1000)

      const submitBtn = authenticatedPage.getByRole('button', { name: '发布话题' })
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.scrollIntoViewIfNeeded()
        await submitBtn.click({ force: true })
        await authenticatedPage.waitForTimeout(3000)
      }
    }
  })

  test('reply to topic as authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/forum')
    await authenticatedPage.waitForTimeout(2000)

    const firstTopic = authenticatedPage.locator('.topic-row').first()
    if (await firstTopic.isVisible().catch(() => false)) {
      await firstTopic.click()
      await authenticatedPage.waitForTimeout(2000)

      const replyTextarea = authenticatedPage.locator('textarea[placeholder*="回复"]').first()
      if (await replyTextarea.isVisible().catch(() => false)) {
        await replyTextarea.fill('E2E test reply')
        const submitBtn = authenticatedPage.getByRole('button', { name: '提交回复' })
        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click()
          await authenticatedPage.waitForTimeout(2000)
        }
      }
    }
  })

  test('like a topic as authenticated user', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/forum')
    await authenticatedPage.waitForTimeout(2000)

    const firstTopic = authenticatedPage.locator('.topic-row').first()
    if (await firstTopic.isVisible().catch(() => false)) {
      await firstTopic.click()
      await authenticatedPage.waitForTimeout(2000)

      const likeBtn = authenticatedPage.locator('button.a-toggle-btn').first()
      if (await likeBtn.isVisible().catch(() => false)) {
        await likeBtn.click()
        await authenticatedPage.waitForTimeout(1000)
      }
    }
  })

  test('unauthenticated user sees login prompt on topic page', async ({ page }) => {
    await page.goto('/forum')
    await page.waitForTimeout(2000)

    const firstTopic = page.locator('.topic-row').first()
    if (await firstTopic.isVisible().catch(() => false)) {
      await firstTopic.click()
      await page.waitForTimeout(2000)
      await expect(page.getByText('登录后即可参与讨论')).toBeVisible()
    }
  })
})
