import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test'
import { expect, test } from '../fixtures/base'

const enabled = process.env.DM_REAL_E2E === '1'
const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0'])

type LocalUser = { id: string; username: string; password: string; csrf: string; context: BrowserContext }
type DMMessage = { id: string; conversation_id: string; sender_type: string; sender_id: string; client_message_id: string; content: string; image_id?: string }
type Fixture = { sender: LocalUser; recipient: LocalUser; owner: LocalUser; admin: LocalUser; channelID: string; imageObjectKeys: string[] }

test.describe('DM v2 real workflow', () => {
  test.skip(!enabled, 'requires DM_REAL_E2E=1, DM_E2E_LOCAL_DB_CLEANUP=1, and local PostgreSQL/MinIO')

  test('covers personal and channel messaging, private media, pagination, blocking, and moderation', async ({ browser, page }) => {
    test.setTimeout(120_000)
    requireLocalEnvironment()
    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
    let fixture: Fixture | null = null

    try {
      fixture = await createFixture(browser, page.request, suffix)
      const senderPage = await fixture.sender.context.newPage()
      const recipientPage = await fixture.recipient.context.newPage()
      const ownerPage = await fixture.owner.context.newPage()

      // Recipient is already listening before the sender creates the first conversation.
      await recipientPage.goto('/inbox?tab=dm', { waitUntil: 'domcontentloaded' })
      await expect(recipientPage.getByTestId('dm-conversation-list')).toBeVisible()
      await senderPage.goto(`/inbox?tab=dm&target_type=user&target_id=${fixture.recipient.id}`, { waitUntil: 'domcontentloaded' })
      await senderPage.getByPlaceholder('输入私信').fill('真实个人私信')
      await senderPage.getByRole('button', { name: '发送' }).click()

      await expect(recipientPage.getByTestId('dm-conversation-list')).toContainText(fixture.sender.username, { timeout: 15_000 })
      const personalConversationID = await conversationIDFor(fixture.sender.id, fixture.recipient.id, 'user')
      await recipientPage.getByTestId(`dm-conversation-${personalConversationID}`).click()
      await expect(recipientPage.locator('.dm-message')).toContainText('真实个人私信')
      await expect(recipientPage.locator('.dm-conversation-list__unread')).toHaveCount(0)
      await expect.poll(() => countRows(`SELECT count(*) FROM dm_messages WHERE conversation_id = ${sql(personalConversationID)} AND read_at IS NOT NULL`)).toBe(1)

      const idempotencyKey = randomUUID()
      const idempotentFirst = await send(fixture.sender, `/api/v1/dm/conversations/${personalConversationID}/messages`, { client_message_id: idempotencyKey, content: '幂等消息' })
      const idempotentSecond = await send(fixture.sender, `/api/v1/dm/conversations/${personalConversationID}/messages`, { client_message_id: idempotencyKey, content: '幂等消息' })
      expect(idempotentSecond.id).toBe(idempotentFirst.id)
      expect(countRows(`SELECT count(*) FROM dm_messages WHERE actor_user_id = ${sql(fixture.sender.id)} AND client_message_id = ${sql(idempotencyKey)}`)).toBe(1)

      // A fresh target is limited to one outgoing message until it replies.
      const waitingFirst = await send(fixture.sender, `/api/v1/dm/targets/user/${fixture.owner.id}/messages`, { client_message_id: randomUUID(), content: '首条等待消息' })
      const waitingSecond = await post(fixture.sender, `/api/v1/dm/conversations/${waitingFirst.conversation_id}/messages`, { client_message_id: randomUUID(), content: '不应发送的第二条' })
      expect(waitingSecond.status()).toBe(403)
      expect((await waitingSecond.json() as { error: { code: string } }).error.code).toBe('dm.waiting_reply')

      // Channel conversations are initiated by a user, while the owner replies as the channel.
      await senderPage.goto(`/inbox?tab=dm&target_type=channel&target_id=${fixture.channelID}`, { waitUntil: 'domcontentloaded' })
      await senderPage.getByPlaceholder('输入私信').fill('发给频道的真实私信')
      await senderPage.getByRole('button', { name: '发送' }).click()
      const channelConversationID = await conversationIDFor(fixture.sender.id, fixture.channelID, 'channel')
      await ownerPage.goto(`/inbox?tab=dm&mailbox=channel:${fixture.channelID}&conversation=${channelConversationID}`, { waitUntil: 'domcontentloaded' })
      await expect(ownerPage.getByTestId('dm-conversation-list')).toContainText(fixture.sender.username, { timeout: 15_000 })
      await expect(ownerPage.getByTestId('dm-reply-as')).toContainText('将以频道 E2E')
      await ownerPage.getByPlaceholder('输入私信').fill('频道回复')
      await ownerPage.getByRole('button', { name: '发送' }).click()
      await expect(senderPage.locator('.dm-message')).toContainText('频道回复', { timeout: 15_000 })
      const channelMessages = await getMessages(fixture.sender, channelConversationID)
      expect(channelMessages.items.some((message) => message.content === '频道回复' && message.sender_type === 'channel' && message.sender_id === fixture.channelID)).toBe(true)

      const image = await uploadPNG(fixture.sender)
      fixture.imageObjectKeys.push(runPsql(`SELECT object_key FROM dm_images WHERE id = ${sql(image.id)}`))
      const imageMessage = await send(fixture.sender, `/api/v1/dm/conversations/${channelConversationID}/messages`, { client_message_id: randomUUID(), content: '', image_id: image.id })
      expect(imageMessage.image_id).toBe(image.id)
      expect((await get(fixture.sender, `/api/v1/dm/images/${image.id}/content`)).status()).toBe(200)
      const anonymous = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL })
      try {
        const denied = await anonymous.request.get(`/api/v1/dm/images/${image.id}/content`)
        expect(denied.status()).toBe(401)
      } finally {
        await anonymous.close()
      }

      seedOlderMessages(personalConversationID, fixture.sender.id, fixture.recipient.id)
      await recipientPage.goto(`/inbox?tab=dm&conversation=${personalConversationID}`, { waitUntil: 'domcontentloaded' })
      await expect(recipientPage.getByTestId('dm-load-older')).toBeVisible()
      const beforeLoad = await recipientPage.locator('.dm-conversation-pane__messages').evaluate(element => element.scrollHeight)
      await recipientPage.getByTestId('dm-load-older').click()
      await expect(recipientPage.locator('.dm-message')).toContainText('分页早期消息 0')
      const afterLoad = await recipientPage.locator('.dm-conversation-pane__messages').evaluate(element => element.scrollHeight)
      expect(afterLoad).toBeGreaterThanOrEqual(beforeLoad)

      const blocked = await put(fixture.sender, `/api/v1/dm/conversations/${personalConversationID}/block`)
      expect(blocked.status()).toBe(200)
      const blockedSend = await post(fixture.sender, `/api/v1/dm/conversations/${personalConversationID}/messages`, { client_message_id: randomUUID(), content: '拉黑后不可发送' })
      expect(blockedSend.status()).toBe(403)
      expect((await blockedSend.json() as { error: { code: string } }).error.code).toBe('dm.blocked')
      expect((await del(fixture.sender, `/api/v1/dm/conversations/${personalConversationID}/block`)).status()).toBe(200)

      const reply = channelMessages.items.find((message) => message.content === '频道回复')!
      expect((await post(fixture.sender, `/api/v1/dm/messages/${reply.id}/reports`, { reason: 'spam', detail: '真实 E2E 举报' })).status()).toBe(201)
      const reports = await get(fixture.admin, '/api/v1/admin/dm/reports')
      expect(reports.status()).toBe(200)
      const report = (await reports.json() as { data: { items: Array<{ id: string; message_id: string; reported_actor_user_id: string; snapshot_content: string }> } }).data.items.find(item => item.message_id === reply.id)
      expect(report).toMatchObject({ reported_actor_user_id: fixture.owner.id, snapshot_content: '频道回复' })
      const reviewed = await put(fixture.admin, `/api/v1/admin/dm/reports/${report!.id}`, { status: 'resolved' })
      expect(reviewed.status()).toBe(200)
      expect(countRows(`SELECT count(*) FROM dm_message_reports WHERE id = ${sql(report!.id)} AND status = 'resolved' AND reviewed_by_user_id = ${sql(fixture.admin.id)}`)).toBe(1)
    } finally {
      await fixture?.sender.context.close()
      await fixture?.recipient.context.close()
      await fixture?.owner.context.close()
      await fixture?.admin.context.close()
      if (fixture) cleanupFixture(fixture)
    }
  })
})

