import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { expect, test } from '../fixtures/base'
import { sanitizeDownloadName } from '../../../src/utils/textDownload'

const enabled = process.env.MUSIC_LYRICS_ROW_EDITOR_E2E === '1'
const albumId = process.env.MUSIC_LYRICS_E2E_ALBUM_ID ?? ''
const sourceSongTitle = process.env.MUSIC_LYRICS_E2E_SONG_TITLE ?? ''
const sourceSongId = process.env.MUSIC_LYRICS_E2E_SOURCE_SONG_ID ?? ''

const descendingOriginal = '[00:02.00]Two\n[00:01.00]One A\n[00:01.00]One B'
const descendingTranslation = '[00:02.00]二\n[00:01.00]一甲\n[00:01.00]一乙'
const sortedOriginal = '[00:01.00]One A\n[00:01.00]One B\n[00:02.00]Two'
const sortedTranslation = '[00:01.00]一甲\n[00:01.00]一乙\n[00:02.00]二'

type LocalAuthFixture = {
  token: string
  user: Record<string, unknown>
  userId: string
}

test.describe('Music lyrics row editor real workflow', () => {
  test.skip(!enabled, 'requires MUSIC_LYRICS_ROW_EDITOR_E2E=1 and a prepared local source song')

  test('imports, validates, downloads, saves, and fits desktop and mobile', async ({ page }, testInfo) => {
    test.setTimeout(90_000)
    requirePreparedFixture()

    const username = `lyrics-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`
    const password = `Lyrics-E2E-${randomUUID()}!`
    const songId = randomUUID()
    const temporarySongTitle = `Lyrics E2E ${randomUUID().slice(0, 8)}`
    let auth: LocalAuthFixture | null = null
    let sourceHash = ''

    try {
      auth = await createLocalAuthFixture(page.request, username, password)
      sourceHash = createTemporarySongFixture(songId, temporarySongTitle, auth.userId)
      await page.addInitScript(({ token, user }) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
      }, { token: auth.token, user: auth.user })

      await runWorkflow(page, testInfo, songId, temporarySongTitle, auth.token)
    } finally {
      if (auth) {
        cleanupTemporaryFixture(songId, auth.userId, sourceHash)
      }
    }
  })
})

async function runWorkflow(
  page: Page,
  testInfo: import('@playwright/test').TestInfo,
  songId: string,
  songTitle: string,
  token: string,
) {
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
    if (response.status() >= 400) {
      failingResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })

  await page.goto(`/music?album=${encodeURIComponent(albumId)}`)
  const track = page.locator('.track').filter({ hasText: songTitle }).first()
  await expect(track.getByText(songTitle, { exact: true })).toBeVisible()
  await track.locator(`[data-testid="track-play-${songId}"]`).click()
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
  await expect(desktopHeader.getByText('时间', { exact: true })).toBeVisible()
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

  const safeSongTitle = sanitizeDownloadName(songTitle)
  const originalDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出原文' }).click()
  const originalDownload = await originalDownloadPromise
  expect(originalDownload.suggestedFilename()).toBe(`${safeSongTitle}.lrc`)
  const originalStream = await originalDownload.createReadStream()
  expect(await readDownload(originalStream)).toBe('[00:01.00]One B\n[00:01.00]Two\n[00:03.00]One A')

  const translationDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出翻译' }).click()
  const translationDownload = await translationDownloadPromise
  expect(translationDownload.suggestedFilename()).toBe(`${safeSongTitle}-translation.lrc`)
  const translationStream = await translationDownload.createReadStream()
  expect(await readDownload(translationStream)).toBe('[00:01.00]一乙\n[00:01.00]二\n[00:03.00]一甲')
  await page.screenshot({ path: testInfo.outputPath('lyrics-row-editor-desktop.png'), fullPage: true })

  await page.getByTestId('lyrics-edit-summary').fill('导入逐行歌词')
  await expect(page.getByTestId('lyrics-save')).toBeEnabled()
  const saveResponsePromise = page.waitForResponse(response => (
    response.request().method() === 'PUT'
    && response.url().endsWith(`/api/v1/music/songs/${songId}/lyrics`)
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

  expect(consoleErrors).toEqual([])
  expect(failedRequests).toEqual([])
  expect(failingResponses).toEqual([])

  const savedResponse = await page.request.get(`/api/v1/music/songs/${songId}/lyrics`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(savedResponse.status()).toBe(200)
}

function requirePreparedFixture() {
  if (!albumId || (!sourceSongId && !sourceSongTitle)) {
    throw new Error('启用真实歌词 smoke 后必须提供 album ID，以及 source song ID 或 title')
  }
  if (process.env.MUSIC_LYRICS_E2E_LOCAL_DB_CLEANUP !== '1') {
    throw new Error('真实歌词 smoke 需要 MUSIC_LYRICS_E2E_LOCAL_DB_CLEANUP=1 以启用 finally 本地恢复')
  }
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    throw new Error('真实歌词 smoke 必须显式提供 PLAYWRIGHT_BASE_URL')
  }
  const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL)
  if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(baseURL.hostname)) {
    throw new Error(`拒绝对非本地地址执行数据库 fixture：${baseURL.origin}`)
  }
}

