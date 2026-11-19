import { expect, test } from '@playwright/test'

for (const initiallyFailed of [false, true]) {
  test(`文章页确认实时订阅状态，不重复订阅（首次加载失败：${initiallyFailed}）`, async ({ page }) => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    let ready = false
    let subscriptionPosts = 0
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname
      let body: unknown = { data: [] }
      if (path.endsWith('/auth/session')) {
        body = { csrf_token: 'test-csrf', user: { uuid: 'test-reader', username: 'reader', email: 'reader@example.test' } }
      } else if (path.endsWith('/site/access')) {
        body = { modules: { feed: { enabled: true, features: {} } } }
      } else if (path.endsWith('/feed/subscription-hub/tree')) {
        body = { data: { types: [] } }
      } else if (path.endsWith('/feed/subscriptions')) {
        if (route.request().method() === 'POST') subscriptionPosts += 1
        if (!ready) {
          if (initiallyFailed) {
            await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
            return
          }
          await pending
        }
        body = { data: [{
          id: 'subscription-1', feed_source_id: 'source-1', is_paused: true,
          feed_source: { id: 'source-1', source_type: 'external_rss', rss_url: 'https://example.test/rss' },
        }] }
      } else if (path.endsWith('/feed/items/subscription-state-test')) {
        const html = '<p>订阅状态验收正文</p>'
        body = { data: {
          item: {
            id: 'subscription-state-test', title: '订阅状态验收', feed_source_id: 'source-1',
            feed_source: { id: 'source-1', title: '实时订阅源', rss_url: 'https://example.test/rss' },
          },
          reader: { default_variant: 'rss', rss: { html }, full_text: { status: 'unavailable', html: '' } },
        } }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })

    expect((await page.goto('/feed/item/subscription-state-test'))?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: '订阅状态验收', exact: true })).toBeVisible()
    const confirm = page.getByRole('button', { name: '确认订阅状态', exact: true })
    await expect(confirm).toBeVisible()
    ready = true
    if (initiallyFailed) await confirm.click()
    else release()
    const subscribed = page.getByRole('button', { name: '已订阅', exact: true })
    await expect(subscribed).toBeVisible()
    await expect(subscribed).toBeDisabled()
    expect(subscriptionPosts).toBe(0)
  })
}