function requireLocalEnvironment() {
  if (process.env.DM_E2E_LOCAL_DB_CLEANUP !== '1') throw new Error('真实 DM 测试需要 DM_E2E_LOCAL_DB_CLEANUP=1')
  if (!process.env.PLAYWRIGHT_BASE_URL) throw new Error('真实 DM 测试必须显式提供 PLAYWRIGHT_BASE_URL')
  const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL)
  if (!localHosts.has(baseURL.hostname)) throw new Error(`拒绝对非本地地址执行 DM fixture：${baseURL.origin}`)
}

async function createFixture(browser: Browser, request: APIRequestContext, suffix: string): Promise<Fixture> {
  const password = `DM-E2E-${randomUUID()}!`
  const users: LocalUser[] = []
  let channelID = ''
  try {
    users.push(await createUser(browser, request, `dm-sender-${suffix}`, password, 'user'))
    users.push(await createUser(browser, request, `dm-recipient-${suffix}`, password, 'user'))
    users.push(await createUser(browser, request, `dm-owner-${suffix}`, password, 'user'))
    users.push(await createUser(browser, request, `dm-admin-${suffix}`, password, 'admin'))
    channelID = randomUUID()
    runPsql(`INSERT INTO channels (id, created_at, updated_at, user_id, name, slug, description) VALUES (${sql(channelID)}, now(), now(), ${sql(users[2]!.id)}, '频道 E2E ${suffix}', ${sql(`dm-channel-${suffix}`)}, '');`)
    return { sender: users[0]!, recipient: users[1]!, owner: users[2]!, admin: users[3]!, channelID, imageObjectKeys: [] }
  } catch (error) {
    await Promise.all(users.map(user => user.context.close()))
    cleanupFixtureRows(users, channelID, [])
    throw error
  }
}

