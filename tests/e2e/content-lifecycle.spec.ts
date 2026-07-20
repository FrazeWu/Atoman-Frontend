import { expect, test } from '@playwright/test'

test('content lifecycle surfaces render across consumption, publishing and analytics', async ({ page }) => {
  const channel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }
  const collection = {
    id: 'collection-1', channel_id: channel.id, content_type: 'blog', name: '文章合集',
    description: '', cover_url: '', is_default: false, created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
  }
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
		const fulfill = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
		if (path === '/api/v1/auth/session') {
			return route.fulfill({
				status: 200,
				json: {
					csrf_token: 'e2e-csrf-token',
					user: { uuid: 'user-1', username: 'creator', email: 'creator@example.com', role: 'user' },
				},
			})
		}

		if (path === '/api/v1/content/continue') {
      return fulfill([{
        content_id: 'post-1', module: 'blog', title: '继续阅读的文章', path: '/posts/post/post-1', cover_url: '',
        position_sec: 0, duration_sec: 0, progress: 0.42, updated_at: '2026-07-18T00:00:00Z',
      }])
    }
    if (path === '/api/v1/studio/state') return fulfill({ current_channel: channel, channels: [channel] })
    if (path === '/api/v1/studio/blog/collections') return fulfill([collection])
    if (path === '/api/v1/studio/blog/settings') {
      return fulfill({ channel_id: channel.id, module: 'blog', default_collection_id: collection.id, default_visibility: 'public', default_publish_status: 'published', autoplay_enabled: false })
    }
    if (path === '/api/v1/studio/blog/analytics') {
      return fulfill({
        range: 28, from: '2026-06-21T00:00:00Z', to: '2026-07-18T00:00:00Z',
        totals: { impression: 200, open: 120, engaged: 80, complete: 40, view: 120, comment: 8, like: 4, bookmark: 5, share: 3 },
        trend: [{ date: '2026-07-18', metrics: { view: 12 } }],
        top: [{ id: 'post-1', title: '继续阅读的文章', metrics: { view: 120 } }],
        sources: [{ source: 'home', count: 160 }, { source: 'notification', count: 40 }],
        retention: { consumers: 40, returning_consumers: 20, rate: 50 },
      })
    }
    if (path === '/api/v1/blog/drafts') return fulfill(null)
    if (path === '/api/v1/blog/posts') return fulfill([])
    if (path === '/api/v1/feed/recommend/articles') return fulfill([])
    if (path === '/api/v1/feed/reading-list') return fulfill([])
    return fulfill([])
  })

  await page.goto('/posts')
  await expect(page.getByRole('heading', { name: '继续阅读' })).toBeVisible()
  await expect(page.getByText('继续阅读的文章')).toBeVisible()
  await expect(page.getByText('42%')).toBeVisible()

  await page.goto('/studio/blog/new')
  await expect(page.getByLabel('发布时间')).toBeVisible()
  await expect(page.getByRole('button', { name: '定时发布' })).toBeDisabled()

  await page.goto('/studio/blog/analytics')
  await expect(page.getByRole('heading', { name: '消费漏斗' })).toBeVisible()
  await expect(page.getByText('有效消费')).toBeVisible()
  await expect(page.getByText('首页', { exact: true })).toBeVisible()
  await expect(page.locator('.studio-analytics__sources').getByText('通知', { exact: true })).toBeVisible()
  await expect(page.getByText('回访率')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 10)
      .map(element => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })),
  }))
  expect(overflow).toEqual({ viewport: 390, scrollWidth: 390, elements: [] })
})
