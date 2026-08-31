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

describe('SubscriptionHubSidebarTree', () => {
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
    expect(wrapper.text()).toContain('关注频道')
    expect(wrapper.findAll('.subscription-hub-sidebar__membership').length).toBe(2)
    expect(wrapper.text()).not.toContain('全部订阅')
  })

  it('selects a type default group and a leaf with their isolated context', async () => {
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
})
