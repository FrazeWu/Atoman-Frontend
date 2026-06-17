import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    token: 'admin-token',
    user: { role: 'admin' },
  }),
}))

vi.mock('@/stores/adminFeedSources', () => ({
  useAdminFeedSourcesStore: () => ({
    error: '',
    loading: false,
    sources: [],
    fetchSources: vi.fn(),
    updateSource: vi.fn(),
    deleteSource: vi.fn(),
  }),
}))

import SettingFeedSourcesView from '@/views/setting/SettingFeedSourcesView.vue'

const stubs = {
  AEmpty: defineComponent({ template: '<section><slot />{{ title }}{{ description }}</section>', props: ['title', 'description'] }),
  APageHeader: defineComponent({ template: '<header>{{ title }}{{ sub }}</header>', props: ['title', 'sub'] }),
  PaperClip: defineComponent({ template: '<button><slot /></button>' }),
  PaperEntry: defineComponent({ template: '<article><slot /><slot name="meta" /><slot name="actions" /></article>' }),
  PaperReject: defineComponent({ template: '<button><slot /></button>' }),
  SettingFeedSourcePanel: defineComponent({
    props: {
      fullTextMode: { type: String, required: true },
    },
    template: '<section data-testid="feed-source-panel">{{ fullTextMode }}</section>',
  }),
}

describe('SettingFeedSourcesView', () => {
  it('渲染全局订阅源管理面板', () => {
    const wrapper = mount(SettingFeedSourcesView, {
      global: { stubs },
    })

    const panel = wrapper.find('[data-testid="feed-source-panel"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toBe('per_source')
    expect(wrapper.text()).not.toContain('后端接口尚未实现')
  })
})
