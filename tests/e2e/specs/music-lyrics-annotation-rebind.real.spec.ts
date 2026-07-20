import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Browser, Locator, Page } from '@playwright/test'
import { expect, test } from '../fixtures/base'

const enabled = process.env.MUSIC_LYRICS_ANNOTATION_REBIND_E2E === '1'
const albumId = process.env.MUSIC_LYRICS_E2E_ALBUM_ID ?? ''
const sourceSongId = process.env.MUSIC_LYRICS_E2E_SOURCE_SONG_ID ?? ''

type LocalAuthFixture = {
  token: string
  user: Record<string, unknown>
  userId: string
}

test.describe('Music lyric annotation rebind real workflow', () => {
  test.skip(!enabled, 'requires MUSIC_LYRICS_ANNOTATION_REBIND_E2E=1 and a prepared local source song')

  test('author rebinds an invalidated annotation without creating another lyric version', async ({ browser, page }, testInfo) => {
    test.setTimeout(90_000)
    requirePreparedFixture()

    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
    const songId = randomUUID()
    const songTitle = `Annotation rebind E2E ${suffix}`
    const authorName = `annotation-author-${suffix}`
    const editorName = `lyrics-editor-${suffix}`
    const password = `Annotation-E2E-${randomUUID()}!`
    let author: LocalAuthFixture | null = null
    let editor: LocalAuthFixture | null = null
    let sourceHash = ''
    let authorContext: Awaited<ReturnType<Browser['newContext']>> | null = null
    let editorContext: Awaited<ReturnType<Browser['newContext']>> | null = null

    try {
      author = await createLocalAuthFixture(page.request, authorName, password)
      editor = await createLocalAuthFixture(page.request, editorName, password)
      sourceHash = createTemporarySongFixture(songId, songTitle, editor.userId)
      authorContext = await createAuthenticatedContext(browser, author)
      editorContext = await createAuthenticatedContext(browser, editor)
      const authorPage = await authorContext.newPage()
      const editorPage = await editorContext.newPage()

      const diagnostics = attachDiagnostics([authorPage, editorPage], songId)
      await openLyrics(editorPage, songId, songTitle)
      await importInitialLyrics(editorPage, songId)

      await openLyrics(authorPage, songId, songTitle)
      await selectTextInLine(authorPage, 'Anchor token is annotated', 'Anchor token')
      await authorPage.locator('.music-annotation-editor textarea').fill('需要保留的注释')
      const createResponse = authorPage.waitForResponse(response => (
        response.request().method() === 'POST'
        && response.url().endsWith(`/api/v1/music/songs/${songId}/lyrics/annotations`)
      ))
      await authorPage.getByRole('button', { name: '保存', exact: true }).click()
      expect((await createResponse).status()).toBe(201)

      const created = await getLyrics(authorPage.request, songId, author.token)
      const annotation = created.annotations.find(item => item.body === '需要保留的注释')
      expect(annotation).toBeTruthy()
      const annotationId = annotation!.id

      await editorPage.getByTestId('lyrics-edit-trigger').click()
      const firstOriginal = editorPage.locator('[data-testid^="lyric-original-"]').first()
      await expect(firstOriginal).toHaveValue('Anchor token is annotated')
      await firstOriginal.fill('Anchor was changed by editor')
      await editorPage.getByTestId('lyrics-edit-summary').fill('改动注释锚点')
      const conflictResponse = editorPage.waitForResponse(response => (
        response.status() === 409
        && response.request().method() === 'PUT'
        && response.url().endsWith(`/api/v1/music/songs/${songId}/lyrics`)
      ))
      await editorPage.getByTestId('lyrics-save').click()
      expect((await conflictResponse).status()).toBe(409)
      await expect(editorPage.getByRole('dialog', { name: '保存歌词' })).toBeVisible()
      const saveResponse = editorPage.waitForResponse(response => (
        response.status() === 200
        && response.request().method() === 'PUT'
        && response.url().endsWith(`/api/v1/music/songs/${songId}/lyrics`)
      ))
      await editorPage.getByRole('button', { name: '继续保存', exact: true }).click()
      expect((await saveResponse).status()).toBe(200)

      await diagnostics.refreshLyrics(async () => {
        await openLyrics(editorPage, songId, songTitle)
        await expect(editorPage.getByTestId(`annotation-rebind-${annotationId}`)).toHaveCount(0)
      })

      const beforeRebindVersions = await getVersions(authorPage.request, songId, author.token)
      const rebindButton = authorPage.getByTestId(`annotation-rebind-${annotationId}`)
      await diagnostics.refreshLyrics(async () => {
        await openLyrics(authorPage, songId, songTitle)
        await expect(rebindButton).toBeVisible()
      })
      await expect(authorPage.getByText('待重新绑定', { exact: true })).toBeVisible()
      await assertDesktopControls(authorPage, rebindButton, null)
      await authorPage.screenshot({ path: testInfo.outputPath('annotation-rebind-pending-desktop.png'), fullPage: true })

      await rebindButton.click()
      await selectTextInLine(authorPage, 'A separate target phrase', 'target phrase')
      const confirmRebind = authorPage.getByTestId('annotation-confirm-rebind')
      await expect(confirmRebind).toBeEnabled()
      await authorPage.setViewportSize({ width: 390, height: 844 })
      await assertMobileRebindControls(authorPage, rebindButton, confirmRebind)
      await authorPage.setViewportSize({ width: 1280, height: 720 })
      await assertDesktopControls(authorPage, rebindButton, confirmRebind)
      const patchResponse = authorPage.waitForResponse(response => (
        response.request().method() === 'PATCH'
        && response.url().endsWith(`/api/v1/music/songs/${songId}/lyrics/annotations/${annotationId}`)
      ))
      await confirmRebind.click()
      const response = await patchResponse
      expect(response.status()).toBe(200)
      expect(Object.keys(response.request().postDataJSON() as Record<string, unknown>).sort()).toEqual([
        'end_offset', 'line_key', 'selected_text', 'start_offset',
      ])

      const rebound = await getLyrics(authorPage.request, songId, author.token)
      const reboundAnnotation = rebound.annotations.find(item => item.id === annotationId)
      expect(reboundAnnotation).toMatchObject({
        status: 'active',
        selected_text: 'target phrase',
        start_offset: 11,
        end_offset: 24,
      })
      expect(await getVersions(authorPage.request, songId, author.token)).toHaveLength(beforeRebindVersions.length)

      const highlight = authorPage.locator('.music-lyrics-line__highlight').filter({ hasText: 'target phrase' })
      await expect(highlight).toBeVisible()
      await highlight.click()
      await expect(authorPage.getByText('需要保留的注释', { exact: true })).toBeVisible()

      await authorPage.setViewportSize({ width: 390, height: 844 })
      await expect(authorPage.locator('.music-lyrics-line__highlight').filter({ hasText: 'target phrase' })).toBeVisible()
      await assertMobileLayout(authorPage)
      await authorPage.screenshot({ path: testInfo.outputPath('annotation-rebind-mobile.png'), fullPage: true })

      expect(diagnostics.consoleErrors).toEqual([])
      expect(diagnostics.failedRequests).toEqual([])
      expect(diagnostics.failingResponses).toEqual([])
    } finally {
      await authorContext?.close()
      await editorContext?.close()
      cleanupTemporaryFixture(songId, [author?.userId, editor?.userId].filter((id): id is string => Boolean(id)), sourceHash)
    }
  })
})

