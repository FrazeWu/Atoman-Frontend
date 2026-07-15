import { expect, test } from '../fixtures/base'

test.describe('Timeline revision proposals', () => {
  test('event detail exposes the revision proposal workflow', async ({ authenticatedPage: page }) => {
    const event = {
      id: 'event-1', user_id: 'owner-1', title: '测试事件', description: '摘要', content: '',
      event_date: '2020-01-01T00:00:00Z', location: 'Paris', source: 'archive', category: '', tags: [], is_public: true,
    }
    await page.route('**/api/v1/timeline/events?*', (route) => route.fulfill({ json: { data: [event], total: 1 } }))
    await page.route('**/api/v1/timeline/events/event-1/revision-proposals?page=1', (route) => route.fulfill({ json: { data: { items: [], page: 1, has_more: false } } }))
    await page.goto('/timeline')
    await page.getByRole('button', { name: '展开详情' }).click()
    await expect(page.getByRole('heading', { name: '修订提案' })).toBeVisible()
    await expect(page.getByText('来源依据')).toBeVisible()
  })
})
