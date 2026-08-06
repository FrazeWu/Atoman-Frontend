import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'

import { test } from '../fixtures/base'

const enabled = process.env.BLOG_COLLAB_REAL_E2E === '1'
const authState = './tests/e2e/.auth/admin.json'

test.describe('Blog collaboration', () => {
  test.skip(!enabled, 'requires BLOG_COLLAB_REAL_E2E=1 and a local backend')

  test('syncs editor content between two authenticated browsers', async ({ authenticatedPage, browser }) => {
    const sessionResponse = await authenticatedPage.request.get('/api/v1/auth/session')
    expect(sessionResponse.ok()).toBeTruthy()
    const session = await sessionResponse.json() as { csrf_token?: string; data?: { csrf_token?: string } }
    const csrfToken = session.csrf_token || session.data?.csrf_token
    expect(csrfToken).toBeTruthy()
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken!,
      Origin: new URL(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173').origin,
    }

    const studioResponse = await authenticatedPage.request.get('/api/v1/studio/state', { headers })
    expect(studioResponse.ok()).toBeTruthy()
    const studioPayload = await studioResponse.json() as { data?: { current_channel?: { id?: string } } }
    const channelId = studioPayload.data?.current_channel?.id
    expect(channelId).toBeTruthy()

    let postId: string | undefined
    const contextA = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL, storageState: authState })
    const contextB = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL, storageState: authState })

    try {
      const created = await authenticatedPage.request.post('/api/v1/blog/posts', {
        headers,
        data: {
          channel_id: channelId,
          title: `协作 E2E ${randomUUID()}`,
          content: '# 协作测试\n初始内容',
          status: 'draft',
          visibility: 'private',
        },
      })
      expect(created.ok()).toBeTruthy()
      const createdPayload = await created.json() as { data?: { id?: string } }
      postId = createdPayload.data?.id
      expect(postId).toBeTruthy()

      const pageA = await contextA.newPage()
      const pageB = await contextB.newPage()
      const editorPath = `/studio/blog/${postId}/edit`
      await Promise.all([pageA.goto(editorPath), pageB.goto(editorPath)])

      const editorA = pageA.locator('.cm-content')
      const editorB = pageB.locator('.cm-content')
      await expect(editorA).toBeVisible()
      await expect(editorB).toBeVisible()

      const syncedContent = `# 协作测试\n同步-${randomUUID()}`
      await editorA.click()
      await editorA.press('Control+A')
      await pageA.keyboard.type(syncedContent)

      await expect(editorB).toContainText(syncedContent, { timeout: 10_000 })
    } finally {
      await contextA.close()
      await contextB.close()
      if (postId) {
        await authenticatedPage.request.delete(`/api/v1/blog/posts/${postId}`, {
          headers,
        })
      }
    }
  })
})
