import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/base'

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
    const activeRequest = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/api/v1/debate/topics') && url.searchParams.get('status') === 'active'
    })
    await page.getByRole('button', { name: '筛选' }).click()
    await activeRequest

    await statusTrigger.click()
    await page.getByRole('option', { name: '已归档', exact: true }).click()
    const archivedRequest = page.waitForRequest(request => {
      const url = new URL(request.url())
      return url.pathname.endsWith('/api/v1/debate/topics') && url.searchParams.get('status') === 'archived'
    })
    await page.getByRole('button', { name: '筛选' }).click()
    await archivedRequest
  })

  test('shows an empty state or debate entries', async ({ page }) => {
    await gotoDebateHome(page)
    await expect(page.getByText('暂无辩题', { exact: true }).or(page.locator('.p-entry').first())).toBeVisible()
  })

  test('creates a debate and opens its current wiki views', async ({ authenticatedPage }) => {
    await gotoDebateHome(authenticatedPage)
    await authenticatedPage.getByRole('button', { name: '新建辩题' }).click()
    await expect(authenticatedPage.getByRole('heading', { name: '新建辩题' })).toBeVisible()

    const title = `E2E 辩题 ${Date.now()}`
    await authenticatedPage.getByPlaceholder('长期吸烟会不会显著增加肺癌风险？').fill(title)
    await authenticatedPage.locator('textarea').fill('这是 E2E 创建的正文。')
    await authenticatedPage.getByPlaceholder('医学，公共健康').fill('测试,E2E')

    const created = authenticatedPage.waitForResponse(response => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith('/api/v1/debate/topics')
    ))
    await authenticatedPage.getByRole('button', { name: '创建', exact: true }).click()
    expect((await created).status()).toBe(201)

    await expect(authenticatedPage).toHaveURL(/\/debate\/[0-9a-f-]+$/)
    await expect(authenticatedPage.getByRole('heading', { name: title })).toBeVisible()
    await expectCurrentDebateViews(authenticatedPage)
  })

  test('view debate detail page', async ({ authenticatedPage }) => {
    const opened = await openFirstDebate(authenticatedPage)
    test.skip(!opened, 'requires at least one debate')
    await expectCurrentDebateViews(authenticatedPage)
  })

  test('vote yes or no on the debate', async ({ authenticatedPage }) => {
    const opened = await openFirstDebate(authenticatedPage)
    test.skip(!opened, 'requires at least one debate')

    const yes = authenticatedPage.locator('[data-test="vote-yes"]')
    const no = authenticatedPage.locator('[data-test="vote-no"]')
    await expect(yes).toBeVisible()
    await expect(no).toBeVisible()

    const chooseNo = await yes.getAttribute('aria-pressed') === 'true'
    const choice = chooseNo ? no : yes
    const expectedVote = chooseNo ? '否' : '是'
    const voteResponse = authenticatedPage.waitForResponse(response => (
      response.request().method() === 'PUT'
      && /\/api\/v1\/debate\/topics\/[0-9a-f-]+\/vote$/.test(new URL(response.url()).pathname)
    ))
    await choice.click()
    expect((await voteResponse).ok()).toBeTruthy()
    await expect(authenticatedPage.locator('[data-test="current-user-vote"]')).toHaveText(expectedVote)
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
  await expect(page.getByRole('button', { name: '讨论' })).toBeVisible()
}
