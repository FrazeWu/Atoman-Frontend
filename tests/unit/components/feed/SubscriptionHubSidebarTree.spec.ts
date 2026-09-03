import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SubscriptionHubSidebarTree from '@/components/feed/SubscriptionHubSidebarTree.vue'
import type { SubscriptionHubTree } from '@/types'

const tree: SubscriptionHubTree = {
  types: [
    {
      subscription_type: 'podcast',
      groups: [
        {
          id: 'podcast-group',
          user_id: 'viewer',
          subscription_type: 'podcast',
          name: '常听节目',
          position: 0,
          memberships: [
            {
              id: 'podcast-member',
              user_id: 'viewer',
              subscription_type: 'podcast',
              group_id: 'podcast-group',
              feed_source_id: 'shared-channel',
              title: '原子谈话',
              position: 0,
            },
          ],
        },
      ],
    },
    {
      subscription_type: 'video',
      groups: [
        {
          id: 'video-group',
          user_id: 'viewer',
          subscription_type: 'video',
          name: '关注频道',
          position: 0,
          memberships: [
            {
              id: 'video-member',
              user_id: 'viewer',
              subscription_type: 'video',
              group_id: 'video-group',
              feed_source_id: 'shared-channel',
              title: '原子谈话',
              position: 0,
            },
          ],
        },
      ],
    },
    { subscription_type: 'blog', groups: [] },
    { subscription_type: 'rss', groups: [] },
  ],
}

const singleDefaultGroupTree: SubscriptionHubTree = {
  types: [
    {
      subscription_type: 'blog',
      groups: [
        {
          id: 'blog-default-group',
          user_id: 'viewer',
          subscription_type: 'blog',
          name: '默认分组',
          position: 0,
          memberships: [
            {
              id: 'blog-member-1',
              user_id: 'viewer',
              subscription_type: 'blog',
              group_id: 'blog-default-group',
              feed_source_id: 'blog-source-1',
              title: '第一篇博客',
              position: 0,
            },
          ],
        },
      ],
    },
  ],
}

const sourceTypeTree: SubscriptionHubTree = {
  types: [
    {
      subscription_type: 'blog',
      groups: [
        {
          id: 'blog-source-type-group',
          user_id: 'viewer',
          subscription_type: 'blog',
          name: '博客订阅',
          position: 0,
          memberships: [
            {
              id: 'account-membership',
              user_id: 'viewer',
              subscription_type: 'blog',
              group_id: 'blog-source-type-group',
              feed_source_id: 'account-source',
              feed_source: {
                id: 'account-source',
                source_type: 'internal_user',
                hash: 'account-hash',
                cover_url: 'https://cdn.example.com/account.webp',
                created_at: '',
              },
              title: '某个用户',
              position: 0,
            },
            {
              id: 'channel-membership',
              user_id: 'viewer',
              subscription_type: 'blog',
              group_id: 'blog-source-type-group',
              feed_source_id: 'channel-source',
              feed_source: {
                id: 'channel-source',
                source_type: 'internal_channel',
                hash: 'channel-hash',
                cover_url: 'https://cdn.example.com/channel.webp',
                created_at: '',
              },
              title: '某个频道',
              position: 1,
            },
          ],
        },
      ],
    },
    {
      subscription_type: 'rss',
      groups: [
        {
          id: 'rss-source-type-group',
          user_id: 'viewer',
          subscription_type: 'rss',
          name: 'RSS 订阅',
          position: 0,
          memberships: [
            {
              id: 'rss-membership',
              user_id: 'viewer',
              subscription_type: 'rss',
              group_id: 'rss-source-type-group',
              feed_source_id: 'rss-source',
              feed_source: {
                id: 'rss-source',
                source_type: 'external_rss',
                hash: 'rss-hash',
                rss_url: 'https://example.com/feed.xml',
                fetch_status: 'blocked',
                created_at: '',
              },
              title: '某个 RSS',
              position: 0,
            },
          ],
        },
      ],
    },
  ],
}

