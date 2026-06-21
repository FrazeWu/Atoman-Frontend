import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import ArticleExplorePanel from '@/components/feed/ArticleExplorePanel.vue'
import { useAuthStore } from '@/stores/auth'
import type { FeedItem, TimelineItem } from '@/types'

const feedItem: FeedItem = {
  id: 'feed-item-1',
  guid: 'feed-item-1',
  title: '探索条目',
  link: 'https://example.com/item',
  summary: '摘要',
  author: '作者',
  published_at: '2026-06-16T00:00:00Z',
  fetched_at: '2026-06-16T00:00:00Z',
  feed_source_id: 'source-1',
  feed_source: {
    id: 'source-1',
    title: 'XXXCLUB',
    rss_url: 'https://example.com/rss.xml',
  },
}

const item: TimelineItem = {
  type: 'feed_item',
  feed_item: feedItem,
  published_at: '2026-06-16T00:00:00Z',
  is_read: false,
}

describe('ArticleExplorePanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.isAuthenticated = false
    authStore.token = null
    authStore.user = null
  })

  it('resets the source trigger so the title is not forced into label uppercase styling', () => {
    const wrapper = mount(ArticleExplorePanel, {
      props: {
        items: [item],
        loading: false,
        totalItems: 1,
        page: 1,
        pageSize: 20,
        selectedArticle: null,
        showArticleSheet: false,
        focusedIndex: -1,
        starredIds: new Set<string>(),
        readingListIds: new Set<string>(),
        feedItemSource: () => ({
          type: 'external_rss',
          id: 'source-1',
          title: 'XXXCLUB',
          rssUrl: 'https://example.com/rss.xml',
          subscribed: false,
        }),
        sourceTriggerLabel: (source: { title: string }) => `查看 ${source.title} 的所有文章`,
      },
      global: {
        stubs: {
          PEmpty: true,
          PBadge: true,
          PClip: true,
          FeedTimelineFooter: true,
        },
      },
    })

    const sourceTrigger = wrapper.get('[data-test="feed-source-trigger"]')
    const style = getComputedStyle(sourceTrigger.element)

    expect(sourceTrigger.text()).toBe('XXXCLUB')
    expect(style.textTransform).toBe('none')
    expect(style.letterSpacing).toBe('normal')
  })
})
