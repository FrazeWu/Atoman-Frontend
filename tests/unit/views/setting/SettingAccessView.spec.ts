import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import { resolveActiveSectionByScroll, resolveInitialSettingSection } from '@/views/setting/settingAccessSections'
import SettingAccessView from '@/views/setting/SettingAccessView.vue'
import SettingManagementOverview from '@/components/setting/SettingManagementOverview.vue'

const routerMocks = vi.hoisted(() => ({
  route: { path: '/site/setting', hash: '', query: {} },
  replace: vi.fn(),
  push: vi.fn(),
}))

const siteAccessState = {
  access: {
    version: 1,
    modules: {
      feed: { enabled: true, features: { 'subscription.manage': true } },
      music: { enabled: true, features: { 'music.submit': true, 'music.review': true } },
      blog: { enabled: true, features: { 'post.create': true, 'channel.manage': true } },
      books: { enabled: false, features: {} },
      forum: { enabled: true, features: { 'topic.create': true, 'category.request': true } },
      debate: { enabled: true, features: { 'debate.create': true, 'argument.create': true } },
      timeline: { enabled: true, features: { 'timeline.edit': true } },
      podcast: { enabled: true, features: { 'podcast.publish': true } },
      video: { enabled: true, features: { 'video.publish': true } },
    },
    settings: {
      feed: { full_text_mode: 'per_source', allow_manage_sources: true, allow_add_source: true },
      blog: { comment_mode: 'authenticated' },
      forum: {
        allow_category_request: true,
        moderator_permissions: { review_category_request: true, pin_topic: true, lock_topic: true },
      },
    },
  },
  save: async () => undefined,
}

const authState = { token: 'admin-token', user: { role: 'owner' } }

vi.mock('vue-router', () => ({
  useRoute: () => routerMocks.route,
  useRouter: () => routerMocks,
}))

vi.mock('@/stores/siteAccess', () => ({ useSiteAccessStore: () => siteAccessState }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))

const stubs = {
  PSectionHeader: defineComponent({ template: '<header><slot /></header>' }),
  PButton: defineComponent({
    props: ['to', 'loading'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  }),
  SettingUsersView: defineComponent({ template: '<div data-test="users-management">用户管理</div>' }),
  SettingCommunityView: defineComponent({ template: '<div data-test="community-management">社区管理</div>' }),
  SettingAnnouncementsView: defineComponent({ template: '<div data-test="announcements-management">公告管理</div>' }),
  SettingFeedSourcePanel: defineComponent({ template: '<div>订阅源面板</div>' }),
  SettingForumModeratorPanel: defineComponent({ template: '<div>版主管理面板</div>' }),
  SettingMusicReviewPanel: defineComponent({ template: '<div data-test="music-review-panel">音乐审核面板</div>' }),
}

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

  it('resolves module hashes from the route', () => {
    expect(resolveInitialSettingSection('#module-music')).toBe('music')
    expect(resolveInitialSettingSection('#detail-feed')).toBe('feed')
    expect(resolveInitialSettingSection('')).toBeNull()
  })

  it('scrolls to the real music management section from the module list', async () => {
    const wrapper = mount(SettingAccessView, {
      global: {
        stubs: {
          ...stubs,
        },
      },
    })

    const overview = wrapper.findComponent(SettingManagementOverview)
    await wrapper.get('[data-test="module-detail-music"]').trigger('click')
    expect(overview.emitted('open-detail')).toEqual([['music']])
    await wrapper.vm.$nextTick()
    expect(wrapper.get('#module-music').text()).toContain('音乐审核面板')
    expect(routerMocks.replace).toHaveBeenCalled()
  })

  it('keeps the requested single-page management order', () => {
    const wrapper = mount(SettingAccessView, { global: { stubs } })
    const sections = wrapper.findAll('.setting-access__management-section')
    expect(sections.map((section) => section.attributes('id'))).toEqual([
      'module-access',
      'users',
      'community',
      'announcements',
      'module-management',
    ])
    expect(wrapper.findAll('.setting-access__module-section').map((section) => section.attributes('id'))).toHaveLength(9)
  })

  it('keeps a unified switch for podcast and saves its visibility', async () => {
    const save = vi.fn(async () => undefined)
    siteAccessState.save = save
    const wrapper = mount(SettingAccessView, { global: { stubs } })

    const podcastToggle = wrapper.get('[data-test="module-enabled-podcast"]')
    await podcastToggle.setValue(false)
    await wrapper.get('.setting-access__actions button:last-child').trigger('click')

    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0]?.modules?.podcast?.enabled).toBe(false)
    expect(save.mock.calls[0]?.[1]).toBe('admin-token')
  })
})
