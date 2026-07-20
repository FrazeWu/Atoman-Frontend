import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { APIRequestContext, Browser, Page } from '@playwright/test'
import { expect, test } from '../fixtures/base'

const enabled = process.env.MUSIC_LYRICS_ANNOTATION_REBIND_E2E === '1'
const albumId = process.env.MUSIC_LYRICS_E2E_ALBUM_ID ?? ''
const sourceSongId = process.env.MUSIC_LYRICS_E2E_SOURCE_SONG_ID ?? ''

type LocalAuthFixture = {
  token: string
  userId: string
  username: string
  password: string
}

type InboxFixture = {
  annotationId: string
  lineKey: string
  sourceHash: string
}

test.describe('Music lyric annotation inbox real workflow', () => {
  test.skip(!enabled, 'requires MUSIC_LYRICS_ANNOTATION_REBIND_E2E=1 and a prepared local source song')

  test('opens a pending annotation from home and inbox, then clears it after rebinding', async ({ browser, page }) => {
    test.setTimeout(60_000)
    requirePreparedFixture()

    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
    const songId = randomUUID()
    const songTitle = `Annotation inbox E2E ${suffix}`
    const username = `annotation-inbox-${suffix}`
    const password = `Annotation-Inbox-${randomUUID()}!`
    let author: LocalAuthFixture | null = null
    let context: Awaited<ReturnType<Browser['newContext']>> | null = null
    let fixture: InboxFixture | null = null

    try {
      author = await createLocalAuthFixture(page.request, username, password)
      fixture = createPendingAnnotationFixture(songId, songTitle, author.userId)
      context = await createAuthenticatedContext(browser, author)
      const authorPage = await context.newPage()

      await authorPage.goto('/music', { waitUntil: 'domcontentloaded' })
      const pendingEntry = authorPage.getByTestId('music-pending-rebind')
      await expect(pendingEntry).toHaveText('待重新绑定 1')
      await pendingEntry.click()
      await expectTargetRoute(authorPage, songId, fixture.annotationId)
      await expect(authorPage.getByTestId('annotation-confirm-rebind')).toBeDisabled()
      await authorPage.getByTestId('annotation-cancel').click()

      await authorPage.goto('/inbox?tab=collaboration', { waitUntil: 'domcontentloaded' })
      await expect(authorPage.getByRole('heading', { name: '歌词修改影响了你的注释绑定', exact: true })).toBeVisible()
      await authorPage.getByRole('button', { name: '前往来源内容', exact: true }).click()
      await expectTargetRoute(authorPage, songId, fixture.annotationId)

      await selectTextInLine(authorPage, 'A ready target phrase', 'target phrase')
      const confirmRebind = authorPage.getByTestId('annotation-confirm-rebind')
      await expect(confirmRebind).toBeEnabled()
      const patchResponse = authorPage.waitForResponse(response => (
        response.request().method() === 'PATCH'
        && response.url().endsWith(`/api/v1/music/songs/${songId}/lyrics/annotations/${fixture!.annotationId}`)
      ))
      await confirmRebind.click()
      expect((await patchResponse).status()).toBe(200)

      const lyrics = await getLyrics(authorPage.request, songId, author.token)
      expect(lyrics.annotations.find(annotation => annotation.id === fixture!.annotationId)).toMatchObject({
        status: 'active', line_key: fixture.lineKey, selected_text: 'target phrase',
      })
      await authorPage.goto('/music', { waitUntil: 'domcontentloaded' })
      await expect(authorPage.getByTestId('music-pending-rebind')).toHaveCount(0)
    } finally {
      await context?.close()
      cleanupTemporaryFixture(songId, author?.userId ? [author.userId] : [], fixture?.sourceHash ?? '')
    }
  })
})

function requirePreparedFixture() {
  if (!albumId || !sourceSongId) throw new Error('启用真实注释收件箱 smoke 后必须提供 album ID 和 source song ID')
  if (process.env.MUSIC_LYRICS_E2E_LOCAL_DB_CLEANUP !== '1') throw new Error('真实注释收件箱 smoke 需要 MUSIC_LYRICS_E2E_LOCAL_DB_CLEANUP=1')
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error('真实注释收件箱 smoke 必须显式提供 PLAYWRIGHT_BASE_URL')
  const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL)
  if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(baseURL.hostname)) throw new Error(`拒绝对非本地地址执行数据库 fixture：${baseURL.origin}`)
}

async function createAuthenticatedContext(browser: Browser, auth: LocalAuthFixture) {
  const context = await browser.newContext()
  const baseURL = process.env.PLAYWRIGHT_BASE_URL!
  const response = await context.request.post(new URL('/api/v1/auth/login', baseURL).toString(), {
    data: { username: auth.username, password: auth.password },
    headers: { Origin: new URL(baseURL).origin },
  })
  expect(response.status()).toBe(200)
  return context
}

