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

  it('feed 模块复用统一的全局订阅源管理面板', () => {
    const wrapper = mount(SettingAccessView, {
      global: {
        stubs: {
          PButton: defineComponent({ template: '<button><slot /></button>' }),
          PSurface: defineComponent({ template: '<section><slot /></section>' }),
          PSectionHeader: defineComponent({ template: '<header><slot /></header>' }),
          SettingForumModeratorPanel: defineComponent({ template: '<div>版主管理面板</div>' }),
          SettingFeedSourcePanel: defineComponent({
            props: {
              fullTextMode: { type: String, required: true },
            },
            template: '<div data-testid="feed-source-panel">订阅源管理功能面板 / {{ fullTextMode }}</div>',
          }),
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('全文抓取')
    expect(text).toContain('订阅源管理功能面板 / per_source')
    expect(wrapper.find('[data-testid="feed-source-panel"]').exists()).toBe(true)
  })

  it('uses a single module flow with an article-style directory', () => {
    const wrapper = mount(SettingAccessView, {
      global: {
        stubs: {
          PButton: defineComponent({ template: '<button><slot /></button>' }),
          PDirectoryNav: defineComponent({
            props: ['items', 'activeId', 'collapsed', 'mobileOpen'],
            template: '<aside data-testid="shared-directory" :data-count="items.length" :data-active="activeId" :data-mobile-open="String(mobileOpen)" />',
          }),
          SettingForumModeratorPanel: defineComponent({ template: '<div>版主管理面板</div>' }),
          SettingFeedSourcePanel: defineComponent({ template: '<div>订阅源管理功能面板</div>' }),
        },
      },
    })

    expect(wrapper.find('.setting-access__module-toggle-grid').exists()).toBe(false)
    expect(wrapper.findAll('.setting-access__section')).toHaveLength(8)
    expect(wrapper.get('[data-testid="shared-directory"]').attributes('data-count')).toBe('8')
    expect(wrapper.get('[data-testid="shared-directory"]').attributes('data-active')).toBe('feed')
    expect(wrapper.find('.setting-access__toc').exists()).toBe(false)
    expect(wrapper.get('.setting-access__directory-trigger').text()).toContain('目录')
    expect(wrapper.get('#module-media').text()).not.toContain('关闭评论')
  })

  it('opens the shared directory on mobile', async () => {
    const wrapper = mount(SettingAccessView, {
      global: {
        stubs: {
          PButton: defineComponent({ template: '<button><slot /></button>' }),
          PDirectoryNav: defineComponent({
            props: ['items', 'activeId', 'collapsed', 'mobileOpen'],
            template: '<aside data-testid="shared-directory" :data-mobile-open="String(mobileOpen)" />',
          }),
          SettingForumModeratorPanel: true,
          SettingFeedSourcePanel: true,
        },
      },
    })

    const directory = wrapper.get('[data-testid="shared-directory"]')
    expect(directory.attributes('data-mobile-open')).toBe('false')
    await wrapper.get('.setting-access__directory-trigger').trigger('click')
    expect(directory.attributes('data-mobile-open')).toBe('true')
  })

  it('保存时会带上 media 模块可见性', async () => {
    const save = vi.fn(async () => undefined)
    siteAccessState.save = save

    const wrapper = mount(SettingAccessView, {
      global: {
        stubs: {
          PButton: defineComponent({
            props: ['loading', 'loadingText', 'to'],
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          }),
          PSurface: defineComponent({ template: '<section><slot /></section>' }),
          PSectionHeader: defineComponent({ template: '<header><slot /></header>' }),
          SettingForumModeratorPanel: defineComponent({ template: '<div>版主管理面板</div>' }),
          SettingFeedSourcePanel: defineComponent({ template: '<div>订阅源管理功能面板</div>' }),
        },
      },
    })

    const kanboToggle = wrapper
      .get('#module-media')
      .find('input.setting-access__module-enabled')
    expect(kanboToggle.exists()).toBe(true)

    await kanboToggle!.setValue(false)
    await wrapper.get('.setting-access__footer button').trigger('click')

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0]?.modules?.media?.enabled).toBe(false)
    expect(save.mock.calls[0]?.[1]).toBe('admin-token')
  })

  it('不再显示或提交匿名与关闭评论设置', async () => {
    const save = vi.fn(async () => undefined)
    siteAccessState.save = save
    const wrapper = mount(SettingAccessView, {
      global: {
        stubs: {
          PButton: defineComponent({
            props: ['loading', 'loadingText', 'to'],
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          }),
          PSurface: defineComponent({ template: '<section><slot /></section>' }),
          PSectionHeader: defineComponent({ template: '<header><slot /></header>' }),
          SettingForumModeratorPanel: true,
          SettingFeedSourcePanel: true,
        },
      },
    })

    expect(wrapper.text()).not.toContain('全部可评论')
    expect(wrapper.text()).not.toContain('关闭评论')
    await wrapper.get('.setting-access__footer button').trigger('click')
    expect(save.mock.calls[0]?.[0]?.settings).not.toHaveProperty('blog')
  })
})
