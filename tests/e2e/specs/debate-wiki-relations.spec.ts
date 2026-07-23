import type { Locator, Page } from '@playwright/test'

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
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/login')
      await page.getByPlaceholder('输入用户名或邮箱').fill(String(fixture.sessions[0]!.user.username))
      await page.getByPlaceholder('输入密码').fill(fixture.sessions[0]!.password)
      await page.getByRole('button', { name: '登录' }).click()
      await page.waitForURL(/^(?!.*\/login)/)

      const initialTopic = page.waitForResponse(response => (
        response.request().method() === 'GET'
        && new URL(response.url()).pathname.endsWith(`/api/v1/debate/topics/${fixture.target.id}`)
      ))
      await page.goto(`/debate/${fixture.target.id}`)
      expect((await initialTopic).ok()).toBeTruthy()
      await expect(page.getByRole('heading', { name: fixture.target.title })).toBeVisible()

      const initialTree = await openSettledTree(page, fixture.target.id, fixture.target.title)
      await expect(initialTree.getByText(fixture.source.title, { exact: true })).toBeVisible()

      await flipSourceConclusion(request, fixture)
      await page.getByRole('tab', { name: '正文' }).click()
      const refreshedTopic = page.waitForResponse(response => (
        response.request().method() === 'GET'
        && new URL(response.url()).pathname.endsWith(`/api/v1/debate/topics/${fixture.target.id}`)
      ))
      await page.reload()
      expect((await refreshedTopic).ok()).toBeTruthy()
      await expect(page.getByText('来源结论已变化', { exact: true })).toBeVisible()

      const staleTree = await openSettledTree(page, fixture.target.id, fixture.target.title)
      await expect(staleTree.getByText(fixture.source.title, { exact: true })).toHaveCount(0)

      await page.getByRole('tab', { name: '正文' }).click()
      const reconfirmed = page.waitForResponse(response => (
        response.request().method() === 'POST'
        && new URL(response.url()).pathname.includes(`/api/v1/debate/topics/${fixture.target.id}/references/`)
        && new URL(response.url()).pathname.endsWith('/reconfirm')
      ))
      await page.getByRole('button', { name: '重新确认', exact: true }).click()
      expect((await reconfirmed).ok()).toBeTruthy()

      const activeTree = await openSettledTree(page, fixture.target.id, fixture.target.title)
      await expect(activeTree.getByText(fixture.source.title, { exact: true })).toBeVisible()
      await expectGraphControlsClearOfNodes(activeTree)
    } finally {
      cleanupDebateFixture(fixture)
    }
  })
})

async function expectGraphControlsClearOfNodes(graph: Locator) {
  const overlapRects = await graph.evaluate((element) => {
    const controls = element.querySelector<HTMLElement>('.vue-flow__controls')
    if (!controls) return []
    const controlsRect = controls.getBoundingClientRect()
    return [...element.querySelectorAll<HTMLElement>('.vue-flow__node')].flatMap((node) => {
      const nodeRect = node.getBoundingClientRect()
      const overlaps = controlsRect.left < nodeRect.right
        && controlsRect.right > nodeRect.left
        && controlsRect.top < nodeRect.bottom
        && controlsRect.bottom > nodeRect.top
      return overlaps ? [{
        controls: { left: controlsRect.left, right: controlsRect.right, top: controlsRect.top, bottom: controlsRect.bottom },
        node: { left: nodeRect.left, right: nodeRect.right, top: nodeRect.top, bottom: nodeRect.bottom },
      }] : []
    })
  })
  expect(overlapRects).toEqual([])
}

function isTreeResponse(url: string, debateID: string) {
  const parsed = new URL(url)
  return parsed.pathname.endsWith(`/api/v1/debates/${debateID}/relations`)
    && parsed.searchParams.get('view') === 'tree'
}

async function openSettledTree(page: Page, debateID: string, rootTitle: string) {
  const treeResponse = page.waitForResponse(response => (
    response.request().method() === 'GET' && isTreeResponse(response.url(), debateID)
  ))
  await page.getByRole('tab', { name: '辩论树' }).click()
  expect((await treeResponse).ok()).toBeTruthy()

  const graph = page.locator('#debate-panel-tree .debate-flow')
  await expect(graph).toHaveAttribute('aria-busy', 'false')
  const root = graph.locator('.debate-node--root')
  await expect(root.getByRole('heading', { name: rootTitle, exact: true })).toBeVisible()
  return graph
}
