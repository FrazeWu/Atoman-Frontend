import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ChannelExplorePanel from '@/components/feed/ChannelExplorePanel.vue'
import type { FeedExploreSource } from '@/types'

const sources: FeedExploreSource[] = [
  {
    id: 'source-1',
    title: '少数派',
    rssUrl: 'https://sspai.com/feed',
    subscriptionCount: 128,
    recentItemCount: 6,
    lastPublishedAt: '2026-06-20T08:30:00Z',
    subscribed: false,
  },
]

const mountPanel = (props?: Partial<InstanceType<typeof ChannelExplorePanel>['$props']>) =>
  mount(ChannelExplorePanel, {
    props: {
      items: [],
      loading: false,
      error: '',
      totalItems: 0,
      page: 1,
      pageSize: 20,
      ...props,
    },
    global: {
      stubs: {
        FeedSourceIdentityCard: {
          props: ['source', 'color', 'avatarLabel', 'displayUrl'],
          emits: ['select'],
          template: `
            <button
              type="button"
              data-test="channel-card"
              :data-source-id="source.id"
              @click="$emit('select', source)"
            >
              {{ source.title }}
            </button>
          `,
        },
        FeedTimelineFooter: {
          props: ['page', 'pageSize', 'total', 'loading'],
          emits: ['change-page'],
          template: `
            <button
              type="button"
              data-test="pagination-forward"
              @click="$emit('change-page', page + 1)"
            >
              next
            </button>
          `,
        },
      },
    },
  })

describe('ChannelExplorePanel', () => {
  it('renders skeletons while loading', () => {
    const wrapper = mountPanel({ loading: true })

    expect(wrapper.findAll('.channel-card-skeleton')).toHaveLength(6)
    expect(wrapper.find('[data-test="channel-card"]').exists()).toBe(false)
  })

  it('emits retry from the error state', async () => {
    const wrapper = mountPanel({ error: '加载失败' })

    expect(wrapper.text()).toContain('加载失败')

    await wrapper.get('.channel-retry-button').trigger('click')

    expect(wrapper.emitted('retry')).toEqual([[]])
  })

  it('renders the empty state message when there are no items', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('暂无可浏览的频道')
  })

  it('renders populated cards and forwards select as open-source', async () => {
    const wrapper = mountPanel({
      items: sources,
      totalItems: 40,
    })

    expect(wrapper.findAll('[data-test="channel-card"]')).toHaveLength(1)

    await wrapper.get('[data-test="channel-card"]').trigger('click')

    expect(wrapper.emitted('open-source')).toEqual([[sources[0]]])
  })

  it('forwards footer page changes', async () => {
    const wrapper = mountPanel({
      items: sources,
      totalItems: 40,
      page: 2,
    })

    await wrapper.get('[data-test="pagination-forward"]').trigger('click')

    expect(wrapper.emitted('change-page')).toEqual([[3]])
  })
})
