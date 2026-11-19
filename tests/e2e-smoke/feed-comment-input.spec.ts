import { expect, test } from '@playwright/test'

test('订阅文章与评论独立滚动，点击正文关闭评论并保留草稿', async ({ page }) => {
  const html = Array.from({ length: 80 }, (_, i) => `<p>正文第 ${i + 1} 段：边读文章边讨论。</p>`).join('')
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = { data: [], meta: { page: 1, total: 0, has_more: false } }
    if (path.endsWith('/auth/session')) {
      body = { csrf_token: 'test-csrf', user: { uuid: 'test-reader', username: 'reader', email: 'reader@example.test' } }
    } else if (path.endsWith('/site/access')) {
      body = { modules: { feed: { enabled: true, features: {} } } }
    } else if (path.endsWith('/feed/items/comment-input-test')) {
      body = { data: {
        item: { id: 'comment-input-test', title: '评论输入与滚动验收', content_html: html, summary: html },
        reader: { default_variant: 'rss', rss: { html }, full_text: { status: 'unavailable', html: '' } },
      } }
    } else if (path.includes('/comments')) {
      body = { data: {
        items: Array.from({ length: 30 }, (_, i) => ({
          id: `comment-${i}`, author_id: 'other', author: { id: 'other', username: 'other', display_name: '读者' },
          content: `评论第 ${i + 1} 条`, rendered_html: `<p>评论第 ${i + 1} 条</p>`, status: 'visible',
          like_count: 0, reply_count: 0, hot_score: 0, created_at: '2026-11-19T00:00:00Z',
          mentions: [], references: [], attachments: [], time_anchors: [], replies: [],
        })),
        target: { kind: 'feed_article', resource_id: 'comment-input-test', comment_count: 30, root_count: 30, can_mark: false },
        page: 1, per_page: 30, total_roots: 30, total_comments: 30, total_replies: 0,
      } }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })

  expect((await page.goto('/feed/item/comment-input-test'))?.status()).toBe(200)
  const article = page.locator('.p-sheet-panel').filter({ has: page.locator('.article-title') })
  await expect(article.getByRole('heading', { name: '评论输入与滚动验收' })).toBeVisible()
  await article.locator('[data-test="feed-article-comments-trigger"]').click()
  const comments = page.locator('.p-sheet-panel').filter({ has: page.locator('.comment-section') })
  await expect(comments).toBeVisible()
  await comments.locator('[data-test="compact-composer-trigger"]').click()
  const input = comments.getByRole('textbox', { name: '评论内容' })
  await input.pressSequentially('这段内容值得讨论')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('这段内容值得讨论')

  const articleScroll = article.locator('.sheet-content')
  const commentScroll = comments.locator('.sheet-content')
  const bounds = await article.boundingBox()
  await page.mouse.move(bounds!.x + 90, bounds!.y + 250)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => articleScroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await expect(comments).toBeVisible()
  expect(await commentScroll.evaluate(el => el.scrollTop)).toBe(0)
  const articlePosition = await articleScroll.evaluate(el => el.scrollTop)
  await comments.hover({ position: { x: 120, y: 300 } })
  await page.mouse.wheel(0, 400)
  await expect.poll(() => commentScroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  expect(await articleScroll.evaluate(el => el.scrollTop)).toBe(articlePosition)

  await page.mouse.click(bounds!.x + 90, bounds!.y + 250)
  await expect(comments).toHaveCount(0)
  expect(await articleScroll.evaluate(el => el.scrollTop)).toBe(articlePosition)
  await article.locator('.sheet-content').evaluate(el => { el.scrollTop = 0 })
  await article.locator('[data-test="feed-article-comments-trigger"]').click()
  const collapsedComposer = comments.locator('[data-test="compact-composer-trigger"]')
  if (await collapsedComposer.isVisible()) await collapsedComposer.click()
  await expect(input).toHaveValue('这段内容值得讨论')
})
