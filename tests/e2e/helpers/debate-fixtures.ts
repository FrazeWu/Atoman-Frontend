import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { expect, type APIRequestContext } from '@playwright/test'

export type DebateSession = {
  token: string
  password: string
  user: Record<string, unknown>
  userId: string
}

export type SeededDebate = {
  id: string
  title: string
  current_revision_id: string
}

export type DebateFixture = {
  sessions: DebateSession[]
  source: SeededDebate
  target: SeededDebate
}

type LoginResponse = {
  token: string
  user: Record<string, unknown>
}

type VoteSummary = {
  current_direction: 'yes' | 'no' | ''
}

export function requireLocalDebateFixture() {
  if (process.env.DEBATE_WIKI_E2E !== '1') {
    throw new Error('必须设置 DEBATE_WIKI_E2E=1')
  }

  const configuredURL = process.env.PLAYWRIGHT_BASE_URL
  if (!configuredURL) throw new Error('必须设置 PLAYWRIGHT_BASE_URL')
  const baseURL = new URL(configuredURL)
  if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(baseURL.hostname)) {
    throw new Error(`拒绝对非本地地址执行数据库 fixture：${baseURL.origin}`)
  }

  if (process.env.DOCKER_HOST) assertLocalDockerEndpoint(process.env.DOCKER_HOST)
  const context = execFileSync('docker', ['context', 'show'], { encoding: 'utf8' }).trim()
  const endpoint = execFileSync('docker', [
    'context', 'inspect',
    '--format', '{{ (index .Endpoints "docker").Host }}',
    context,
  ], { encoding: 'utf8' }).trim()
  assertLocalDockerEndpoint(endpoint)
}

export function assertLocalDockerEndpoint(endpoint: string) {
  if (!endpoint.trim().startsWith('unix://')) {
    throw new Error(`拒绝对非本机 Docker daemon 执行数据库 fixture：${endpoint || '未配置 endpoint'}`)
  }
}

export async function createDebateFixture(request: APIRequestContext): Promise<DebateFixture> {
  requireLocalDebateFixture()
  runPsql('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const password = `Debate-E2E-${randomUUID()}!`
  const sessions: DebateSession[] = []
  const userIDs: string[] = []
  const debateIDs: string[] = []

  try {
    for (let index = 0; index < 10; index += 1) {
      const username = `debate-e2e-${index}-${suffix}`
      const userId = runPsql(`
        INSERT INTO "Users" (uuid, username, email, password, role, is_active, onboarding_completed_at, created_at, updated_at, auth_version)
        VALUES (gen_random_uuid(), ${sqlLiteral(username)}, ${sqlLiteral(`${username}@example.test`)}, crypt(${sqlLiteral(password)}, gen_salt('bf', 10)), 'user', true, now(), now(), now(), 0)
        RETURNING uuid;
      `)
      userIDs.push(userId)

      const loggedIn = await api<LoginResponse>(request, 'POST', '/api/v1/auth/token', null, { username, password }, {
        'X-Forwarded-For': `127.0.0.${index + 10}`,
      })
      sessions.push({ ...loggedIn, password, userId })
    }

    const source = await createDebate(
      request,
      sessions[0]!.token,
      `吸烟会不会显著增加肺癌风险？ ${suffix}`,
    )
    debateIDs.push(source.id)
    expect(source.current_revision_id).toBeTruthy()
    for (const [index, session] of sessions.entries()) {
      await setVote(request, session.token, source.id, index < 8 ? 'yes' : 'no')
    }
    const sourceVotes = await api<VoteSummary>(
      request,
      'GET',
      `/api/v1/debate/topics/${source.id}/votes`,
      sessions[0]!.token,
    )
    expect(sourceVotes.current_direction).toBe('yes')

    const target = await createDebate(
      request,
      sessions[0]!.token,
      `公共场所是否应该全面禁烟？ ${suffix}`,
    )
    debateIDs.push(target.id)
    expect(target.current_revision_id).toBeTruthy()
    return { sessions, source, target }
  } catch (error) {
    cleanupFixtureRows(debateIDs, userIDs)
    throw error
  }
}

export async function saveWikiReference(request: APIRequestContext, fixture: DebateFixture) {
  const updated = await api<SeededDebate>(
    request,
    'PUT',
    `/api/v1/debate/topics/${fixture.target.id}`,
    fixture.sessions[0]!.token,
    {
      title: fixture.target.title,
      description: '',
      content: `已有医学结论：@debate:${fixture.source.id}:support`,
      tags: [],
      edit_summary: '引用已有结论',
      base_revision: fixture.target.current_revision_id,
    },
  )
  expect(updated.current_revision_id).toBeTruthy()
  expect(updated.current_revision_id).not.toBe(fixture.target.current_revision_id)
  fixture.target = updated
  return updated
}

export async function flipSourceConclusion(request: APIRequestContext, fixture: DebateFixture) {
  for (const session of fixture.sessions.slice(0, 8)) {
    await setVote(request, session.token, fixture.source.id, 'no')
  }
  const votes = await api<VoteSummary>(
    request,
    'GET',
    `/api/v1/debate/topics/${fixture.source.id}/votes`,
    fixture.sessions[0]!.token,
  )
  expect(votes.current_direction).toBe('no')
}

export function cleanupDebateFixture(fixture: DebateFixture) {
  requireLocalDebateFixture()
  cleanupFixtureRows(
    [fixture.source.id, fixture.target.id],
    fixture.sessions.map(session => session.userId),
  )
}

async function createDebate(request: APIRequestContext, token: string, title: string) {
  return api<SeededDebate>(request, 'POST', '/api/v1/debate/topics', token, {
    title,
    description: '',
    content: '',
    tags: [],
  })
}

async function setVote(
  request: APIRequestContext,
  token: string,
  debateID: string,
  direction: 'yes' | 'no',
) {
  await api<VoteSummary>(request, 'PUT', `/api/v1/debate/topics/${debateID}/vote`, token, { direction })
}

async function api<T>(
  request: APIRequestContext,
  method: string,
  path: string,
  token: string | null,
  data?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await request.fetch(path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(data === undefined ? {} : { data }),
  })
  if (!response.ok()) {
    throw new Error(`${method} ${path}: ${response.status()} ${await response.text()}`)
  }

  const body = await response.json() as T | { data: T }
  if (body !== null && typeof body === 'object' && 'data' in body) return body.data
  return body as T
}