function createTemporarySongFixture(songId: string, temporaryTitle: string, userId: string) {
  const sourceWhere = sourceSongId
    ? `source.id = ${sqlLiteral(sourceSongId)} AND source.album_id = ${sqlLiteral(albumId)}`
    : `source.album_id = ${sqlLiteral(albumId)} AND source.title = ${sqlLiteral(sourceSongTitle)}`
  const sourceCount = Number(runPsql(`SELECT count(*) FROM "Songs" source WHERE ${sourceWhere} AND source.deleted_at IS NULL;`))
  expect(sourceCount, 'source song 查询必须唯一').toBe(1)

  const sourceHash = readSourceSongHash(sourceWhere)
  const insertedId = runPsql(`
    INSERT INTO "Songs" (
      id, created_at, updated_at, title, release_date, track_number, lyrics,
      audio_url, audio_source, cover_url, cover_source, batch_id, status,
      album_id, uploaded_by, play_count, duration_sec
    )
    SELECT
      ${sqlLiteral(songId)}, now(), now(), ${sqlLiteral(temporaryTitle)}, source.release_date,
      COALESCE((SELECT max(track_number) FROM "Songs" WHERE album_id = ${sqlLiteral(albumId)}), 0) + 1000,
      '', source.audio_url, source.audio_source, source.cover_url, source.cover_source,
      '', 'open', source.album_id, ${sqlLiteral(userId)}, 0, source.duration_sec
    FROM "Songs" source
    WHERE ${sourceWhere} AND source.deleted_at IS NULL
    RETURNING id;
  `)
  expect(insertedId).toBe(songId)
  return sourceHash
}

function readSourceSongHash(sourceWhere: string) {
  return runPsql(`
    SELECT md5(row_to_json(source)::text)
    FROM "Songs" source
    WHERE ${sourceWhere} AND source.deleted_at IS NULL;
  `)
}

async function createLocalAuthFixture(request: APIRequestContext, username: string, password: string): Promise<LocalAuthFixture> {
  const userId = runPsql(`
    INSERT INTO "Users" (uuid, username, email, password, role, is_active, onboarding_completed_at, created_at, updated_at, auth_version)
    VALUES (gen_random_uuid(), ${sqlLiteral(username)}, ${sqlLiteral(`${username}@example.test`)}, crypt(${sqlLiteral(password)}, gen_salt('bf', 10)), 'user', true, now(), now(), now(), 0)
    RETURNING uuid;
  `)
  try {
    const response = await request.post('/api/v1/auth/login', {
      data: { username, password },
    })
    expect(response.status()).toBe(200)
    const body = await response.json() as { token: string, user: Record<string, unknown> }
    return { token: body.token, user: body.user, userId }
  } catch (error) {
    runPsql(`DELETE FROM "Users" WHERE uuid = ${sqlLiteral(userId)};`)
    throw error
  }
}

function cleanupTemporaryFixture(songId: string, userId: string, sourceHash: string) {
  runPsql(`
    BEGIN;
    DELETE FROM music_lyric_annotation_votes WHERE annotation_id IN (
      SELECT id FROM music_lyric_annotations WHERE song_id = ${sqlLiteral(songId)}
    );
    DELETE FROM music_lyric_annotations WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_song_lyric_lines WHERE lyric_id IN (
      SELECT id FROM music_song_lyrics WHERE song_id = ${sqlLiteral(songId)}
    );
    DELETE FROM music_song_lyrics WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_song_lyric_versions WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM lyric_annotations WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_listening_histories WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_playlist_songs WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_song_bookmarks WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM song_artists WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM song_corrections WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM "Songs" WHERE id = ${sqlLiteral(songId)};
    DELETE FROM "Users" WHERE uuid = ${sqlLiteral(userId)};
    COMMIT;
  `)

  const counts = runPsql(`
    SELECT concat_ws('|',
      (SELECT count(*) FROM "Songs" WHERE id = ${sqlLiteral(songId)}),
      (SELECT count(*) FROM "Users" WHERE uuid = ${sqlLiteral(userId)}),
      (SELECT count(*) FROM music_song_lyrics WHERE song_id = ${sqlLiteral(songId)}),
      (SELECT count(*) FROM music_song_lyric_versions WHERE song_id = ${sqlLiteral(songId)})
    );
  `)
  expect(counts).toBe('0|0|0|0')

  if (sourceHash) {
    const sourceWhere = sourceSongId
      ? `source.id = ${sqlLiteral(sourceSongId)} AND source.album_id = ${sqlLiteral(albumId)}`
      : `source.album_id = ${sqlLiteral(albumId)} AND source.title = ${sqlLiteral(sourceSongTitle)}`
    expect(readSourceSongHash(sourceWhere)).toBe(sourceHash)
  }
}

