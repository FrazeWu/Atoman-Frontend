import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FeedSourceIdentityCard from '@/components/feed/FeedSourceIdentityCard.vue'
import type { FeedExploreSource } from '@/types'

const source: FeedExploreSource = {
  id: 'source-1',
  title: '少数派',
  rssUrl: 'https://sspai.com/feed',
  category: 'blog',
  subscriptionCount: 128,
  recentItemCount: 6,
  lastPublishedAt: '2026-06-20T08:30:00Z',
  subscribed: false,
  recentItems: [
    { id: 'item-1', title: '近期文章', publishedAt: '2026-06-20T08:30:00Z' },
  ],
}

describe('FeedSourceIdentityCard', () => {
  it('renders feed source identity details, keeps its default test hook, and emits select on row click', async () => {
    const wrapper = mount(FeedSourceIdentityCard, {
      props: {
        source,
        color: 'hsl(12 70% 52%)',
        avatarLabel: '少',
        displayUrl: 'sspai.com/feed',
      },
    })

    expect(wrapper.get('[data-test="feed-source-card"]').element.tagName).toBe('ARTICLE')
    expect(wrapper.get('[data-test="feed-source-card"]').attributes('role')).toBe('button')
    expect((wrapper.vm as any).$options.inheritAttrs).toBe(false)
    expect(wrapper.get('[data-test="feed-source-avatar"]').text()).toContain('少')
    expect(wrapper.get('[data-test="feed-source-title"]').text()).toBe('少数派')
    expect(wrapper.get('[data-test="feed-source-url"]').text()).toBe('sspai.com/feed')
    expect(wrapper.get('[data-test="feed-source-count"]').text()).toContain('128 订阅')
    expect(wrapper.text()).toContain('6 篇近期内容')
    expect(wrapper.text()).toContain('近期文章')
    expect(wrapper.text()).toMatch(/6.*20/)

    await wrapper.get('[data-test="feed-source-card"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[source]])
  })

  it('emits subscribe from the subscribe button without opening the row', async () => {
    const wrapper = mount(FeedSourceIdentityCard, {
      props: {
        source,
        color: 'hsl(12 70% 52%)',
        avatarLabel: '少',
        displayUrl: 'sspai.com/feed',
      },
    })

    expect(wrapper.get('[data-test="feed-source-subscribe"]').text()).toBe('订阅')

    await wrapper.get('[data-test="feed-source-subscribe"]').trigger('click')

    expect(wrapper.emitted('subscribe')).toEqual([[source]])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('disables the subscribe button for subscribed sources', () => {
    const wrapper = mount(FeedSourceIdentityCard, {
      props: {
        source: { ...source, subscribed: true },
        color: 'hsl(12 70% 52%)',
        avatarLabel: '少',
        displayUrl: 'sspai.com/feed',
      },
    })

    expect(wrapper.get('[data-test="feed-source-subscribe"]').text()).toBe('已订阅')
    expect(wrapper.get('[data-test="feed-source-subscribe"]').attributes('disabled')).toBeDefined()
  })

  it('lets a parent override the root data-test hook while forwarding other attrs', async () => {
    const wrapper = mount(FeedSourceIdentityCard, {
      props: {
        source,
        color: 'hsl(12 70% 52%)',
        avatarLabel: '少',
        displayUrl: 'sspai.com/feed',
      },
      attrs: {
        'data-test': 'channel-card',
        'data-parent-hook': 'source-card',
        'aria-label': '打开少数派频道',
      },
    })

    expect(wrapper.find('[data-test="feed-source-card"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="channel-card"]').attributes('aria-label')).toBe('打开少数派频道')
    expect(wrapper.get('[data-test="channel-card"]').attributes('data-parent-hook')).toBe('source-card')
  })

  it('keeps the source title and URL out of uppercase button chrome', () => {
    const wrapper = mount(FeedSourceIdentityCard, {
      props: {
        source: {
          ...source,
          title: 'XXXCLUB',
          rssUrl: 'https://example.com/NodeSeek',
        },
        color: 'hsl(12 70% 52%)',
        avatarLabel: 'X',
        displayUrl: 'example.com/NodeSeek',
      },
    })

    const titleStyle = getComputedStyle(wrapper.get('[data-test="feed-source-title"]').element)
    const urlStyle = getComputedStyle(wrapper.get('[data-test="feed-source-url"]').element)

    expect(titleStyle.textTransform).toBe('none')
    expect(urlStyle.textTransform).toBe('none')
    expect(titleStyle.letterSpacing).toBe('normal')
  })

  it('renders description, compact stats, and recent previews for recommendation cards', () => {
    const wrapper = mount(FeedSourceIdentityCard, {
      props: {
        source,
        color: 'hsl(120 40% 52%)',
        avatarLabel: '少',
        displayUrl: 'sspai.com/feed',
        eyebrow: '热度 94 · 收藏 1.2K · 阅读 8.4K',
        summaryText: '关注模型、工具、应用与研究动态，偏产品落地与工作流实践。',
        metadataText: '每周多次 · 3 天前更新',
        compact: true,
        variant: 'recommend',
      },
    })

    expect(wrapper.text()).toContain('热度 94 · 收藏 1.2K · 阅读 8.4K')
    expect(wrapper.text()).toContain('关注模型、工具、应用与研究动态')
    expect(wrapper.text()).toContain('每周多次 · 3 天前更新')
    expect(wrapper.text()).toContain('近期文章')
  })
})
