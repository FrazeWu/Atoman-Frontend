import { chromium, expect, type Page } from '@playwright/test'

// Isolated HTTP fixtures exercise the real Vue routes, sheets and form events.
// Backend ownership/CAS and file-safety behavior are verified by the Go suite.
export async function runBooksV2Smoke(baseURL = 'http://127.0.0.1:5186', screenshots?: string) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  const errors: string[] = []
  const writes: { path: string; body: Record<string, unknown> }[] = []
  const work = { id: 'work-1', revision_id: 'wiki-1', title: '中国大历史', description: '从阅读到讨论的统一图书。', authors: [{ id: 'person-1', name: '黄仁宇', role: 'author' }], editions: [], lifecycle_status: 'active', rating_score: 0, rating_count: 0 }
  let note = { id: 'note-1', work_id: work.id, title: '历史阅读', body: '尚未公开的读书笔记', tags: ['历史'], version: 1 }
  const entry = { id: 'entry-1', work_id: work.id, work_title: work.title, status: 'reading', tags: ['历史'], version: 1 }
  const asset = { id: 'asset-1', work_id: work.id, title: work.title, language: 'zh', format: 'txt', status: 'active', current_revision_id: 'file-1' }
  async function fixture(page: Page) {
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/v1/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname.replace('/api/v1', ''), method = request.method()
      const ok = (data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) })
      const body = request.postDataJSON() as Record<string, unknown> | null
      if (method !== 'GET') writes.push({ path, body: body || {} })
      if (path === '/auth/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ csrf_token: 'fixture-csrf', user: { uuid: 'user-1', username: 'reader', email: 'reader@example.test', role: 'user' } }) })
      if (path === '/site/access') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      if (path === '/books/works') return ok({ items: [work], total: 1 })
      if (path === '/books/works/work-1') { if (method === 'PATCH') { work.title = String(body?.title); work.revision_id = 'wiki-2' }; return ok(work) }
      if (path === '/books/works/work-1/assets') return ok({ items: [asset] })
      if (path === '/books/works/work-1/rating') return ok({ rating_count: 6, rating_score: 8, weighted_rating_score: 8.4, rating_active: true, minimum_rating_count: 6, viewer_rating: method === 'PUT' ? body?.score : undefined })
      if (path === '/books/rankings/high-rated') return ok({ items: [{ work_id: work.id, title: work.title, rating_count: 6, weighted_rating_score: 8.4 }], total: 1 })
      if (path === '/books/me/library') return ok({ items: [entry], total: 1 })
      if (path === '/books/me/library/works/work-1') { entry.status = String(body?.status); entry.version++; return ok(entry) }
      if (path === '/books/me/reading-statistics') return ok({ total_seconds: 360, timezone: 'UTC', days: [{ day: '2026-10-17', seconds: 360 }], works: [], from: '2026-09-18', to: '2026-10-17' })
      if (path === '/books/me/private-notes') return ok({ items: [note], total: 1 })
      if (path === '/books/me/private-notes/note-1') { if (method === 'PUT') note = { ...note, title: String(body?.title), body: String(body?.body), version: note.version + 1 }; return ok(note) }
      if (path === '/books/wiki/work/work-1/revisions') return ok({ items: [{ id: work.revision_id, version: 1, is_current: true, edit_type: 'creation', summary: '创建作品', snapshot: work, changes: [{ field: 'title', before: null, after: work.title }] }], total: 1 })
      if (path.endsWith('/merges') || path.endsWith('/reviews') || path === '/books/me/reading-marks') return ok({ items: [], total: 0 })
      if (path.startsWith('/discussions/')) return ok({ items: [], total_roots: 0, total_comments: 0, target: { comment_count: 0, root_count: 0 } })
      if (path === '/books/assets/asset-1/revisions') return ok({ items: [{ id: 'file-1', asset_id: asset.id, number: 1, original_filename: '历史.txt', status: 'ready', created_at: '2026-10-17' }] })
      if (path === '/books/asset-revisions/file-1/content') return route.fulfill({ status: 200, contentType: 'text/plain;charset=utf-8', body: '第一段正文。\n\n第二段正文。\n\n可以划线和讨论。' })
      if (path === '/books/me/reading-sessions') return ok({ session: { id: 'session-1', last_sequence: 0, heartbeat_sequence: 0 }, state: { revision_id: 'file-1', version: 0, epub_cfi: '', pdf_page: 0, txt_offset: 0, current_percent: 0, furthest_percent: 0 } })
      if (path === '/books/me/reading-marks/file-1') return ok({ items: [], deleted: [] })
      if (path === '/books/me/selections/work-1') return ok({ asset_id: asset.id, revision_id: 'file-1' })
      if (path === '/books/works/work-1/reading-recommendation') return ok({ work_id: work.id, asset, revision_id: 'file-1', available: true, source: 'selection' })
      return ok({ items: [], total: 0 })
    })
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Shanghai' }); await fixture(page)
    await page.goto(`${baseURL}/books/library`)
    await expect(page.getByRole('heading', { name: '我的书架' })).toBeVisible()
    await page.locator('li').filter({ hasText: '中国大历史' }).getByLabel('阅读状态').selectOption('read')
    await expect.poll(() => writes.some(item => item.path.endsWith('/library/works/work-1') && item.body.base_version === 1)).toBe(true)
    await page.goto(`${baseURL}/books/notes`)
    await page.getByRole('button', { name: '编辑', exact: true }).click()
    await page.getByLabel('笔记正文', { exact: true }).fill('编辑后的私人笔记，不会自动公开')
    await page.getByRole('button', { name: '保存私人笔记', exact: true }).click()
    await expect(page.getByText('私人笔记已保存。', { exact: true })).toBeVisible()
    expect(note.body).toBe('编辑后的私人笔记，不会自动公开')
    await page.goto(`${baseURL}/books/work/work-1`)
    await page.getByRole('button', { name: '作品资料与修订历史', exact: true }).click()
    await page.getByLabel('书名', { exact: true }).fill('中国大历史（修正）')
    await page.getByRole('button', { name: '保存并公开', exact: true }).click()
    await expect(page.getByText('资料已公开，修订历史已保留。', { exact: true })).toBeVisible()
    expect(writes.find(item => item.path === '/books/works/work-1')?.body.base_revision_id).toBe('wiki-1')
    if (screenshots) await page.screenshot({ path: `${screenshots}/wiki-desktop.png` })
    await page.keyboard.press('Escape')
    await page.goto(`${baseURL}/books?sort=high-rated`)
    await expect(page.getByText('信誉加权评分 8.4 · 6 人')).toBeVisible()
    await page.goto(`${baseURL}/books/read/work-1/asset-1/file-1`)
    await expect(page.getByText('第一段正文。')).toBeVisible()
    await expect(page.getByText('进度已同步到云端 · 书签仅本人可见')).toBeVisible()
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' }); await fixture(mobile)
    await mobile.goto(`${baseURL}/books/notes`)
    await mobile.getByRole('button', { name: '编辑', exact: true }).click()
    const sheet = mobile.locator('.p-sheet-mobile-page').last(); await expect(sheet).toBeVisible()
    await mobile.getByLabel('笔记正文', { exact: true }).fill('手机未保存笔记')
    await expect.poll(async () => mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect.poll(async () => (await sheet.boundingBox())?.y).toBe(0)
    if (screenshots) await mobile.screenshot({ path: `${screenshots}/notes-mobile.png` })
    await sheet.locator('.p-sheet-mobile-page__back').click()
    await expect(mobile.getByText('放弃未保存的笔记？', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
    return { assertions: '书架 CAS、笔记保存、作品 Wiki、高分榜、真实 TXT 阅读、手机未保存保护', writes: writes.length, errors }
  } finally { await browser.close() }
}