function requirePreparedFixture() {
  if (!albumId || !sourceSongId) {
    throw new Error('启用真实注释重绑 smoke 后必须提供 album ID 和 source song ID')
  }
  if (process.env.MUSIC_LYRICS_E2E_LOCAL_DB_CLEANUP !== '1') {
    throw new Error('真实注释重绑 smoke 需要 MUSIC_LYRICS_E2E_LOCAL_DB_CLEANUP=1 以启用 finally 本地恢复')
  }
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    throw new Error('真实注释重绑 smoke 必须显式提供 PLAYWRIGHT_BASE_URL')
  }
  const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL)
  if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(baseURL.hostname)) {
    throw new Error(`拒绝对非本地地址执行数据库 fixture：${baseURL.origin}`)
  }
}

async function createAuthenticatedContext(browser: Browser, auth: LocalAuthFixture) {
  const context = await browser.newContext()
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, auth)
  return context
}

async function openLyrics(page: Page, songId: string, songTitle: string) {
  const targetPath = `/music/album/${encodeURIComponent(albumId)}`
  if (new URL(page.url()).pathname === targetPath) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  } else {
    await page.goto(targetPath, { waitUntil: 'domcontentloaded' })
  }
  const track = page.locator('.track').filter({ hasText: songTitle }).first()
  await expect(track.getByText(songTitle, { exact: true })).toBeVisible({ timeout: 15_000 })
  await track.locator(`[data-testid="track-play-${songId}"]`).click()
  await page.locator('.feature-link').filter({ hasText: '词' }).click()
  await expect(page.getByTestId('lyrics-edit-trigger')).toBeVisible()
}

