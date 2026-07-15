import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingCommentModeration from '@/views/setting/SettingCommentModeration.vue'
import { commentApi } from '@/api/comments'
import { settingRoutes } from '@/router/routes/settings'

const report = {
  id: 'report-1', reason: 'spam', note: '', status: 'pending', created_at: '2026-07-15T08:00:00Z',
  comment_id: 'comment-1', root_id: 'comment-1', target_kind: 'blog_post' as const, resource_id: 'post-1',
  reporter_id: 'user-2', username: 'bob', content: '广告内容', comment_status: 'auto_folded',
}

describe('SettingCommentModeration', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('loads a compact pending queue and invokes every moderation action', async () => {
    vi.spyOn(commentApi, 'listReports').mockResolvedValue({ items: [report], page: 1, per_page: 20, total: 1, has_more: false })
    const moderate = vi.spyOn(commentApi, 'moderate').mockResolvedValue({ ok: true })
    const wrapper = mount(SettingCommentModeration)
    await flushPromises()
    expect(commentApi.listReports).toHaveBeenCalledWith({ status: 'pending', page: 1, page_size: 20 })
    expect(wrapper.text()).toContain('广告内容')

    const actions = { restore: 'restore', hide: 'hide', delete: 'delete', uphold: 'uphold_report', reject: 'reject_report' }
    for (const [button, apiAction] of Object.entries(actions)) {
      await wrapper.get(`[data-action="${button}"]`).trigger('click')
      await flushPromises()
      expect(moderate).toHaveBeenCalledWith('comment-1', { action: apiAction, report_id: 'report-1', reason: '' })
    }
  })

  it('registers the queue under the moderator guard', () => {
    const root = settingRoutes.find(({ path }) => path === '/setting')
    const route = root?.children?.find(({ path }) => path === 'comment-moderation')
    expect(root?.meta?.requiresAuth).toBe(true)
    expect(root?.meta?.requiresAdmin).toBeUndefined()
    expect(route?.meta?.requiresModerator).toBe(true)
  })
})
