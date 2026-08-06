import { randomUUID } from 'node:crypto'

import { expect, test } from '../fixtures/base'

const enabled = process.env.BLOG_COLLAB_REAL_E2E === '1'
test.describe('Blog collaboration', () => {
  test.setTimeout(60_000)
  test.skip(!enabled, 'requires BLOG_COLLAB_REAL_E2E=1 and a local backend')

  test('syncs editor content between two authenticated pages', async ({ authenticatedPage: page }) => {
    const sessionResponse = await page.request.get('/api/v1/auth/session')
    expect(sessionResponse.status()).toBe(200)
    const session = await sessionResponse.json() as { csrf_token?: string; data?: { csrf_token?: string } }
    const csrfToken = session.csrf_token || session.data?.csrf_token
    expect(csrfToken).toBeTruthy()
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken!,
      Origin: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173').origin,
    }

    const studioResponse = await page.request.get('/api/v1/studio/state', { headers })
    expect(studioResponse.ok()).toBeTruthy()
    const studioPayload = await studioResponse.json() as { data?: { current_channel?: { id?: string } } }
    const channelId = studioPayload.data?.current_channel?.id
    expect(channelId).toBeTruthy()
    const request = page.request

    let postId: string | undefined
    try {
      const created = await page.request.post('/api/v1/blog/posts', {
        headers,
        data: {
          channel_id: channelId,
          title: `协作 E2E ${randomUUID()}`,
          content: '# 协作测试\n初始内容',
          status: 'draft',
          visibility: 'private',
        },
      })
      expect(created.ok(), await created.text()).toBeTruthy()
      const createdPayload = await created.json() as { data?: { id?: string } }
      postId = createdPayload.data?.id
      expect(postId).toBeTruthy()

      const pageA = page
      const pageB = await page.context().newPage()
      try {
        const editorPath = `/studio/blog/${postId}/edit`
        const editorURL = new URL(editorPath, process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173').toString()
        const editorA = pageA.locator('.cm-content')
        const editorB = pageB.locator('.cm-content')
        await pageA.goto(editorURL, { waitUntil: 'domcontentloaded' })
        await expect(pageA).toHaveURL(editorURL)
        try {
          await expect(editorA).toBeVisible({ timeout: 20_000 })
        } catch {
          throw new Error(`editor did not load: ${await pageA.locator('body').innerText()}`)
        }
        await pageB.goto(editorURL, { waitUntil: 'domcontentloaded' })
        await expect(editorB).toBeVisible({ timeout: 20_000 })

        const syncedContent = `# 协作测试\n同步-${randomUUID()}`
        await editorA.click()
        await editorA.press('Control+A')
        await pageA.keyboard.type(syncedContent)

        await expect(editorB).toContainText(syncedContent, { timeout: 10_000 })
      } finally {
        await pageB.close()
      }
    } finally {
      if (postId) {
        const cleanupSession = await request.get('/api/v1/auth/session')
        const cleanupPayload = await cleanupSession.json() as { csrf_token?: string; data?: { csrf_token?: string } }
        const cleanupToken = cleanupPayload.csrf_token || cleanupPayload.data?.csrf_token
        await request.delete(`/api/v1/blog/posts/${postId}`, {
          headers: { ...headers, 'X-CSRF-Token': cleanupToken! },
        })
      }
    }
  })
})
