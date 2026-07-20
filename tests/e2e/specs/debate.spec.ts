import type { Page, Response } from '@playwright/test'

import { expect, test } from '../fixtures/base'
import {
  cleanupDebateFixture,
  createDebateFixture,
  type DebateSession,
} from '../helpers/debate-fixtures'

test.describe('Debate', () => {
  test('browse debates home page', async ({ page }) => {
    await gotoDebateHome(page)
    await expect(page.getByRole('heading', { name: '辩论', exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('标签筛选')).toBeVisible()
  })

  test('filter debates by active and archived status', async ({ page }) => {
    await gotoDebateHome(page)

    const statusTrigger = page.getByRole('button', { name: '全部状态' })
    await statusTrigger.click()
    await expect(page.getByRole('option')).toHaveCount(3)
    await expect(page.getByRole('option', { name: '开放', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: '已归档', exact: true })).toBeVisible()

    await page.getByRole('option', { name: '开放', exact: true }).click()
    const activeResponse = page.waitForResponse(response => {
      const url = new URL(response.url())
      return response.request().method() === 'GET'
        && url.pathname.endsWith('/api/v1/debate/topics')
        && url.searchParams.get('status') === 'active'
    })
    await page.getByRole('button', { name: '筛选' }).click()
    await expectDebateStatusResponse(await activeResponse, 'active')

    await statusTrigger.click()
    await page.getByRole('option', { name: '已归档', exact: true }).click()
    const archivedResponse = page.waitForResponse(response => {
      const url = new URL(response.url())
      return response.request().method() === 'GET'
        && url.pathname.endsWith('/api/v1/debate/topics')
        && url.searchParams.get('status') === 'archived'
    })
    await page.getByRole('button', { name: '筛选' }).click()
    await expectDebateStatusResponse(await archivedResponse, 'archived')
  })

  test('shows an empty state or debate entries', async ({ page }) => {
    await gotoDebateHome(page)
    await expect(page.getByText('暂无辩题', { exact: true }).or(page.locator('.p-entry').first())).toBeVisible()
  })

  test('creates a debate and opens its current wiki views', async ({ page, request }) => {
    test.skip(process.env.DEBATE_WIKI_E2E !== '1', 'requires local PostgreSQL and DEBATE_WIKI_E2E=1')
    test.setTimeout(90_000)
    const fixture = await createDebateFixture(request)

    try {
      await authenticatePage(page, fixture.sessions[0]!)
      await gotoDebateHome(page)
      await page.getByRole('button', { name: '新建辩题' }).click()
      await expect(page.getByRole('heading', { name: '新建辩题' })).toBeVisible()

      const title = `E2E 辩题 ${Date.now()}`
      await page.getByPlaceholder('长期吸烟会不会显著增加肺癌风险？').fill(title)
      await page.locator('textarea').fill('这是 E2E 创建的正文。')
      await page.getByPlaceholder('医学，公共健康').fill('测试,E2E')

      const created = page.waitForResponse(response => (
        response.request().method() === 'POST'
        && new URL(response.url()).pathname.endsWith('/api/v1/debate/topics')
      ))
      await page.getByRole('button', { name: '创建', exact: true }).click()
      expect((await created).status()).toBe(201)

      await expect(page).toHaveURL(/\/debate\/[0-9a-f-]+$/)
      await expect(page.getByRole('heading', { name: title })).toBeVisible()
      await expectCurrentDebateViews(page)
    } finally {
      cleanupDebateFixture(fixture)
    }
  })

  test('view debate detail page', async ({ authenticatedPage }) => {
    const opened = await openFirstDebate(authenticatedPage)
    test.skip(!opened, 'requires at least one debate')
    await expectCurrentDebateViews(authenticatedPage)
  })

  test('vote yes or no on the debate', async ({ page, request }) => {
    test.skip(process.env.DEBATE_WIKI_E2E !== '1', 'requires local PostgreSQL and DEBATE_WIKI_E2E=1')
    test.setTimeout(90_000)
    const fixture = await createDebateFixture(request)

    try {
      await authenticatePage(page, fixture.sessions[0]!)
      const detailResponse = page.waitForResponse(response => (
        response.request().method() === 'GET'
        && new URL(response.url()).pathname.endsWith(`/api/v1/debate/topics/${fixture.target.id}`)
      ))
      await page.goto(`/debate/${fixture.target.id}`)
      expect((await detailResponse).ok()).toBeTruthy()

      const yes = page.locator('[data-test="vote-yes"]')
      const no = page.locator('[data-test="vote-no"]')
      await expect(yes).toBeVisible()
      await expect(no).toBeVisible()

      const voteResponse = page.waitForResponse(response => (
        response.request().method() === 'PUT'
        && new URL(response.url()).pathname.endsWith(`/api/v1/debate/topics/${fixture.target.id}/vote`)
      ))
      await yes.click()
      expect((await voteResponse).ok()).toBeTruthy()
      await expect(page.locator('[data-test="current-user-vote"]')).toHaveText('是')
    } finally {
      cleanupDebateFixture(fixture)
    }
  })
})

async function gotoDebateHome(page: Page) {
  const debatesResponse = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname.endsWith('/api/v1/debate/topics')
  ))
  await page.goto('/debate')
  expect((await debatesResponse).ok()).toBeTruthy()
}

async function expectDebateStatusResponse(response: Response, status: 'active' | 'archived') {
  expect(response.ok()).toBeTruthy()
  const body = await response.json() as { data?: Array<{ status?: string }> }
  expect(Array.isArray(body.data)).toBeTruthy()
  expect((body.data ?? []).every(item => item.status === status)).toBeTruthy()
}

async function authenticatePage(page: Page, session: DebateSession) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, session)
}

async function openFirstDebate(page: Page) {
  await gotoDebateHome(page)
  const firstDebate = page.locator('.p-entry').first()
  await expect(firstDebate.or(page.getByText('暂无辩题', { exact: true }))).toBeVisible()
  if (!await firstDebate.isVisible()) return false

  const detailResponse = page.waitForResponse(response => (
    response.request().method() === 'GET'
    && /\/api\/v1\/debate\/topics\/[0-9a-f-]+$/.test(new URL(response.url()).pathname)
  ))
  await firstDebate.click()
  expect((await detailResponse).ok()).toBeTruthy()
  await expect(page).toHaveURL(/\/debate\/[0-9a-f-]+$/)
  return true
}

async function expectCurrentDebateViews(page: Page) {
  await expect(page.getByRole('tab', { name: '正文' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '辩论树' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '关系图' })).toBeVisible()
  await page.getByRole('button', { name: '讨论' }).click()
  const discussion = page.getByRole('dialog', { name: '讨论' })
  await expect(discussion).toBeVisible()
  await discussion.getByRole('button', { name: '关闭讨论' }).click()
  await expect(discussion).toHaveCount(0)
}
