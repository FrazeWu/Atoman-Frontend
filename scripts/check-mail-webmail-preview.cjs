// Visual smoke against an isolated local Vite server. Uses synthetic API
// responses and does not connect to the live Atoman mailbox or R2.
const assert = require('node:assert/strict')
const { chromium } = require('@playwright/test')
const root = process.env.MAIL_PREVIEW_URL || 'http://127.0.0.1:5189'

const currentAccount = { data: { status: 'active', available: true, address: 'preview@atoman.org' } }
const sampleFolders = { data: [
  { id: 'inbox-id', name: 'Inbox', role: 'inbox', parentId: null, totalEmails: 1, unreadEmails: 1 },
  { id: 'junk-id', name: 'Junk Mail', role: 'junk', parentId: null, totalEmails: 0, unreadEmails: 0 },
] }
const sampleMail = { data: [
  { id: 'synthetic-1', threadId: 'thread-1', subject: '页面布局验收', preview: '这只是一条本地界面测试数据，不存在于任何真实邮箱。', receivedAt: '2026-11-04T10:00:00Z', hasAttachment: false },
] }
async function run() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
  try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  let account = currentAccount
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let result = { data: {} }
    if (url.pathname.endsWith('/auth/session')) {
      result = { csrf_token: 'preview-session-csrf', user: { username: 'layout-preview', uuid: '11111111-1111-4111-8111-111111111111', email: 'preview@example.test', role: 'user', is_active: true } }
    } else if (url.pathname.endsWith('/mail/me')) {
      result = account
    } else if (url.pathname.endsWith('/mail/folders')) {
      result = sampleFolders
    } else if (url.pathname.endsWith('/mail/messages')) {
      result = url.searchParams.get('mailbox_id') === 'inbox-id' ? sampleMail : { data: [] }
    }
    await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(result) })
  })
  const page = await context.newPage()
  await page.goto(`${root}/mail`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('mail-active-workspace').waitFor({ timeout: 20000 })
  await page.getByTestId('mail-message-synthetic-1').click()
  await page.getByTestId('mail-selected-preview').waitFor()
  let rects = await page.evaluate(() => {
    const items = ['mail-folder-pane', 'mail-list-pane', 'mail-reader-pane'].map(name => document.querySelector(`[data-testid="${name}"]`).getBoundingClientRect())
    return items.map(box => ({ x: box.x, width: box.width, height: box.height, right: box.right }))
  })
  assert.ok(rects.every(item => item.width > 160), 'Desktop mail columns must each have usable width')
  assert.ok(rects[0].right <= rects[1].x + 2 && rects[1].right <= rects[2].x + 2, 'Desktop mail columns must not overlap')
  await page.screenshot({ path: '/tmp/atoman-webmail-desktop-preview-20261104.png', fullPage: true })
  console.log('MAIL_DESKTOP_VISUAL_BOUNDS_OK', JSON.stringify(rects))

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('mail-reader-pane').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '返回邮件列表' }).click()
  await page.getByTestId('mail-list-pane').waitFor({ state: 'visible' })
  await page.getByRole('button', { name: '返回文件夹' }).click()
  await page.getByTestId('mail-folder-pane').waitFor({ state: 'visible' })
  await page.screenshot({ path: '/tmp/atoman-webmail-mobile-preview-20261104.png', fullPage: true })
  const mobileOverflow = await page.evaluate(() => ({ viewport: window.innerWidth, mailWidth: document.querySelector('.mail-page').getBoundingClientRect().width, scrollWidth: document.querySelector('.mail-page').scrollWidth }))
  assert.ok(mobileOverflow.scrollWidth <= mobileOverflow.viewport + 1, `Mobile Webmail should not scroll horizontally: ${JSON.stringify(mobileOverflow)}`)
  console.log('MAIL_MOBILE_SINGLE_PANE_AND_NO_OVERFLOW_OK', JSON.stringify(mobileOverflow))

  // A real mobile visit starts the separate mobile app/router. Test that runtime
  // after a hard refresh, not merely desktop CSS resized to 390px.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('mail-active-workspace').waitFor({ timeout: 20000 })
  await page.getByTestId('mail-list-pane').waitFor({ state: 'visible' })
  const mobileRuntime = await page.evaluate(() => document.documentElement.dataset.atomanApp)
  assert.equal(mobileRuntime, 'mobile', 'Hard reload at 390px must boot the mobile Atoman runtime')
  await page.screenshot({ path: '/tmp/atoman-webmail-mobile-preview-20261104.png', fullPage: true })
  const genuineMobileBounds = await page.evaluate(() => ({ viewport: window.innerWidth, scrollWidth: document.querySelector('.mail-page').scrollWidth }))
  assert.ok(genuineMobileBounds.scrollWidth <= genuineMobileBounds.viewport + 1)
  console.log('MAIL_GENUINE_MOBILE_RUNTIME_AND_ROUTE_OK', JSON.stringify(genuineMobileBounds))

  account = { data: { status: 'reserved', available: false, address: 'preview@atoman.org' } }
  await page.reload({ waitUntil: 'domcontentloaded' })
  try {
    await page.getByTestId('mail-not-active').waitFor({ timeout: 14000 })
  } catch (error) {
    console.log('MAIL_RESERVED_DIAGNOSTIC_URL', page.url())
    console.log('MAIL_RESERVED_DIAGNOSTIC_BODY', (await page.locator('body').innerText().catch(() => 'unreadable')).slice(0, 750))
    throw error
  }
  assert.equal(await page.getByTestId('mail-active-workspace').count(), 0)
  console.log('MAIL_RESERVED_ACCOUNT_FAIL_CLOSED_IN_BROWSER_OK')
  await page.goto(`${root}/modules`, { waitUntil: 'domcontentloaded' })
  const mobileMailEntry = page.getByRole('link', { name: '电子邮件' })
  await mobileMailEntry.waitFor({ timeout: 16000 })
  await mobileMailEntry.click()
  await page.getByTestId('mail-not-active').waitFor({ timeout: 16000 })
  console.log('MAIL_MOBILE_MODULE_DIRECTORY_NAVIGATION_OK')
  } finally {
    await browser.close()
  }
}
run().catch(error => { console.error(error); process.exitCode = 1 })
