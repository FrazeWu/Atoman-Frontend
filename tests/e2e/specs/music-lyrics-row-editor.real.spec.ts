import { expect, test } from '../fixtures/base'

const enabled = process.env.MUSIC_LYRICS_ROW_EDITOR_E2E === '1'
const albumId = process.env.MUSIC_LYRICS_E2E_ALBUM_ID ?? ''
const songTitle = process.env.MUSIC_LYRICS_E2E_SONG_TITLE ?? ''
const authToken = process.env.MUSIC_LYRICS_E2E_AUTH_TOKEN ?? ''
const authUser = process.env.MUSIC_LYRICS_E2E_AUTH_USER ?? ''

const descendingOriginal = '[00:02.00]Two\n[00:01.00]One A\n[00:01.00]One B'
const descendingTranslation = '[00:02.00]二\n[00:01.00]一甲\n[00:01.00]一乙'
const sortedOriginal = '[00:01.00]One A\n[00:01.00]One B\n[00:02.00]Two'
const sortedTranslation = '[00:01.00]一甲\n[00:01.00]一乙\n[00:02.00]二'

test.describe('Music lyrics row editor real workflow', () => {
  test.skip(!enabled || !albumId || !songTitle, 'requires prepared music lyric e2e fixture')

  test('imports, validates, downloads, saves, and fits desktop and mobile', async ({ authenticatedPage: page }, testInfo) => {
    test.setTimeout(90_000)
    const consoleErrors: string[] = []
    const failedRequests: string[] = []
    const failingResponses: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`)
    })
    page.on('response', (response) => {
      if ([404, 409, 500].includes(response.status())) {
        failingResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
      }
    })

    if (authToken && authUser) {
      await page.addInitScript(({ token, user }) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', user)
      }, { token: authToken, user: authUser })
    }

    await page.goto(`/music?album=${encodeURIComponent(albumId)}`)
    const track = page.locator('.track').filter({ hasText: songTitle }).first()
    await expect(track.getByText(songTitle, { exact: true })).toBeVisible()
    await track.locator('[data-testid^="track-play-"]').click()
    await expect(page.locator('.player')).toBeVisible()
    await page.locator('.feature-link').filter({ hasText: '词' }).click()
    await expect(page.getByTestId('lyrics-edit-trigger')).toBeVisible()
    await page.getByTestId('lyrics-edit-trigger').click()

    const editor = page.getByTestId('lyric-editor-grid')
    await expect(editor).toBeVisible()
    const desktopHeader = editor.locator('.lyric-grid-header')
    for (const heading of ['序号', '原文', '翻译', '操作']) {
      await expect(desktopHeader.getByText(heading, { exact: true })).toBeVisible()
    }
    const initialOriginalValues = await editor.locator('[data-testid^="lyric-original-"]')
      .evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))

    await page.getByLabel('原文 LRC').setInputFiles({
      name: 'song.lrc',
      mimeType: 'text/plain',
      buffer: Buffer.from(descendingOriginal),
    })
    await page.getByLabel('翻译 LRC').setInputFiles({
      name: 'song-translation.lrc',
      mimeType: 'text/plain',
      buffer: Buffer.from(descendingTranslation),
    })
    await page.getByRole('button', { name: '预览导入' }).click()
    await expect(page.getByRole('dialog', { name: '导入预览' }).getByRole('cell', { name: 'One A' })).toBeVisible()
    await expect(page.getByText('时间不能早于上一行')).toBeVisible()
    await expect(page.getByTestId('lyrics-import-confirm')).toBeDisabled()
    await page.getByRole('button', { name: '取消', exact: true }).last().click()

    await page.getByLabel('原文 LRC').setInputFiles({
      name: 'song.lrc',
      mimeType: 'text/plain',
      buffer: Buffer.from(sortedOriginal),
    })
    await page.getByLabel('翻译 LRC').setInputFiles({
      name: 'song-translation.lrc',
      mimeType: 'text/plain',
      buffer: Buffer.from(sortedTranslation),
    })
    await page.getByRole('button', { name: '预览导入' }).click()
    await expect(page.getByRole('dialog', { name: '导入预览' }).getByRole('cell', { name: 'One A' })).toBeVisible()
    await page.getByRole('button', { name: '取消', exact: true }).last().click()
    expect(await editor.locator('[data-testid^="lyric-original-"]')
      .evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(initialOriginalValues)

    await page.getByRole('button', { name: '预览导入' }).click()
    await page.getByTestId('lyrics-import-confirm').click()
    await expect(editor.locator('[data-testid^="lyric-original-"]').first()).toHaveValue('One A')
    await expect(page.getByText('存在重复时间')).toBeVisible()

    const firstTime = editor.locator('[data-testid^="lyric-time-"]').nth(0)
    const thirdTime = editor.locator('[data-testid^="lyric-time-"]').nth(2)
    await firstTime.fill('00:03.00')
    await thirdTime.fill('00:01.00')
    await expect(page.getByText('时间不能早于上一行').first()).toBeVisible()
    await expect(page.getByTestId('lyrics-save')).toBeDisabled()

    await page.getByRole('button', { name: '按时间排序' }).click()
    await expect(page.getByText('时间不能早于上一行')).toHaveCount(0)
    await expect(page.getByText('存在重复时间')).toBeVisible()

    const originalDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出原文' }).click()
    const originalDownload = await originalDownloadPromise
    expect(originalDownload.suggestedFilename()).toMatch(/\.lrc$/)
    expect(originalDownload.suggestedFilename()).not.toMatch(/-translation\.lrc$/)
    const originalStream = await originalDownload.createReadStream()
    expect(await readDownload(originalStream)).toBe('[00:01.00]One B\n[00:01.00]Two\n[00:03.00]One A')

    const translationDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出翻译' }).click()
    const translationDownload = await translationDownloadPromise
    expect(translationDownload.suggestedFilename()).toMatch(/-translation\.lrc$/)
    const translationStream = await translationDownload.createReadStream()
    expect(await readDownload(translationStream)).toBe('[00:01.00]一乙\n[00:01.00]二\n[00:03.00]一甲')
    await page.screenshot({ path: testInfo.outputPath('lyrics-row-editor-desktop.png'), fullPage: true })

    await page.getByTestId('lyrics-edit-summary').fill('导入逐行歌词')
    await expect(page.getByTestId('lyrics-save')).toBeEnabled()
    const saveResponsePromise = page.waitForResponse(response => (
      response.request().method() === 'PUT'
      && /\/api\/v1\/music\/songs\/[^/]+\/lyrics$/.test(response.url())
    ))
    await page.getByTestId('lyrics-save').click()
    expect((await saveResponsePromise).status()).toBe(200)
    await expect(page.getByText('One A', { exact: true })).toBeVisible()
    await expect(page.getByText('一甲', { exact: true })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByTestId('lyrics-edit-trigger').click()
    await expect(editor).toBeVisible()
    await expect(page.getByLabel('原文，第 1 行')).toBeVisible()
    await assertMobileLayout(page)
    await page.screenshot({ path: testInfo.outputPath('lyrics-row-editor-mobile.png'), fullPage: true })

    expect(consoleErrors.filter(message => /lyrics?|music/i.test(message))).toEqual([])
    expect(failedRequests.filter(message => /lyrics?|music/i.test(message))).toEqual([])
    expect(failingResponses.filter(message => /lyrics?|music/i.test(message))).toEqual([])
  })
})

async function readDownload(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function assertMobileLayout(page: import('@playwright/test').Page) {
  await expect.poll(
    () => page.getByTestId('lyric-editor-grid').evaluate(element => element.getBoundingClientRect().right),
    { message: '歌词编辑抽屉应完成进场并位于移动端视口内' },
  ).toBeLessThanOrEqual(390)

  const layout = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('.lyric-row')
    const original = row?.querySelector<HTMLElement>('[data-testid^="lyric-original-"]')
    const actions = row?.querySelector<HTMLElement>('.lyric-actions')
    const controls = document.querySelector<HTMLElement>('.player-controls-hub')
    const rect = (element: HTMLElement | null | undefined) => element?.getBoundingClientRect()
    return {
      viewportWidth: window.innerWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      row: rect(row),
      original: rect(original),
      actions: rect(actions),
      controls: rect(controls),
    }
  })

  expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth)
  for (const box of [layout.row, layout.original, layout.actions, layout.controls]) {
    expect(box).toBeTruthy()
    expect(box!.left).toBeGreaterThanOrEqual(0)
    expect(box!.right).toBeLessThanOrEqual(layout.viewportWidth)
  }
  expect(layout.actions!.top).toBeGreaterThanOrEqual(layout.original!.bottom)
}