async function createUser(browser: Browser, request: APIRequestContext, username: string, password: string, role: 'user' | 'admin'): Promise<LocalUser> {
  const email = `${username}@example.test`
  const verificationCode = '123456'
  const authCodeSecret = process.env.DM_E2E_AUTH_CODE_SECRET
  if (!authCodeSecret) throw new Error('真实 DM 测试需要 DM_E2E_AUTH_CODE_SECRET，与后端 AUTH_CODE_SECRET 保持一致')
  const digest = createHmac('sha256', authCodeSecret).update(`${email}\0registration\0${verificationCode}`).digest('hex')
  runPsql(`INSERT INTO email_verification_codes (uuid, email, purpose, code, failed_attempts, expires_at, used, created_at) VALUES (gen_random_uuid(), ${sql(email)}, 'registration', ${sql(digest)}, 0, now() + interval '10 minutes', false, now());`)
  const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL })
  const response = await context.request.post('/api/v1/auth/register', { data: { username, email, password, password_confirm: password, verification_code: verificationCode }, headers: { Origin: new URL(process.env.PLAYWRIGHT_BASE_URL!).origin } })
  expect(response.status()).toBe(201)
  const body = await response.json() as { csrf_token: string; user: { uuid: string } }
  if (role === 'admin') runPsql(`UPDATE "Users" SET role = 'admin' WHERE uuid = ${sql(body.user.uuid)};`)
  return { id: body.user.uuid, username, password, csrf: body.csrf_token, context }
}

function headers(user: LocalUser) { return { Origin: new URL(process.env.PLAYWRIGHT_BASE_URL!).origin, 'X-CSRF-Token': user.csrf } }
function get(user: LocalUser, path: string) { return user.context.request.get(path) }
function post(user: LocalUser, path: string, data: unknown) { return user.context.request.post(path, { data, headers: headers(user) }) }
function put(user: LocalUser, path: string, data?: unknown) { return user.context.request.put(path, { ...(data === undefined ? {} : { data }), headers: headers(user) }) }
function del(user: LocalUser, path: string) { return user.context.request.delete(path, { headers: headers(user) }) }
async function send(user: LocalUser, path: string, data: unknown): Promise<DMMessage> { const response = await post(user, path, data); expect(response.status()).toBe(201); return (await response.json() as { data: DMMessage }).data }
async function getMessages(user: LocalUser, conversationID: string) { const response = await get(user, `/api/v1/dm/conversations/${conversationID}/messages?limit=100`); expect(response.status()).toBe(200); return (await response.json() as { data: { items: DMMessage[] } }).data }

async function uploadPNG(user: LocalUser) {
  const response = await user.context.request.post('/api/v1/dm/images', { multipart: { image: { name: 'dm-e2e.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL0XQAAAABJRU5ErkJggg==', 'base64') } }, headers: headers(user) })
  expect(response.status()).toBe(201)
  return (await response.json() as { data: { id: string } }).data
}

async function conversationIDFor(userID: string, targetID: string, targetType: 'user' | 'channel') {
  const first = targetType === 'user' && userID > targetID ? targetID : userID
  const second = targetType === 'user' && userID > targetID ? userID : targetID
  const type = targetType === 'user' ? 'user' : 'channel'
  const query = `SELECT id FROM dm_conversations WHERE participant_a_type = 'user' AND participant_a = ${sql(first)} AND participant_b_type = ${sql(type)} AND participant_b = ${sql(second)} LIMIT 1;`
  await expect.poll(() => runPsql(query), { timeout: 15_000 }).not.toBe('')
  return runPsql(query)
}