function runPsql(sql: string) {
  const container = process.env.MUSIC_LYRICS_E2E_POSTGRES_CONTAINER ?? 'atoman-dev-postgres-1'
  const database = process.env.MUSIC_LYRICS_E2E_POSTGRES_DB ?? 'atoman_dev'
  const user = process.env.MUSIC_LYRICS_E2E_POSTGRES_USER ?? 'atoman'
  return execFileSync('docker', [
    'exec', container,
    'psql', '-q', '-U', user, '-d', database,
    '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql,
  ], { encoding: 'utf8' }).trim()
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

async function readDownload(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

async function assertMobileLayout(page: Page) {
  await expect.poll(
    () => page.getByTestId('lyric-editor-grid').evaluate(element => element.getBoundingClientRect().right),
    { message: '歌词编辑抽屉应完成进场并位于移动端视口内' },
  ).toBeLessThanOrEqual(390)
  await expect.poll(
    () => page.locator('.p-sheet-panel[aria-label="编辑歌词"]').evaluate(element => element.getBoundingClientRect().right),
    { message: '歌词 sheet 应完成进场并位于移动端视口内' },
  ).toBeLessThanOrEqual(390)

  const layout = await page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('.lyric-row')
    const original = row?.querySelector<HTMLElement>('[data-testid^="lyric-original-"]')
    const actions = row?.querySelector<HTMLElement>('.lyric-actions')
    const actionButtons = [...(actions?.querySelectorAll<HTMLElement>('.lyric-action') ?? [])]
    const sheet = document.querySelector<HTMLElement>('.p-sheet-panel[aria-label="编辑歌词"]')
    const player = document.querySelector<HTMLElement>('.player')
    const controls = document.querySelector<HTMLElement>('.player-controls-hub')
    const rect = (element: HTMLElement | null | undefined) => element?.getBoundingClientRect()
    return {
      viewportWidth: window.innerWidth,
      bodyScrollWidth: document.documentElement.scrollWidth,
      row: rect(row),
      original: rect(original),
      actions: rect(actions),
      actionButtons: actionButtons.map(rect),
      sheet: rect(sheet),
      player: rect(player),
      controls: rect(controls),
    }
  })

  expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.player).toBeTruthy()
  expect(layout.controls).toBeTruthy()
  const viewportBoxes = [
    ['row', layout.row],
    ['original', layout.original],
    ['actions', layout.actions],
    ['sheet', layout.sheet],
    ...layout.actionButtons.map((box, index) => [`action-${index + 1}`, box] as const),
  ] as const
  for (const [name, box] of viewportBoxes) {
    expect(box).toBeTruthy()
    expect(box!.left, `${name} 左边界`).toBeGreaterThanOrEqual(0)
    expect(box!.right, `${name} 右边界`).toBeLessThanOrEqual(layout.viewportWidth)
  }
  expect(layout.actionButtons).toHaveLength(3)
  expect(layout.actions!.top).toBeGreaterThanOrEqual(layout.original!.bottom)

  for (let index = 0; index < layout.actionButtons.length; index += 1) {
    for (let other = index + 1; other < layout.actionButtons.length; other += 1) {
      expect(rectanglesIntersect(layout.actionButtons[index]!, layout.actionButtons[other]!)).toBe(false)
    }
  }
  for (const editorBox of [layout.sheet!, layout.row!, layout.original!, layout.actions!, ...layout.actionButtons.map(box => box!)]) {
    expect(rectanglesIntersect(editorBox, layout.player!)).toBe(false)
    expect(rectanglesIntersect(editorBox, layout.controls!)).toBe(false)
  }
}

function rectanglesIntersect(
  first: { left: number, right: number, top: number, bottom: number },
  second: { left: number, right: number, top: number, bottom: number },
) {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top
}
