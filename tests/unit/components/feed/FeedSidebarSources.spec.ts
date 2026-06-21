import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FeedSidebarSources from '@/components/feed/FeedSidebarSources.vue'
import type { Subscription, SubscriptionGroup } from '@/types'

const groups: SubscriptionGroup[] = [
  {
    id: 'g-tech',
    user_id: 'user-1',
    name: '科技生活',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'g-culture',
    user_id: 'user-1',
    name: '文化生活',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

const subscriptions: Subscription[] = [
  {
    id: 'sub-1',
    user_id: 'user-1',
    feed_source_id: 'source-1',
    title: '少数派',
    subscription_group_id: 'g-tech',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sub-2',
    user_id: 'user-1',
    feed_source_id: 'source-2',
    title: '英格兰周报',
    subscription_group_id: 'g-culture',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sub-3',
    user_id: 'user-1',
    feed_source_id: 'source-3',
    feed_source: {
      id: 'source-3',
      source_type: 'external_rss',
      rss_url: 'https://example.com/rss.xml',
      hash: 'source-3-hash',
      title: '未分类来源',
      created_at: '2026-01-01T00:00:00Z',
    },
    created_at: '2026-01-01T00:00:00Z',
  },
]

describe('FeedSidebarSources', () => {
  it('renders grouped and unassigned sources with active state', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: {
        subscriptions,
        groups,
        activeSourceId: 'sub-2',
      },
    })

    expect(wrapper.text()).toContain('订阅源类别 / SOURCES')
    expect(wrapper.text()).toContain('科技生活')
    expect(wrapper.text()).toContain('文化生活')
    expect(wrapper.text()).toContain('少数派')
    expect(wrapper.text()).toContain('英格兰周报')
    expect(wrapper.text()).toContain('未分类来源')
    expect(wrapper.text()).toContain('未分类')
    expect(wrapper.get('[data-source-id="sub-2"]').classes()).toContain('is-active')
    expect(wrapper.find('.feed-sidebar-sources__count').exists()).toBe(false)
  })

  it('falls back to feed source title when subscription title is missing', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: {
        subscriptions: [
          {
            id: 'sub-with-source-title',
            user_id: 'user-1',
            feed_source_id: 'source-with-title',
            feed_source: {
              id: 'source-with-title',
              source_type: 'external_rss',
              rss_url: 'https://example.com/feed.xml',
              hash: 'source-with-title-hash',
              title: '源标题',
              created_at: '2026-01-01T00:00:00Z',
            },
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        groups: [],
      },
    })

    expect(wrapper.text()).toContain('源标题')
    expect(wrapper.text()).not.toContain('未命名订阅')
  })

  it('falls back to feed source title when subscription title is just the rss url', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: {
        subscriptions: [
          {
            id: 'sub-with-url-title',
            user_id: 'user-1',
            feed_source_id: 'source-with-url-title',
            title: 'https://feeds.acast.com/public/shows/68004395b4ef799a7a410371',
            feed_source: {
              id: 'source-with-url-title',
              source_type: 'external_rss',
              rss_url: 'https://feeds.acast.com/public/shows/68004395b4ef799a7a410371',
              hash: 'source-with-url-title-hash',
              title: 'Acast Show Name',
              created_at: '2026-01-01T00:00:00Z',
            },
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        groups: [],
      },
    })

    expect(wrapper.text()).toContain('Acast Show Name')
    expect(wrapper.text()).not.toContain('https://feeds.acast.com/public/shows/68004395b4ef799a7a410371')
  })

  it('renders subscriptions with missing groups under unassigned group', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: {
        subscriptions: [
          {
            id: 'sub-missing-group',
            user_id: 'user-1',
            feed_source_id: 'source-missing-group',
            title: '孤立订阅源',
            subscription_group_id: 'g-missing',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        groups: [],
      },
    })

    expect(wrapper.text()).toContain('未分类')
    expect(wrapper.text()).toContain('孤立订阅源')
  })

  it('renders empty state when subscriptions are empty', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: {
        subscriptions: [],
        groups,
      },
    })

    expect(wrapper.text()).toContain('暂无订阅源')
    expect(wrapper.find('.feed-sidebar-sources__groups').exists()).toBe(false)
  })

  it('classifies lowercase newsletter subscriptions as weekly reports', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: {
        subscriptions: [
          {
            id: 'sub-newsletter',
            user_id: 'user-1',
            feed_source_id: 'source-newsletter',
            title: 'frontend newsletter',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        groups: [],
      },
    })

    expect(wrapper.get('.feed-sidebar-sources__badge').text()).toBe('周报')
  })

  it('emits source selection and manage events', async () => {
    const wrapper = mount(FeedSidebarSources, {
      props: {
        subscriptions,
        groups,
        activeSourceId: 'sub-2',
      },
    })

    await wrapper.get('[data-source-id="sub-1"]').trigger('click')
    await wrapper.get('[data-testid="feed-sidebar-manage"]').trigger('click')

    expect(wrapper.emitted('select-source')).toEqual([['sub-1']])
    expect(wrapper.emitted('manage')).toEqual([[]])
  })

  it('hides source content when collapsed', () => {
    const wrapper = mount(FeedSidebarSources, {
      props: {
        subscriptions,
        groups,
        collapsed: true,
      },
    })

    expect(wrapper.get('.feed-sidebar-sources').classes()).toContain('is-collapsed')
    expect(wrapper.text()).not.toContain('少数派')
  })
})