async function importInitialLyrics(page: Page, songId: string) {
  await page.getByTestId('lyrics-edit-trigger').click()
  await page.getByLabel('原文 LRC').setInputFiles({
    name: 'annotation-rebind.lrc',
    mimeType: 'text/plain',
    buffer: Buffer.from('[00:01.00]Anchor token is annotated\n[00:02.00]A separate target phrase'),
  })
  await page.getByRole('button', { name: '预览导入' }).click()
  await page.getByTestId('lyrics-import-confirm').click()
  await page.getByTestId('lyrics-edit-summary').fill('创建可注释歌词')
  const saveResponse = page.waitForResponse(response => (
    response.request().method() === 'PUT'
    && response.url().endsWith(`/api/v1/music/songs/${songId}/lyrics`)
  ))
  await page.getByTestId('lyrics-save').click()
  expect((await saveResponse).status()).toBe(200)
  await expect(page.getByText('Anchor token is annotated', { exact: true })).toBeVisible()
}

async function selectTextInLine(page: Page, lineText: string, selectedText: string) {
  const line = page.locator('.music-lyrics-line__text').filter({ hasText: lineText }).first()
  await expect(line).toBeVisible()
  await line.evaluate((element, selectionText) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let text = ''
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      nodes.push(node)
      text += node.data
    }
    const start = text.indexOf(selectionText)
    if (start < 0) throw new Error(`无法选择文本：${selectionText}`)
    const end = start + selectionText.length
    let cursor = 0
    let startNode: Text | undefined
    let endNode: Text | undefined
    let startOffset = 0
    let endOffset = 0
    for (const node of nodes) {
      const nextCursor = cursor + node.data.length
      if (!startNode && start >= cursor && start <= nextCursor) {
        startNode = node
        startOffset = start - cursor
      }
      if (!endNode && end >= cursor && end <= nextCursor) {
        endNode = node
        endOffset = end - cursor
      }
      cursor = nextCursor
    }
    if (!startNode || !endNode) throw new Error(`无法定位文本：${selectionText}`)
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, selectedText)
  await line.dispatchEvent('mouseup')
}

