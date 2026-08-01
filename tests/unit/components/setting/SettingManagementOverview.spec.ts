import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'

const mocks = vi.hoisted(() => ({
  listAdminUsers: vi.fn(),
  fetchSources: vi.fn(),
}))

vi.mock('@/api/adminUsers', () => ({ listAdminUsers: mocks.listAdminUsers }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ token: 'admin-token' }) }))
vi.mock('@/stores/adminFeedFulltext', () => ({
  useAdminFeedFulltextStore: () => ({
    sourcesMeta: { total: 3 },
    fetchSources: mocks.fetchSources,
  }),
}))

describe('SettingManagementOverview', () => {
  it('shows concise user and source previews with detail links', async () => {
    mocks.listAdminUsers.mockResolvedValue({
      data: [{
        uuid: 'user-1', username: 'alice', display_name: 'Alice', is_active: true,
      }],
      meta: { page: 1, page_size: 5, total: 8, has_more: true },
    })
    mocks.fetchSources.mockResolvedValue([{
      id: 'source-1', title: 'Example Feed', pending_count: 2, status: 'degraded',
    }])

    const wrapper = mount(SettingManagementOverview, {
      global: {
        stubs: {
          PButton: defineComponent({ props: ['to'], template: '<a :href="to"><slot /></a>' }),
        },
      },
    })
    await flushPromises()

    expect(mocks.listAdminUsers).toHaveBeenCalledWith({ page: 1, page_size: 5 })
    expect(mocks.fetchSources).toHaveBeenCalledWith('admin-token', { page: 1, limit: 5 })
    expect(wrapper.text()).toContain('8 位用户')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('3 个订阅源')
    expect(wrapper.text()).toContain('Example Feed')
    expect(wrapper.get('[data-test="user-management-link"]').attributes('href')).toBe('/site/setting/users')
    expect(wrapper.get('[data-test="subscription-management-link"]').attributes('href')).toBe('/site/setting/subscriptions')
  })
})