describe('SubscriptionHubSidebarTree', () => {

  it('keeps the sidebar focused on populated subscription types', () => {
    const wrapper = mount(SubscriptionHubSidebarTree, { props: { tree } })

    expect(wrapper.findAll('.subscription-hub-sidebar__type-select')).toHaveLength(2)
    expect(wrapper.find('[data-testid="subscription-hub-type-toggle-podcast"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[data-testid="subscription-hub-type-toggle-video"]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="subscription-hub-type-blog"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="subscription-hub-type-rss"]').exists()).toBe(false)
    expect(wrapper.findAll('.subscription-hub-sidebar__membership')).toHaveLength(1)
  })

  it('keeps identical sources separate in their podcast and video contexts', () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree,
        activeType: 'podcast',
        activeGroupId: 'podcast-group',
      },
    })

    expect(wrapper.text()).toContain('播客')
    expect(wrapper.text()).toContain('视频')
    expect(wrapper.text()).toContain('常听节目')
    expect(wrapper.text()).not.toContain('关注频道')
    expect(wrapper.findAll('.subscription-hub-sidebar__membership').length).toBe(1)
    expect(wrapper.text()).not.toContain('全部订阅')
  })

  it('selects a type and a leaf with their isolated context', async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, { props: { tree } })

    await wrapper.get('[data-testid="subscription-hub-type-video"]').trigger('click')
    expect(wrapper.emitted('select-context')).toEqual([
      [{ subscriptionType: 'video', groupId: 'video-group' }],
    ])

    await wrapper.get('[data-testid="subscription-hub-membership-video-member"]').trigger('click')
    expect(wrapper.emitted('select-context')).toEqual([
      [{ subscriptionType: 'video', groupId: 'video-group' }],
      [{ subscriptionType: 'video', groupId: 'video-group', membershipId: 'video-member' }],
    ])
  })

  it('toggles types without changing the selected subscription context', async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree,
        activeType: 'podcast',
        activeGroupId: 'podcast-group',
      },
    })

    await wrapper.get('[data-testid="subscription-hub-type-toggle-podcast"]').trigger('click')
    expect(wrapper.emitted('select-context')).toBeUndefined()
    expect(wrapper.get('[data-testid="subscription-hub-type-toggle-podcast"]').attributes('aria-expanded')).toBe('false')

    await wrapper.get('[data-testid="subscription-hub-type-toggle-video"]').trigger('click')
    expect(wrapper.get('[data-testid="subscription-hub-type-toggle-video"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[data-testid="subscription-hub-type-toggle-podcast"]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.emitted('select-context')).toBeUndefined()
  })

  it('keeps group disclosure separate from group selection', async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree,
        activeType: 'podcast',
        activeGroupId: 'podcast-group',
      },
    })

    await wrapper.get('[data-testid="subscription-hub-group-toggle-podcast-group"]').trigger('click')

    expect(wrapper.emitted('select-context')).toBeUndefined()
    expect(wrapper.get('[data-testid="subscription-hub-group-toggle-podcast-group"]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="subscription-hub-membership-podcast-member"]').exists()).toBe(false)
  })

  it('uses a distinct prefix for disclosure panel ids', () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree,
        idPrefix: 'mobile',
      },
    })

    expect(wrapper.get('[data-testid="subscription-hub-type-toggle-podcast"]').attributes('aria-controls')).toBe('mobile-type-panel-podcast')
  })

  it('flattens a single default group into its subscription list', () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree: singleDefaultGroupTree,
        activeType: 'blog',
        activeGroupId: 'blog-default-group',
      },
    })

    expect(wrapper.find('[data-testid="subscription-hub-group-blog-default-group"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="subscription-hub-membership-blog-member-1"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('默认分组')
  })

  it('shows a consistent visual identity and source context for each subscription', async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree: sourceTypeTree,
        activeType: 'blog',
        activeGroupId: 'blog-source-type-group',
      },
    })

    const memberships = wrapper.findAll('.subscription-hub-sidebar__membership')

    expect(memberships.map((membership) => membership.find('.subscription-hub-sidebar__membership-name').text())).toEqual([
      '某个用户',
      '某个频道',
    ])
    expect(memberships.map((membership) => membership.find('.subscription-hub-sidebar__membership-source-type').text())).toEqual([
      '账户',
      '频道',
    ])
    expect(memberships.map((membership) => membership.get('.p-avatar img').attributes('src'))).toEqual([
      'https://cdn.example.com/account.webp',
      'https://cdn.example.com/channel.webp',
    ])

    await wrapper.setProps({ activeType: 'rss', activeGroupId: 'rss-source-type-group' })
    const rssMembership = wrapper.get('[data-testid="subscription-hub-membership-rss-membership"]')
    expect(rssMembership.find('.subscription-hub-sidebar__membership-name').text()).toBe('某个 RSS')
    expect(rssMembership.find('.subscription-hub-sidebar__membership-source-type').text()).toBe('RSS · example.com/feed.xml')
    expect(rssMembership.get('.p-avatar img').attributes('src')).toBe('https://example.com/favicon.ico')
    expect(rssMembership.get('[data-test="subscription-hub-membership-status"]').attributes('aria-label')).toBe('来源异常')
  })

  it('opens unified subscription management from the icon action', async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, { props: { tree } })

    const manageButton = wrapper.get('[data-testid="subscription-hub-manage"]')
    expect(manageButton.attributes('aria-label')).toBe('管理订阅')
    expect(manageButton.text()).toBe('')

    await manageButton.trigger('click')
    expect(wrapper.emitted('manage')).toHaveLength(1)
  })

  it('renders a fixed module type without the type layer', () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree,
        fixedType: 'video',
        activeType: 'video',
        activeGroupId: 'video-group',
      },
    })

    expect(wrapper.findAll('.subscription-hub-sidebar__type-select')).toHaveLength(0)
    expect(wrapper.findAll('.subscription-hub-sidebar__type-toggle')).toHaveLength(0)
    expect(wrapper.text()).toContain('关注频道')
    expect(wrapper.text()).toContain('原子谈话')
    expect(wrapper.text()).not.toContain('常听节目')
  })

  it('keeps an empty fixed module type visible without the type layer', () => {
    const wrapper = mount(SubscriptionHubSidebarTree, {
      props: {
        tree,
        fixedType: 'blog',
        activeType: 'blog',
      },
    })

    expect(wrapper.findAll('.subscription-hub-sidebar__type-select')).toHaveLength(0)
    expect(wrapper.text()).toContain('尚无订阅')
  })
})
