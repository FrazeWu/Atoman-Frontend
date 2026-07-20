import { expect, test } from '../fixtures/base'
import {
  cleanupDebateFixture,
  createDebateFixture,
  flipSourceConclusion,
  requireLocalDebateFixture,
  saveWikiReference,
} from '../helpers/debate-fixtures'

test.describe('Debate wiki relation lifecycle', () => {
  test.skip(process.env.DEBATE_WIKI_E2E !== '1', 'requires local PostgreSQL and DEBATE_WIKI_E2E=1')

  test('stales and explicitly reconfirms a relation after conclusion reversal', async ({ page, request }) => {
    test.setTimeout(90_000)
    requireLocalDebateFixture()
    const fixture = await createDebateFixture(request)

    try {
      await saveWikiReference(request, fixture)
      await page.addInitScript(({ token, user }) => {
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
      }, fixture.sessions[0])

      const initialTopic = page.waitForResponse(response => (
        response.request().method() === 'GET'
        && new URL(response.url()).pathname.endsWith(`/api/v1/debate/topics/${fixture.target.id}`)
      ))
      await page.goto(`/debate/${fixture.target.id}`)
      expect((await initialTopic).ok()).toBeTruthy()
      await expect(page.getByRole('heading', { name: fixture.target.title })).toBeVisible()

      const initialTree = page.waitForResponse(response => isTreeResponse(response.url(), fixture.target.id))
      await page.getByRole('tab', { name: '辩论树' }).click()
      expect((await initialTree).ok()).toBeTruthy()
      await expect(treePanel(page).getByText(fixture.source.title, { exact: true })).toBeVisible()

      await flipSourceConclusion(request, fixture)
      await page.getByRole('tab', { name: '正文' }).click()
      const refreshedTopic = page.waitForResponse(response => (
        response.request().method() === 'GET'
        && new URL(response.url()).pathname.endsWith(`/api/v1/debate/topics/${fixture.target.id}`)
      ))
      await page.reload()
      expect((await refreshedTopic).ok()).toBeTruthy()
      await expect(page.getByText('来源结论已变化', { exact: true })).toBeVisible()

      const staleTree = page.waitForResponse(response => isTreeResponse(response.url(), fixture.target.id))
      await page.getByRole('tab', { name: '辩论树' }).click()
      expect((await staleTree).ok()).toBeTruthy()
      await expect(treePanel(page).getByText(fixture.source.title, { exact: true })).toHaveCount(0)

      await page.getByRole('tab', { name: '正文' }).click()
      const reconfirmed = page.waitForResponse(response => (
        response.request().method() === 'POST'
        && new URL(response.url()).pathname.includes(`/api/v1/debate/topics/${fixture.target.id}/references/`)
        && new URL(response.url()).pathname.endsWith('/reconfirm')
      ))
      await page.getByRole('button', { name: '重新确认', exact: true }).click()
      expect((await reconfirmed).ok()).toBeTruthy()

      const activeTree = page.waitForResponse(response => isTreeResponse(response.url(), fixture.target.id))
      await page.getByRole('tab', { name: '辩论树' }).click()
      expect((await activeTree).ok()).toBeTruthy()
      await expect(treePanel(page).getByText(fixture.source.title, { exact: true })).toBeVisible()
    } finally {
      cleanupDebateFixture(fixture)
    }
  })
})

function isTreeResponse(url: string, debateID: string) {
  const parsed = new URL(url)
  return parsed.pathname.endsWith(`/api/v1/debates/${debateID}/relations`)
    && parsed.searchParams.get('view') === 'tree'
}

function treePanel(page: import('@playwright/test').Page) {
  return page.locator('#debate-panel-tree')
}
