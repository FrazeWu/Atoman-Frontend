import { expect, test } from '@playwright/test'

// Uses the project's isolated foreground acceptance server and real APIs.
test('作品、译本和文件分步确认，已有书目不重复创建', async ({ page, context }, info) => {
  const origin = process.env.RATING_ACCEPTANCE_BASE_URL || 'http://127.0.0.1:5187'
  const login = await context.request.post('/api/v1/auth/login', {
    headers: { Origin: origin }, data: { username: 'rating-a', password: 'rating-acceptance-only' },
  })
  expect(login.status()).toBe(200)
  const title = `作品版本验收-${info.project.name}-${Date.now()}`
  const posts: Array<{ url: string; body: Record<string, unknown> }> = []
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/books/')) posts.push({ url: request.url(), body: request.postDataJSON() })
  })
  await page.goto('/books/new')
  await expect(page.locator('.book-catalog .p-page-header__title').filter({ hasText: /^添加图书$/ })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0)
  await page.locator('#create-source-file').setInputFiles({ name: 'version.txt', mimeType: 'text/plain', buffer: Buffer.from('只用于本地验收的文件') })
  await page.locator('input[name="work"][value="new"]').check()
  await page.locator('#create-book-title').fill(title)
  await page.locator('#create-book-authors').fill('原作者')
  await expect(page.locator('#create-book-subtitle')).toHaveCount(0)
  await page.getByRole('button', { name: '下一步：版本／译本', exact: true }).click()
  await expect(page.locator('input[name="edition"]:checked')).toHaveCount(0)
  await page.locator('input[name="edition"][value="new"]').check()
  await page.locator('#create-edition-title').fill('中文修订译本')
  await page.locator('#create-edition-subtitle').fill('版本专有副标题')
  await page.locator('#create-edition-translators').fill('译者甲\n译者乙')
  await page.locator('#create-edition-language').fill('zh')
  await page.locator('#create-edition-publisher').fill('验收出版社')
  await page.locator('#create-edition-statement').fill('第 2 版')
  await page.locator('#create-edition-isbn').fill('978-7-5115-7592-0')
  await page.screenshot({ path: info.outputPath('edition-form.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const response = page.waitForResponse(response => response.request().method() === 'POST' && /\/works\/[^/]+\/editions$/.test(response.url()))
  await page.getByRole('button', { name: '确认并公开版本', exact: true }).click()
  const created = await response
  expect(created.status(), await created.text()).toBe(201)
  await expect(page.getByRole('heading', { name: '书目已公开', exact: true })).toBeVisible()
  await expect(page.getByText('已选择：version.txt', { exact: true })).toBeVisible()
  await expect(page.locator('input[type="checkbox"]')).not.toBeChecked()
  expect(posts.filter(post => post.url.endsWith('/assets'))).toHaveLength(0)
  expect(posts.find(post => post.url.endsWith('/works'))?.body).not.toHaveProperty('subtitle')
  const result = await created.json()
  const edition = result.data
  expect(edition.translators.map((person: { name: string }) => person.name)).toEqual(['译者甲', '译者乙'])
  const detail = await context.newPage()
  await detail.goto(`/books/edition/${edition.id}`)
  await expect(detail.getByText('译者甲 / 译者乙 译')).toBeVisible()
  await expect(detail.getByText('版本专有副标题', { exact: true })).toBeVisible()
  await detail.screenshot({ path: info.outputPath('edition-detail.png'), fullPage: true })
  expect(await detail.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  await detail.goto(`/books/new?work=${edition.work_id}`)
  await expect(detail.locator(`input[name="edition"][value="${edition.id}"]`)).toBeVisible()
  await expect(detail.locator('input[name="edition"]:checked')).toHaveCount(0)
  await detail.locator('#create-edition-search').fill('978-7-5115-7592-0')
  await detail.locator(`input[name="edition"][value="${edition.id}"]`).check()
  await expect(detail.locator('#create-edition-isbn')).toHaveCount(0)
  await detail.getByRole('button', { name: '确认使用此版本', exact: true }).click()
  await expect(detail.getByRole('heading', { name: '书目已公开', exact: true })).toBeVisible()
  const catalog = await (await context.request.get(`/api/v1/books/works/${edition.work_id}`)).json()
  expect(catalog.data.editions).toHaveLength(1)
  expect(catalog.data.authors.map((person: { name: string }) => person.name)).toEqual(['原作者'])

  // Page cold-start restores rotate CSRF credentials; use the current session token.
  const csrf = (await (await context.request.get('/api/v1/auth/session')).json()).csrf_token as string
  const asset = await context.request.post(`/api/v1/books/works/${edition.work_id}/assets`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf }, data: { edition_id: edition.id, title: '同一译本的文件', language: 'zh', format: 'txt' },
  })
  expect(asset.status(), await asset.text()).toBe(201)
  expect((await asset.json()).data.edition_id).toBe(edition.id)
  await detail.close()
})