function cleanupFixtureRows(debateIDs: string[], userIDs: string[]) {
  const debateList = sqlList(debateIDs)
  const userList = sqlList(userIDs)
  const fixtureDebates = `SELECT id FROM debates WHERE id IN (${debateList}) OR user_id IN (${userList})`
  runPsql(`
    BEGIN;
    DELETE FROM debate_revision_references
      WHERE debate_id IN (${fixtureDebates})
         OR revision_id IN (SELECT id FROM revisions WHERE content_type = 'debate' AND content_id IN (${fixtureDebates}));
    DELETE FROM debate_relations
      WHERE source_debate_id IN (${fixtureDebates}) OR target_debate_id IN (${fixtureDebates});
    DELETE FROM debate_conclusion_events WHERE debate_id IN (${fixtureDebates});
    DELETE FROM debate_votes WHERE debate_id IN (${fixtureDebates});
    DELETE FROM content_protections WHERE content_type = 'debate' AND content_id IN (${fixtureDebates});
    DELETE FROM revisions WHERE content_type = 'debate' AND content_id IN (${fixtureDebates});
    DELETE FROM debates WHERE id IN (${debateList}) OR user_id IN (${userList});
    DELETE FROM "Users" WHERE uuid IN (${userList});
    COMMIT;
  `)
}

function runPsql(sql: string) {
  return execFileSync('docker', buildLocalPsqlArgs(sql), { encoding: 'utf8' }).trim()
}

export function buildLocalPsqlArgs(sql: string) {
  return [
    'exec', process.env.DEBATE_E2E_POSTGRES_CONTAINER ?? 'atoman-dev-postgres-1',
    'psql', '-q',
    '-h', '/var/run/postgresql',
    '-U', process.env.DEBATE_E2E_POSTGRES_USER ?? 'atoman',
    '-d', process.env.DEBATE_E2E_POSTGRES_DB ?? 'atoman_dev',
    '-v', 'ON_ERROR_STOP=1',
    '-At', '-c', sql,
  ]
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function sqlList(values: string[]) {
  return values.length > 0 ? values.map(sqlLiteral).join(', ') : 'NULL'
}