async function expectTargetRoute(page: Page, songId: string, annotationId: string) {
  await expect(page).toHaveURL(new RegExp(`/music/album/${albumId}\\?`))
  await expect(page).toHaveURL(new RegExp(`song_id=${songId}`))
  await expect(page).toHaveURL(new RegExp(`annotation_id=${annotationId}`))
  await expect(page.getByTestId('annotation-confirm-rebind')).toBeDisabled()
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

async function getLyrics(request: APIRequestContext, songId: string, token: string) {
  const response = await request.get(`/api/v1/music/songs/${songId}/lyrics`, { headers: { Authorization: `Bearer ${token}` } })
  expect(response.status()).toBe(200)
  return (await response.json() as { data: { annotations: Array<{ id: string, line_key: string, selected_text: string, status: string }> } }).data
}

function createPendingAnnotationFixture(songId: string, temporaryTitle: string, userId: string): InboxFixture {
  const lyricId = randomUUID()
  const lineId = randomUUID()
  const annotationId = randomUUID()
  const lineKey = `inbox-${randomUUID().slice(0, 8)}`
  const sourceWhere = `source.id = ${sqlLiteral(sourceSongId)} AND source.album_id = ${sqlLiteral(albumId)}`
  expect(Number(runPsql(`SELECT count(*) FROM "Songs" source WHERE ${sourceWhere} AND source.deleted_at IS NULL;`))).toBe(1)
  const sourceHash = runPsql(`SELECT md5(row_to_json(source)::text) FROM "Songs" source WHERE ${sourceWhere} AND source.deleted_at IS NULL;`)
  const content = '[00:01.00]A ready target phrase'
  const meta = JSON.stringify({
    song_id: songId,
    annotation_id: annotationId,
    album_id: albumId,
    title: '歌词修改影响了你的注释绑定',
    body: '请重新选择注释对应的歌词片段。',
    source_label: '歌词注释',
  })
  runPsql(`
    BEGIN;
    INSERT INTO "Songs" (id, created_at, updated_at, title, release_date, track_number, lyrics, audio_url, audio_source, cover_url, cover_source, batch_id, status, album_id, uploaded_by, play_count, duration_sec)
    SELECT ${sqlLiteral(songId)}, now(), now(), ${sqlLiteral(temporaryTitle)}, source.release_date,
      COALESCE((SELECT max(track_number) FROM "Songs" WHERE album_id = ${sqlLiteral(albumId)}), 0) + 1000,
      ${sqlLiteral(content)}, source.audio_url, source.audio_source, source.cover_url, source.cover_source, '', 'open', source.album_id,
      ${sqlLiteral(userId)}, 0, source.duration_sec
    FROM "Songs" source WHERE ${sourceWhere} AND source.deleted_at IS NULL;
    INSERT INTO music_song_lyrics (id, created_at, updated_at, song_id, content, translation, format, version, updated_by, edit_summary)
    VALUES (${sqlLiteral(lyricId)}, now(), now(), ${sqlLiteral(songId)}, ${sqlLiteral(content)}, '', 'lrc', 1, ${sqlLiteral(userId)}, '预置待重绑注释');
    INSERT INTO music_song_lyric_lines (id, created_at, updated_at, lyric_id, line_key, line_index, time_ms, text, translation)
    VALUES (${sqlLiteral(lineId)}, now(), now(), ${sqlLiteral(lyricId)}, ${sqlLiteral(lineKey)}, 0, 1000, 'A ready target phrase', '');
    INSERT INTO music_lyric_annotations (id, created_at, updated_at, song_id, line_id, selected_text, start_offset, end_offset, body, created_by, status)
    VALUES (${sqlLiteral(annotationId)}, now(), now(), ${sqlLiteral(songId)}, ${sqlLiteral(lineId)}, 'target', 8, 14, '从收件箱进入的注释', ${sqlLiteral(userId)}, 'needs_rebind');
    INSERT INTO notifications (id, created_at, updated_at, recipient_id, actor_id, type, source_type, source_id, meta, aggregation_key)
    VALUES (${sqlLiteral(randomUUID())}, now(), now(), ${sqlLiteral(userId)}, ${sqlLiteral(userId)}, 'collaboration.required', 'music_lyrics', ${sqlLiteral(annotationId)}, ${sqlLiteral(meta)}::jsonb, '');
    COMMIT;
  `)
  return { annotationId, lineKey, sourceHash }
}

async function createLocalAuthFixture(request: APIRequestContext, username: string, password: string): Promise<LocalAuthFixture> {
  const userId = runPsql(`
    INSERT INTO "Users" (uuid, username, email, password, role, is_active, onboarding_completed_at, created_at, updated_at, auth_version)
    VALUES (gen_random_uuid(), ${sqlLiteral(username)}, ${sqlLiteral(`${username}@example.test`)}, crypt(${sqlLiteral(password)}, gen_salt('bf', 10)), 'user', true, now(), now(), now(), 0)
    RETURNING uuid;
  `)
  try {
		const response = await request.post('/api/v1/auth/token', { data: { username, password } })
		expect(response.status()).toBe(200)
		const body = await response.json() as { token: string }
		return { token: body.token, userId, username, password }
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
    DELETE FROM notifications WHERE (source_type = 'music_lyrics' AND source_id IN (SELECT id FROM music_lyric_annotations WHERE song_id = ${sqlLiteral(songId)})) OR recipient_id IN (${usersList});
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
  expect(runPsql(`SELECT concat_ws('|', (SELECT count(*) FROM "Songs" WHERE id = ${sqlLiteral(songId)}), (SELECT count(*) FROM "Users" WHERE uuid IN (${usersList})), (SELECT count(*) FROM music_song_lyrics WHERE song_id = ${sqlLiteral(songId)}), (SELECT count(*) FROM music_song_lyric_versions WHERE song_id = ${sqlLiteral(songId)}), (SELECT count(*) FROM notifications WHERE recipient_id IN (${usersList})));`)).toBe('0|0|0|0|0')
  if (sourceHash) expect(runPsql(`SELECT md5(row_to_json(source)::text) FROM "Songs" source WHERE source.id = ${sqlLiteral(sourceSongId)} AND source.album_id = ${sqlLiteral(albumId)} AND source.deleted_at IS NULL;`)).toBe(sourceHash)
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
