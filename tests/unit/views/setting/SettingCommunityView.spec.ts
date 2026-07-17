import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SettingCommunityView from '@/views/setting/SettingCommunityView.vue'

describe('SettingCommunityView', () => {
  it('switches between moderation, users and groups', async () => {
    const wrapper = mount(SettingCommunityView, { global: { stubs: {
      SettingForumModerationPanel: { template: '<div>举报列表</div>' },
      SettingForumUserModerationPanel: { template: '<div>处罚历史</div>' },
      SettingForumGroupPanel: { template: '<div>用户组设置</div>' },
    } } })
    expect(wrapper.text()).toContain('举报列表')
    await wrapper.get('[data-test="community-tab-users"]').trigger('click')
    expect(wrapper.text()).toContain('处罚历史')
    await wrapper.get('[data-test="community-tab-groups"]').trigger('click')
    expect(wrapper.text()).toContain('用户组设置')
  })
})