function attachDiagnostics(pages: Page[], songId: string) {
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  const failingResponses: string[] = []
  const lyricSavePath = `/api/v1/music/songs/${songId}/lyrics`
  const sourceAudioPath = `/music/albums/${albumId}/tracks/${sourceSongId}.mp3`
  for (const page of pages) {
    page.on('console', message => {
      const expectedAnchorConflict = message.type() === 'error'
        && message.text().includes('status of 409 (Conflict)')
        && message.location().url.endsWith(lyricSavePath)
      if (message.type() === 'error' && !expectedAnchorConflict) consoleErrors.push(message.text())
    })
    page.on('requestfailed', request => {
      const expectedPlaybackAbort = request.method() === 'GET'
        && request.failure()?.errorText === 'net::ERR_ABORTED'
        && new URL(request.url()).pathname === sourceAudioPath
      if (expectedPlaybackAbort) return
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`)
    })
    page.on('response', response => {
      const expectedAnchorConflict = response.status() === 409
        && response.request().method() === 'PUT'
        && response.url().endsWith(lyricSavePath)
      if (response.status() >= 400 && !expectedAnchorConflict) {
        failingResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
      }
    })
  }
  return {
    consoleErrors,
    failedRequests,
    failingResponses,
    async refreshLyrics(waitForReady: () => Promise<void>) {
      await waitForReady()
    },
  }
}

async function getLyrics(request: APIRequestContext, songId: string, token: string) {
  const response = await request.get(`/api/v1/music/songs/${songId}/lyrics`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.status()).toBe(200)
  const body = await response.json() as {
    data: { annotations: Array<{ id: string, body: string, status: string, selected_text: string, start_offset: number, end_offset: number }> }
  }
  return body.data
}

async function getVersions(request: APIRequestContext, songId: string, token: string) {
  const response = await request.get(`/api/v1/music/songs/${songId}/lyrics/versions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.status()).toBe(200)
  const body = await response.json() as { data?: unknown[] }
  return body.data ?? []
}

async function assertDesktopControls(page: Page, pending: Locator, confirm: Locator | null) {
  for (const control of [pending, confirm].filter((item): item is Locator => Boolean(item))) {
    await expect(control).toBeVisible()
    const box = await control.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
}

async function assertMobileLayout(page: Page) {
  const layout = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector<HTMLElement>(selector)?.getBoundingClientRect()
    return {
      width: window.innerWidth,
      panel: rect('.music-lyrics-panel'),
      highlight: rect('.music-lyrics-line__highlight'),
      player: rect('.player'),
      controls: rect('.player-controls-hub'),
    }
  })
  expect(layout.panel).toBeTruthy()
  expect(layout.panel!.right).toBeLessThanOrEqual(layout.width)
  expect(layout.highlight).toBeTruthy()
  expect(layout.player).toBeTruthy()
  expect(layout.controls).toBeTruthy()
  expect(rectanglesIntersect(layout.highlight!, layout.player!)).toBe(false)
  expect(rectanglesIntersect(layout.highlight!, layout.controls!)).toBe(false)
}

async function assertMobileRebindControls(page: Page, pending: Locator, confirm: Locator) {
  await assertDesktopControls(page, pending, confirm)
  const layout = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector<HTMLElement>(selector)?.getBoundingClientRect()
    return {
      player: rect('.player'),
      controls: rect('.player-controls-hub'),
      pending: rect('[data-testid^="annotation-rebind-"]'),
      confirm: rect('[data-testid="annotation-confirm-rebind"]'),
    }
  })
  expect(layout.player).toBeTruthy()
  expect(layout.controls).toBeTruthy()
  expect(layout.pending).toBeTruthy()
  expect(layout.confirm).toBeTruthy()
  expect(rectanglesIntersect(layout.pending!, layout.player!)).toBe(false)
  expect(rectanglesIntersect(layout.pending!, layout.controls!)).toBe(false)
  expect(rectanglesIntersect(layout.confirm!, layout.player!)).toBe(false)
  expect(rectanglesIntersect(layout.confirm!, layout.controls!)).toBe(false)
}

function rectanglesIntersect(
  first: { left: number, right: number, top: number, bottom: number },
  second: { left: number, right: number, top: number, bottom: number },
) {
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top
}

function createTemporarySongFixture(songId: string, temporaryTitle: string, userId: string) {
  const sourceWhere = `source.id = ${sqlLiteral(sourceSongId)} AND source.album_id = ${sqlLiteral(albumId)}`
  expect(Number(runPsql(`SELECT count(*) FROM "Songs" source WHERE ${sourceWhere} AND source.deleted_at IS NULL;`))).toBe(1)
  const sourceHash = runPsql(`SELECT md5(row_to_json(source)::text) FROM "Songs" source WHERE ${sourceWhere} AND source.deleted_at IS NULL;`)
  expect(runPsql(`
    INSERT INTO "Songs" (id, created_at, updated_at, title, release_date, track_number, lyrics, audio_url, audio_source, cover_url, cover_source, batch_id, status, album_id, uploaded_by, play_count, duration_sec)
    SELECT ${sqlLiteral(songId)}, now(), now(), ${sqlLiteral(temporaryTitle)}, source.release_date,
      COALESCE((SELECT max(track_number) FROM "Songs" WHERE album_id = ${sqlLiteral(albumId)}), 0) + 1000,
      '', source.audio_url, source.audio_source, source.cover_url, source.cover_source, '', 'open', source.album_id,
      ${sqlLiteral(userId)}, 0, source.duration_sec
    FROM "Songs" source WHERE ${sourceWhere} AND source.deleted_at IS NULL RETURNING id;
  `)).toBe(songId)
  return sourceHash
}

