import { expect, test } from '../fixtures/base'

const comment = (id: string, content: string) => ({
  id, author_id: 'owner-1', author: { id: 'owner-1', username: 'owner', display_name: 'Owner', avatar_url: '' },
  floor_number: 1, content, rendered_html: `<p>${content}</p>`, status: 'active', like_count: 0, reply_count: 0,
  hot_score: 0, created_at: '2026-07-15T10:00:00Z', marked: false, liked: false,
  mentions: [], attachments: [], time_anchors: [], replies: [],
})

async function becomeTargetOwner(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
	localStorage.setItem('token', `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`)
	localStorage.setItem('user', JSON.stringify({ uuid: 'owner-1', username: 'owner', email: 'owner@example.com', role: 'user' }))
  })
}

test.describe('Timeline revision proposals', () => {
  test('creates and accepts an event proposal then refreshes event content', async ({ page }) => {
    await becomeTargetOwner(page)
    const event = {
      id: 'event-1', user_id: 'owner-1', title: '测试事件', description: '摘要', content: '',
      event_date: '2020-01-01T00:00:00Z', location: 'Paris', source: 'archive', category: '', tags: [], is_public: true,
    }
    let proposals: Record<string, unknown>[] = []
    await page.route('**/api/v1/timeline/events?*', (route) => route.fulfill({ json: { data: [event], total: 1 } }))
    await page.route('**/api/v1/timeline/events/event-1', (route) => route.fulfill({ json: { data: event } }))
    await page.route('**/api/v1/timeline/events/event-1/revision-proposals?*', (route) => route.fulfill({ json: { data: { items: proposals, page: 1, per_page: 20, total: proposals.length, has_more: false } } }))
    await page.route('**/api/v1/timeline/events/event-1/revision-proposals', async (route) => {
      const body = route.request().postDataJSON()
      const created = { comment: comment('proposal-1', body.content), target_kind: 'timeline_event', target_id: event.id, patch: body.patch, evidence: body.evidence, status: 'pending' }
      proposals = [created]
      await route.fulfill({ status: 201, json: { data: created } })
    })
    await page.route('**/api/v1/timeline/revision-proposals/proposal-1/decision', async (route) => {
      event.location = 'Berlin'
      proposals = [{ ...proposals[0], status: 'accepted', reviewer_id: 'owner-1' }]
      await route.fulfill({ json: { data: proposals[0] } })
    })

    await page.goto('/timeline')
    await page.getByRole('button', { name: '展开详情' }).click()
    await page.locator('[data-test="proposal-field"]').selectOption('location')
    await page.locator('[data-test="proposal-value"]').fill('Berlin')
    await page.locator('[data-test="proposal-evidence"]').fill('Federal archive')
    await page.locator('.timeline-proposals textarea').fill('修正事件地点')
    await page.getByRole('button', { name: '提交提案' }).click()
    await expect(page.getByText('Federal archive')).toBeVisible()
    await page.locator('[data-test="accept-proposal"]').click()
    await expect(page.getByText('已接受')).toBeVisible()
    await expect(page.getByText('Berlin', { exact: true })).toBeVisible()
  })

  test('creates and rejects a person proposal', async ({ page }) => {
    await becomeTargetOwner(page)
    const person = { id: 'person-1', user_id: 'owner-1', name: '测试人物', bio: '旧简介', tags: [], is_public: true, locations: [] }
    let proposals: Record<string, unknown>[] = []
    await page.route('**/api/v1/timeline/persons/person-1', (route) => route.fulfill({ json: { data: person } }))
    await page.route('**/api/v1/timeline/persons/person-1/revision-proposals?*', (route) => route.fulfill({ json: { data: { items: proposals, page: 1, per_page: 20, total: proposals.length, has_more: false } } }))
    await page.route('**/api/v1/timeline/persons/person-1/revision-proposals', async (route) => {
      const body = route.request().postDataJSON()
      const created = { comment: comment('person-proposal', body.content), target_kind: 'timeline_person', target_id: person.id, patch: body.patch, evidence: body.evidence, status: 'pending' }
      proposals = [created]
      await route.fulfill({ status: 201, json: { data: created } })
    })
    await page.route('**/api/v1/timeline/revision-proposals/person-proposal/decision', (route) => {
      proposals = [{ ...proposals[0], status: 'rejected', reviewer_id: 'owner-1' }]
      return route.fulfill({ json: { data: proposals[0] } })
    })

    await page.goto('/timeline/person/person-1')
    await page.locator('[data-test="proposal-field"]').selectOption('bio')
    await page.locator('[data-test="proposal-value"]').fill('新简介')
    await page.locator('[data-test="proposal-evidence"]').fill('Biography')
    await page.locator('.timeline-proposals textarea').fill('修正人物简介')
    await page.getByRole('button', { name: '提交提案' }).click()
    await expect(page.getByText('Biography')).toBeVisible()
    await page.locator('[data-test="reject-proposal"]').click()
    await expect(page.getByText('已拒绝')).toBeVisible()
    await expect(page.getByText('旧简介')).toBeVisible()
  })
})
