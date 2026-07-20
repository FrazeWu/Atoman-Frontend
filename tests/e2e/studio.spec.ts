import { expect, test } from '@playwright/test'

test.describe('Unified Studio', () => {
	test.beforeEach(async ({ page }) => {
		let collections = [{
      id: 'collection-default', channel_id: 'channel-1', content_type: 'blog', name: '全部文章',
      description: '', cover_url: '', is_default: true, created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
    }]
    const channel = { id: 'channel-1', name: '主频道', slug: 'main', description: '', cover_url: '' }

    await page.route('**/api/v1/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
      const method = request.method()
			const fulfill = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
			if (path === '/api/v1/auth/session') {
				return fulfill({
					csrf_token: 'e2e-csrf-token',
					user: { id: 'user-1', uuid: 'user-1', username: 'creator', email: 'creator@example.com', role: 'user' },
				})
			}

			if (path === '/api/v1/studio/state') {
        return fulfill({ data: { current_channel: channel, channels: [channel] } })
      }
      if (path === '/api/v1/studio/dashboard') {
        return fulfill({ data: {
          channel_subscriber_count: 24,
          sections: ['blog', 'podcast', 'video'].map(module => ({
			module,
			metrics: { view: 12, play: 12, complete: 8, comment: 3, like: 4, bookmark: 5, share: 6 },
			recent: [], issues: [],
          })),
        } })
      }
      if (path === '/api/v1/studio/blog/collections' && method === 'GET') {
        return fulfill({ data: collections })
      }
      if (path === '/api/v1/studio/blog/collections' && method === 'POST') {
        const input = request.postDataJSON() as { name: string; description: string }
        const created = {
          id: 'collection-research', channel_id: 'channel-1', content_type: 'blog', name: input.name,
          description: input.description, cover_url: '', is_default: false,
          created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
        }
        collections = [...collections, created]
        return fulfill({ data: created })
      }
      if (/^\/api\/v1\/studio\/(blog|podcast|video)\/collections$/.test(path)) {
        return fulfill({ data: [] })
      }
      if (/^\/api\/v1\/studio\/(blog|podcast|video)\/contents$/.test(path)) {
		const module = path.split('/')[4]
		const data = module === 'blog' ? [{
		  id: 'post-1', module: 'blog', channel_id: 'channel-1', title: '浏览器测试文章', summary: '', cover_url: '',
		  status: 'published', visibility: 'public', collections: [{ id: 'collection-default', name: '全部文章' }],
		  view_count: 12, metrics: { view: 12, comment: 3, like: 4, bookmark: 5, share: 6 },
		  published_at: '2026-07-18T00:00:00Z', created_at: '2026-07-18T00:00:00Z', updated_at: '2026-07-18T00:00:00Z',
		}] : []
		return fulfill({ data, meta: { page: Number(url.searchParams.get('page') || 1), page_size: 20, total: data.length, has_more: false } })
      }
	  if (path === '/api/v1/blog/posts/post-1/unpublish' && method === 'POST') return fulfill({ id: 'post-1', status: 'draft' })
	  if (path === '/api/v1/studio/blog/contents/post-1/share' && method === 'POST') return fulfill({ data: { path: '/posts/post/post-1' } })
      if (/^\/api\/v1\/studio\/(blog|podcast|video)\/settings$/.test(path)) {
        const module = path.split('/')[5]
        return fulfill({ data: {
          channel_id: 'channel-1', module, default_collection_id: null,
          default_visibility: 'public', default_publish_status: 'published', autoplay_enabled: false,
        } })
      }
      if (path === '/api/v1/blog/drafts' && method === 'GET') return fulfill({ data: null })
      if (path === '/api/v1/blog/drafts' && method === 'POST') {
        return fulfill({ data: { ...request.postDataJSON(), updated_at: '2026-07-18T00:00:00Z' } })
      }
      if (path === '/api/v1/blog/drafts' && method === 'DELETE') return fulfill({ data: { ok: true } })
      if (path === '/api/v1/blog/posts' && method === 'POST') return fulfill({ data: { id: 'draft-1' } })

      return fulfill({ data: [] })
    })
  })

  test('manages all creator modules under one channel and keeps collection context', async ({ page }, testInfo) => {
    const navigateInApp = async (path: string) => {
      await page.evaluate((target) => {
        window.history.pushState({}, '', target)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, path)
    }

    await page.goto('/')
    await page.getByRole('link', { name: '创作中心' }).click()
    await expect(page).toHaveURL(/\/studio$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.locator('[data-testid="studio-dashboard-section"]')).toHaveCount(3)
    await expect(page.locator('[data-testid="studio-channel-selector"] select')).toHaveValue('channel-1')
	await expect(page.locator('[data-module="blog"] [data-metric="view"]')).toContainText('12')
	await expect(page.locator('[data-module="podcast"] [data-metric="complete"]')).toContainText('8')

    const blogSection = page.locator('[data-testid="studio-dashboard-section"][data-module="blog"]')
    await blogSection.getByRole('link', { name: '管理' }).click()
    await expect(page).toHaveURL(/\/studio\/blog\/content$/)
	await expect(page.getByText('浏览器测试文章')).toBeVisible()
	for (const label of ['阅读', '评论', '点赞', '收藏', '分享', '发布时间']) {
	  await expect(page.getByRole('columnheader', { name: label })).toBeVisible()
	}
	await page.getByRole('button', { name: '转为草稿' }).click()
	await expect(page.getByRole('status')).toContainText('已转为草稿')
	await expect(page.getByRole('button', { name: '分享' })).toBeVisible()

    await page.getByTestId('manage-collections').click()
    await page.getByTestId('new-collection').click()
    await page.getByTestId('collection-name').fill('研究')
    await page.getByTestId('collection-description').fill('研究笔记')
    await page.getByTestId('save-collection').click()
    await expect(page.getByTestId('studio-collection-sheet').getByText('研究', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '关闭博客合集' }).click()

    await page.getByTestId('collection-filter').selectOption('collection-research')
    await expect(page).toHaveURL(/collection_id=collection-research/)
    await page.getByTestId('create-content').click()
    await expect(page).toHaveURL(/\/studio\/blog\/new\?collection=collection-research/)

    const editor = page.locator('.cm-content')
    await expect(editor).toBeVisible()
    await editor.click()
    await page.keyboard.insertText('# Studio 草稿\n\n正文')
    await page.getByRole('button', { name: '存草稿' }).click()
    await expect(page).toHaveURL(/\/studio\/blog\/content\?collection_id=collection-research/)
    await expect(page.getByTestId('collection-filter')).toHaveValue('collection-research')

    const studioNav = page.getByTestId('studio-primary-nav')
    await studioNav.getByRole('link', { name: '播客', exact: true }).click()
    await expect(page).toHaveURL(/\/studio\/podcast\/content/)
    await expect(page.locator('[data-testid="studio-channel-selector"] select')).toHaveValue('channel-1')
    await studioNav.getByRole('link', { name: '视频', exact: true }).click()
    await expect(page).toHaveURL(/\/studio\/video\/content/)
    await expect(page.locator('[data-testid="studio-channel-selector"] select')).toHaveValue('channel-1')

    for (const oldPath of ['/posts/post/new', '/podcasts/editor', '/videos/upload']) {
      await navigateInApp(oldPath)
      await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible()
    }

    await navigateInApp('/studio/blog/content?collection_id=collection-research')
    await expect(page.getByRole('heading', { name: '内容' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('studio-desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(pageOverflow).toBe(false)
    await page.getByRole('button', { name: '打开创作中心导航' }).click()
    await page.screenshot({ path: testInfo.outputPath('studio-mobile.png'), fullPage: true })
  })
})