function seedOlderMessages(conversationID: string, senderID: string, recipientID: string) {
  runPsql(`
    INSERT INTO dm_messages (id, conversation_id, sender_type, sender_id, actor_user_id, client_message_id, content, created_at, updated_at)
    SELECT gen_random_uuid(), ${sql(conversationID)}, 'user', CASE WHEN number % 2 = 0 THEN ${sql(senderID)}::uuid ELSE ${sql(recipientID)}::uuid END, CASE WHEN number % 2 = 0 THEN ${sql(senderID)}::uuid ELSE ${sql(recipientID)}::uuid END, gen_random_uuid(), '分页早期消息 ' || number, now() - interval '2 hours' - number * interval '1 second', now() - interval '2 hours' - number * interval '1 second' FROM generate_series(0, 34) number;
  `)
}

function cleanupFixture(fixture: Fixture) {
  cleanupFixtureRows([fixture.sender, fixture.recipient, fixture.owner, fixture.admin], fixture.channelID, fixture.imageObjectKeys)
}

function cleanupFixtureRows(createdUsers: LocalUser[], channelID: string, imageObjectKeys: string[]) {
  const users = createdUsers.map(user => sql(user.id)).join(', ') || 'NULL'
  const channel = channelID ? sql(channelID) : 'NULL::uuid'
  const objectErrors = imageObjectKeys.flatMap(key => {
    try { deletePrivateImageObject(key); return [] } catch (error) { return [error] }
  })
  runPsql(`
    BEGIN;
    DELETE FROM notifications WHERE recipient_id IN (${users}) OR actor_id IN (${users});
    DELETE FROM dm_message_reports WHERE reporter_user_id IN (${users}) OR reported_actor_user_id IN (${users}) OR message_id IN (SELECT id FROM dm_messages WHERE conversation_id IN (SELECT id FROM dm_conversations WHERE participant_a IN (${users}) OR participant_b IN (${users})));
    DELETE FROM user_blocks WHERE blocker_id IN (${users}) OR blocked_id IN (${users});
    DELETE FROM dm_messages WHERE conversation_id IN (SELECT id FROM dm_conversations WHERE participant_a IN (${users}) OR participant_b IN (${users}));
    DELETE FROM dm_images WHERE uploaded_by_user_id IN (${users});
    DELETE FROM dm_channel_settings WHERE channel_id = ${channel};
    DELETE FROM dm_conversations WHERE participant_a IN (${users}) OR participant_b IN (${users});
    DELETE FROM auth_sessions WHERE user_id IN (${users});
    DELETE FROM user_settings WHERE user_id IN (${users});
    DELETE FROM user_studio_states WHERE user_id IN (${users});
    DELETE FROM collections WHERE created_by IN (${users}) OR channel_id IN (SELECT id FROM channels WHERE user_id IN (${users}));
    DELETE FROM channels WHERE user_id IN (${users});
    DELETE FROM bookmark_folders WHERE user_id IN (${users});
    DELETE FROM subscriptions WHERE user_id IN (${users});
    DELETE FROM subscription_groups WHERE user_id IN (${users});
    DELETE FROM feed_sources WHERE source_id IN (${users});
    DELETE FROM music_playlists WHERE user_id IN (${users});
    DELETE FROM email_verification_codes WHERE email LIKE 'dm-%@example.test';
    DELETE FROM "Users" WHERE uuid IN (${users});
    COMMIT;
  `)
  expect(countRows(`SELECT count(*) FROM "Users" WHERE uuid IN (${users})`)).toBe(0)
  expect(countRows(`SELECT count(*) FROM dm_conversations WHERE participant_a IN (${users}) OR participant_b IN (${users})`)).toBe(0)
  if (objectErrors.length) throw new AggregateError(objectErrors, '私有图片对象清理失败')
}

function countRows(query: string) { return Number(runPsql(query)) }
function runPsql(query: string) { return execFileSync('docker', ['exec', process.env.DM_E2E_POSTGRES_CONTAINER ?? 'atoman-dev-postgres-1', 'psql', '-q', '-h', '/var/run/postgresql', '-U', process.env.DM_E2E_POSTGRES_USER ?? 'atoman', '-d', process.env.DM_E2E_POSTGRES_DB ?? 'atoman_dev', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query], { encoding: 'utf8' }).trim() }
function sql(value: string) { return `'${value.replaceAll("'", "''")}'` }

function deletePrivateImageObject(key: string) {
  if (!key) return
  const minio = process.env.DM_E2E_MINIO_CONTAINER ?? 'atoman-dev-minio-1'
  const network = execFileSync('docker', ['inspect', '-f', '{{range $name, $config := .NetworkSettings.Networks}}{{$name}}{{end}}', minio], { encoding: 'utf8' }).trim()
  const bucket = process.env.DM_E2E_DM_S3_BUCKET ?? 'atoman-dm-dev'
  execFileSync('docker', ['run', '--rm', '--network', network, '--entrypoint', '/bin/sh', 'minio/mc:latest', '-c', `mc alias set local http://${minio}:9000 minioadmin minioadmin >/dev/null && mc rm --force local/${bucket}/${key}`], { stdio: 'pipe' })
}
