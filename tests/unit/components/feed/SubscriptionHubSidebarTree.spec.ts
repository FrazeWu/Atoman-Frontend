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

describe('SubscriptionHubSidebarTree', () => {

  it('keeps empty types visible while opening only the first populated type', () => {
    const wrapper = mount(SubscriptionHubSidebarTree, { props: { tree } })

    expect(wrapper.findAll('.subscription-hub-sidebar__type-select')).toHaveLength(4)
    expect(wrapper.find('[data-testid="subscription-hub-type-toggle-podcast"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[data-testid="subscription-hub-type-toggle-video"]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="subscription-hub-type-blog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="subscription-hub-type-rss"]').exists()).toBe(true)
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

  it('shows an empty state when an empty type is opened', async () => {
    const wrapper = mount(SubscriptionHubSidebarTree, { props: { tree } })

    await wrapper.get('[data-testid="subscription-hub-type-blog"]').trigger('click')

    expect(wrapper.text()).toContain('尚无订阅')
    expect(wrapper.get('[data-testid="subscription-hub-type-toggle-blog"]').attributes('aria-expanded')).toBe('true')
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
})