async function createLocalAuthFixture(request: APIRequestContext, username: string, password: string): Promise<LocalAuthFixture> {
  const userId = runPsql(`
    INSERT INTO "Users" (uuid, username, email, password, role, is_active, onboarding_completed_at, created_at, updated_at, auth_version)
    VALUES (gen_random_uuid(), ${sqlLiteral(username)}, ${sqlLiteral(`${username}@example.test`)}, crypt(${sqlLiteral(password)}, gen_salt('bf', 10)), 'user', true, now(), now(), now(), 0)
    RETURNING uuid;
  `)
  try {
    const response = await request.post('/api/v1/auth/login', { data: { username, password } })
    expect(response.status()).toBe(200)
    const body = await response.json() as { token: string, user: Record<string, unknown> }
    return { token: body.token, user: body.user, userId }
  } catch (error) {
    runPsql(`DELETE FROM "Users" WHERE uuid = ${sqlLiteral(userId)};`)
    throw error
  }
}

function cleanupTemporaryFixture(songId: string, userIds: string[], sourceHash: string) {
  const usersList = userIds.map(sqlLiteral).join(', ') || 'NULL'
  runPsql(`
    BEGIN;
    DELETE FROM music_lyric_annotation_votes WHERE annotation_id IN (SELECT id FROM music_lyric_annotations WHERE song_id = ${sqlLiteral(songId)});
    DELETE FROM notifications
    WHERE (source_type = 'music_lyrics' AND source_id IN (SELECT id FROM music_lyric_annotations WHERE song_id = ${sqlLiteral(songId)}))
      OR recipient_id IN (${usersList});
    DELETE FROM music_lyric_annotations WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_song_lyric_lines WHERE lyric_id IN (SELECT id FROM music_song_lyrics WHERE song_id = ${sqlLiteral(songId)});
    DELETE FROM music_song_lyrics WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_song_lyric_versions WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM lyric_annotations WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_listening_histories WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_playlist_songs WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM music_song_bookmarks WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM song_artists WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM song_corrections WHERE song_id = ${sqlLiteral(songId)};
    DELETE FROM "Songs" WHERE id = ${sqlLiteral(songId)};
    DELETE FROM "Users" WHERE uuid IN (${usersList});
    COMMIT;
  `)
  const counts = runPsql(`
    SELECT concat_ws('|',
      (SELECT count(*) FROM "Songs" WHERE id = ${sqlLiteral(songId)}),
      (SELECT count(*) FROM "Users" WHERE uuid IN (${usersList})),
      (SELECT count(*) FROM music_song_lyrics WHERE song_id = ${sqlLiteral(songId)}),
      (SELECT count(*) FROM music_song_lyric_versions WHERE song_id = ${sqlLiteral(songId)}),
      (SELECT count(*) FROM notifications WHERE recipient_id IN (${usersList}))
    );
  `)
  expect(counts).toBe('0|0|0|0|0')
  if (sourceHash) {
    expect(runPsql(`SELECT md5(row_to_json(source)::text) FROM "Songs" source WHERE source.id = ${sqlLiteral(sourceSongId)} AND source.album_id = ${sqlLiteral(albumId)} AND source.deleted_at IS NULL;`)).toBe(sourceHash)
  }
}

function runPsql(sql: string) {
  const container = process.env.MUSIC_LYRICS_E2E_POSTGRES_CONTAINER ?? 'atoman-dev-postgres-1'
  const database = process.env.MUSIC_LYRICS_E2E_POSTGRES_DB ?? 'atoman_dev'
  const user = process.env.MUSIC_LYRICS_E2E_POSTGRES_USER ?? 'atoman'
  return execFileSync('docker', ['exec', container, 'psql', '-q', '-U', user, '-d', database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], { encoding: 'utf8' }).trim()
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}
