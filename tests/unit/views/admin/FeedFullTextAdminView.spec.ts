import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/siteAccess', () => ({
  useSiteAccessStore: () => ({ feedFullTextMode: 'per_source' }),
}))

vi.mock('@/components/setting/SettingFeedSourcePanel.vue', () => ({
  default: defineComponent({
    name: 'SettingFeedSourcePanel',
    props: ['fullTextMode'],
    template: '<div data-testid="feed-source-panel">{{ fullTextMode }} 订阅源监控面板</div>',
  }),
}))

import FeedFullTextAdminView from '@/views/setting/SettingFeedFullText.vue'

describe('FeedFullTextAdminView', () => {
  it('复用订阅源监控面板', () => {
    const wrapper = mount(FeedFullTextAdminView)

    expect(wrapper.get('[data-testid="feed-source-panel"]').text()).toContain('订阅源监控面板')
  })
})
