import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'

describe('FeedSourceArticlesSheet', () => {
  it('renders source articles and emits subscribe for unsubscribed sources', async () => {
    const wrapper = mount(FeedSourceArticlesSheet, {
      props: {
        show: true,
        source: {
          type: 'external_rss',
          id: 'source-rss-1',
          title: 'Example RSS',
          rssUrl: 'https://example.com/feed.xml',
          subscribed: false,
        },
        items: [
          {
            type: 'feed_item',
            published_at: '2026-06-17T00:00:00Z',
            is_read: false,
            feed_item: {
              id: 'feed-item-1',
              feed_source_id: 'source-rss-1',
              guid: 'guid-1',
              title: '外部文章',
              link: 'https://example.com/article',
              summary: '<p>摘要</p>',
              author: '作者',
              published_at: '2026-06-17T00:00:00Z',
              fetched_at: '2026-06-17T00:00:00Z',
            },
          },
        ],
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot name="header" /><slot /></section>' },
          PEmpty: true,
          PPress: {
            props: ['label'],
            emits: ['click'],
            template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Example RSS')
    expect(wrapper.text()).toContain('外部文章')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('subscribe')).toBeTruthy()
  })

  it('opens a selected article without triggering the source subscribe action', async () => {
    const wrapper = mount(FeedSourceArticlesSheet, {
      props: {
        show: true,
        source: {
          type: 'internal_channel',
          id: 'channel-1',
          title: '思想频道',
          subscriptionId: 'sub-channel-1',
          subscribed: true,
        },
        items: [
          {
            type: 'post',
            published_at: '2026-06-17T00:00:00Z',
            is_read: false,
            post: {
              id: 'post-1',
              user_id: 'user-1',
              title: '内部文章',
              content: '正文',
              summary: '摘要',
              status: 'published',
              visibility: 'public',
              allow_comments: true,
              pinned: false,
              created_at: '2026-06-17T00:00:00Z',
              updated_at: '2026-06-17T00:00:00Z',
            },
          },
        ],
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot name="header" /><slot /></section>' },
          PEmpty: true,
          PPress: true,
        },
      },
    })

    await wrapper.get('[data-test="source-article-row"]').trigger('click')

    expect(wrapper.emitted('open-article')?.[0]?.[0]).toMatchObject({ type: 'post' })
  })
})
