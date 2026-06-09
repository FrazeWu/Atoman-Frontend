import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import { resolveActiveSectionByScroll } from '@/views/setting/settingAccessSections'
import SettingAccessView from '@/views/setting/SettingAccessView.vue'

const siteAccessState = {
  access: {
    version: 1,
    modules: {
      feed: { enabled: true, features: { 'subscription.manage': true } },
      music: { enabled: true, features: { 'music.submit': true, 'music.review': true } },
      blog: { enabled: true, features: { 'post.create': true, 'channel.manage': true } },
      forum: { enabled: true, features: { 'topic.create': true, 'category.request': true } },
      debate: { enabled: true, features: { 'debate.create': true, 'argument.create': true } },
      timeline: { enabled: true, features: { 'timeline.edit': true } },
      podcast: { enabled: true, features: { 'podcast.publish': true } },
      video: { enabled: true, features: { 'video.publish': true } },
    },
    settings: {
      feed: { full_text_mode: 'per_source' },
      blog: { comment_mode: 'authenticated' },
      forum: {
        allow_category_request: true,
        moderator_permissions: {
          review_category_request: true,
          pin_topic: true,
          lock_topic: true,
        },
      },
    },
  },
  save: async () => undefined,
}

const authState = { token: 'admin-token' }

vi.mock('@/stores/siteAccess', () => ({
  useSiteAccessStore: () => siteAccessState,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}))

describe('SettingAccessView section sync', () => {
  it('uses the latest section above the viewport anchor as active', () => {
    const positions = [
      { key: 'feed', top: 320 },
      { key: 'music', top: 980 },
      { key: 'blog', top: 1640 },
      { key: 'forum', top: 2300 },
    ] as const

    expect(resolveActiveSectionByScroll(positions, 0, 180)).toBe('feed')
    expect(resolveActiveSectionByScroll(positions, 900, 180)).toBe('music')
    expect(resolveActiveSectionByScroll(positions, 1700, 180)).toBe('blog')
    expect(resolveActiveSectionByScroll(positions, 2500, 180)).toBe('forum')
  })

  it('falls back to the first section when scroll is still above all sections', () => {
    const positions = [
      { key: 'feed', top: 600 },
      { key: 'music', top: 1200 },
    ] as const

    expect(resolveActiveSectionByScroll(positions, 0, 120)).toBe('feed')
  })

  it('feed 模块只保留策略设置，不再渲染订阅源管理面板', () => {
    const wrapper = mount(SettingAccessView, {
      global: {
        stubs: {
          ABtn: defineComponent({ template: '<button><slot /></button>' }),
          ASurface: defineComponent({ template: '<section><slot /></section>' }),
          ASectionHeader: defineComponent({ template: '<header><slot /></header>' }),
          SettingForumModeratorPanel: defineComponent({ template: '<div>版主管理面板</div>' }),
          SettingFeedSourcePanel: defineComponent({ template: '<div>订阅源管理功能面板</div>' }),
        },
      },
    })

    const text = wrapper.text()
    expect(text).not.toContain('控制管理员是否保留订阅源配置入口')
    expect(text).not.toContain('允许管理员手动录入新的 RSS 订阅源')
    expect(text).not.toContain('订阅源管理功能面板')
    expect(text).toContain('全文抓取策略')
  })

  it('保存时会带上 kanbo 模块可见性', async () => {
    const save = vi.fn(async () => undefined)
    siteAccessState.save = save

    const wrapper = mount(SettingAccessView, {
      global: {
        stubs: {
          ABtn: defineComponent({
            props: ['loading', 'loadingText', 'to'],
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          }),
          ASurface: defineComponent({ template: '<section><slot /></section>' }),
          ASectionHeader: defineComponent({ template: '<header><slot /></header>' }),
          SettingForumModeratorPanel: defineComponent({ template: '<div>版主管理面板</div>' }),
          SettingFeedSourcePanel: defineComponent({ template: '<div>订阅源管理功能面板</div>' }),
        },
      },
    })

    const kanboToggle = wrapper
      .findAll('label.setting-access__module-toggle-item')
      .find((item) => item.text().includes('刊播'))
      ?.find('input[type="checkbox"]')
    expect(kanboToggle.exists()).toBe(true)

    await kanboToggle!.setValue(false)
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0]?.modules?.kanbo?.enabled).toBe(false)
    expect(save.mock.calls[0]?.[1]).toBe('admin-token')
  })
})
