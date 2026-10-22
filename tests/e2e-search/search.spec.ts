import { expect, test, type Page } from '@playwright/test'

const hit = { key: 'books:work:1', module: 'books', type: 'work', id: '1', title: '三体 <script>unsafe</script>', subtitle: '刘慈欣', snippet: '宇宙与文明', href: '/books/work/1' }
async function mockResults(page: Page) {
  // 仅模拟搜索响应来覆盖可重复的页面状态；能力及登录状态仍走本地后端。
  await page.route('**/api/v1/search?**', route => {
    const url = new URL(route.request().url())
    const list = url.searchParams.get('view') === 'list'
    return route.fulfill({ json: { data: {
      view: list ? 'list' : 'grouped', scope: 'public', query: url.searchParams.get('q'), partial: false,
      items: list ? [hit] : [], groups: list ? [] : [{ module: 'books', type: 'work', label: '作品', items: [hit], total: 30, has_more: true, error: null }],
      ...(list ? { pagination: { page: Number(url.searchParams.get('page') || 1), page_size: 24, total: 30, has_more: url.searchParams.get('page') !== '2' } } : {}),
    } } })
  })
}

test('真实本地接口：图书发现、匿名私有权限', async ({ page, request }, info) => {
  expect((await request.get('/')).status()).toBe(200)
  const caps = await request.get('/api/v1/search/capabilities')
  expect(caps.status()).toBe(200)
  expect((await caps.json()).data.modules.some((module: { module: string }) => module.module === 'books')).toBe(true)
  const response = await request.get('/api/v1/search?module=books&type=work&view=list')
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('no-store')
  expect((await request.get('/api/v1/search?scope=mine&q=秘密')).status()).toBe(401)
  await page.goto('/search?module=books&type=work')
  await expect(page.getByRole('heading', { name: '全站搜索' })).toBeVisible({ timeout: 20000 })
  const items = (await response.json()).data.items
  await expect(page.locator('.search-results li')).toHaveCount(items.length)
  await expect(page.getByText(`共 ${items.length} 条结果`)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('real-search.png'), fullPage: true })
})

test('URL、重复筛选、分页、历史导航与移动布局', async ({ page }, info) => {
  await mockResults(page)
  await page.goto('/search?q=三体')
  await expect(page.getByRole('heading', { name: '图书', exact: true })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(hit.title, { exact: true })).toBeVisible()
  expect(await page.locator('.search-results script').count()).toBe(0)
  await page.locator('.search-group').getByRole('link', { name: /查看全部/ }).click()
  await expect(page).toHaveURL(/type=work/)
  await page.getByText('筛选与排序', { exact: true }).click()
  await page.getByLabel('作品语言', { exact: true }).pressSequentially('zh, en')
  await page.getByLabel('排序', { exact: true }).selectOption('rating_desc')
  await page.getByRole('button', { name: '应用筛选' }).click()
  await expect.poll(() => new URL(page.url()).searchParams.getAll('filter[language]')).toEqual(['zh', 'en'])
  await page.getByRole('button', { name: '下一页' }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.reload()
  await expect(page.getByText('第 2 页')).toBeVisible()
  await page.goBack()
  await expect(page.getByText('第 1 页')).toBeVisible()
  await page.getByRole('navigation', { name: '搜索模块', exact: true }).getByRole('button', { name: '音乐', exact: true }).click()
  await expect.poll(() => new URL(page.url()).searchParams.get('module')).toBe('music')
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('三体')
  expect(new URL(page.url()).searchParams.has('filter[language]')).toBe(false)
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.screenshot({ path: info.outputPath('filtered-search.png'), fullPage: true })
})

test('局部失败、失败重试和匿名我的内容', async ({ page }) => {
  let failed = true
  await page.route('**/api/v1/search?**', route => route.fulfill({ json: { data: {
    view: 'grouped', scope: 'public', query: '三体', partial: failed,
    items: [], groups: [{ module: 'books', type: 'work', label: '作品', items: [hit], total: null, has_more: false, error: null },
      ...(failed ? [{ module: 'music', type: 'album', label: '专辑', items: [], total: null, has_more: false, error: { code: 'unavailable', message: 'temporary' } }] : [])],
  } } }))
  await page.goto('/search?q=三体')
  await expect(page.getByText('部分结果暂不可用', { exact: false })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(hit.title, { exact: true })).toBeVisible()
  failed = false
  await page.getByRole('status').getByRole('button', { name: '重试' }).click()
  await expect(page.getByText('部分结果暂不可用', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: '我的内容', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('请先登录')
  await expect(page.getByText(hit.title, { exact: true })).toHaveCount(0)
})

test('旧搜索 URL 保留关键词、类型、重复筛选', async ({ page }) => {
  await mockResults(page)
  await page.goto('/books/search?q=三体&type=work&filter[language]=zh&filter[language]=en')
  await expect(page).toHaveURL(/\/search\?/)
  await expect(page.getByRole('heading', { name: '全站搜索' })).toBeVisible({ timeout: 20000 })
  const query = new URL(page.url()).searchParams
  expect(query.get('module')).toBe('books')
  expect(query.getAll('filter[language]')).toEqual(['zh', 'en'])
  for (const path of ['/forum/search', '/videos/search', '/debate/search', '/timeline/search']) {
    await page.goto(`${path}?q=三体`)
    await expect(page).toHaveURL(/\/search\?/)
    expect(new URL(page.url()).searchParams.get('q')).toBe('三体')
  }
})

test('搜索入口含图书，桌面支持快捷键和键盘选择', async ({ page }, info) => {
  await mockResults(page)
  if (info.project.name === 'mobile') {
    await page.goto('/music')
    await page.getByTestId('search-button').click()
    await expect(page).toHaveURL(/\/search\?module=music/)
    await page.getByRole('searchbox', { name: '关键词' }).fill('三体')
    await page.getByRole('search').getByRole('button', { name: '搜索', exact: true }).click()
    await expect(page.getByText(hit.title, { exact: true })).toBeVisible()
    return
  }
  await page.goto('/search')
  await expect(page.getByRole('heading', { name: '全站搜索' })).toBeVisible({ timeout: 20000 })
  await page.keyboard.press('Control+k')
  const input = page.getByTestId('topbar-search-input')
  await expect(input).toBeFocused()
  await input.fill('三体')
  await expect(page.locator('.topbar-search-section__item')).toHaveCount(1)
  await page.getByRole('button', { name: /查看全部更多结果/ }).click()
  await expect(page).toHaveURL(/q=/)
  await page.keyboard.press('Control+k')
  await input.fill('三体')
  await expect(page.locator('.topbar-search-section__item')).toHaveCount(1)
  await input.press('Enter')
  await expect(page).toHaveURL(/\/books\/work\/1/)
})
