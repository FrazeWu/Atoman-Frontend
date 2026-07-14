import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import FeedSourceArticlesSheet from '@/components/feed/FeedSourceArticlesSheet.vue'

describe('FeedSourceArticlesSheet', () => {
  it('renders a branded source header and emits subscribe for unsubscribed sources', async () => {
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

    expect(wrapper.get('[data-test="feed-source-avatar"]').text()).toContain('E')
    expect(wrapper.get('[data-test="feed-source-title"]').text()).toContain('Example RSS')
    expect(wrapper.get('[data-test="feed-source-url"]').text()).toContain('https://example.com/feed.xml')
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

  it('filters source articles by a local search query and shows source status metadata', async () => {
    const wrapper = mount(FeedSourceArticlesSheet, {
      props: {
        show: true,
        source: {
          type: 'external_rss',
          id: 'source-rss-2',
          title: 'Deep Research Feed',
          rssUrl: 'https://example.com/research.xml',
          subscribed: true,
          healthStatus: 'healthy',
          lastCheckedAt: '2026-06-17T08:30:00Z',
          itemCount: 2,
        } as any,
        items: [
          {
            type: 'feed_item',
            published_at: '2026-06-17T00:00:00Z',
            is_read: false,
            feed_item: {
              id: 'feed-item-search-1',
              feed_source_id: 'source-rss-2',
              guid: 'guid-search-1',
              title: 'AI Weekly',
              link: 'https://example.com/ai',
              summary: '关于模型和推理',
              author: '作者',
              published_at: '2026-06-17T00:00:00Z',
              fetched_at: '2026-06-17T00:00:00Z',
            },
          },
          {
            type: 'feed_item',
            published_at: '2026-06-16T00:00:00Z',
            is_read: false,
            feed_item: {
              id: 'feed-item-search-2',
              feed_source_id: 'source-rss-2',
              guid: 'guid-search-2',
              title: 'Design Systems',
              link: 'https://example.com/design',
              summary: '关于组件库',
              author: '作者',
              published_at: '2026-06-16T00:00:00Z',
              fetched_at: '2026-06-16T00:00:00Z',
            },
          },
        ],
      },
      global: {
        stubs: {
          PSheet: { template: '<section><slot name="header" /><slot /></section>' },
          PEmpty: { props: ['title', 'description'], template: '<div class="p-empty">{{ title }} {{ description }}</div>' },
          PPress: true,
        },
      },
    })

    expect(wrapper.text()).toContain('状态正常')
    expect(wrapper.text()).toContain('共 2 篇')
    expect(wrapper.text()).toContain('2026-06-17')

    await wrapper.get('[data-test="source-search-input"]').setValue('AI')

    expect(wrapper.text()).toContain('AI Weekly')
    expect(wrapper.text()).not.toContain('Design Systems')
  })

  it('supports local sorting for source articles', async () => {
    const wrapper = mount(FeedSourceArticlesSheet, {
      props: {
        show: true,
        source: {
          type: 'external_rss',
          id: 'source-rss-3',
          title: 'Sortable Feed',
          rssUrl: 'https://example.com/sort.xml',
          subscribed: true,
        },
        items: [
          {
            type: 'feed_item',
            published_at: '2026-06-17T00:00:00Z',
            is_read: false,
            feed_item: {
              id: 'feed-item-sort-1',
              feed_source_id: 'source-rss-3',
              guid: 'guid-sort-1',
              title: 'Zulu Entry',
              link: 'https://example.com/zulu',
              summary: '摘要',
              author: '作者',
              published_at: '2026-06-17T00:00:00Z',
              fetched_at: '2026-06-17T00:00:00Z',
            },
          },
          {
            type: 'feed_item',
            published_at: '2026-06-15T00:00:00Z',
            is_read: false,
            feed_item: {
              id: 'feed-item-sort-2',
              feed_source_id: 'source-rss-3',
              guid: 'guid-sort-2',
              title: 'Alpha Entry',
              link: 'https://example.com/alpha',
              summary: '摘要',
              author: '作者',
              published_at: '2026-06-15T00:00:00Z',
              fetched_at: '2026-06-15T00:00:00Z',
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

    const initialTitles = wrapper.findAll('[data-test="source-article-row"]').map((node) => node.text())
    expect(initialTitles[0]).toContain('Zulu Entry')

    await wrapper.get('[data-test="source-sort-select"]').setValue('oldest')

    const sortedTitles = wrapper.findAll('[data-test="source-article-row"]').map((node) => node.text())
    expect(sortedTitles[0]).toContain('Alpha Entry')
  })

  it('estimates source update cadence from recent article timestamps', () => {
    const wrapper = mount(FeedSourceArticlesSheet, {
      props: {
        show: true,
        source: {
          type: 'external_rss',
          id: 'source-rss-4',
          title: 'Cadence Feed',
          rssUrl: 'https://example.com/cadence.xml',
          subscribed: true,
        },
        items: [
          {
            type: 'feed_item',
            published_at: '2026-06-17T00:00:00Z',
            is_read: false,
            feed_item: {
              id: 'feed-item-cadence-1',
              feed_source_id: 'source-rss-4',
              guid: 'guid-cadence-1',
              title: '第一篇',
              link: 'https://example.com/1',
              summary: '摘要',
              author: '作者',
              published_at: '2026-06-17T00:00:00Z',
              fetched_at: '2026-06-17T00:00:00Z',
            },
          },
          {
            type: 'feed_item',
            published_at: '2026-06-15T00:00:00Z',
            is_read: false,
            feed_item: {
              id: 'feed-item-cadence-2',
              feed_source_id: 'source-rss-4',
              guid: 'guid-cadence-2',
              title: '第二篇',
              link: 'https://example.com/2',
              summary: '摘要',
              author: '作者',
              published_at: '2026-06-15T00:00:00Z',
              fetched_at: '2026-06-15T00:00:00Z',
            },
          },
          {
            type: 'feed_item',
            published_at: '2026-06-13T00:00:00Z',
            is_read: false,
            feed_item: {
              id: 'feed-item-cadence-3',
              feed_source_id: 'source-rss-4',
              guid: 'guid-cadence-3',
              title: '第三篇',
              link: 'https://example.com/3',
              summary: '摘要',
              author: '作者',
              published_at: '2026-06-13T00:00:00Z',
              fetched_at: '2026-06-13T00:00:00Z',
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

    expect(wrapper.text()).toContain('约每 2 天更新一次')
  })
})
